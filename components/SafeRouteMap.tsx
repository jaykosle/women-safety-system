// components/SafeRouteMap.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface RouteData {
  path: { lat: number; lng: number }[]
  distanceKm: string
  avgRiskScore: string
}

interface MarkerState {
  start: { lat: number; lng: number } | null
  end: { lat: number; lng: number } | null
}

type PickMode = 'start' | 'end' | null
type ViewMode = 'both' | 'safe' | 'short'

export default function SafeRouteMap() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markersRef = useRef<{ start: any; end: any }>({ start: null, end: null })
  const routeLayersRef = useRef<any[]>([])
  const heatLayerRef = useRef<any>(null)

  const [markers, setMarkers] = useState<MarkerState>({ start: null, end: null })
  const [pickMode, setPickMode] = useState<PickMode>(null)
  const [loading, setLoading] = useState(false)
  const [safeRoute, setSafeRoute] = useState<RouteData | null>(null)
  const [shortRoute, setShortRoute] = useState<RouteData | null>(null)
  const [alpha, setAlpha] = useState(0.6)
  const [viewMode, setViewMode] = useState<ViewMode>('both')
  const [error, setError] = useState<string | null>(null)
  const [heatmapOn, setHeatmapOn] = useState(true)
  const [step, setStep] = useState<'idle' | 'picking_start' | 'picking_end' | 'ready' | 'result'>('idle')

  // Init map
