// app/api/admin/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const userId = getUserFromRequest(req)?.userId
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [userCount, crimeCount, activeSos, highRiskZones] = await Promise.all([
    prisma.user.count(),
    prisma.crimeRecord.count(),
    prisma.sosAlert.count({ where: { status: 'ACTIVE' } }),
    prisma.riskZone.count({ where: { riskLevel: { in: ['HIGH', 'CRITICAL'] } } })
  ])

  return NextResponse.json({ userCount, crimeCount, activeSos, highRiskZones })
}