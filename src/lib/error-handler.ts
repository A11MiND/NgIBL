/**
 * Centralized Error Handling
 * 
 * Enterprise-grade error handling with typed errors, consistent response format,
 * and integration with structured logging.
 */

import { logger } from './logger'

// ─── Custom Error Classes ───────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, message)
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`)
  }
}

export class ValidationError extends AppError {
  public readonly fields?: Record<string, string>

  constructor(message = 'Validation failed', fields?: Record<string, string>) {
    super(400, message)
    this.fields = fields
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number

  constructor(retryAfter = 60) {
    super(429, 'Too many requests. Please try again later.')
    this.retryAfter = retryAfter
  }
}

export class AIProviderError extends AppError {
  public readonly provider: string

  constructor(provider: string, message: string) {
    super(502, `AI Provider (${provider}): ${message}`)
    this.provider = provider
  }
}

// ─── Response Types ─────────────────────────────────────────────────

export type ActionResult<T = void> = {
  success: true
  data: T
} | {
  success: false
  error: string
  code?: number
}

// ─── Error Handler Wrapper ──────────────────────────────────────────

/**
 * Wraps an async function with centralized error handling.
 * Catches all errors, logs them, and returns a standardized response.
 * 
 * Usage:
 *   export async function myAction() {
 *     return withErrorHandling('myAction', async () => {
 *       // ... your logic
 *       return data
 *     })
 *   }
 */
export async function withErrorHandling<T>(
  actionName: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<ActionResult<T>> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (error) {
    if (error instanceof AppError) {
      // Operational errors — expected, log at warn level
      logger.warn({
        action: actionName,
        error: error.message,
        statusCode: error.statusCode,
        ...context,
      }, `Action failed: ${actionName}`)

      return {
        success: false,
        error: error.message,
        code: error.statusCode,
      }
    }

    // Unexpected errors — log at error level
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({
      action: actionName,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    }, `Unexpected error in ${actionName}`)

    return {
      success: false,
      error: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again.'
        : message,
      code: 500,
    }
  }
}

/**
 * Wraps an API route handler with centralized error handling.
 * Returns proper HTTP responses with status codes.
 */
export async function withApiErrorHandling(
  routeName: string,
  fn: () => Promise<Response>,
  context?: Record<string, unknown>
): Promise<Response> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof AppError) {
      logger.warn({
        route: routeName,
        error: error.message,
        statusCode: error.statusCode,
        ...context,
      }, `API error: ${routeName}`)

      return Response.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }

    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({
      route: routeName,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    }, `Unexpected API error in ${routeName}`)

    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
