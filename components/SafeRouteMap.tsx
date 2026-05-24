// components/SafeRouteMap.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface RouteData {
  path: { lat: number; lng: number }[]
  distanceKm: string
  avgRiskScore: string
}

interface LatLng { lat: number; lng: number }
type PickMode  = 'start' | 'end' | null
type ViewMode  = 'both' | 'safe' | 'short'
type AppStep   = 'idle' | 'picking_start' | 'picking_end' | 'ready' | 'loading' | 'result'

// Popular Indian cities for quick jump
const CITIES = [
  { name: 'Delhi',       lat: 28.6139, lng: 77.2090, zoom: 12 },
  { name: 'Mumbai',      lat: 19.0760, lng: 72.8777, zoom: 12 },
  { name: 'Bengaluru',   lat: 12.9716, lng: 77.5946, zoom: 12 },
  { name: 'Chennai',     lat: 13.0827, lng: 80.2707, zoom: 12 },
  { name: 'Kolkata',     lat: 22.5726, lng: 88.3639, zoom: 12 },
  { name: 'Hyderabad',   lat: 17.3850, lng: 78.4867, zoom: 12 },
  { name: 'Pune',        lat: 18.5204, lng: 73.8567, zoom: 12 },
  { name: 'Ahmedabad',   lat: 23.0225, lng: 72.5714, zoom: 12 },
  { name: 'Jaipur',      lat: 26.9124, lng: 75.7873, zoom: 12 },
  { name: 'Lucknow',     lat: 26.8467, lng: 80.9462, zoom: 12 },
  { name: 'Kanpur',      lat: 26.4499, lng: 80.3319, zoom: 12 },
  { name: 'Varanasi',    lat: 25.3176, lng: 82.9739, zoom: 12 },
  { name: 'Patna',       lat: 25.5941, lng: 85.1376, zoom: 12 },
  { name: 'Bhopal',      lat: 23.2599, lng: 77.4126, zoom: 12 },
  { name: 'Indore',      lat: 22.7196, lng: 75.8577, zoom: 12 },
  { name: 'Nagpur',      lat: 21.1458, lng: 79.0882, zoom: 12 },
  { name: 'Surat',       lat: 21.1702, lng: 72.8311, zoom: 12 },
  { name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185, zoom: 12 },
]

type MapTheme = 'dark' | 'light'

const TILE_URLS: Record<MapTheme, string> = {
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
}

