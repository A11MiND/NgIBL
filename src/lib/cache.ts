/**
 * Vercel KV Cache Layer
 * 
 * Uses Vercel KV (free tier: 30k requests/month) for:
 * - AI response caching (avoid repeated expensive calls)
 * - Analysis result caching
 * - General purpose key-value caching
 * 
 * Falls back gracefully when KV is not configured (local development).
 */

import { logger } from './logger'

// ─── KV Client (lazy init) ─────────────────────────────────────────

let kvClient: any = null

async function getKV() {
  if (kvClient) return kvClient

  // Only import if KV environment variables are set
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    logger.debug('Vercel KV not configured — caching disabled')
    return null
  }

  try {
    const { kv } = await import('@vercel/kv')
    kvClient = kv
    return kvClient
  } catch {
    logger.warn('Failed to initialize Vercel KV — caching disabled')
    return null
  }
}

// ─── Cache Operations ───────────────────────────────────────────────

/**
 * Get a cached value by key.
 * Returns null if not found or KV is unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const kv = await getKV()
  if (!kv) return null

  try {
    const value = await kv.get(key)
    if (value) {
      logger.debug({ key }, 'Cache HIT')
    }
    return value as T | null
  } catch (error) {
    logger.warn({ key, error }, 'Cache GET failed')
    return null
  }
}

/**
 * Set a cached value with TTL (time-to-live in seconds).
 * Default TTL: 1 hour (3600s).
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
  const kv = await getKV()
  if (!kv) return

  try {
    await kv.setex(key, ttlSeconds, value)
    logger.debug({ key, ttl: ttlSeconds }, 'Cache SET')
  } catch (error) {
    logger.warn({ key, error }, 'Cache SET failed')
  }
}

/**
 * Delete a cached value.
 */
export async function cacheDelete(key: string): Promise<void> {
  const kv = await getKV()
  if (!kv) return

  try {
    await kv.del(key)
    logger.debug({ key }, 'Cache DELETE')
  } catch (error) {
    logger.warn({ key, error }, 'Cache DELETE failed')
  }
}

/**
 * Delete all cached values matching a pattern.
 * Use for cache invalidation (e.g., when experiment data changes).
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  const kv = await getKV()
  if (!kv) return

  try {
    // Vercel KV supports SCAN with patterns
    const keys: string[] = []
    let cursor = 0
    do {
      const [nextCursor, matchedKeys] = await kv.scan(cursor, { match: pattern, count: 100 })
      cursor = nextCursor as number
      keys.push(...(matchedKeys as string[]))
    } while (cursor !== 0)

    if (keys.length > 0) {
      await Promise.all(keys.map((k: string) => kv.del(k)))
      logger.info({ pattern, count: keys.length }, 'Cache pattern invalidated')
    }
  } catch (error) {
    logger.warn({ pattern, error }, 'Cache pattern invalidation failed')
  }
}

// ─── Cache Key Builders ─────────────────────────────────────────────

export const CacheKeys = {
  /** Cache key for class-level analysis */
  classAnalysis: (experimentId: string) => `analysis:class:${experimentId}`,

  /** Cache key for individual student analysis */
  studentAnalysis: (experimentId: string, submissionId: string) =>
    `analysis:student:${experimentId}:${submissionId}`,

  /** Cache key for experiment data */
  experiment: (experimentId: string) => `experiment:${experimentId}`,

  /** Cache key for user settings */
  userSettings: (userId: string) => `user:settings:${userId}`,

  /** Cache key for simulation code */
  simulation: (simulationId: string) => `simulation:${simulationId}`,
}

// ─── High-Level Cache Helpers ───────────────────────────────────────

/**
 * Get-or-set pattern: returns cached value or computes and caches it.
 * This is the most common caching pattern.
 */
export async function cached<T>(
  key: string,
  compute: () => Promise<T>,
  ttlSeconds = 3600
): Promise<T> {
  // Try cache first
  const cachedValue = await cacheGet<T>(key)
  if (cachedValue !== null) {
    return cachedValue
  }

  // Cache miss — compute the value
  const freshValue = await compute()

  // Store in cache (fire-and-forget)
  cacheSet(key, freshValue, ttlSeconds).catch(() => {})

  return freshValue
}