// Init map
  useEffect(() => {
    if (typeof window === 'undefined') return

    const init = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      await import('leaflet.heat')

      if (!mapRef.current) return

      // --- FIX: Prevent re-initialization if map already exists ---
      if (mapInstance.current) return;
      
      // Secondary check: if the DOM element is already "owned" by Leaflet
      // @ts-ignore
      if (mapRef.current._leaflet_id) return;

      const map = L.map(mapRef.current, {
        center: [22.5, 82.5],
        zoom: 5,
        zoomControl: false
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      mapInstance.current = map

      // Load heatmap
      try {
        const res = await fetch('/api/heatmap')
        if (res.ok) {
          const points = await res.json()
          if (points.length && (L as any).heatLayer) {
            heatLayerRef.current = (L as any).heatLayer(points, {
              radius: 20,
              blur: 15,
              maxZoom: 12,
              gradient: { 0.3: '#1a9e4a', 0.6: '#f5a623', 1.0: '#e8342a' }
            })
            heatLayerRef.current.addTo(map)
          }
        }
      } catch (err) {
        console.error("Heatmap load failed:", err)
      }
    }

    init()

    // --- FIX: Robust Cleanup ---
    return () => {
      if (mapInstance.current) {
        mapInstance.current.off(); // Remove event listeners
        mapInstance.current.remove(); // Destroy map instance
        mapInstance.current = null; // Reset the ref
      }
    }
  }, [])

  // Click handler based on pickMode
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
          radius: 10,
          fillColor: '#4ade80',
          color: '#fff',
          weight: 2,
          fillOpacity: 1
        }).bindTooltip('Start', { permanent: true, direction: 'top' }).addTo(map)

        setMarkers(prev => ({ ...prev, start: { lat, lng } }))
        setPickMode('end')
        setStep('picking_end')
      } else if (pickMode === 'end') {
        markersRef.current.end?.remove()
        markersRef.current.end = L.circleMarker([lat, lng], {
          radius: 10,
          fillColor: '#f87171',
          color: '#fff',
          weight: 2,
          fillOpacity: 1
        }).bindTooltip('End', { permanent: true, direction: 'top' }).addTo(map)

        setMarkers(prev => ({ ...prev, end: { lat, lng } }))
        setPickMode(null)
        setStep('ready')
      }
    }

    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [pickMode])

  // Toggle heatmap
  useEffect(() => {
    const map = mapInstance.current
    if (!map || !heatLayerRef.current) return
    if (heatmapOn) {
      heatLayerRef.current.addTo(map)
    } else {
      map.removeLayer(heatLayerRef.current)
    }
  }, [heatmapOn])

  // Update route visibility
  useEffect(() => {
    routeLayersRef.current.forEach(({ layer, type }) => {
      if (!mapInstance.current) return
      if (viewMode === 'both') {
        layer.addTo(mapInstance.current)
      } else if (viewMode === 'safe' && type === 'safe') {
        layer.addTo(mapInstance.current)
      } else if (viewMode === 'short' && type === 'short') {
        layer.addTo(mapInstance.current)
      } else {
        mapInstance.current.removeLayer(layer)
      }
    })
  }, [viewMode])

  const startPicking = () => {
    // Clear previous
    markersRef.current.start?.remove()
    markersRef.current.end?.remove()
    routeLayersRef.current.forEach(({ layer }) => mapInstance.current?.removeLayer(layer))
    routeLayersRef.current = []
    setSafeRoute(null)
    setShortRoute(null)
    setMarkers({ start: null, end: null })
    setStep('picking_start')
    setPickMode('start')
    setError(null)
  }

  const computeRoutes = useCallback(async () => {
    if (!markers.start || !markers.end) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/routes/safe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startLat: markers.start.lat,
          startLng: markers.start.lng,
          endLat: markers.end.lat,
          endLng: markers.end.lng,
          alpha
        })
      })

      if (!res.ok) throw new Error('Route computation failed')
      const data = await res.json()

      setSafeRoute(data.safeRoute)
      setShortRoute(data.shortRoute)
      setStep('result')

      // Draw routes
      const L = (await import('leaflet')).default
      const map = mapInstance.current
      routeLayersRef.current.forEach(({ layer }) => map.removeLayer(layer))
      routeLayersRef.current = []

      const shortPath = data.shortRoute.path.map((n: any) => [n.lat, n.lng])
      const shortLayer = L.polyline(shortPath, {
        color: '#60a5fa',
        weight: 4,
        opacity: 0.7,
        dashArray: '8 4'
      }).bindPopup(
        `<b>Shortest Route</b><br/>Distance: ${data.shortRoute.distanceKm} km<br/>Risk: ${data.shortRoute.avgRiskScore}/100`
      )

      const safePath = data.safeRoute.path.map((n: any) => [n.lat, n.lng])
      const safeLayer = L.polyline(safePath, {
        color: '#4ade80',
        weight: 5,
        opacity: 0.9
      }).bindPopup(
        `<b>Safest Route</b><br/>Distance: ${data.safeRoute.distanceKm} km<br/>Risk: ${data.safeRoute.avgRiskScore}/100`
      )

      routeLayersRef.current = [
        { layer: shortLayer, type: 'short' },
        { layer: safeLayer, type: 'safe' }
      ]

      shortLayer.addTo(map)
      safeLayer.addTo(map)

      const allPoints = [...shortPath, ...safePath]
      map.fitBounds(L.latLngBounds(allPoints), { padding: [60, 60] })

    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [markers, alpha])

  const getRiskColor = (score: string) => {
    const n = parseInt(score)
    if (n < 30) return '#4ade80'
    if (n < 60) return '#fbbf24'
    if (n < 80) return '#f97316'
    return '#ef4444'
  }

  const getRiskLabel = (score: string) => {
    const n = parseInt(score)
    if (n < 30) return 'Safe'
    if (n < 60) return 'Moderate'
    if (n < 80) return 'High Risk'
    return 'Critical'
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#0f1117', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden' }}>

      {/* Google Font */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        background: 'rgba(15,17,23,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }}>SafeNav</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Women Safety Route Planner</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setHeatmapOn(h => !h)}
            style={{
              background: heatmapOn ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${heatmapOn ? 'rgba(234,179,8,0.4)' : 'rgba(255,255,255,0.1)'}`,
              color: heatmapOn ? '#fbbf24' : 'rgba(255,255,255,0.5)',
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {heatmapOn ? '◉' : '○'} Crime Heatmap
          </button>
        </div>
      </div>

      {/* Left panel */}
      <div style={{
        position: 'absolute', top: 64, left: 16, bottom: 16, width: 300,
        display: 'flex', flexDirection: 'column', gap: 10, zIndex: 1000
      }}>

        {/* Step guide */}
        <div style={{
          background: 'rgba(15,17,23,0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: '16px 18px'
        }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Route Planner</p>

          {/* Steps */}
          {[
            { id: 'start', label: 'Origin', sub: markers.start ? `${markers.start.lat.toFixed(4)}, ${markers.start.lng.toFixed(4)}` : 'Click to place on map', color: '#4ade80', active: step === 'picking_start' },
            { id: 'end', label: 'Destination', sub: markers.end ? `${markers.end.lat.toFixed(4)}, ${markers.end.lng.toFixed(4)}` : 'Click to place on map', color: '#f87171', active: step === 'picking_end' },
          ].map((item, i) => (
            <div key={item.id} style={{ display: 'flex', gap: 12, marginBottom: i === 0 ? 10 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: item.active ? item.color : markers[item.id as 'start' | 'end'] ? item.color + '30' : 'rgba(255,255,255,0.06)',
                  border: `1.5px solid ${item.active ? item.color : markers[item.id as 'start' | 'end'] ? item.color : 'rgba(255,255,255,0.12)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600,
                  color: item.active ? '#000' : markers[item.id as 'start' | 'end'] ? item.color : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.3s', flexShrink: 0
                }}>{i + 1}</div>
                {i === 0 && <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.1)', margin: '3px 0' }} />}
              </div>
              <div style={{ paddingTop: 4 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: item.active ? '#fff' : 'rgba(255,255,255,0.6)' }}>{item.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: markers[item.id as 'start' | 'end'] ? item.color : 'rgba(255,255,255,0.25)', fontFamily: "'DM Mono', monospace" }}>{item.sub}</p>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button
              onClick={startPicking}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: step === 'picking_start' || step === 'picking_end'
                  ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${step === 'picking_start' || step === 'picking_end' ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: step === 'picking_start' || step === 'picking_end' ? '#4ade80' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {step === 'picking_start' ? '→ Click start point' : step === 'picking_end' ? '→ Click end point' : '+ Set Points'}
            </button>

            {step === 'ready' && (
              <button
                onClick={computeRoutes}
                disabled={loading}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: loading ? 'rgba(74,222,128,0.1)' : '#4ade80',
                  border: 'none',
                  color: loading ? '#4ade80' : '#000',
                  cursor: loading ? 'default' : 'pointer', transition: 'all 0.2s'
                }}
              >
                {loading ? 'Computing...' : 'Find Safe Route'}
              </button>
            )}
          </div>

          {error && (
            <p style={{ margin: '10px 0 0', fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '8px 10px', borderRadius: 6 }}>{error}</p>
          )}
        </div>

        {/* Alpha slider */}
        <div style={{
          background: 'rgba(15,17,23,0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: '14px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Safety Priority</p>
            <span style={{ fontSize: 12, fontWeight: 500, color: alpha > 0.6 ? '#4ade80' : alpha > 0.3 ? '#fbbf24' : '#60a5fa', fontFamily: "'DM Mono', monospace" }}>
              {Math.round(alpha * 100)}%
            </span>
          </div>
          <input
            type="range" min={0} max={1} step={0.05} value={alpha}
            onChange={e => setAlpha(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#4ade80' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Fastest</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Safest</span>
          </div>
        </div>

        {/* Results */}
        {safeRoute && shortRoute && (
          <div style={{
            background: 'rgba(15,17,23,0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '14px 18px'
          }}>
            <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Route Comparison</p>

            {/* View toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 4 }}>
              {(['both', 'safe', 'short'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 500,
                    background: viewMode === v ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: 'none', color: viewMode === v ? '#fff' : 'rgba(255,255,255,0.35)',
                    cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize'
                  }}
                >{v === 'both' ? 'Both' : v === 'safe' ? 'Safe' : 'Short'}</button>
              ))}
            </div>

            {/* Safe route card */}
            <div style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 20, height: 3, background: '#4ade80', borderRadius: 2 }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: '#4ade80' }}>Safest Route</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Distance</p>
                  <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 500, color: '#fff', fontFamily: "'DM Mono', monospace" }}>{safeRoute.distanceKm}<span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}> km</span></p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Risk Score</p>
                  <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 500, color: getRiskColor(safeRoute.avgRiskScore), fontFamily: "'DM Mono', monospace" }}>{safeRoute.avgRiskScore}<span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}> /100</span></p>
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${safeRoute.avgRiskScore}%`, height: '100%', background: getRiskColor(safeRoute.avgRiskScore), borderRadius: 2, transition: 'width 0.6s ease' }} />
                </div>
                <span style={{ fontSize: 10, color: getRiskColor(safeRoute.avgRiskScore), fontWeight: 500 }}>{getRiskLabel(safeRoute.avgRiskScore)}</span>
              </div>
            </div>

            {/* Short route card */}
            <div style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 20, height: 3, background: '#60a5fa', borderRadius: 2, backgroundImage: 'repeating-linear-gradient(90deg, #60a5fa 0, #60a5fa 6px, transparent 6px, transparent 10px)' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: '#60a5fa' }}>Shortest Route</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Distance</p>
                  <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 500, color: '#fff', fontFamily: "'DM Mono', monospace" }}>{shortRoute.distanceKm}<span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}> km</span></p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Risk Score</p>
                  <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 500, color: getRiskColor(shortRoute.avgRiskScore), fontFamily: "'DM Mono', monospace" }}>{shortRoute.avgRiskScore}<span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}> /100</span></p>
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${shortRoute.avgRiskScore}%`, height: '100%', background: getRiskColor(shortRoute.avgRiskScore), borderRadius: 2, transition: 'width 0.6s ease' }} />
                </div>
                <span style={{ fontSize: 10, color: getRiskColor(shortRoute.avgRiskScore), fontWeight: 500 }}>{getRiskLabel(shortRoute.avgRiskScore)}</span>
              </div>
            </div>

            {/* Risk saved badge */}
            {(() => {
              const saved = parseInt(shortRoute.avgRiskScore) - parseInt(safeRoute.avgRiskScore)
              const extraKm = (parseFloat(safeRoute.distanceKm) - parseFloat(shortRoute.distanceKm)).toFixed(2)
              if (saved <= 0) return null
              return (
                <div style={{ marginTop: 10, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#4ade80' }}>Risk reduced by <strong>{saved} pts</strong></span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>+{extraKm} km detour</span>
                </div>
              )
            })()}
          </div>
        )}

        {/* Legend */}
        <div style={{
          background: 'rgba(15,17,23,0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: '12px 16px'
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Crime Risk Legend</p>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['#4ade80', 'Low'], ['#fbbf24', 'Med'], ['#f97316', 'High'], ['#ef4444', 'Critical']].map(([c, l]) => (
              <div key={l} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', height: 4, background: c, borderRadius: 2 }} />
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step hint overlay */}
      {(step === 'picking_start' || step === 'picking_end') && (
        <div style={{
          position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,17,23,0.95)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 30,
          padding: '10px 24px', zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: step === 'picking_start' ? '#4ade80' : '#f87171', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 400 }}>
            {step === 'picking_start' ? 'Click anywhere on the map to set your start point' : 'Now click to set your destination'}
          </span>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; transform: scale(1) } 50% { opacity:0.5; transform: scale(1.3) } }
        .leaflet-container { cursor: ${pickMode ? 'crosshair' : 'grab'} !important; }
        .leaflet-popup-content-wrapper { background: rgba(15,17,23,0.95); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 13px; }
        .leaflet-popup-tip { background: rgba(15,17,23,0.95); }
        .leaflet-tooltip { background: rgba(15,17,23,0.9); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 11px; font-family: 'DM Sans', sans-serif; }
      `}</style>
    </div>
  )
}