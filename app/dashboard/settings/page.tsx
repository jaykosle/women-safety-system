// app/dashboard/settings/page.tsx
'use client'

import { useAuth } from '@/context/AuthContext'
import { LogOut, User, Mail, Shield } from 'lucide-react'

export default function SettingsPage() {
  const { user, logout } = useAuth()

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-base font-bold text-slate-900 mb-5">Profile</h2>
        <div className="space-y-3">
          <Field icon={User} label="Name" value={user?.name} />
          <Field icon={Mail} label="Email" value={user?.email} />
          <Field icon={Shield} label="Role" value={user?.role} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-base font-bold text-slate-900 mb-2">Session</h2>
        <p className="text-sm text-slate-500 mb-4">Sign out of your account on this device.</p>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-sm font-semibold hover:bg-rose-100 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </div>
  )
}

function Field({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <Icon className="w-4 h-4 text-slate-400" />
      <span className="text-xs text-slate-500 w-20">{label}</span>
      <span className="text-sm text-slate-800 font-medium">{value ?? '—'}</span>
    </div>
  )
}
