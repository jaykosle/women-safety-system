// lib/districtCentroids.ts
// Loads synthetic_crime_data.csv once and computes (state, district) -> {lat, lng} centroid.
// Used by the hotspots API to enrich responses with coordinates so the analytics map
// can render heatmaps without per-district geocoding round trips.

import fs from 'node:fs'
import path from 'node:path'

type Centroid = { lat: number; lng: number; samples: number }
type Index = Map<string, Centroid> // key = `${STATE_UPPER}|${DISTRICT_UPPER}`

let cache: Index | null = null

function key(state: string, district: string) {
  return `${state.toUpperCase().trim()}|${district.toUpperCase().trim()}`
}

function load(): Index {
  if (cache) return cache
  const idx: Index = new Map()
  const file = path.join(process.cwd(), 'synthetic_crime_data.csv')

  if (!fs.existsSync(file)) {
    console.warn('[districtCentroids] synthetic_crime_data.csv not found at', file)
    cache = idx
    return idx
  }

  const raw = fs.readFileSync(file, 'utf8')
  const lines = raw.split(/\r?\n/)
  if (lines.length < 2) { cache = idx; return idx }

  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  const iDistrict = header.indexOf('district')
  const iState = header.indexOf('state')
  const iLat = header.indexOf('latitude')
  const iLng = header.indexOf('longitude')
  if (iDistrict < 0 || iState < 0 || iLat < 0 || iLng < 0) {
    console.warn('[districtCentroids] CSV header missing required columns')
    cache = idx
    return idx
  }

  // Accumulate sum of lat/lng per (state, district) — divide at the end.
  const sums = new Map<string, { latSum: number; lngSum: number; n: number }>()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const cols = line.split(',')
    const state = cols[iState]
    const district = cols[iDistrict]
    const lat = parseFloat(cols[iLat])
    const lng = parseFloat(cols[iLng])
    if (!state || !district || !isFinite(lat) || !isFinite(lng)) continue

    const k = key(state, district)
    const cur = sums.get(k)
    if (cur) {
      cur.latSum += lat; cur.lngSum += lng; cur.n += 1
    } else {
      sums.set(k, { latSum: lat, lngSum: lng, n: 1 })
    }
  }

  for (const [k, v] of sums) {
    idx.set(k, { lat: v.latSum / v.n, lng: v.lngSum / v.n, samples: v.n })
  }

  console.log(`[districtCentroids] indexed ${idx.size} (state, district) centroids`)
  cache = idx
  return idx
}

export function getCentroid(state: string, district: string): { lat: number; lng: number } | null {
  const c = load().get(key(state, district))
  if (!c) return null
  return { lat: c.lat, lng: c.lng }
}

export function getStateBounds(state: string): { sw: [number, number]; ne: [number, number] } | null {
  const idx = load()
  const stateKey = state.toUpperCase().trim()
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity
  let found = false
  for (const [k, c] of idx) {
    if (!k.startsWith(stateKey + '|')) continue
    found = true
    if (c.lat < minLat) minLat = c.lat
    if (c.lat > maxLat) maxLat = c.lat
    if (c.lng < minLng) minLng = c.lng
    if (c.lng > maxLng) maxLng = c.lng
  }
  if (!found) return null
  return { sw: [minLat, minLng], ne: [maxLat, maxLng] }
}
