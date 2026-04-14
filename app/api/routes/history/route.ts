// app/api/routes/history/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const payload = getUserFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const history = await prisma.routeHistory.findMany({
    where: { userId: payload.userId },
    orderBy: { createdAt: 'desc' },
    take: 20
  })
  return NextResponse.json(history)
}