// app/sos/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { Shield, Plus, Trash2, Phone, Mail, AlertTriangle, CheckCircle, MapPin } from 'lucide-react'
import Link from 'next/link'

interface Contact {
  id: string
  name: string
  phone: string
  email?: string
}

interface SosAlert {
  id: string
  status: string
  latitude: number
  longitude: number
  message?: string
  createdAt: string
}

export default function SosPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [alerts, setAlerts] = useState<SosAlert[]>([])
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [sosLoading, setSosLoading] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [sosSuccess, setSosSuccess] = useState(false)
  const [error, setError] = useState('')
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    fetchContacts()
    fetchHistory()
  }, [])

  async function fetchContacts() {
    const res = await fetch('/api/auth/contacts')
    if (res.ok) setContacts(await res.json())
  }

  async function fetchHistory() {
    const res = await fetch('/api/sos/history')
    if (res.ok) setAlerts(await res.json())
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault()
    setAddLoading(true)
    setError('')
    const res = await fetch('/api/auth/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    if (res.ok) {
      setForm({ name: '', phone: '', email: '' })
      fetchContacts()
    } else {
      const d = await res.json()
      setError(d.error || 'Failed to add contact')
    }
    setAddLoading(false)
  }

  async function deleteContact(id: string) {
    await fetch('/api/auth/contacts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: id })
    })
    fetchContacts()
  }

  async function triggerSOS() {
    setSosLoading(true)
    setSosSuccess(false)
    setError('')
    setLocating(true)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocating(false)
        const res = await fetch('/api/sos/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            message: 'Emergency! I need help.'
          })
        })
        if (res.ok) {
          setSosSuccess(true)
          fetchHistory()
          setTimeout(() => setSosSuccess(false), 5000)
        } else {
          setError('SOS failed. Try again.')
        }
        setSosLoading(false)
      },
      () => {
        setLocating(false)
        setSosLoading(false)
        setError('Location access denied. Please enable GPS.')
      }
    )
  }

  async function resolveAlert(id: string) {
    await fetch('/api/sos/resolve', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: id, status: 'RESOLVED' })
    })
    fetchHistory()
  }

  const statusColor = (s: string) =>
    s === 'ACTIVE' ? '#ef4444' : s === 'RESOLVED' ? '#22c55e' : '#94a3b8'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-7 h-7 text-indigo-600" />
          <span className="text-xl font-bold text-slate-800">SafePath AI</span>
        </div>
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">
          ← Back to Dashboard
        </Link>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* SOS Button */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Emergency SOS</h1>
          <p className="text-slate-500 text-sm mb-6">
            Triggers an alert to all your trusted contacts with your live location.
          </p>

          {sosSuccess && (
            <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 rounded-xl py-3 px-4 mb-4 text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> SOS sent to {contacts.length} contact(s)!
            </div>
          )}
          {error && (
            <div className="text-rose-600 bg-rose-50 rounded-xl py-3 px-4 mb-4 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={triggerSOS}
            disabled={sosLoading || contacts.length === 0}
            className="w-full max-w-xs mx-auto block py-4 rounded-2xl text-white font-bold text-lg transition-all"
            style={{
              background: sosLoading ? '#fca5a5' : 'linear-gradient(135deg, #ef4444, #dc2626)',
              boxShadow: sosLoading ? 'none' : '0 8px 24px rgba(239,68,68,0.4)',
              cursor: contacts.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {locating ? '📍 Getting Location...' : sosLoading ? 'Sending SOS...' : '🚨 TRIGGER SOS'}
          </button>

          {contacts.length === 0 && (
            <p className="text-xs text-amber-600 mt-3">Add at least one trusted contact below to enable SOS.</p>
          )}
        </div>

        {/* Trusted Contacts */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-5">Trusted Contacts</h2>

{/* Add form */}
<form onSubmit={addContact} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
  <input
    required 
    placeholder="Full Name"
    value={form.name} 
    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
    className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
  />
  <input
    required 
    placeholder="Phone Number"
    value={form.phone} 
    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
    className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
  />
  <div className="flex gap-2">
    <input
      placeholder="Email (optional)"
      value={form.email} 
      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
      className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
    />
    <button
      type="submit" 
      disabled={addLoading}
      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-xl transition-colors disabled:opacity-50"
    >
      <Plus className="w-4 h-4" />
    </button>
  </div>
</form>

          {/* Contact list */}
          {contacts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No contacts added yet.</p>
          ) : (
            <div className="space-y-3">
              {contacts.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{c.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </span>
                      {c.email && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Mail className="w-3 h-3" /> {c.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteContact(c.id)}
                    className="text-slate-400 hover:text-rose-500 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SOS History */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-5">SOS History</h2>
          {alerts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No SOS alerts triggered yet.</p>
          ) : (
            <div className="space-y-3">
              {alerts.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ background: statusColor(a.status) }}>
                        {a.status}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="w-3 h-3" />
                      {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
                    </span>
                  </div>
                  {a.status === 'ACTIVE' && (
                    <button onClick={() => resolveAlert(a.id)}
                      className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 transition-colors font-medium">
                      Mark Resolved
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}