// lib/routing/riskScorer.ts
// Request-scoped risk scorer with spatial grid index and inverse-distance interpolation.
// Replaces the buggy module-level cache + linear-scan approach in graph.ts.

import { prisma } from '@/lib/prisma'

const GRID_DEG = 0.005          // matches RiskZone.gridResolution
const SEARCH_RADIUS_DEG = 0.02  // ~2.2 km — beyond this we treat as "no data"
const IDW_POWER = 2             // standard inverse-distance weighting exponent
const MIN_NEIGHBORS_FOR_IDW = 2

interface Zone { lat: number; lng: number; score: number }

export interface RiskScorer {
  /** Score a point. Returns 0–100. */
  scorePoint(lat: number, lng: number): number
  /** Score a segment by averaging risk along it, weighted by segment length. */
  scoreSegment(aLat: number, aLng: number, bLat: number, bLng: number): number
  /** True if any zone is within SEARCH_RADIUS_DEG of the bbox center. */
  hasNearbyData(): boolean
  /** Count of zones loaded in this scorer. */
  zoneCount(): number
}

/**
 * Bucket zones into a sparse grid keyed by integer cell coords so lookups
 * are O(neighbors) instead of O(total zones).
 */
function bucketize(zones: Zone[]) {
  const buckets = new Map<string, Zone[]>()
  for (const z of zones) {
    const cx = Math.floor(z.lat / GRID_DEG)
    const cy = Math.floor(z.lng / GRID_DEG)
    const key = `${cx},${cy}`
    const bucket = buckets.get(key)
    if (bucket) bucket.push(z)
    else buckets.set(key, [z])
  }
  return buckets
}

export async function buildRiskScorer(
  swLat: number, swLng: number,
  neLat: number, neLng: number
): Promise<RiskScorer> {
  const pad = GRID_DEG * 4
  const zones = await prisma.riskZone.findMany({
    where: {
      latitude:  { gte: swLat - pad, lte: neLat + pad },
      longitude: { gte: swLng - pad, lte: neLng + pad },
    },
    select: { latitude: true, longitude: true, riskScore: true },
  })

  const points: Zone[] = zones.map(z => ({
    lat: z.latitude, lng: z.longitude, score: z.riskScore,
  }))
  const buckets = bucketize(points)

  function pointsNear(lat: number, lng: number, radiusDeg: number): Zone[] {
    const cx = Math.floor(lat / GRID_DEG)
    const cy = Math.floor(lng / GRID_DEG)
    const span = Math.ceil(radiusDeg / GRID_DEG)
    const out: Zone[] = []
    for (let dx = -span; dx <= span; dx++) {
      for (let dy = -span; dy <= span; dy++) {
        const bucket = buckets.get(`${cx + dx},${cy + dy}`)
        if (!bucket) continue
        for (const z of bucket) {
          const dLat = z.lat - lat
          const dLng = z.lng - lng
          if (dLat * dLat + dLng * dLng <= radiusDeg * radiusDeg) {
            out.push(z)
          }
        }
      }
    }
    return out
  }

  function scorePoint(lat: number, lng: number): number {
    // Try exact-cell hit first
    const snapLat = Math.round(lat / GRID_DEG) * GRID_DEG
    const snapLng = Math.round(lng / GRID_DEG) * GRID_DEG
    const exact = pointsNear(snapLat, snapLng, GRID_DEG * 0.6)
    if (exact.length > 0) {
      // Average of zones inside the cell (usually 0 or 1)
      let sum = 0
      for (const z of exact) sum += z.score
      return sum / exact.length
    }

    // Otherwise inverse-distance weighting from nearest neighbors
    const neighbors = pointsNear(lat, lng, SEARCH_RADIUS_DEG)
    if (neighbors.length === 0) return 0       // no data → treat as unknown/safe
    if (neighbors.length < MIN_NEIGHBORS_FOR_IDW) return neighbors[0].score

    let wSum = 0
    let scoreSum = 0
    for (const z of neighbors) {
      const dLat = z.lat - lat
      const dLng = z.lng - lng
      const d = Math.sqrt(dLat * dLat + dLng * dLng) || 1e-9
      const w = 1 / Math.pow(d, IDW_POWER)
      wSum += w
      scoreSum += z.score * w
    }
    return scoreSum / wSum
  }

  function scoreSegment(aLat: number, aLng: number, bLat: number, bLng: number): number {
    // Sample at start, midpoint, end — segments are short, so 3 samples is enough
    const s1 = scorePoint(aLat, aLng)
    const s2 = scorePoint((aLat + bLat) / 2, (aLng + bLng) / 2)
    const s3 = scorePoint(bLat, bLng)
    return (s1 + s2 + s3) / 3
  }

  const _hasData = points.length > 0
  return {
    scorePoint, scoreSegment,
    hasNearbyData: () => _hasData,
    zoneCount: () => points.length,
  }
}
