// app/api/sos/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function PATCH(req: NextRequest) {
  const userId = getUserFromRequest(req)?.userId
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { alertId, status } = await req.json()

  const alert = await prisma.sosAlert.findFirst({ where: { id: alertId, userId } })
  if (!alert) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.sosAlert.update({
    where: { id: alertId },
    data: { status, resolvedAt: new Date() }
  })
  return NextResponse.json(updated)
}