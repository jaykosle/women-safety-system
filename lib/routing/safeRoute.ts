// lib/routing/safeRoute.ts
// Penalty-based re-routing safe-route engine.
//
// Strategy:
//   1. Get OSRM primary route (= shortest).
//   2. Score risk along it with the request-scoped RiskScorer.
//   3. Find the N riskiest segments along the primary.
//   4. For each, generate a detour waypoint offset perpendicular to the road segment.
//   5. Query OSRM start→waypoint→end in parallel for each detour.
//   6. Score each candidate by cost = (1-α)·distNorm + α·riskNorm and pick the best as "safe".
//   7. If the best candidate isn't meaningfully safer, return primary as both
//      (UI surfaces "already optimal" message via the `differs` flag).

import { buildRiskScorer, RiskScorer } from './riskScorer'

// Tuned for city-scale routes (5–30 km). Hotspots in cities are typically
// neighborhoods 1–5 km wide, so detour offsets need to clear them but not
// suggest absurdly long alternatives.
const RISKY_SEGMENTS_TO_DETOUR = 2          // top-N risky segments to detour around
const RISK_IMPROVEMENT_THRESHOLD = 5        // ≥5 pts lower avg risk to qualify as "different"
const CRITICAL_RISK = 70                    // segments with risk ≥ this are flagged "critical"
const HIGH_RISK = 50                        // segments with risk ≥ this are flagged "high"
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

/** Offset distance scales with route length so we clear realistic hotspot sizes. */
function detourOffsets(routeDistanceKm: number): { near: number; far: number } {
  return {
    near: Math.max(1.5, Math.min(routeDistanceKm * 0.12, 5)),
    far:  Math.max(3.0, Math.min(routeDistanceKm * 0.25, 10)),
  }
}

/** When the user wants safety (α > 0.6), allow longer detours; otherwise stay close. */
function maxDistanceFactor(alpha: number): number {
  return alpha > 0.6 ? 1.8 : 1.4
}

export interface RoutePoint { lat: number; lng: number }

export interface RouteResult {
  path: RoutePoint[]
  totalDistance: number      // metres
  avgRiskScore: number       // 0–100
  peakRiskScore: number      // worst single-segment risk along the path
  criticalDistanceM: number  // total length of segments with risk ≥ CRITICAL_RISK
  highDistanceM: number      // total length of segments with risk ≥ HIGH_RISK
  geojson: object
}

export interface RoutesResponse {
  safe: RouteResult
  short: RouteResult
  differs: boolean
  safetyImprovementPct: number   // (shortRisk - safeRisk) / shortRisk * 100, ≥ 0
  distancePenaltyPct: number     // (safeDist - shortDist) / shortDist * 100, ≥ 0
  lowDataCoverage: boolean
  candidatesEvaluated: number
  /** True if the safe route is still dangerous (peak ≥ CRITICAL_RISK or critical% ≥ 30). */
  dangerousRouteUnavoidable: boolean
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function haversine(a: RoutePoint, b: RoutePoint): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

/** Move `from` by `distKm` along bearing perpendicular to `(from→to)`, on side ±1. */
function perpendicularOffset(from: RoutePoint, to: RoutePoint, distKm: number, side: 1 | -1): RoutePoint {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI

  // Bearing from→to
  const φ1 = toRad(from.lat), φ2 = toRad(to.lat)
  const Δλ = toRad(to.lng - from.lng)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const bearing = Math.atan2(y, x)

  // Rotate 90° to either side
  const perpBearing = bearing + (side * Math.PI / 2)

  // Destination point from midpoint along perpBearing for distKm
  const midLat = (from.lat + to.lat) / 2
  const midLng = (from.lng + to.lng) / 2
  const φ = toRad(midLat)
  const λ = toRad(midLng)
  const δ = distKm / R

  const φ3 = Math.asin(Math.sin(φ) * Math.cos(δ) + Math.cos(φ) * Math.sin(δ) * Math.cos(perpBearing))
  const λ3 = λ + Math.atan2(
    Math.sin(perpBearing) * Math.sin(δ) * Math.cos(φ),
    Math.cos(δ) - Math.sin(φ) * Math.sin(φ3)
  )

  return { lat: toDeg(φ3), lng: ((toDeg(λ3) + 540) % 360) - 180 }
}

// ── OSRM helpers ──────────────────────────────────────────────────────────────

async function osrmRoute(points: RoutePoint[]): Promise<{
  coords: [number, number][]   // [lng, lat]
  distance: number             // metres
} | null> {
  const coordStr = points.map(p => `${p.lng},${p.lat}`).join(';')
  const url = `${OSRM_BASE}/${coordStr}?geometries=geojson&overview=full`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return null
    return { coords: route.geometry.coordinates, distance: route.distance }
  } catch {
    return null
  }
}

