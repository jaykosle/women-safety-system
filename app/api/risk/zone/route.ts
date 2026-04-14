// app/api/risk/zone/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const swLat = parseFloat(searchParams.get('swLat') || '0')
  const swLng = parseFloat(searchParams.get('swLng') || '0')
  const neLat = parseFloat(searchParams.get('neLat') || '90')
  const neLng = parseFloat(searchParams.get('neLng') || '90')

  const zones = await prisma.riskZone.findMany({
    where: {
      latitude: { gte: swLat, lte: neLat },
      longitude: { gte: swLng, lte: neLng }
    }
  })
  return NextResponse.json(zones)
}