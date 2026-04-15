// app/api/analytics/forecast/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
 
export async function POST(req: NextRequest) {
  try {
    const userId = getUserFromRequest(req)?.userId
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 
    const { state, district, crimeType, yearsAhead = 3 } = await req.json()
 
    if (!state || !crimeType) {
      return NextResponse.json({ error: 'State and crimeType required' }, { status: 400 })
    }
 
    const mlRes = await fetch(process.env.ML_SERVICE_URL + '/api/forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, district, crime_type: crimeType, years_ahead: yearsAhead })
    })
 
    if (!mlRes.ok) {
      return NextResponse.json({ error: 'Forecast failed' }, { status: mlRes.status })
    }
 
    const data = await mlRes.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Forecast error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}