// app/api/routes/safe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { computeRoutes } from '@/lib/routing/safeRoute'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { startLat, startLng, endLat, endLng, alpha = 0.6 } = await req.json()

  if (
    typeof startLat !== 'number' || typeof startLng !== 'number' ||
    typeof endLat   !== 'number' || typeof endLng   !== 'number'
  ) {
    return NextResponse.json({ error: 'Missing or invalid coordinates' }, { status: 400 })
  }

  try {
    const result = await computeRoutes(startLat, startLng, endLat, endLng, alpha)

    const summarize = (r: typeof result.safe) => ({
      path: r.path,
      distanceKm: (r.totalDistance / 1000).toFixed(2),
      avgRiskScore: r.avgRiskScore.toFixed(0),
      peakRiskScore: r.peakRiskScore.toFixed(0),
      criticalDistanceKm: (r.criticalDistanceM / 1000).toFixed(2),
      highDistanceKm: (r.highDistanceM / 1000).toFixed(2),
      geojson: r.geojson,
    })

    const payload = {
      safeRoute: summarize(result.safe),
      shortRoute: summarize(result.short),
      meta: {
        differs: result.differs,
        safetyImprovementPct: Math.round(result.safetyImprovementPct),
        distancePenaltyPct: Math.round(result.distancePenaltyPct * 10) / 10,
        lowDataCoverage: result.lowDataCoverage,
        candidatesEvaluated: result.candidatesEvaluated,
        dangerousRouteUnavoidable: result.dangerousRouteUnavoidable,
      },
    }

    const userId = getUserFromRequest(req)?.userId
    if (userId) {
      await prisma.routeHistory.create({
        data: {
          userId,
          startLat, startLng, endLat, endLng,
          safeRoute: result.safe.geojson as object,
          shortRoute: result.short.geojson as object,
          safeDistance: result.safe.totalDistance / 1000,
          shortDistance: result.short.totalDistance / 1000,
          avgRiskScore: result.safe.avgRiskScore,
        },
      }).catch(err => console.error('routeHistory insert failed:', err))
    }

    return NextResponse.json(payload)
  } catch (err: any) {
    console.error('Route computation error:', err)
    return NextResponse.json(
      { error: err?.message || 'Route computation failed' },
      { status: 500 }
    )
  }
}
