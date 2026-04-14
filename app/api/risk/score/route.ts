// app/api/risk/score/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRiskLevel } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const { lat, lng } = await req.json()
  if (!lat || !lng) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })

  const gridLat = Math.round(lat / 0.005) * 0.005
  const gridLng = Math.round(lng / 0.005) * 0.005

  const cached = await prisma.riskZone.findFirst({
    where: { latitude: gridLat, longitude: gridLng, gridResolution: 0.005 }
  })
  if (cached) return NextResponse.json(cached)

  const mlResponse = await fetch(process.env.ML_API_URL + '/predict-risk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng })
  })

  if (!mlResponse.ok) return NextResponse.json({ error: 'ML service unavailable' }, { status: 503 })

  const { risk_score, crime_density, night_crime_rate } = await mlResponse.json()

  const zone = await prisma.riskZone.create({
    data: {
      latitude: gridLat,
      longitude: gridLng,
      riskScore: risk_score,
      riskLevel: getRiskLevel(risk_score),
      crimeDensity: crime_density,
      nightCrimeRate: night_crime_rate,
      severityScore: 0,
      crimeCount: 0
    }
  })
  return NextResponse.json(zone)
}