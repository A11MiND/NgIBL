/**
 * Structured Logging with Pino
 * 
 * Enterprise-grade logging that replaces console.log with structured JSON logs.
 * - Development: Pretty-printed colored output
 * - Production: JSON format (compatible with Vercel log drain, Datadog, etc.)
 */

import pino from 'pino'

const isServer = typeof window === 'undefined'
const isDev = process.env.NODE_ENV === 'development'

// Create logger only on server side
export const logger: pino.Logger = isServer
  ? pino({
      level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
      
      // Add base context to every log
      base: {
        env: process.env.NODE_ENV,
        service: 'ibl-platform',
      },
      
      // Timestamp format
      timestamp: pino.stdTimeFunctions.isoTime,
      
      // Pretty print in development
      ...(isDev && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname,env,service',
          },
        },
      }),
      
      // Redact sensitive fields
      redact: {
        paths: [
          'apiKey',
          'password',
          'token',
          'authorization',
          'cookie',
          '*.apiKey',
          '*.password',
          '*.deepseekApiKey',
          '*.geminiApiKey',
          '*.qwenApiKey',
        ],
        censor: '[REDACTED]',
      },
    })
  : (pino({ level: 'silent' }) as pino.Logger) // Client-side: silent logger

// ─── Convenience Methods ────────────────────────────────────────────

/**
 * Log an AI operation (generation, chat, analysis)
 */
export function logAI(operation: string, details: {
  provider: string
  model?: string
  duration?: number
  tokenEstimate?: number
  cached?: boolean
  error?: string
}) {
  if (details.error) {
    logger.error({ operation, ...details }, `AI ${operation} failed`)
  } else {
    logger.info({ operation, ...details }, `AI ${operation} completed`)
  }
}

/**
 * Log a database operation
 */
export function logDB(operation: string, details: {
  table: string
  duration?: number
  error?: string
}) {
  if (details.error) {
    logger.error({ operation, ...details }, `DB ${operation} failed`)
  } else {
    logger.debug({ operation, ...details }, `DB ${operation}`)
  }
}

/**
 * Log an authentication event
 */
export function logAuth(event: string, details: {
  userId?: string
  email?: string
  success: boolean
  reason?: string
}) {
  const level = details.success ? 'info' : 'warn'
  logger[level]({ event, ...details }, `Auth: ${event}`)
}

/**
 * Log a rate limit event
 */
export function logRateLimit(details: {
  identifier: string
  action: string
  remaining: number
  blocked: boolean
}) {
  if (details.blocked) {
    logger.warn(details, `Rate limit exceeded: ${details.action}`)
  } else {
    logger.debug(details, `Rate limit check: ${details.action}`)
  }
}
