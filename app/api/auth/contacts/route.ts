// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const userId = getUserFromRequest(req)?.userId
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contacts = await prisma.trustedContact.findMany({ 
    where: { userId },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(contacts)
}

export async function POST(req: NextRequest) {
  const userId = getUserFromRequest(req)?.userId
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, phone, email } = await req.json()
  
  if (!name || !phone) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }

  const contact = await prisma.trustedContact.create({
    data: { userId, name, phone, email }
  })

  return NextResponse.json(contact, { status: 201 })
}