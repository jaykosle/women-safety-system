// lib/analytics-cache.ts
import { prisma } from './prisma'

const CACHE_DURATIONS = {
  stats: 7 * 24 * 60 * 60 * 1000,      // 7 days
  forecast: 30 * 24 * 60 * 60 * 1000,   // 30 days
  hotspots: 7 * 24 * 60 * 60 * 1000,    // 7 days
  trends: 7 * 24 * 60 * 60 * 1000,      // 7 days
}

type CacheType = 'stats' | 'forecast' | 'hotspots' | 'trends'

export async function getCachedAnalytics(
  state: string,
  cacheType: CacheType,
  district?: string,
  crimeType?: string
): Promise<any | null> {
  try {
    const cache = await prisma.analyticsCache.findUnique({
      where: {
        state_district_cacheType_crimeType: {
          state,
          district: district || '',
          cacheType,
          crimeType: crimeType || '',
        }
      }
    })

    if (!cache || new Date(cache.expiresAt) < new Date()) {
      // Cache expired or not found
      return null
    }

    return cache.data
  } catch (err) {
    console.error('Cache retrieval error:', err)
    return null
  }
}

export async function setCachedAnalytics(
  state: string,
  cacheType: CacheType,
  data: any,
  district?: string,
  crimeType?: string
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + CACHE_DURATIONS[cacheType])

    await prisma.analyticsCache.upsert({
      where: {
        state_district_cacheType_crimeType: {
          state,
          district: district || '',
          cacheType,
          crimeType: crimeType || '',
        }
      },
      update: {
        data,
        expiresAt
      },
      create: {
        state,
        district: district || '',
        cacheType,
        crimeType: crimeType || '',
        data,
        expiresAt
      }
    })
  } catch (err) {
    console.error('Cache write error:', err)
    // Don't throw - caching is optional
  }
}

export async function invalidateAnalyticsCache(
  state?: string,
  cacheType?: CacheType
): Promise<void> {
  try {
    const where: any = {}
    if (state) where.state = state
    if (cacheType) where.cacheType = cacheType

    await prisma.analyticsCache.deleteMany({ where })
  } catch (err) {
    console.error('Cache invalidation error:', err)
  }
}

// Middleware for automatic cache integration in API routes
export function withAnalyticsCache(
  handler: (req: any) => Promise<any>,
  cacheType: CacheType
) {
  return async (req: any) => {
    const { searchParams } = new URL(req.url)
    const state = searchParams.get('state')
    const district = searchParams.get('district')
    const crimeType = searchParams.get('crime_type')

    // Try to get from cache
    if (state) {
      const cached = await getCachedAnalytics(
        state,
        cacheType,
        district || undefined,
        crimeType || undefined
      )
      if (cached) return cached
    }

    // Fetch fresh data
    const data = await handler(req)

    // Cache the result
    if (state) {
      await setCachedAnalytics(
        state,
        cacheType,
        data,
        district || undefined,
        crimeType || undefined
      )
    }

    return data
  }
}