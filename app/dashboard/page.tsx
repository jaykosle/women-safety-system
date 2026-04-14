'use client'
import { useAuth } from '@/context/AuthContext'
import { Shield, LogOut, Map, Bell, BarChart } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Nav */}
      <nav className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-7 h-7 text-indigo-600" />
          <span className="text-xl font-bold text-slate-800">SafePath AI</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-slate-600">
            Welcome, <span className="font-medium text-slate-800">{user?.name}</span>
          </span>
          <button
            onClick={logout}
            className="flex items-center space-x-1 px-4 py-2 text-sm text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {/* Dashboard Content */}
      <main className="max-w-6xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard</h1>
        <p className="text-slate-500 mb-10">Your safety overview</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/map" className="block">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer">
              <Map className="w-10 h-10 text-indigo-500 mb-4" />
              <h2 className="text-lg font-bold text-slate-900 mb-1">Safety Map</h2>
              <p className="text-slate-500 text-sm">View heatmaps and safe routes in your area</p>
            </div>
          </Link>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer">
            <Bell className="w-10 h-10 text-rose-500 mb-4" />
            <h2 className="text-lg font-bold text-slate-900 mb-1">SOS Alert</h2>
            <p className="text-slate-500 text-sm">Trigger emergency alerts to your trusted contacts</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer">
            <BarChart className="w-10 h-10 text-emerald-500 mb-4" />
            <h2 className="text-lg font-bold text-slate-900 mb-1">Analytics</h2>
            <p className="text-slate-500 text-sm">View crime trends and safety statistics</p>
          </div>
        </div>

        {/* User Info Card */}
        <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Account Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex">
              <span className="text-slate-500 w-24">Name</span>
              <span className="text-slate-800 font-medium">{user?.name}</span>
            </div>
            <div className="flex">
              <span className="text-slate-500 w-24">Email</span>
              <span className="text-slate-800 font-medium">{user?.email}</span>
            </div>
            <div className="flex">
              <span className="text-slate-500 w-24">Role</span>
              <span className="text-indigo-600 font-medium capitalize">{user?.role?.toLowerCase()}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}