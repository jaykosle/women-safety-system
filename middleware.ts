import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/dashboard']
const AUTH_ROUTES = ['/login', '/signup']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Just check if cookie EXISTS — no verification
  const token = req.cookies.get('auth-token')?.value
  const hasToken = !!token && token.length > 0

  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r))
  const isAuthPage = AUTH_ROUTES.some(r => pathname.startsWith(r))

  // Not logged in + trying to access dashboard → go to login
  if (isProtected && !hasToken) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Already logged in + trying to access login/signup → go to dashboard
  if (isAuthPage && hasToken) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup']
}