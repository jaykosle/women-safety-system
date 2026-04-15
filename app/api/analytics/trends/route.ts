// app/api/analytics/trends/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
 
export async function GET(req: NextRequest) {
  try {
    const userId = getUserFromRequest(req)?.userId
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 
    const { searchParams } = new URL(req.url)
    const state = searchParams.get('state')
    const district = searchParams.get('district')
 
    if (!state) {
      return NextResponse.json({ error: 'State required' }, { status: 400 })
    }
 
    const mlRes = await fetch(process.env.ML_SERVICE_URL + '/api/trends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, district })
    })
 
    if (!mlRes.ok) {
      return NextResponse.json({ error: 'Trends query failed' }, { status: mlRes.status })
    }
 
    const data = await mlRes.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Trends error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}