// app/analytics/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, MapPin, AlertTriangle, Download, Filter } from 'lucide-react'
import Link from 'next/link'

// Types
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
  historical: { years: number[], values: number[] }
  forecast: { years: number[], values: number[] }
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
}

type CrimeType = 'rape' | 'kidnapping' | 'dowry_death' | 'assault_women' | 'insult_modesty' | 'cruelty_husband' | 'importation_girls'

const CRIME_LABELS: Record<CrimeType, string> = {
  rape: 'Rape',
  kidnapping: 'Kidnapping & Abduction',
  dowry_death: 'Dowry Deaths',
  assault_women: 'Assault on Women',
  insult_modesty: 'Insult to Modesty',
  cruelty_husband: 'Cruelty by Husband',
  importation_girls: 'Importation of Girls'
}

const CRIME_COLORS: Record<CrimeType, string> = {
  rape: '#ef4444',
  kidnapping: '#f97316',
  dowry_death: '#ec4899',
  assault_women: '#f59e0b',
  insult_modesty: '#eab308',
  cruelty_husband: '#06b6d4',
  importation_girls: '#8b5cf6'
}

// Indian States list (for demo)
const INDIAN_STATES = [
  'ANDHRA PRADESH', 'UTTAR PRADESH', 'MADHYA PRADESH', 'MAHARASHTRA',
  'WEST BENGAL', 'BIHAR', 'RAJASTHAN', 'KARNATAKA', 'TAMIL NADU', 'GUJARAT',
  'DELHI', 'KERALA', 'ODISHA', 'HARYANA', 'PUNJAB', 'JHARKHAND',
  'CHHATTISGARH', 'ASSAM', 'HIMACHAL PRADESH', 'UTTARAKHAND'
]

