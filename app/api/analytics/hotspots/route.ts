// app/api/analytics/hotspots/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getCentroid, getStateBounds } from '@/lib/districtCentroids'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const userId = getUserFromRequest(req)?.userId
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const state = searchParams.get('state')
    const limit = parseInt(searchParams.get('limit') || '10')

    const mlRes = await fetch(process.env.ML_SERVICE_URL + '/api/hotspots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, limit }),
    })

    if (!mlRes.ok) {
      return NextResponse.json({ error: 'Hotspots query failed' }, { status: mlRes.status })
    }

    const data = await mlRes.json()
    const raw = Array.isArray(data) ? data : (data.hotspots ?? [])

    // Attach district centroid from synthetic_crime_data.csv so the client can map them.
    const hotspots = raw.map((h: any) => {
      const c = getCentroid(h.state, h.district)
      return c ? { ...h, lat: c.lat, lng: c.lng } : h
    })

    const bounds = state ? getStateBounds(state) : null

    return NextResponse.json({ hotspots, bounds })
  } catch (err: any) {
    console.error('Hotspots error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}