export default function SafeRouteMap() {
  const mapRef        = useRef<HTMLDivElement>(null)
  const mapInstance   = useRef<any>(null)
  const tileLayerRef  = useRef<any>(null)
  const markersRef    = useRef<{ start: any; end: any }>({ start: null, end: null })
  const routeLayers   = useRef<{ layer: any; type: string }[]>([])
  const heatLayer     = useRef<any>(null)

  const [markers,    setMarkers]    = useState<{ start: LatLng | null; end: LatLng | null }>({ start: null, end: null })
  const [pickMode,   setPickMode]   = useState<PickMode>(null)
  const [step,       setStep]       = useState<AppStep>('idle')
  const [safeRoute,  setSafeRoute]  = useState<RouteData | null>(null)
  const [shortRoute, setShortRoute] = useState<RouteData | null>(null)
  const [routeMeta,  setRouteMeta]  = useState<{
    differs: boolean
    safetyImprovementPct: number
    distancePenaltyPct: number
    lowDataCoverage: boolean
    candidatesEvaluated: number
    dangerousRouteUnavoidable: boolean
  } | null>(null)
  const [alpha,      setAlpha]      = useState(0.6)
  const [viewMode,   setViewMode]   = useState<ViewMode>('both')
  const [heatmapOn,  setHeatmapOn]  = useState(true)
  const [theme,      setTheme]      = useState<MapTheme>('dark')
  const [error,      setError]      = useState<string | null>(null)

  // City search state
  const [cityQuery,     setCityQuery]     = useState('')
  const [cityResults,   setCityResults]   = useState<typeof CITIES>([])
  const [selectedCity,  setSelectedCity]  = useState<typeof CITIES[0] | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    let mounted = true

    const init = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      await import('leaflet.heat')
      if (!mounted || !mapRef.current || mapInstance.current) return
      // @ts-ignore
      if (mapRef.current._leaflet_id) return

      const map = L.map(mapRef.current, {
        center: [22.5, 82.5], zoom: 5, zoomControl: false
      })

      const savedTheme = (typeof window !== 'undefined' && localStorage.getItem('map:theme')) as MapTheme | null
      const initialTheme: MapTheme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark'
      if (initialTheme !== 'dark') setTheme(initialTheme)

      tileLayerRef.current = L.tileLayer(TILE_URLS[initialTheme], {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd', maxZoom: 19,
      }).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)
      mapInstance.current = map

      // Load heatmap
      try {
        const res = await fetch('/api/heatmap')
        if (res.ok) {
          const points = await res.json()
          if (points.length && (L as any).heatLayer) {
            heatLayer.current = (L as any).heatLayer(points, {
              radius: 20, blur: 15, maxZoom: 12,
              gradient: { 0.3: '#1a9e4a', 0.6: '#f5a623', 1.0: '#e8342a' }
            }).addTo(map)
          }
        }
      } catch { /* heatmap optional */ }
    }

    init()
    return () => {
      mounted = false
      if (mapInstance.current) {
        mapInstance.current.off()
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  // ── Map click handler ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    const handler = async (e: any) => {
      if (!pickMode) return
      const L = (await import('leaflet')).default
      const { lat, lng } = e.latlng

      if (pickMode === 'start') {
        markersRef.current.start?.remove()
        markersRef.current.start = L.circleMarker([lat, lng], {
          radius: 10, fillColor: '#4ade80', color: '#fff', weight: 2.5, fillOpacity: 1
        }).bindTooltip('A', { permanent: true, direction: 'top', className: 'map-label' }).addTo(map)
        setMarkers(p => ({ ...p, start: { lat, lng } }))
        setPickMode('end')
        setStep('picking_end')
      } else {
        markersRef.current.end?.remove()
        markersRef.current.end = L.circleMarker([lat, lng], {
          radius: 10, fillColor: '#f87171', color: '#fff', weight: 2.5, fillOpacity: 1
        }).bindTooltip('B', { permanent: true, direction: 'top', className: 'map-label' }).addTo(map)
        setMarkers(p => ({ ...p, end: { lat, lng } }))
        setPickMode(null)
        setStep('ready')
      }
    }

    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [pickMode])

  // ── Heatmap toggle ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstance.current
    if (!map || !heatLayer.current) return
    heatmapOn ? heatLayer.current.addTo(map) : map.removeLayer(heatLayer.current)
  }, [heatmapOn])

  // ── Tile theme swap ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapInstance.current) return
      if (tileLayerRef.current) map.removeLayer(tileLayerRef.current)
      tileLayerRef.current = L.tileLayer(TILE_URLS[theme], {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd', maxZoom: 19,
      }).addTo(map)
      tileLayerRef.current.bringToBack?.()
      if (typeof window !== 'undefined') localStorage.setItem('map:theme', theme)
    })()
    return () => { cancelled = true }
  }, [theme])

  // ── Route visibility toggle ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    routeLayers.current.forEach(({ layer, type }) => {
      const show = viewMode === 'both' || viewMode === type
      show ? layer.addTo(map) : map.removeLayer(layer)
    })
  }, [viewMode])

  // ── City search ──────────────────────────────────────────────────────────────
  const handleCityInput = (q: string) => {
    setCityQuery(q)
    if (!q.trim()) { setCityResults([]); return }
    const lower = q.toLowerCase()
    setCityResults(CITIES.filter(c => c.name.toLowerCase().includes(lower)).slice(0, 6))
  }

  const selectCity = (city: typeof CITIES[0]) => {
    setSelectedCity(city)
    setCityQuery(city.name)
    setCityResults([])
    mapInstance.current?.flyTo([city.lat, city.lng], city.zoom, { duration: 1.2 })
    // Reset points when switching city
    reset()
  }

  // ── Geocode search (fallback via Nominatim) ──────────────────────────────────
  const geocodeSearch = async () => {
    if (!cityQuery.trim()) return
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityQuery)},India&format=json&limit=1`
      )
      const data = await res.json()
      if (data[0]) {
        const lat = parseFloat(data[0].lat)
        const lng = parseFloat(data[0].lon)
        mapInstance.current?.flyTo([lat, lng], 13, { duration: 1.2 })
        setCityResults([])
        reset()
      }
    } catch { /* ignore */ }
  }

  // ── Reset ────────────────────────────────────────────────────────────────────
  const reset = () => {
    markersRef.current.start?.remove()
    markersRef.current.end?.remove()
    routeLayers.current.forEach(({ layer }) => mapInstance.current?.removeLayer(layer))
    routeLayers.current = []
    setSafeRoute(null); setShortRoute(null); setRouteMeta(null)
    setMarkers({ start: null, end: null })
    setPickMode(null); setStep('idle'); setError(null)
  }

  // ── Start picking ────────────────────────────────────────────────────────────
  const startPicking = () => {
    reset()
    setStep('picking_start')
    setPickMode('start')
  }

  // ── Compute routes ────────────────────────────────────────────────────────────
  const compute = useCallback(async () => {
    if (!markers.start || !markers.end) return
    setStep('loading'); setError(null)

    try {
      const res = await fetch('/api/routes/safe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...markers.start && { startLat: markers.start.lat, startLng: markers.start.lng },
          ...markers.end && { endLat: markers.end.lat, endLng: markers.end.lng }, alpha })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Route failed')
      }
      const data = await res.json()
      setSafeRoute(data.safeRoute)
      setShortRoute(data.shortRoute)
      setRouteMeta(data.meta ?? null)
      setStep('result')

      const L = (await import('leaflet')).default
      const map = mapInstance.current
      routeLayers.current.forEach(({ layer }) => map.removeLayer(layer))
      routeLayers.current = []

      const shortPts = data.shortRoute.path.map((n: any) => [n.lat, n.lng])
      const safePts  = data.safeRoute.path.map((n: any)  => [n.lat, n.lng])

      const shortLayer = L.polyline(shortPts, {
        color: '#60a5fa', weight: 4, opacity: 0.75, dashArray: '10 5'
      }).bindPopup(`<b>Shortest</b><br/>${data.shortRoute.distanceKm} km · Risk ${data.shortRoute.avgRiskScore}/100`)

      const safeLayer = L.polyline(safePts, {
        color: '#4ade80', weight: 5, opacity: 0.9
      }).bindPopup(`<b>Safest</b><br/>${data.safeRoute.distanceKm} km · Risk ${data.safeRoute.avgRiskScore}/100`)

      routeLayers.current = [{ layer: shortLayer, type: 'short' }, { layer: safeLayer, type: 'safe' }]
      shortLayer.addTo(map); safeLayer.addTo(map)
      map.fitBounds(L.latLngBounds([...shortPts, ...safePts]), { padding: [60, 60] })
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setStep('ready')
    }
  }, [markers, alpha])

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const riskColor = (s: string) => {
    const n = parseInt(s)
    if (n < 30) return '#4ade80'
    if (n < 60) return '#fbbf24'
    if (n < 80) return '#f97316'
    return '#ef4444'
  }
  const riskLabel = (s: string) => {
    const n = parseInt(s)
    if (n < 30) return 'Safe'
    if (n < 60) return 'Moderate'
    if (n < 80) return 'High Risk'
    return 'Critical'
  }

  const isPicking = step === 'picking_start' || step === 'picking_end'

  // ── Styles ────────────────────────────────────────────────────────────────────
  const panel: React.CSSProperties = {
    background: 'rgba(13,15,20,0.92)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
    padding: '14px 16px'
  }
  const label: React.CSSProperties = {
    margin: '0 0 10px', fontSize: 10, fontWeight: 600,
    color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em'
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0a0c10',
      fontFamily: "'Inter', 'DM Sans', sans-serif", overflow: 'hidden' }}>

      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* ── Top bar ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1100,
        background: 'rgba(10,12,16,0.88)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4ade80"/>
            <circle cx="12" cy="9" r="2.5" fill="#0a0c10"/>
          </svg>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>SafeNav</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>Women Safety</span>
        </div>

        {/* City search */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.06)', border: `1px solid ${searchFocused ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 10, padding: '7px 12px', transition: 'border-color 0.2s'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={cityQuery}
              onChange={e => handleCityInput(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={e => e.key === 'Enter' && geocodeSearch()}
              placeholder="Search city or area..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#fff', fontSize: 13, fontFamily: 'inherit'
              }}
            />
            {cityQuery && (
              <button onClick={() => { setCityQuery(''); setCityResults([]) }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 0, fontSize: 16 }}>×</button>
            )}
          </div>

          {/* Dropdown */}
          {cityResults.length > 0 && searchFocused && (
            <div style={{
              position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 1200,
              background: 'rgba(13,15,20,0.98)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}>
              {cityResults.map(city => (
                <button key={city.name} onClick={() => selectCity(city)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: 'none', border: 'none',
                  color: '#fff', fontSize: 13, cursor: 'pointer', textAlign: 'left',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'background 0.15s'
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,222,128,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#4ade80">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  </svg>
                  {city.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Heatmap toggle */}
        <button onClick={() => setHeatmapOn(h => !h)} style={{
          background: heatmapOn ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${heatmapOn ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.1)'}`,
          color: heatmapOn ? '#fbbf24' : 'rgba(255,255,255,0.45)',
          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
        }}>
          {heatmapOn ? '◉' : '○'} Heatmap
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} map`}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.7)',
            padding: '6px 10px', borderRadius: 8, fontSize: 14,
            cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32,
          }}
        >
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Left panel ── */}
      <div style={{
        position: 'absolute', top: 64, left: 14, bottom: 14, width: 292,
        display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1000, overflowY: 'auto',
        scrollbarWidth: 'none'
      }}>

        {/* Step 1: Choose city */}
        <div style={panel}>
          <p style={label}>Step 1 — Choose Area</p>
          {selectedCity ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{selectedCity.name}</span>
              </div>
              <button onClick={() => { setSelectedCity(null); setCityQuery('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 12 }}>
                Change
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              Search for a city above to zoom the map
            </p>
          )}
        </div>

        {/* Step 2: Place points */}
        <div style={panel}>
          <p style={label}>Step 2 — Set Points</p>

          {/* Point A */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: step === 'picking_start' ? '#4ade80' : markers.start ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)',
                border: `1.5px solid ${markers.start ? '#4ade80' : 'rgba(255,255,255,0.12)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: step === 'picking_start' ? '#000' : markers.start ? '#4ade80' : 'rgba(255,255,255,0.25)'
              }}>A</div>
              <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.08)', marginTop: 3 }} />
            </div>
            <div style={{ paddingTop: 3 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: step === 'picking_start' ? '#4ade80' : '#fff' }}>Start Point</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: markers.start ? '#4ade80' : 'rgba(255,255,255,0.25)',
                fontFamily: 'monospace' }}>
                {markers.start ? `${markers.start.lat.toFixed(4)}, ${markers.start.lng.toFixed(4)}` : 'Not set'}
              </p>
            </div>
          </div>

          {/* Point B */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: step === 'picking_end' ? '#f87171' : markers.end ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.06)',
              border: `1.5px solid ${markers.end ? '#f87171' : 'rgba(255,255,255,0.12)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: step === 'picking_end' ? '#000' : markers.end ? '#f87171' : 'rgba(255,255,255,0.25)'
            }}>B</div>
            <div style={{ paddingTop: 3 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: step === 'picking_end' ? '#f87171' : '#fff' }}>End Point</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: markers.end ? '#f87171' : 'rgba(255,255,255,0.25)',
                fontFamily: 'monospace' }}>
                {markers.end ? `${markers.end.lat.toFixed(4)}, ${markers.end.lng.toFixed(4)}` : 'Not set'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={startPicking} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: isPicking ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${isPicking ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.1)'}`,
              color: isPicking ? '#4ade80' : 'rgba(255,255,255,0.6)'
            }}>
              {isPicking
                ? (step === 'picking_start' ? '→ Click start' : '→ Click end')
                : markers.start || markers.end ? '↺ Reset' : '+ Place Points'}
            </button>

            {step === 'ready' && (
              <button onClick={compute} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: '#4ade80', border: 'none', color: '#000', cursor: 'pointer'
              }}>Find Routes →</button>
            )}
          </div>

          {error && (
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 7,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171', fontSize: 11 }}>{error}</div>
          )}
        </div>

        {/* Step 3: Safety slider */}
        <div style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ ...label, margin: 0 }}>Step 3 — Safety Priority</p>
            <span style={{ fontSize: 12, fontWeight: 600, color: alpha > 0.6 ? '#4ade80' : alpha > 0.3 ? '#fbbf24' : '#60a5fa',
              fontFamily: 'monospace' }}>{Math.round(alpha * 100)}%</span>
          </div>
          <input type="range" min={0} max={1} step={0.05} value={alpha}
            onChange={e => setAlpha(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#4ade80', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>⚡ Fastest</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>🛡 Safest</span>
          </div>
        </div>

        {/* Loading */}
        {step === 'loading' && (
          <div style={{ ...panel, textAlign: 'center' }}>
            <div style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid rgba(74,222,128,0.2)',
              borderTop: '2px solid #4ade80', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Computing routes...</p>
          </div>
        )}

        {/* Results */}
        {safeRoute && shortRoute && step === 'result' && (
          <div style={panel}>
            <p style={label}>Route Comparison</p>

            {/* Toggle */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3, marginBottom: 12 }}>
              {(['both', 'safe', 'short'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setViewMode(v)} style={{
                  flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 500,
                  background: viewMode === v ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: 'none', color: viewMode === v ? '#fff' : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer', textTransform: 'capitalize'
                }}>{v === 'both' ? 'Both' : v === 'safe' ? '🛡 Safe' : '⚡ Short'}</button>
              ))}
            </div>

            {/* Safe card */}
            {[
              { route: safeRoute,  label: 'Safest Route',   color: '#4ade80', lineStyle: 'solid' },
              { route: shortRoute, label: 'Shortest Route', color: '#60a5fa', lineStyle: 'dashed' },
            ].map(({ route, label: lbl, color, lineStyle }) => (
              <div key={lbl} style={{
                background: `rgba(${color === '#4ade80' ? '74,222,128' : '96,165,250'},0.06)`,
                border: `1px solid rgba(${color === '#4ade80' ? '74,222,128' : '96,165,250'},0.2)`,
                borderRadius: 10, padding: '11px 13px', marginBottom: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 22, height: 3, background: color, borderRadius: 2,
                    backgroundImage: lineStyle === 'dashed' ? `repeating-linear-gradient(90deg,${color} 0,${color} 6px,transparent 6px,transparent 10px)` : undefined }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color }}>{lbl}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Distance</p>
                    <p style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>
                      {route.distanceKm}<span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.35)' }}> km</span>
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Risk Score</p>
                    <p style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 600, color: riskColor(route.avgRiskScore), fontFamily: 'monospace' }}>
                      {route.avgRiskScore}<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>/100</span>
                    </p>
                  </div>
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                    <div style={{ width: `${route.avgRiskScore}%`, height: '100%',
                      background: riskColor(route.avgRiskScore), borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                  <span style={{ fontSize: 10, color: riskColor(route.avgRiskScore), fontWeight: 600 }}>
                    {riskLabel(route.avgRiskScore)}
                  </span>
                </div>
              </div>
            ))}

            {/* Smart status banner */}
            {(() => {
              if (routeMeta?.lowDataCoverage) return (
                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
                  fontSize: 11, color: '#fbbf24', lineHeight: 1.5,
                }}>
                  <strong style={{ display: 'block', marginBottom: 2 }}>⚠ Low risk-data coverage</strong>
                  We don't have crime data for this area yet, so we can't suggest a safer alternative.
                </div>
              )

              // Hardest case: no safer alternative AND the route passes through dangerous zones.
              if (routeMeta?.dangerousRouteUnavoidable) {
                const criticalKm = parseFloat((safeRoute as any).criticalDistanceKm ?? '0')
                const peak = parseInt((safeRoute as any).peakRiskScore ?? '0')
                return (
                  <div style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                    fontSize: 11, color: '#fca5a5', lineHeight: 1.5,
                  }}>
                    <strong style={{ display: 'block', marginBottom: 2, color: '#f87171' }}>
                      ⚠ Route passes through dangerous zones
                    </strong>
                    {criticalKm > 0 && <>{criticalKm.toFixed(1)} km in critical-risk areas (peak {peak}/100). </>}
                    No safer alternative found across {routeMeta.candidatesEvaluated} detours — consider travelling in daylight or with company.
                  </div>
                )
              }

              if (!routeMeta?.differs) return (
                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                  fontSize: 11, color: '#93c5fd', lineHeight: 1.5,
                }}>
                  <strong style={{ display: 'block', marginBottom: 2 }}>✓ Route is already optimal</strong>
                  We evaluated {routeMeta?.candidatesEvaluated ?? 0} alternatives — none were meaningfully safer than the direct route.
                </div>
              )

              return (
                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>
                      ↓ {routeMeta.safetyImprovementPct}% safer
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                      +{routeMeta.distancePenaltyPct}% distance
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    Best of {routeMeta.candidatesEvaluated} detour candidates
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Legend */}
        <div style={panel}>
          <p style={label}>Crime Heatmap Legend</p>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['#4ade80','Low'],['#fbbf24','Medium'],['#f97316','High'],['#ef4444','Critical']].map(([c, l]) => (
              <div key={l} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ width: '100%', height: 3, background: c, borderRadius: 2, marginBottom: 4 }} />
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hint bar */}
      {isPicking && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,12,16,0.95)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 30,
          padding: '10px 24px', zIndex: 1001,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%',
            background: step === 'picking_start' ? '#4ade80' : '#f87171',
            animation: 'pulse 1.2s ease-in-out infinite' }} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
            {step === 'picking_start'
              ? 'Click the map to set your start point (A)'
              : 'Click the map to set your destination (B)'}
          </span>
        </div>
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.4)} }
        .leaflet-container { cursor: ${pickMode ? 'crosshair' : 'grab'} !important; }
        .map-label.leaflet-tooltip {
          background: rgba(10,12,16,0.9); border: 1px solid rgba(255,255,255,0.12);
          color: #fff; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 6px;
          font-family: 'Inter', sans-serif;
        }
        .leaflet-popup-content-wrapper {
          background: rgba(10,12,16,0.96); border: 1px solid rgba(255,255,255,0.1);
          color: #fff; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 13px;
        }
        .leaflet-popup-tip { background: rgba(10,12,16,0.96); }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}