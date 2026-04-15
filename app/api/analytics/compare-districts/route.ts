// app/api/analytics/compare-districts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
 
export async function POST(req: NextRequest) {
  try {
    const userId = getUserFromRequest(req)?.userId
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 
    const { state, districts } = await req.json()
 
    if (!state || !districts || !Array.isArray(districts)) {
      return NextResponse.json({ error: 'State and districts array required' }, { status: 400 })
    }
 
    const mlRes = await fetch(process.env.ML_SERVICE_URL + '/api/compare-districts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, districts })
    })
 
    if (!mlRes.ok) {
      return NextResponse.json({ error: 'Comparison failed' }, { status: mlRes.status })
    }
 
    const data = await mlRes.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Comparison error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}