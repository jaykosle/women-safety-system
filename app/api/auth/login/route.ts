import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signJWT } from '@/lib/jwt'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password)
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    const token = signJWT({ userId: user.id, role: user.role })

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 86400000)
      }
    })

    const userData = { id: user.id, name: user.name, email: user.email, role: user.role }

    // Build response with explicit cookie header
    const response = NextResponse.json({ token, user: userData })
    
    response.headers.set(
      'Set-Cookie',
      `auth-token=${token}; Path=/; Max-Age=${7 * 86400}; HttpOnly; SameSite=Lax`
    )

    return response

  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}