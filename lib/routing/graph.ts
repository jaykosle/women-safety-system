// lib/routing/graph.ts
import { prisma } from '@/lib/prisma'

export interface Node {
  id: string
  lat: number
  lng: number
}

export interface Edge {
  from: string
  to: string
  distance: number    // metres
  riskScore: number   // 0–100
}

export interface Graph {
  nodes: Map<string, Node>
  adjacency: Map<string, Edge[]>
}

const GRID = 0.005

export function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sl = Math.sin(dLat / 2), sn = Math.sin(dLng / 2)
  const c = sl * sl + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sn * sn
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c))
}

// In-memory risk cache — populated by prefetchRiskZones before segment scoring
const riskCache = new Map<string, number>()

function snapGrid(v: number): number {
  return Math.round(Math.round(v / GRID) * GRID * 100000) / 100000
}

export async function prefetchRiskZones(
  swLat: number, swLng: number,
  neLat: number, neLng: number
): Promise<void> {
  const pad = GRID * 2
  const zones = await prisma.riskZone.findMany({
    where: {
      latitude:  { gte: swLat - pad, lte: neLat + pad },
      longitude: { gte: swLng - pad, lte: neLng + pad },
    },
    select: { latitude: true, longitude: true, riskScore: true }
  })
  for (const z of zones) {
    riskCache.set(`${z.latitude},${z.longitude}`, z.riskScore)
  }
}

export function getSegmentRiskSync(
  aLat: number, aLng: number,
  bLat: number, bLng: number
): number {
  const midLat = snapGrid((aLat + bLat) / 2)
  const midLng = snapGrid((aLng + bLng) / 2)

  // Check exact cell first
  const exact = riskCache.get(`${midLat},${midLng}`)
  if (exact !== undefined) return exact

  // Search nearby cells in cache
  let best = 10   // baseline low risk
  let bestDist = Infinity
  for (const [key, score] of riskCache.entries()) {
    const [cLat, cLng] = key.split(',').map(Number)
    const d = Math.abs(cLat - midLat) + Math.abs(cLng - midLng)
    if (d < GRID * 3 && d < bestDist) {
      bestDist = d
      best = score
    }
  }
  return best
}

export async function buildGraph(
  startLat: number, startLng: number,
  endLat: number, endLng: number
): Promise<Graph> {
  // OSRM alternatives=3 gives up to 3 different road paths
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${startLng},${startLat};${endLng},${endLat}` +
    `?steps=true&geometries=geojson&overview=full&alternatives=3`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`OSRM error ${res.status}`)
  const data = await res.json()
  if (!data.routes?.length) throw new Error('OSRM returned no routes')

  // Collect bounding box of ALL alternative routes
  const allCoords: [number, number][] = data.routes.flatMap((r: any) =>
    r.geometry.coordinates
  )
  const lats = allCoords.map(([, lat]: [number, number]) => lat)
  const lngs = allCoords.map(([lng]: [number, number]) => lng)

  // ONE DB query to prefetch all risk zones in the area
  await prefetchRiskZones(
    Math.min(...lats), Math.min(...lngs),
    Math.max(...lats), Math.max(...lngs)
  )

  const nodes = new Map<string, Node>()
  const adjacency = new Map<string, Edge[]>()
  const edgeSet = new Set<string>()

  function addEdge(edge: Edge) {
    const fwd = `${edge.from}->${edge.to}`
    const bwd = `${edge.to}->${edge.from}`
    if (edgeSet.has(fwd)) return
    edgeSet.add(fwd); edgeSet.add(bwd)

    if (!adjacency.has(edge.from)) adjacency.set(edge.from, [])
    adjacency.get(edge.from)!.push(edge)
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, [])
    adjacency.get(edge.to)!.push({ ...edge, from: edge.to, to: edge.from })
  }

  // Build graph from ALL route alternatives — gives Dijkstra real choices
  for (const route of data.routes) {
    for (const leg of route.legs) {
      for (const step of leg.steps) {
        const coords: [number, number][] = step.geometry.coordinates
        for (let i = 0; i < coords.length - 1; i++) {
          const [aLng, aLat] = coords[i]
          const [bLng, bLat] = coords[i + 1]
          const aId = `${aLat.toFixed(5)},${aLng.toFixed(5)}`
          const bId = `${bLat.toFixed(5)},${bLng.toFixed(5)}`
          nodes.set(aId, { id: aId, lat: aLat, lng: aLng })
          nodes.set(bId, { id: bId, lat: bLat, lng: bLng })
          const distance  = haversineDistance({ lat: aLat, lng: aLng }, { lat: bLat, lng: bLng })
          const riskScore = getSegmentRiskSync(aLat, aLng, bLat, bLng)
          addEdge({ from: aId, to: bId, distance, riskScore })
        }
      }
    }
  }

  return { nodes, adjacency }
}

export function findNearestNode(lat: number, lng: number, nodes: Map<string, Node>): Node {
  let best: Node | null = null
  let bestDist = Infinity
  for (const node of nodes.values()) {
    const d = haversineDistance({ lat, lng }, { lat: node.lat, lng: node.lng })
    if (d < bestDist) { bestDist = d; best = node }
  }
  if (!best) throw new Error('Empty graph')
  return best
}