function coordsToPath(coords: [number, number][]): RoutePoint[] {
  return coords.map(([lng, lat]) => ({ lat, lng }))
}

function pathToGeoJSON(path: RoutePoint[]): object {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: path.map(p => [p.lng, p.lat]) },
    properties: {},
  }
}

// ── Route scoring ─────────────────────────────────────────────────────────────

interface PathRisk {
  avg: number
  peak: number
  criticalM: number
  highM: number
}

/**
 * One-pass scoring: distance-weighted average, peak segment risk, and the total
 * length of segments above the high/critical thresholds.
 */
function scorePath(path: RoutePoint[], scorer: RiskScorer): PathRisk {
  if (path.length < 2) return { avg: 0, peak: 0, criticalM: 0, highM: 0 }
  let weightedSum = 0
  let totalLen = 0
  let peak = 0
  let criticalM = 0
  let highM = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]
    const len = haversine(a, b)
    if (len < 1) continue
    const r = scorer.scoreSegment(a.lat, a.lng, b.lat, b.lng)
    weightedSum += r * len
    totalLen += len
    if (r > peak) peak = r
    if (r >= CRITICAL_RISK) criticalM += len
    else if (r >= HIGH_RISK) highM += len
  }
  return {
    avg: totalLen > 0 ? weightedSum / totalLen : 0,
    peak, criticalM, highM,
  }
}

interface ScoredSegment { idx: number; mid: RoutePoint; len: number; risk: number }

