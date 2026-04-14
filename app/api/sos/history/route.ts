import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const userId = getUserFromRequest(req)?.userId
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  const where = user?.role === 'ADMIN' ? {} : { userId }

  const alerts = await prisma.sosAlert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50
  })
  return NextResponse.json(alerts)
}