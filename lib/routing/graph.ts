//lib/routing/graph.ts
import { prisma } from '@/lib/prisma'

export interface Node {
  id: string
  lat: number
  lng: number
}

export interface Edge {
  from: string
  to: string
  distance: number   // metres
  riskScore: number  // 0–100
}

export interface Graph {
  nodes: Map<string, Node>
  adjacency: Map<string, Edge[]>
}

const SEVERITY_WEIGHTS: Record<string, number> = {
  LOW: 1, MEDIUM: 2, HIGH: 4, CRITICAL: 6
}
const NIGHT_MULTIPLIER = 1.4
const RADIUS_DEG = 0.003 // ~300m

// Haversine distance in metres between two lat/lng points
export function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const c =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c))
}

export async function computeSegmentRisk(
  startLat: number, startLng: number,
  endLat: number, endLng: number
): Promise<number> {
  const midLat = (startLat + endLat) / 2
  const midLng = (startLng + endLng) / 2

  const crimes = await prisma.crimeRecord.findMany({
    where: {
      latitude:  { gte: midLat - RADIUS_DEG, lte: midLat + RADIUS_DEG },
      longitude: { gte: midLng - RADIUS_DEG, lte: midLng + RADIUS_DEG }
    }
  })

  if (crimes.length === 0) return 10

  let totalWeight = 0
  for (const crime of crimes) {
    let w = (SEVERITY_WEIGHTS[crime.severity] ?? 1) * crime.caseCount
    if (crime.timeOfDay === 'NIGHT' || crime.timeOfDay === 'EVENING') {
      w *= NIGHT_MULTIPLIER
    }
    totalWeight += w
  }

  return Math.min(100, totalWeight * 2)
}

// Fetch road network from OSRM and build a weighted graph
export async function buildGraph(
  startLat: number, startLng: number,
  endLat: number, endLng: number
): Promise<Graph> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${startLng},${startLat};${endLng},${endLat}` +
    `?steps=true&geometries=geojson&overview=full&annotations=true`

  const res = await fetch(url)
  if (!res.ok) throw new Error('OSRM unavailable')
  const data = await res.json()

  const nodes = new Map<string, Node>()
  const adjacency = new Map<string, Edge[]>()

  function addEdge(edge: Edge) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, [])
    adjacency.get(edge.from)!.push(edge)
    // bidirectional
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, [])
    adjacency.get(edge.to)!.push({ ...edge, from: edge.to, to: edge.from })
  }

  for (const leg of data.routes[0].legs) {
    for (const step of leg.steps) {
      const coords: [number, number][] = step.geometry.coordinates
      for (let i = 0; i < coords.length - 1; i++) {
        const [aLng, aLat] = coords[i]
        const [bLng, bLat] = coords[i + 1]

        const aId = `${aLat.toFixed(5)},${aLng.toFixed(5)}`
        const bId = `${bLat.toFixed(5)},${bLng.toFixed(5)}`

        nodes.set(aId, { id: aId, lat: aLat, lng: aLng })
        nodes.set(bId, { id: bId, lat: bLat, lng: bLng })

        const distance = haversineDistance(
          { lat: aLat, lng: aLng },
          { lat: bLat, lng: bLng }
        )
        const riskScore = await computeSegmentRisk(aLat, aLng, bLat, bLng)

        addEdge({ from: aId, to: bId, distance, riskScore })
      }
    }
  }

  return { nodes, adjacency }
}

export function findNearestNode(
  lat: number, lng: number,
  nodes: Map<string, Node>
): Node {
  let best: Node | null = null
  let bestDist = Infinity
  for (const node of nodes.values()) {
    const d = haversineDistance({ lat, lng }, { lat: node.lat, lng: node.lng })
    if (d < bestDist) { bestDist = d; best = node }
  }
  if (!best) throw new Error('No nodes in graph')
  return best
}