// app/api/routes/safe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { computeSafeRoute, computeShortestRoute } from '@/lib/routing/dijkstra'

export async function POST(req: NextRequest) {
  const { startLat, startLng, endLat, endLng, alpha = 0.6 } = await req.json()

  if (!startLat || !startLng || !endLat || !endLng) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 })
  }

  try {
    const [safeRoute, shortRoute] = await Promise.all([
      computeSafeRoute(startLat, startLng, endLat, endLng, alpha),
      computeShortestRoute(startLat, startLng, endLat, endLng)
    ])

    const payload = {
      safeRoute: {
        path: safeRoute.path,
        distanceKm: (safeRoute.totalDistance / 1000).toFixed(2),
        avgRiskScore: safeRoute.avgRiskScore.toFixed(0),
        geojson: safeRoute.geojson
      },
      shortRoute: {
        path: shortRoute.path,
        distanceKm: (shortRoute.totalDistance / 1000).toFixed(2),
        avgRiskScore: shortRoute.avgRiskScore.toFixed(0),
        geojson: shortRoute.geojson
      }
    }

    const userId = getUserFromRequest(req)?.userId
    if (userId) {
      await prisma.routeHistory.create({
        data: {
          userId,
          startLat, startLng, endLat, endLng,
          safeRoute: safeRoute.geojson as object,
          shortRoute: shortRoute.geojson as object,
          safeDistance: parseFloat(payload.safeRoute.distanceKm),
          shortDistance: parseFloat(payload.shortRoute.distanceKm),
          avgRiskScore: safeRoute.avgRiskScore
        }
      })
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error('Route computation error:', err)
    return NextResponse.json({ error: 'Route computation failed' }, { status: 500 })
  }
}