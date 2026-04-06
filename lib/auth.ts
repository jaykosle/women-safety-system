import { NextRequest } from 'next/server'
import { verifyJWT } from './jwt'

export function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies.get('auth-token')?.value

  if (!token) return null
  return verifyJWT(token)
}