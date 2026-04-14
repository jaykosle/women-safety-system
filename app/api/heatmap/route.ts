//app/api/heatmap/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const swLat = parseFloat(searchParams.get('swLat') || '8')
  const swLng = parseFloat(searchParams.get('swLng') || '68')
  const neLat = parseFloat(searchParams.get('neLat') || '37')
  const neLng = parseFloat(searchParams.get('neLng') || '97')

  const zones = await prisma.riskZone.findMany({
    where: {
      latitude: { gte: swLat, lte: neLat },
      longitude: { gte: swLng, lte: neLng }
    },
    select: { latitude: true, longitude: true, riskScore: true }
  })

  const points = zones.map(z => [z.latitude, z.longitude, z.riskScore / 100])
  return NextResponse.json(points)
}