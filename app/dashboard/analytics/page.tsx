// app/dashboard/analytics/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { TrendingUp, TrendingDown, MapPin, BarChart2, LineChart as LineIcon, Flame } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend, ComposedChart, Line,
} from 'recharts'

// Leaflet must only run client-side
const HotspotHeatmap = dynamic(() => import('@/components/HotspotHeatmap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[480px] rounded-xl bg-slate-100 animate-pulse" />
  ),
})

interface CrimeStats {
  state: string
  district?: string
  years_covered: number[]
  crimes: Record<string, {
    total: number
    yearly: Record<number, number>
    severity: number
    avg_per_year: number
  }>
  total_records: number
}

interface Forecast {
  state: string
  crime_type: string
  historical: { years: number[]; values: number[] }
  forecast: { years: number[]; values: number[] }
  metrics: {
    mean_absolute_error: number
    r2_score: number
    trend_direction: string
    trend_magnitude_percent: number
    confidence: 'high' | 'medium' | 'low'
  }
}

interface Hotspot {
  state: string
  district: string
  total_crimes: number
  severity_score: number
  crime_breakdown: Record<string, number>
  lat?: number
  lng?: number
}

interface HotspotsResponse {
  hotspots: Hotspot[]
  bounds: { sw: [number, number]; ne: [number, number] } | null
}

type CrimeType =
  | 'rape' | 'kidnapping' | 'dowry_death' | 'assault_women'
  | 'insult_modesty' | 'cruelty_husband' | 'importation_girls'

const CRIME_LABELS: Record<CrimeType, string> = {
  rape: 'Rape',
  kidnapping: 'Kidnapping & Abduction',
  dowry_death: 'Dowry Deaths',
  assault_women: 'Assault on Women',
  insult_modesty: 'Insult to Modesty',
  cruelty_husband: 'Cruelty by Husband',
  importation_girls: 'Importation of Girls',
}

const CRIME_COLORS: Record<CrimeType, string> = {
  rape: '#ef4444',
  kidnapping: '#f97316',
  dowry_death: '#ec4899',
  assault_women: '#f59e0b',
  insult_modesty: '#eab308',
  cruelty_husband: '#06b6d4',
  importation_girls: '#8b5cf6',
}

const INDIAN_STATES = [
  'ANDHRA PRADESH', 'UTTAR PRADESH', 'MADHYA PRADESH', 'MAHARASHTRA',
  'WEST BENGAL', 'BIHAR', 'RAJASTHAN', 'KARNATAKA', 'TAMIL NADU', 'GUJARAT',
  'DELHI', 'KERALA', 'ODISHA', 'HARYANA', 'PUNJAB', 'JHARKHAND',
  'CHHATTISGARH', 'ASSAM', 'HIMACHAL PRADESH', 'UTTARAKHAND',
]

const TABS: { key: 'overview' | 'forecast' | 'hotspots'; label: string; icon: any }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart2 },
  { key: 'forecast', label: 'Forecast', icon: LineIcon },
  { key: 'hotspots', label: 'Hotspots', icon: Flame },
]

