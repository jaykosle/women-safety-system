import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const userId = getUserFromRequest(req)?.userId
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { latitude, longitude, message } = await req.json()

  const alert = await prisma.sosAlert.create({
    data: { userId, latitude, longitude, message, status: 'ACTIVE' }
  })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  const contacts = await prisma.trustedContact.findMany({ where: { userId } })

  // Placeholder — wire up Twilio/Nodemailer here later
  console.log(`SOS from ${user?.name} at ${latitude},${longitude} — ${contacts.length} contacts to notify`)

  return NextResponse.json({ alert, contactsNotified: contacts.length })
}