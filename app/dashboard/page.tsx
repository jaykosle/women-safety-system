// app/dashboard/page.tsx
'use client'
import { useAuth } from '@/context/AuthContext'
import {
  Shield, LogOut, Map, Bell, BarChart2, Navigation,
  ChevronRight, Activity, Users, AlertCircle, Home,
  Settings, Menu, X, Zap, TrendingUp, MapPin, Phone
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

const navSections = [
  {
    label: 'MAIN',
    items: [
      { href: '/dashboard', icon: Home, label: 'Overview', active: true },
    ]
  },
  {
    label: 'SAFETY TOOLS',
    items: [
      { href: '/map', icon: Map, label: 'Safety Map', badge: 'Live' },
      { href: '/sos', icon: Bell, label: 'SOS Alert', badge: 'Emergency', badgeColor: 'bg-rose-100 text-rose-700' },
      { href: '/map', icon: Navigation, label: 'Safe Routes' },
    ]
  },
  {
    label: 'AI ANALYSIS',
    items: [
      { href: '/analytics', icon: BarChart2, label: 'Crime Analytics' },
      { href: '/analytics', icon: TrendingUp, label: 'Risk Trends' },
      { href: '/analytics', icon: Activity, label: 'Hotspot Detection' },
    ]
  },
  {
    label: 'ACCOUNT',
    items: [
      { href: '/dashboard', icon: Users, label: 'Trusted Contacts' },
      { href: '/dashboard', icon: Settings, label: 'Settings' },
    ]
  },
]

const quickActions = [
  {
    href: '/map',
    icon: Map,
    label: 'Safety Map',
    desc: 'View heatmaps & risk zones',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
    accent: 'from-violet-500 to-violet-600',
  },
  {
    href: '/sos',
    icon: Bell,
    label: 'SOS Alert',
    desc: 'Emergency contacts notified instantly',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-100',
    accent: 'from-rose-500 to-rose-600',
    urgent: true,
  },
  {
    href: '/analytics',
    icon: BarChart2,
    label: 'Analytics',
    desc: 'Crime trends & safety stats',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    accent: 'from-blue-500 to-blue-600',
  },
  {
    href: '/map',
    icon: Navigation,
    label: 'Safe Routes',
    desc: 'Navigate via low-risk paths',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    accent: 'from-emerald-500 to-emerald-600',
  },
]

const safetyTips = [
  'Share your live location with trusted contacts before late-night travel',
  'Check AI risk scores for your destination before heading out',
  'Your SOS alert is just one tap away — practice using it',
]

export default function DashboardPage() {
  const { user, loading, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  return (
    <div className="min-h-screen bg-slate-50 flex" style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}>

      {/* ── MOBILE OVERLAY ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-40 flex flex-col
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-rose-500 to-rose-600 flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <span className="text-base font-bold text-slate-900">SafePath<span className="text-rose-500"> AI</span></span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">{section.label}</p>
              {section.items.map(({ href, icon: Icon, label, badge, badgeColor, active }: any) => (
                <Link
                  key={label}
                  href={href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl mb-0.5 group transition-all ${
                    active
                      ? 'bg-rose-50 text-rose-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${active ? 'text-rose-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  {badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor ?? 'bg-slate-100 text-slate-500'}`}>
                      {badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* SOS Quick Button */}
        <div className="px-4 py-4 border-t border-slate-100">
          <Link
            href="/sos"
            className="flex items-center justify-center gap-2 w-full py-3 bg-linear-to-r from-rose-500 to-rose-600 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-700 transition-all shadow-sm shadow-rose-200 text-sm"
          >
            <Zap className="w-4 h-4" />
            Trigger SOS Alert
          </Link>
        </div>

        {/* User info */}
        <div className="px-4 py-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-linear-to-br from-rose-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.[0] ?? '?'}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">{user?.name}</p>
                <p className="text-[10px] text-slate-400 capitalize">{user?.role?.toLowerCase()}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <p className="text-xs text-slate-400 font-medium">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <h1 className="text-xl font-bold text-slate-900">{greeting}, {firstName}!</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/sos"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-linear-to-r from-rose-500 to-rose-600 rounded-xl hover:from-rose-600 hover:to-rose-700 shadow-sm shadow-rose-200 transition-all"
            >
              <Bell className="w-4 h-4" />
              SOS
            </Link>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 px-6 py-8 overflow-y-auto">

          {/* Safety Status Banner */}
          <div className="mb-8 p-5 bg-linear-to-r from-emerald-500 to-teal-500 rounded-2xl text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold opacity-90">Safety Status</p>
                <p className="font-bold text-lg">AI System Active</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-white/20 px-4 py-2 rounded-xl">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-sm font-semibold">Monitoring ON</span>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <section className="mb-8">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Quick Access</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {quickActions.map(({ href, icon: Icon, label, desc, color, bg, border, accent, urgent }) => (
                <Link
                  key={label}
                  href={href}
                  className={`group p-5 bg-white rounded-2xl border ${border} hover:shadow-lg transition-all relative overflow-hidden`}
                >
                  {urgent && (
                    <div className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                  )}
                  <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1 text-base">{label}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed mb-4">{desc}</p>
                  <div className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
                    Open <ChevronRight className="w-3 h-3" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Account Info */}
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 p-6">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-5">Account</h2>
              <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-rose-400 to-violet-500 flex items-center justify-center text-white text-lg font-bold">
                  {user?.name?.[0] ?? '?'}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{user?.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{user?.role?.toLowerCase()} account</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Email', value: user?.email },
                  { label: 'Role', value: user?.role, style: 'text-rose-600 font-semibold capitalize' },
                ].map(({ label, value, style }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-400">{label}</span>
                    <span className={style ?? 'text-slate-700 font-medium'}>{value?.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Safety Tips */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
              <div className="flex items-center gap-2 mb-5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Safety Tips</h2>
              </div>
              <div className="space-y-3">
                {safetyTips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-white text-[10px] font-bold">{i + 1}</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}