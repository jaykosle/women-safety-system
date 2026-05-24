// app/dashboard/layout.tsx
'use client'

import { useAuth } from '@/context/AuthContext'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Shield, LogOut, Map, Bell, BarChart2, Navigation,
  Home, Settings, Menu, X, Zap, Users, ChevronLeft, ChevronRight,
} from 'lucide-react'

type NavItem = {
  href: string
  icon: any
  label: string
  badge?: string
  badgeColor?: string
  matchPrefix?: boolean
}

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: 'MAIN',
    items: [
      { href: '/dashboard', icon: Home, label: 'Overview' },
    ],
  },
  {
    label: 'SAFETY TOOLS',
    items: [
      { href: '/dashboard/map', icon: Map, label: 'Safety Map', badge: 'Live', matchPrefix: true },
      {
        href: '/dashboard/sos', icon: Bell, label: 'SOS Alert',
        badge: 'Emergency', badgeColor: 'bg-rose-100 text-rose-700', matchPrefix: true,
      },
      { href: '/dashboard/map?mode=route', icon: Navigation, label: 'Safe Routes' },
    ],
  },
  {
    label: 'AI ANALYSIS',
    items: [
      { href: '/dashboard/analytics', icon: BarChart2, label: 'Crime Analytics', matchPrefix: true },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { href: '/dashboard/contacts', icon: Users, label: 'Trusted Contacts', matchPrefix: true },
      { href: '/dashboard/settings', icon: Settings, label: 'Settings', matchPrefix: true },
    ],
  },
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/map': 'Safety Map',
  '/dashboard/sos': 'Emergency SOS',
  '/dashboard/analytics': 'Crime Analytics',
  '/dashboard/contacts': 'Trusted Contacts',
  '/dashboard/settings': 'Settings',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar:collapsed')
    if (saved === '1') setCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar:collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  // close mobile drawer on route change
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const isActive = (item: NavItem) => {
    const base = item.href.split('?')[0]
    if (item.matchPrefix) return pathname === base || pathname.startsWith(base + '/')
    return pathname === base
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
          <span className="text-sm text-slate-500">Loading your dashboard…</span>
        </div>
      </div>
    )
  }

  const firstName = user?.name?.split(' ')[0] ?? 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const pageTitle = PAGE_TITLES[pathname] ?? 'Dashboard'
  const isOverview = pathname === '/dashboard'

  return (
    <div
      className="min-h-screen bg-slate-50 flex"
      style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen bg-white border-r border-slate-100 z-40 flex flex-col
          transition-[width,transform] duration-300 ease-in-out
          ${collapsed ? 'w-20' : 'w-64'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:sticky lg:top-0 lg:z-auto lg:shrink-0
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center">
              <Shield className="text-white" style={{ width: 18, height: 18 }} />
            </div>
            {!collapsed && (
              <span className="text-base font-bold text-slate-900 truncate">
                SafePath<span className="text-rose-500"> AI</span>
              </span>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-600"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-6">
              {!collapsed && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => {
                const active = isActive(item)
                const Icon = item.icon
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}
                      px-3 py-2.5 rounded-xl mb-0.5 group transition-all
                      ${active
                        ? 'bg-rose-50 text-rose-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                  >
                    <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
                      <Icon className={`w-4 h-4 ${active ? 'text-rose-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                      {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                    </div>
                    {!collapsed && item.badge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor ?? 'bg-slate-100 text-slate-500'}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:block px-3 pb-2">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /> Collapse</>}
          </button>
        </div>

        {/* SOS Quick Button */}
        <div className="px-4 py-3 border-t border-slate-100">
          <Link
            href="/dashboard/sos"
            className={`flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-700 transition-all shadow-sm shadow-rose-200 text-sm`}
            title="Trigger SOS Alert"
          >
            <Zap className="w-4 h-4 shrink-0" />
            {!collapsed && 'Trigger SOS Alert'}
          </Link>
        </div>

        {/* User */}
        <div className="px-4 py-4 border-t border-slate-100">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-rose-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{user?.name}</p>
                  <p className="text-[10px] text-slate-400 capitalize truncate">{user?.role?.toLowerCase()}</p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
              <h1 className="text-xl font-bold text-slate-900 truncate">
                {isOverview ? `${greeting}, ${firstName}!` : pageTitle}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/sos"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-rose-500 to-rose-600 rounded-xl hover:from-rose-600 hover:to-rose-700 shadow-sm shadow-rose-200 transition-all"
            >
              <Bell className="w-4 h-4" />
              SOS
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
