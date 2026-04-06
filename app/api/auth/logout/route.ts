import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value
    if (token) {
      await prisma.session.deleteMany({ where: { token } })
    }
    const response = NextResponse.json({ success: true })
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      maxAge: 0,
      path: '/'
    })
    return response
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}