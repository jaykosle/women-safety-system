// components/HotspotHeatmap.tsx
'use client'

import { useEffect, useRef } from 'react'

export interface HeatHotspot {
  district: string
  state: string
  total_crimes: number
  crime_breakdown: Record<string, number>
  lat?: number
  lng?: number
}

interface Props {
  hotspots: HeatHotspot[]
  bounds: { sw: [number, number]; ne: [number, number] } | null
  /** 'all' or a specific crime_breakdown key */
  filter: string
  /** Hex color used for tinting the heat gradient */
  accentColor: string
  /** 'dark' or 'light' tiles */
  theme?: 'dark' | 'light'
  height?: number
}

const TILE_URLS: Record<'dark' | 'light', string> = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
}

export default function HotspotHeatmap({
  hotspots, bounds, filter, accentColor, theme = 'light', height = 480,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const tileRef = useRef<any>(null)
  const heatRef = useRef<any>(null)
  const markerLayerRef = useRef<any>(null)

  // Init Leaflet once
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return
    let cancelled = false

    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      await import('leaflet.heat')
      if (cancelled || !containerRef.current) return
      // @ts-ignore
      if (containerRef.current._leaflet_id) return

      const map = L.map(containerRef.current, {
        center: [22.5, 82.5], zoom: 5, zoomControl: true, attributionControl: false,
      })
      tileRef.current = L.tileLayer(TILE_URLS[theme], {
        attribution: '&copy; CARTO', subdomains: 'abcd', maxZoom: 19,
      }).addTo(map)
      markerLayerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
    })()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.off()
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Swap tiles on theme change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapRef.current) return
      if (tileRef.current) map.removeLayer(tileRef.current)
      tileRef.current = L.tileLayer(TILE_URLS[theme], {
        attribution: '&copy; CARTO', subdomains: 'abcd', maxZoom: 19,
      }).addTo(map)
      tileRef.current.bringToBack?.()
    })()
    return () => { cancelled = true }
  }, [theme])

  // Re-render heat + markers when data, filter, or accent change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false

    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapRef.current) return

      // Clear existing
      if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null }
      markerLayerRef.current?.clearLayers()

      const valid = hotspots.filter(h => typeof h.lat === 'number' && typeof h.lng === 'number')
      if (valid.length === 0) return

      // Compute intensity per hotspot
      const intensities = valid.map(h =>
        filter === 'all' ? h.total_crimes : (h.crime_breakdown?.[filter] ?? 0)
      )
      const max = Math.max(...intensities, 1)

      const points = valid.map((h, i) => [
        h.lat as number,
        h.lng as number,
        Math.max(0.05, intensities[i] / max),
      ]) as [number, number, number][]

      heatRef.current = (L as any).heatLayer(points, {
        radius: 35, blur: 25, maxZoom: 11, max: 1.0,
        gradient: {
          0.2: theme === 'light' ? '#bfdbfe' : '#1e3a8a',
          0.4: '#fbbf24',
          0.7: '#f97316',
          1.0: accentColor,
        },
      }).addTo(map)

      // District markers with tooltips
      valid.forEach((h, i) => {
        const count = intensities[i]
        if (count === 0 && filter !== 'all') return
        const marker = L.circleMarker([h.lat as number, h.lng as number], {
          radius: 5 + Math.min(12, (count / max) * 12),
          fillColor: accentColor,
          color: '#fff',
          weight: 1.5,
          fillOpacity: 0.85,
        }).bindTooltip(
          `<div style="font-family: 'DM Sans', sans-serif; font-size: 12px;">
             <div style="font-weight: 700; margin-bottom: 2px;">${h.district}</div>
             <div style="color: #64748b;">${count.toLocaleString()} ${filter === 'all' ? 'total crimes' : 'cases'}</div>
           </div>`,
          { direction: 'top', offset: [0, -4] }
        )
        markerLayerRef.current.addLayer(marker)
      })

      // Fit bounds to data (state bbox if available)
      if (bounds) {
        map.fitBounds([bounds.sw, bounds.ne], { padding: [40, 40] })
      } else {
        const latLngs = valid.map(h => [h.lat as number, h.lng as number]) as [number, number][]
        map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] })
      }
    })()

    return () => { cancelled = true }
  }, [hotspots, filter, accentColor, bounds])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden' }}
    />
  )
}
