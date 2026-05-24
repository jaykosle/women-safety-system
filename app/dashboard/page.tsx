// app/dashboard/page.tsx
'use client'

import { useAuth } from '@/context/AuthContext'
import {
  Activity, AlertCircle, Users, Bell, MapPin, ShieldCheck,
  ChevronRight, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Contact { id: string; name: string }
interface SosAlert { id: string; status: string; createdAt: string; latitude: number; longitude: number }

const safetyTips = [
  'Share your live location with trusted contacts before late-night travel',
  'Check AI risk scores for your destination before heading out',
  'Your SOS alert is just one tap away — practice using it',
]

export default function OverviewPage() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [alerts, setAlerts] = useState<SosAlert[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/contacts').then(r => r.ok ? r.json() : []),
      fetch('/api/sos/history').then(r => r.ok ? r.json() : []),
    ])
      .then(([c, a]) => { setContacts(c); setAlerts(a) })
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [])

  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE').length
  const lastAlert = alerts[0]
  const lastAlertText = lastAlert
    ? new Date(lastAlert.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'None yet'

  return (
    <div className="px-6 py-8">
      {/* Status Banner */}
      <div className="mb-8 p-5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl text-white flex items-center justify-between shadow-sm">
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

      {/* Live Stat Cards */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">At a Glance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Trusted Contacts"
            value={statsLoading ? '—' : String(contacts.length)}
            hint={contacts.length === 0 ? 'Add your first contact' : `${contacts.length} ready to notify`}
            icon={Users}
            tone="violet"
            href="/dashboard/contacts"
          />
          <StatCard
            label="Active Alerts"
            value={statsLoading ? '—' : String(activeAlerts)}
            hint={activeAlerts > 0 ? 'Resolve in SOS panel' : 'All clear'}
            icon={Bell}
            tone={activeAlerts > 0 ? 'rose' : 'emerald'}
            href="/dashboard/sos"
            urgent={activeAlerts > 0}
          />
          <StatCard
            label="Total SOS History"
            value={statsLoading ? '—' : String(alerts.length)}
            hint={`Last: ${lastAlertText}`}
            icon={Activity}
            tone="blue"
            href="/dashboard/sos"
          />
          <StatCard
            label="Safety Index"
            value="A"
            hint="Based on your area"
            icon={ShieldCheck}
            tone="emerald"
            href="/dashboard/analytics"
          />
        </div>
      </section>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 p-6">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-5">Account</h2>
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-400 to-violet-500 flex items-center justify-center text-white text-lg font-bold">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role?.toLowerCase()} account</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <Row label="Email" value={user?.email} />
            <Row label="Role" value={user?.role} valueClass="text-rose-600 font-semibold capitalize" />
          </div>
        </div>

        {/* Safety tips */}
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

      {/* Recent activity */}
      <div className="mt-6 bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Recent Activity</h2>
          <Link href="/dashboard/sos" className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">
            No alerts yet. You're safe — keep it that way.
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center justify-between py-2.5 px-3 hover:bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      a.status === 'ACTIVE' ? 'bg-rose-100 text-rose-700'
                      : a.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {a.status}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3" />
                    {a.latitude.toFixed(3)}, {a.longitude.toFixed(3)}
                  </span>
                </div>
                <span className="text-xs text-slate-400 shrink-0">
                  {new Date(a.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value?: string; valueClass?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={valueClass ?? 'text-slate-700 font-medium'}>{value?.toLowerCase()}</span>
    </div>
  )
}

const TONE: Record<string, { bg: string; text: string; border: string }> = {
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-100' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
}

function StatCard({
  label, value, hint, icon: Icon, tone, href, urgent,
}: {
  label: string; value: string; hint: string; icon: any;
  tone: keyof typeof TONE; href: string; urgent?: boolean
}) {
  const t = TONE[tone]
  return (
    <Link
      href={href}
      className={`group p-5 bg-white rounded-2xl border ${t.border} hover:shadow-lg transition-all relative overflow-hidden`}
    >
      {urgent && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
      )}
      <div className={`w-11 h-11 ${t.bg} rounded-xl flex items-center justify-center mb-4`}>
        <Icon className={`w-5 h-5 ${t.text}`} />
      </div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mb-1">{value}</p>
      <p className={`text-xs ${t.text}`}>{hint}</p>
    </Link>
  )
}
