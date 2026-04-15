// lib/routing/dijkstra.ts
import { MinHeap } from './min-heap'
import {
  Node, Edge, Graph,
  buildGraph, findNearestNode,
  haversineDistance, getSegmentRiskSync
} from './graph'

export interface RouteResult {
  path: Node[]
  totalDistance: number
  avgRiskScore: number
  geojson: object
}

function edgeCost(edge: Edge, alpha = 0.6): number {
  const MAX_SEGMENT_M = 1000
  const normDist = (edge.distance / MAX_SEGMENT_M) * 100
  return (1 - alpha) * normDist + alpha * edge.riskScore
}

function dijkstra(
  graph: Graph,
  startId: string,
  endId: string,
  alpha: number
): Map<string, string> {
  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  const visited = new Set<string>()
  const pq = new MinHeap<{ id: string; cost: number }>(
    (a, b) => a.cost - b.cost
  )

  dist.set(startId, 0)
  pq.push({ id: startId, cost: 0 })

  while (!pq.isEmpty()) {
    const { id: u } = pq.pop()!
    if (visited.has(u)) continue
    visited.add(u)
    if (u === endId) break

    for (const edge of graph.adjacency.get(u) ?? []) {
      if (visited.has(edge.to)) continue
      const tentative = (dist.get(u) ?? Infinity) + edgeCost(edge, alpha)
      if (tentative < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, tentative)
        prev.set(edge.to, u)
        pq.push({ id: edge.to, cost: tentative })
      }
    }
  }

  return prev
}

function reconstructPath(
  prev: Map<string, string>,
  graph: Graph,
  startId: string,
  endId: string
): Node[] {
  const path: Node[] = []
  let cur: string | undefined = endId
  while (cur) {
    const node = graph.nodes.get(cur)
    if (node) path.unshift(node)
    cur = prev.get(cur)
    if (cur === startId) {
      const s = graph.nodes.get(startId)
      if (s) path.unshift(s)
      break
    }
  }
  return path
}

function pathToGeoJSON(path: Node[]): object {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: path.map(n => [n.lng, n.lat])
    },
    properties: {}
  }
}

function computePathAvgRisk(path: Node[]): number {
  if (path.length < 2) return 0
  let total = 0
  for (let i = 0; i < path.length - 1; i++) {
    total += getSegmentRiskSync(
      path[i].lat, path[i].lng,
      path[i + 1].lat, path[i + 1].lng
    )
  }
  return total / (path.length - 1)
}

function totalPathDistance(path: Node[]): number {
  let d = 0
  for (let i = 1; i < path.length; i++) {
    d += haversineDistance(
      { lat: path[i - 1].lat, lng: path[i - 1].lng },
      { lat: path[i].lat, lng: path[i].lng }
    )
  }
  return d
}

export async function computeSafeRoute(
  startLat: number, startLng: number,
  endLat: number, endLng: number,
  alpha = 0.6
): Promise<RouteResult> {
  const graph = await buildGraph(startLat, startLng, endLat, endLng)
  const startNode = findNearestNode(startLat, startLng, graph.nodes)
  const endNode   = findNearestNode(endLat, endLng, graph.nodes)

  const prev = dijkstra(graph, startNode.id, endNode.id, alpha)
  const path = reconstructPath(prev, graph, startNode.id, endNode.id)

  return {
    path,
    totalDistance: totalPathDistance(path),
    avgRiskScore:  computePathAvgRisk(path),
    geojson:       pathToGeoJSON(path)
  }
}

export async function computeShortestRoute(
  startLat: number, startLng: number,
  endLat: number, endLng: number
): Promise<RouteResult> {
  return computeSafeRoute(startLat, startLng, endLat, endLng, 0)
}