/**
 * Rate Limiting with Vercel KV
 * 
 * Sliding window rate limiter using Vercel KV (free tier).
 * Prevents AI API abuse and protects expensive operations.
 * 
 * Falls back gracefully (allows all requests) when KV is not configured.
 */

import { logger, logRateLimit } from './logger'

// ─── KV Client ──────────────────────────────────────────────────────

let kvClient: any = null

async function getKV() {
  if (kvClient) return kvClient

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null
  }

  try {
    const { kv } = await import('@vercel/kv')
    kvClient = kv
    return kvClient
  } catch {
    return null
  }
}

// ─── Rate Limit Configuration ───────────────────────────────────────

export const RateLimits = {
  /** AI chatbot: 20 messages per minute per user */
  chatbot: { limit: 20, windowSeconds: 60 },

  /** AI analysis: 5 analyses per 5 minutes per user */
  analysis: { limit: 5, windowSeconds: 300 },

  /** Simulation generation: 10 per 10 minutes per user */
  simulation: { limit: 10, windowSeconds: 600 },

  /** Login attempts: 5 per 15 minutes per IP */
  login: { limit: 5, windowSeconds: 900 },

  /** Registration: 3 per hour per IP */
  registration: { limit: 3, windowSeconds: 3600 },

  /** API general: 100 requests per minute */
  api: { limit: 100, windowSeconds: 60 },
} as const

export type RateLimitAction = keyof typeof RateLimits

// ─── Rate Limiter ───────────────────────────────────────────────────

export interface RateLimitResult {
  success: boolean
  remaining: number
  limit: number
  resetAt: Date
}

/**
 * Check and enforce rate limit for an action.
 * 
 * @param identifier - Unique identifier (userId, email, or IP)
 * @param action - The rate-limited action
 * @returns Whether the request is allowed
 */
export async function rateLimit(
  identifier: string,
  action: RateLimitAction
): Promise<RateLimitResult> {
  const config = RateLimits[action]
  const kv = await getKV()

  // If KV is not available, allow all requests (graceful degradation)
  if (!kv) {
    return {
      success: true,
      remaining: config.limit,
      limit: config.limit,
      resetAt: new Date(Date.now() + config.windowSeconds * 1000),
    }
  }

  const key = `ratelimit:${action}:${identifier}`

  try {
    const count = await kv.incr(key)

    // Set expiry on first request in window
    if (count === 1) {
      await kv.expire(key, config.windowSeconds)
    }

    const remaining = Math.max(0, config.limit - count)
    const ttl = await kv.ttl(key)
    const resetAt = new Date(Date.now() + (ttl > 0 ? ttl : config.windowSeconds) * 1000)
    const blocked = count > config.limit

    logRateLimit({
      identifier,
      action,
      remaining,
      blocked,
    })

    return {
      success: !blocked,
      remaining,
      limit: config.limit,
      resetAt,
    }
  } catch (error) {
    logger.warn({ key, error }, 'Rate limit check failed — allowing request')
    return {
      success: true,
      remaining: config.limit,
      limit: config.limit,
      resetAt: new Date(Date.now() + config.windowSeconds * 1000),
    }
  }
}

/**
 * Middleware-style rate limit check that throws on limit exceeded.
 */
export async function enforceRateLimit(
  identifier: string,
  action: RateLimitAction
): Promise<void> {
  const result = await rateLimit(identifier, action)
  if (!result.success) {
    const { RateLimitError } = await import('./error-handler')
    throw new RateLimitError(
      Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
    )
  }
}