export default function AnalyticsPage() {
  const [selectedState, setSelectedState] = useState<string>('ANDHRA PRADESH')
  const [selectedCrimeType, setSelectedCrimeType] = useState<CrimeType>('rape')
  const [stats, setStats] = useState<CrimeStats | null>(null)
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [hotspotBounds, setHotspotBounds] = useState<HotspotsResponse['bounds']>(null)
  const [hotspotFilter, setHotspotFilter] = useState<'all' | CrimeType>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'forecast' | 'hotspots'>('overview')

  const fetchStats = useCallback(async (state: string) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/analytics/state-stats?state=${encodeURIComponent(state)}`)
      if (!res.ok) throw new Error('Failed to fetch statistics')
      setStats(await res.json())
    } catch (err: any) {
      setError(err.message); setStats(null)
    } finally { setLoading(false) }
  }, [])

  const fetchForecast = useCallback(async (state: string, crimeType: CrimeType) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/analytics/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, crimeType, yearsAhead: 3 }),
      })
      if (!res.ok) throw new Error('Failed to fetch forecast')
      setForecast(await res.json())
    } catch (err: any) {
      setError(err.message); setForecast(null)
    } finally { setLoading(false) }
  }, [])

  const fetchHotspots = useCallback(async (state: string) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/analytics/hotspots?state=${encodeURIComponent(state)}&limit=30`)
      if (!res.ok) throw new Error('Failed to fetch hotspots')
      const data: HotspotsResponse = await res.json()
      setHotspots(data.hotspots || [])
      setHotspotBounds(data.bounds ?? null)
    } catch (err: any) {
      setError(err.message); setHotspots([]); setHotspotBounds(null)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchStats(selectedState)
    if (activeTab === 'forecast') fetchForecast(selectedState, selectedCrimeType)
    else if (activeTab === 'hotspots') fetchHotspots(selectedState)
  }, [selectedState]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab)
    if (tab === 'forecast') fetchForecast(selectedState, selectedCrimeType)
    else if (tab === 'hotspots') fetchHotspots(selectedState)
  }

  const handleStateChange = (state: string) => {
    setSelectedState(state); setForecast(null); setHotspots([])
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <p className="text-sm text-slate-500 mb-6">
        Comprehensive analysis of crimes against women in India (2001–2014).
      </p>

      {/* Controls bar */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">State</label>
          <select
            value={selectedState}
            onChange={(e) => handleStateChange(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white"
          >
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap gap-1 bg-slate-50 rounded-xl p-1">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key
            return (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-white text-rose-600 shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm mb-6">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-10 h-10 border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
          <p className="mt-4 text-sm text-slate-500">Loading data…</p>
        </div>
      )}

      {/* OVERVIEW */}
      {!loading && activeTab === 'overview' && stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {Object.entries(stats.crimes).map(([key, crime]) => (
              <div
                key={key}
                className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition-shadow"
              >
                <div
                  className="text-[11px] font-bold uppercase tracking-wider mb-2"
                  style={{ color: CRIME_COLORS[key as CrimeType] }}
                >
                  {CRIME_LABELS[key as CrimeType]}
                </div>
                <div className="text-3xl font-bold text-slate-900 mb-1">
                  {crime.total.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 mb-3">
                  Avg/year: {crime.avg_per_year.toFixed(0)}
                </div>
                <div className="h-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(crime.yearly).map(([y, v]) => ({ y, v }))}>
                      <Bar dataKey="v" fill={CRIME_COLORS[key as CrimeType]} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          {/* Yearly breakdown */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">Yearly trend by crime type</h2>

            <div className="flex flex-wrap gap-2 mb-5">
              {(Object.entries(CRIME_LABELS) as [CrimeType, string][]).map(([type, label]) => {
                const active = selectedCrimeType === type
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedCrimeType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    style={active ? { borderColor: CRIME_COLORS[type], color: CRIME_COLORS[type] } : {}}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {stats.crimes[selectedCrimeType] && (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(stats.crimes[selectedCrimeType].yearly)
                      .map(([year, value]) => ({ year, value }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8, border: '1px solid #e2e8f0',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" fill={CRIME_COLORS[selectedCrimeType]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}

      {/* FORECAST */}
      {!loading && activeTab === 'forecast' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h2 className="text-base font-bold text-slate-900 mb-4">3-year forecast</h2>

          <div className="flex flex-wrap gap-2 mb-5">
            {(Object.entries(CRIME_LABELS) as [CrimeType, string][]).map(([type, label]) => {
              const active = selectedCrimeType === type
              return (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedCrimeType(type)
                    fetchForecast(selectedState, type)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  style={active ? { borderColor: CRIME_COLORS[type], color: CRIME_COLORS[type] } : {}}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {forecast && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <Metric
                  label="Model R² Score"
                  value={`${(forecast.metrics.r2_score * 100).toFixed(0)}%`}
                  tone={forecast.metrics.r2_score > 0.7 ? 'emerald' : 'amber'}
                />
                <Metric
                  label="Confidence"
                  value={forecast.metrics.confidence}
                  tone="blue"
                  capitalize
                />
                <Metric
                  label="Trend"
                  value={
                    <span className="flex items-center gap-1">
                      {forecast.metrics.trend_direction === 'increasing' ? (
                        <><TrendingUp className="w-4 h-4 text-rose-500" />
                          <span className="text-rose-600">↑ {forecast.metrics.trend_magnitude_percent.toFixed(1)}%</span>
                        </>
                      ) : (
                        <><TrendingDown className="w-4 h-4 text-emerald-500" />
                          <span className="text-emerald-600">↓ {forecast.metrics.trend_magnitude_percent.toFixed(1)}%</span>
                        </>
                      )}
                    </span>
                  }
                  tone="slate"
                />
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={[
                      ...forecast.historical.years.map((y, i) => ({
                        year: y, historical: forecast.historical.values[i],
                      })),
                      ...forecast.forecast.years.map((y, i) => ({
                        year: y, forecast: forecast.forecast.values[i],
                      })),
                    ]}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="historical" name="Historical"
                      fill={CRIME_COLORS[selectedCrimeType]} radius={[4, 4, 0, 0]}
                    />
                    <Line
                      type="monotone" dataKey="forecast" name="Forecast"
                      stroke={CRIME_COLORS[selectedCrimeType]} strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={{ r: 4, fill: CRIME_COLORS[selectedCrimeType] }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      {/* HOTSPOTS */}
      {!loading && activeTab === 'hotspots' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-base font-bold text-slate-900">
              Crime hotspots in {selectedState}
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Filter
              </label>
              <select
                value={hotspotFilter}
                onChange={(e) => setHotspotFilter(e.target.value as 'all' | CrimeType)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-rose-300"
              >
                <option value="all">All crimes (total)</option>
                {(Object.entries(CRIME_LABELS) as [CrimeType, string][]).map(([type, label]) => (
                  <option key={type} value={type}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Map */}
          {hotspots.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-3 mb-4">
              <HotspotHeatmap
                hotspots={hotspots}
                bounds={hotspotBounds}
                filter={hotspotFilter}
                accentColor={
                  hotspotFilter === 'all' ? '#e11d48' : CRIME_COLORS[hotspotFilter as CrimeType]
                }
                theme="light"
                height={460}
              />
              <div className="flex items-center justify-between mt-3 px-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{
                      background: hotspotFilter === 'all'
                        ? '#e11d48' : CRIME_COLORS[hotspotFilter as CrimeType],
                    }}
                  />
                  {hotspotFilter === 'all'
                    ? 'Total crime intensity'
                    : `${CRIME_LABELS[hotspotFilter as CrimeType]} intensity`}
                </span>
                <span>
                  {hotspots.filter(h => typeof h.lat === 'number').length} of {hotspots.length} districts mapped
                </span>
              </div>
            </div>
          )}

          {hotspots.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-sm text-slate-400">
              No hotspot data available for this state.
            </div>
          ) : (
            <div className="space-y-3">
              {hotspots.map((h, i) => {
                const critical = h.severity_score > 2000
                return (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-rose-500" />
                          <h3 className="text-base font-bold text-slate-900">{h.district}</h3>
                        </div>
                        <p className="text-xs text-slate-500">
                          {h.total_crimes.toLocaleString()} total crimes recorded
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          critical ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {critical ? 'CRITICAL' : 'HIGH'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {Object.entries(h.crime_breakdown).map(([type, count]) => (
                        <div
                          key={type}
                          className="rounded-lg px-3 py-2 border"
                          style={{
                            borderColor: `${CRIME_COLORS[type as CrimeType]}33`,
                            background: `${CRIME_COLORS[type as CrimeType]}0d`,
                          }}
                        >
                          <p
                            className="text-[10px] font-bold uppercase tracking-wider mb-0.5"
                            style={{ color: CRIME_COLORS[type as CrimeType] }}
                          >
                            {CRIME_LABELS[type as CrimeType]}
                          </p>
                          <p className="text-lg font-bold text-slate-900">{count.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Metric({
  label, value, tone, capitalize,
}: {
  label: string
  value: React.ReactNode
  tone: 'emerald' | 'amber' | 'blue' | 'slate'
  capitalize?: boolean
}) {
  const map: Record<string, { bg: string; border: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' },
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-100',   text: 'text-amber-700' },
    blue:    { bg: 'bg-blue-50',    border: 'border-blue-100',    text: 'text-blue-700' },
    slate:   { bg: 'bg-slate-50',   border: 'border-slate-100',   text: 'text-slate-700' },
  }
  const t = map[tone]
  return (
    <div className={`${t.bg} ${t.border} border rounded-xl p-4`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <div className={`text-lg font-bold ${t.text} ${capitalize ? 'capitalize' : ''}`}>{value}</div>
    </div>
  )
}