export default function CrimeAnalyticsPage() {
  // State management
  const [selectedState, setSelectedState] = useState<string>('ANDHRA PRADESH')
  const [selectedCrimeType, setSelectedCrimeType] = useState<CrimeType>('rape')
  const [stats, setStats] = useState<CrimeStats | null>(null)
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'forecast' | 'hotspots'>('overview')

  // Fetch state statistics
  const fetchStats = useCallback(async (state: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics/state-stats?state=${encodeURIComponent(state)}`)
      if (!res.ok) throw new Error('Failed to fetch statistics')
      const data = await res.json()
      setStats(data)
    } catch (err: any) {
      setError(err.message)
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch forecast
  const fetchForecast = useCallback(async (state: string, crimeType: CrimeType) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state,
          crimeType,
          yearsAhead: 3
        })
      })
      if (!res.ok) throw new Error('Failed to fetch forecast')
      const data = await res.json()
      setForecast(data)
    } catch (err: any) {
      setError(err.message)
      setForecast(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch hotspots
  const fetchHotspots = useCallback(async (state: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics/hotspots?state=${encodeURIComponent(state)}&limit=15`)
      if (!res.ok) throw new Error('Failed to fetch hotspots')
      const data = await res.json()
      setHotspots(data.hotspots || [])
    } catch (err: any) {
      setError(err.message)
      setHotspots([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchStats(selectedState)
    if (activeTab === 'forecast') {
      fetchForecast(selectedState, selectedCrimeType)
    } else if (activeTab === 'hotspots') {
      fetchHotspots(selectedState)
    }
  }, [selectedState]) // eslint-disable-line react-hooks/exhaustive-deps


  const handleStateChange = (state: string) => {
    setSelectedState(state)
    setForecast(null)
    setHotspots([])
  }

  const handleCrimeTypeChange = (type: CrimeType) => {
    setSelectedCrimeType(type)
  }

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab)
    if (tab === 'forecast') {
      fetchForecast(selectedState, selectedCrimeType)
    } else if (tab === 'hotspots') {
      fetchHotspots(selectedState)
    }
  }

  // Mini chart for trends
  const MiniChart = ({ values }: { values: number[] }) => {
    if (!values || values.length === 0) return null
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = max - min || 1

    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
        {values.slice(-12).map((v, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${((v - min) / range) * 100}%`,
              background: v > max * 0.7 ? '#ef4444' : v > max * 0.4 ? '#f59e0b' : '#4ade80',
              borderRadius: 2,
              minHeight: 2
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#fff',
      fontFamily: '"JetBrains Mono", "Courier New", monospace'
    }}>
      {/* Header */}
      <header style={{
        padding: '20px 32px',
        borderBottom: '1px solid rgba(148,163,184,0.1)',
        background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>
                Crime Analytics Dashboard
              </h1>
              <p style={{ margin: '4px 0 0', color: 'rgba(226,232,240,0.6)', fontSize: 14 }}>
                Comprehensive analysis of crimes against women in India (2001-2014)
              </p>
            </div>
            <Link href="/dashboard" style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: 'rgba(226,232,240,0.1)',
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: 13,
              border: '1px solid rgba(148,163,184,0.2)',
              cursor: 'pointer'
            }}>
              ← Back to Dashboard
            </Link>
          </div>

          {/* State selector */}
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid rgba(148,163,184,0.3)',
                background: 'rgba(226,232,240,0.05)',
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              {INDIAN_STATES.map(state => (
                <option key={state} value={state} style={{ color: '#000' }}>{state}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '32px' }}>
        {error && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5',
            marginBottom: 24,
            fontSize: 13
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
          {(['overview', 'forecast', 'hotspots'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: 'none',
                color: activeTab === tab ? '#60a5fa' : 'rgba(148,163,184,0.6)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: activeTab === tab ? 600 : 400,
                borderBottom: activeTab === tab ? '2px solid #60a5fa' : 'transparent',
                transition: 'all 0.3s ease'
              }}
            >
              {tab === 'overview' && '📊 Overview'}
              {tab === 'forecast' && '🔮 Forecast'}
              {tab === 'hotspots' && '🔴 Hotspots'}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{
              display: 'inline-block',
              width: 40,
              height: 40,
              border: '2px solid rgba(96,165,250,0.2)',
              borderTop: '2px solid #60a5fa',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ marginTop: 16, color: 'rgba(148,163,184,0.7)' }}>Loading data...</p>
          </div>
        )}

        {!loading && activeTab === 'overview' && stats && (
          <>
            {/* Key Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
              {Object.entries(stats.crimes).map(([key, crime]) => (
                <div
                  key={key}
                  style={{
                    padding: 20,
                    borderRadius: 12,
                    background: 'rgba(226,232,240,0.03)',
                    border: '1px solid rgba(148,163,184,0.1)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'rgba(148,163,184,0.3)'
                    el.style.background = 'rgba(226,232,240,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'rgba(148,163,184,0.1)'
                    el.style.background = 'rgba(226,232,240,0.03)'
                  }}
                >
                  <div style={{ color: CRIME_COLORS[key as CrimeType], fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                    {CRIME_LABELS[key as CrimeType]}
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
                    {crime.total.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)', marginBottom: 8 }}>
                    Avg per year: {crime.avg_per_year.toFixed(0)}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <MiniChart values={Object.values(crime.yearly)} />
                  </div>
                </div>
              ))}
            </div>

            {/* Crime Type Breakdown */}
            <div style={{
              padding: 24,
              borderRadius: 12,
              background: 'rgba(226,232,240,0.03)',
              border: '1px solid rgba(148,163,184,0.1)',
              marginBottom: 32
            }}>
              <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600 }}>
                Crime Distribution by Type
              </h2>

              {/* Crime type selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {Object.entries(CRIME_LABELS).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => handleCrimeTypeChange(type as CrimeType)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: `1px solid ${selectedCrimeType === type ? CRIME_COLORS[type as CrimeType] : 'rgba(148,163,184,0.2)'}`,
                      background: selectedCrimeType === type ? 'rgba(96,165,250,0.1)' : 'transparent',
                      color: selectedCrimeType === type ? '#60a5fa' : 'rgba(148,163,184,0.6)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: selectedCrimeType === type ? 600 : 400,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Yearly trend for selected crime */}
              {stats.crimes[selectedCrimeType] && (
                <div>
                  <div style={{ fontSize: 14, color: 'rgba(148,163,184,0.7)', marginBottom: 12 }}>
                    Yearly cases: {selectedCrimeType in stats.crimes ? Object.values(stats.crimes[selectedCrimeType].yearly).join(' → ') : 'N/A'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: '200px' }}>
                    {Object.entries(stats.crimes[selectedCrimeType].yearly).map(([year, value]) => {
                      const maxVal = Math.max(...Object.values(stats.crimes[selectedCrimeType].yearly))
                      const barHeight = Math.round((value / maxVal) * 180) // px, max 180px leaving room for label

                      return (
                        <div
                          key={year}
                          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: `${barHeight}px`,   // ← explicit px, always resolves
                              background: CRIME_COLORS[selectedCrimeType],
                              borderRadius: '4px 4px 0 0',
                              transition: 'all 0.3s ease',
                              cursor: 'pointer',
                              minHeight: 2
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                            title={`${year}: ${value}`}
                          />
                          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 8 }}>
                            {year}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!loading && activeTab === 'forecast' && (
          <div style={{
            padding: 24,
            borderRadius: 12,
            background: 'rgba(226,232,240,0.03)',
            border: '1px solid rgba(148,163,184,0.1)'
          }}>
            <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600 }}>
              3-Year Crime Forecast
            </h2>

            {/* Crime type selector for forecast */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              {Object.entries(CRIME_LABELS).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedCrimeType(type as CrimeType)
                    fetchForecast(selectedState, type as CrimeType)
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: `1px solid ${selectedCrimeType === type ? CRIME_COLORS[type as CrimeType] : 'rgba(148,163,184,0.2)'}`,
                    background: selectedCrimeType === type ? 'rgba(96,165,250,0.1)' : 'transparent',
                    color: selectedCrimeType === type ? '#60a5fa' : 'rgba(148,163,184,0.6)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: selectedCrimeType === type ? 600 : 400,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {forecast && (
              <div>
                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                  <div style={{ padding: 16, background: 'rgba(96,165,250,0.1)', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', marginBottom: 6 }}>Model R² Score</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: forecast.metrics.r2_score > 0.7 ? '#4ade80' : '#f59e0b' }}>
                      {(forecast.metrics.r2_score * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div style={{ padding: 16, background: 'rgba(96,165,250,0.1)', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', marginBottom: 6 }}>Confidence</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#4ade80', textTransform: 'capitalize' }}>
                      {forecast.metrics.confidence}
                    </div>
                  </div>
                  <div style={{ padding: 16, background: 'rgba(96,165,250,0.1)', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', marginBottom: 6 }}>Trend</div>
                    <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {forecast.metrics.trend_direction === 'increasing' ? (
                        <>
                          <TrendingUp style={{ width: 16, height: 16, color: '#ef4444' }} />
                          <span style={{ color: '#ef4444' }}>↑ {forecast.metrics.trend_magnitude_percent.toFixed(1)}%</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown style={{ width: 16, height: 16, color: '#4ade80' }} />
                          <span style={{ color: '#4ade80' }}>↓ {forecast.metrics.trend_magnitude_percent.toFixed(1)}%</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Combined chart - Historical + Forecast */}
                <div style={{ marginTop: 24 }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>
                    Historical & Forecasted Cases
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: '240px' }}>
                    {(() => {
                      const maxVal = Math.max(
                        ...forecast.historical.values,
                        ...forecast.forecast.values
                      )
                      return (
                        <>
                          {/* Historical bars */}
                          {forecast.historical.values.map((value, i) => {
                            const barHeight = Math.round((value / maxVal) * 220)
                            return (
                              <div
                                key={`hist-${i}`}
                                style={{
                                  flex: 1,
                                  height: `${barHeight}px`,
                                  background: CRIME_COLORS[selectedCrimeType],
                                  borderRadius: 2,
                                  opacity: 1,
                                  transition: 'all 0.3s ease',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                                title={`${forecast.historical.years[i]}: ${value}`}
                              />
                            )
                          })}

                          {/* Forecast bars (lighter) */}
                          {forecast.forecast.values.map((value, i) => {
                            const barHeight = Math.round((value / maxVal) * 220)
                            return (
                              <div
                                key={`forecast-${i}`}
                                style={{
                                  flex: 1,
                                  height: `${barHeight}px`,
                                  background: CRIME_COLORS[selectedCrimeType],
                                  borderRadius: 2,
                                  opacity: 0.4,
                                  borderTop: `2px dashed ${CRIME_COLORS[selectedCrimeType]}`,
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.6' }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.4' }}
                                title={`${forecast.forecast.years[i]} (Forecast): ${value.toFixed(0)}`}
                              />
                            )
                          })}
                        </>
                      )
                    })()}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 12 }}>
                    <span>Historical (2001-2014)</span>
                    <span>Forecast (2015-2017)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'hotspots' && (
          <div>
            <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600 }}>
              Crime Hotspots in {selectedState}
            </h2>

            <div style={{ display: 'grid', gap: 12 }}>
              {hotspots.length > 0 ? (
                hotspots.map((hotspot, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 20,
                      borderRadius: 12,
                      background: 'rgba(226,232,240,0.03)',
                      border: '1px solid rgba(148,163,184,0.1)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = 'rgba(148,163,184,0.3)'
                      el.style.background = 'rgba(226,232,240,0.08)'
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = 'rgba(148,163,184,0.1)'
                      el.style.background = 'rgba(226,232,240,0.03)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <MapPin style={{ width: 16, height: 16, color: '#ef4444' }} />
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                            {hotspot.district}
                          </h3>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: 'rgba(148,163,184,0.6)' }}>
                          {hotspot.total_crimes.toLocaleString()} total crimes recorded
                        </p>
                      </div>
                      <div style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: hotspot.severity_score > 2000 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                        color: hotspot.severity_score > 2000 ? '#fca5a5' : '#fed7aa',
                        fontSize: 12,
                        fontWeight: 600
                      }}>
                        {hotspot.severity_score > 2000 ? '🔴 CRITICAL' : '🟠 HIGH'}
                      </div>
                    </div>

                    {/* Crime breakdown */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                      {Object.entries(hotspot.crime_breakdown).map(([type, count]) => (
                        <div
                          key={type}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            background: 'rgba(226,232,240,0.05)',
                            border: `1px solid ${CRIME_COLORS[type as CrimeType]}33`
                          }}
                        >
                          <div style={{ fontSize: 11, color: CRIME_COLORS[type as CrimeType], fontWeight: 600, marginBottom: 4 }}>
                            {CRIME_LABELS[type as CrimeType]}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                            {count.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{
                  padding: 40,
                  textAlign: 'center',
                  color: 'rgba(148,163,184,0.6)',
                  fontSize: 14
                }}>
                  No hotspot data available for this state
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}