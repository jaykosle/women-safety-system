// app/api/risk/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRiskLevel } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const { coordinates }: { coordinates: { lat: number; lng: number }[] } = await req.json()
  if (!coordinates?.length) return NextResponse.json({ error: 'coordinates array required' }, { status: 400 })

  const results = await Promise.all(coordinates.map(async ({ lat, lng }) => {
    const gridLat = Math.round(lat / 0.005) * 0.005
    const gridLng = Math.round(lng / 0.005) * 0.005

    const cached = await prisma.riskZone.findFirst({
      where: { latitude: gridLat, longitude: gridLng }
    })
    if (cached) return cached

    const mlRes = await fetch(process.env.ML_API_URL + '/predict-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng })
    })
    if (!mlRes.ok) return { latitude: lat, longitude: lng, riskScore: 0, riskLevel: 'SAFE' }

    const { risk_score, crime_density, night_crime_rate } = await mlRes.json()
    return prisma.riskZone.create({
      data: {
        latitude: gridLat, longitude: gridLng,
        riskScore: risk_score, riskLevel: getRiskLevel(risk_score),
        crimeDensity: crime_density, nightCrimeRate: night_crime_rate,
        severityScore: 0, crimeCount: 0
      }
    })
  }))
  return NextResponse.json(results)
}