function topRiskySegments(path: RoutePoint[], scorer: RiskScorer, n: number): ScoredSegment[] {
  const segs: ScoredSegment[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]
    const len = haversine(a, b)
    if (len < 30) continue
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }
    const risk = scorer.scoreSegment(a.lat, a.lng, b.lat, b.lng)
    segs.push({ idx: i, mid, len, risk })
  }
  // Sort by risk × length (greatest exposure first), spread them out so we don't
  // pick 4 consecutive segments in the same hotspot.
  segs.sort((x, y) => (y.risk * y.len) - (x.risk * x.len))
  const picked: ScoredSegment[] = []
  const MIN_SEPARATION = Math.max(1, Math.floor(path.length / (n * 2)))
  for (const s of segs) {
    if (picked.every(p => Math.abs(p.idx - s.idx) >= MIN_SEPARATION)) {
      picked.push(s)
      if (picked.length >= n) break
    }
  }
  return picked
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function computeRoutes(
  startLat: number, startLng: number,
  endLat: number, endLng: number,
  alpha = 0.6
): Promise<RoutesResponse> {
  const start: RoutePoint = { lat: startLat, lng: startLng }
  const end:   RoutePoint = { lat: endLat,   lng: endLng }

  // Step 1: OSRM primary = the shortest route
  const primary = await osrmRoute([start, end])
  if (!primary) throw new Error('OSRM did not return a primary route')
  const shortPath = coordsToPath(primary.coords)
  const shortDist = primary.distance
  const shortDistKm = shortDist / 1000

  // Step 2: build risk scorer for the area covered by the primary corridor.
  // Pad bbox proportional to route length so the scorer also covers the
  // alternative detour corridors that lie beyond the direct route.
  const lats = shortPath.map(p => p.lat)
  const lngs = shortPath.map(p => p.lng)
  const padDeg = Math.max(0.03, shortDistKm * 0.005)
  const scorer = await buildRiskScorer(
    Math.min(...lats) - padDeg, Math.min(...lngs) - padDeg,
    Math.max(...lats) + padDeg, Math.max(...lngs) + padDeg
  )
  const shortRisk = scorePath(shortPath, scorer)

  function asResult(path: RoutePoint[], dist: number, risk: PathRisk): RouteResult {
    return {
      path, totalDistance: dist,
      avgRiskScore: risk.avg,
      peakRiskScore: risk.peak,
      criticalDistanceM: risk.criticalM,
      highDistanceM: risk.highM,
      geojson: pathToGeoJSON(path),
    }
  }

  // No risk data nearby → can't meaningfully detour
  if (!scorer.hasNearbyData() || shortRisk.avg < 5) {
    const result = asResult(shortPath, shortDist, shortRisk)
    return {
      safe: result, short: result,
      differs: false,
      safetyImprovementPct: 0,
      distancePenaltyPct: 0,
      lowDataCoverage: !scorer.hasNearbyData(),
      candidatesEvaluated: 0,
      dangerousRouteUnavoidable: false,
    }
  }

  // Step 3+4: find risky segments, generate detour waypoints.
  // For each risky segment: 2 sides × 2 offset radii = 4 candidates.
  // We pick the top RISKY_SEGMENTS_TO_DETOUR (=2) segments → 8 total OSRM calls.
  const risky = topRiskySegments(shortPath, scorer, RISKY_SEGMENTS_TO_DETOUR)
  const { near, far } = detourOffsets(shortDistKm)
  const waypoints: RoutePoint[] = []
  for (const seg of risky) {
    const a = shortPath[seg.idx]
    const b = shortPath[seg.idx + 1]
    for (const offset of [near, far]) {
      waypoints.push(perpendicularOffset(a, b, offset,  1))
      waypoints.push(perpendicularOffset(a, b, offset, -1))
    }
  }

  // Step 5: query OSRM for each detour in parallel
  const detourResults = await Promise.all(
    waypoints.map(wp => osrmRoute([start, wp, end]))
  )

  // Step 6: score each candidate; pick the best by alpha-weighted cost
  type Candidate = { path: RoutePoint[]; dist: number; risk: PathRisk; cost: number }
  const candidates: Candidate[] = []
  // Primary as baseline
  candidates.push({
    path: shortPath, dist: shortDist, risk: shortRisk,
    cost: combinedCost(shortDist, shortRisk.avg, shortDist, alpha),
  })

  const distCap = shortDist * maxDistanceFactor(alpha)
  // Track which paths we've already added to dedupe near-identical OSRM responses
  const seenSignatures = new Set<string>()
  for (const r of detourResults) {
    if (!r) continue
    if (r.distance > distCap) continue
    const path = coordsToPath(r.coords)
    const sig = pathSignature(path)
    if (seenSignatures.has(sig)) continue
    seenSignatures.add(sig)
    const risk = scorePath(path, scorer)
    candidates.push({
      path, dist: r.distance, risk,
      cost: combinedCost(r.distance, risk.avg, shortDist, alpha),
    })
  }

  candidates.sort((a, b) => a.cost - b.cost)
  const best = candidates[0]

  // Step 7: did we improve enough to call it a different route?
  const safetyImprovement = shortRisk.avg - best.risk.avg
  const differs =
    best.path !== shortPath
    && safetyImprovement >= RISK_IMPROVEMENT_THRESHOLD

  const safePath = differs ? best.path : shortPath
  const safeDist = differs ? best.dist : shortDist
  const safeRisk = differs ? best.risk : shortRisk

  // Flag a route as "dangerously unavoidable" when it passes through critical
  // zones AND we couldn't find a meaningfully safer alternative.
  const criticalPct = safeDist > 0 ? (safeRisk.criticalM / safeDist) * 100 : 0
  const dangerousRouteUnavoidable =
    !differs && (safeRisk.peak >= CRITICAL_RISK || criticalPct >= 30)

  return {
    safe: asResult(safePath, safeDist, safeRisk),
    short: asResult(shortPath, shortDist, shortRisk),
    differs,
    safetyImprovementPct: shortRisk.avg > 0
      ? Math.max(0, ((shortRisk.avg - safeRisk.avg) / shortRisk.avg) * 100)
      : 0,
    distancePenaltyPct: shortDist > 0
      ? Math.max(0, ((safeDist - shortDist) / shortDist) * 100)
      : 0,
    lowDataCoverage: false,
    candidatesEvaluated: candidates.length - 1,    // exclude primary
    dangerousRouteUnavoidable,
  }
}

/** Coarse fingerprint of a path so we can drop near-duplicate OSRM responses. */
function pathSignature(path: RoutePoint[]): string {
  if (path.length === 0) return ''
  const step = Math.max(1, Math.floor(path.length / 8))
  const samples: string[] = []
  for (let i = 0; i < path.length; i += step) {
    samples.push(`${path[i].lat.toFixed(2)},${path[i].lng.toFixed(2)}`)
  }
  return samples.join('|')
}

/**
 * Combined cost: blend normalized distance and risk-weighted distance.
 * - Distance is normalized against the shortest route's distance so it's unit-free.
 * - Risk component is weighted by distance so longer risky stretches penalize more.
 */
function combinedCost(distM: number, avgRisk: number, baselineDistM: number, alpha: number): number {
  const distNorm = distM / baselineDistM       // 1.0 = same as shortest, 1.4 = 40% longer
  const riskNorm = (avgRisk / 100) * distNorm  // longer + riskier compounds
  return (1 - alpha) * distNorm + alpha * riskNorm * 2
  // The ×2 multiplier on the risk term gives risk meaningful sway at α=0.5+.
  // Without it the safe route only diverges when risk-vs-distance tradeoff is
  // extreme, which defeats the whole feature.
}
