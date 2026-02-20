/**
 * Tests for centralized error handling
 */
import { describe, it, expect, vi } from 'vitest'
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  AIProviderError,
  withErrorHandling,
} from '@/lib/error-handler'

// Mock the logger to avoid pino initialization issues in tests
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logAI: vi.fn(),
  logDB: vi.fn(),
  logAuth: vi.fn(),
  logRateLimit: vi.fn(),
}))

describe('Error Classes', () => {
  it('AppError sets correct properties', () => {
    const error = new AppError(400, 'Bad request')
    expect(error.statusCode).toBe(400)
    expect(error.message).toBe('Bad request')
    expect(error.isOperational).toBe(true)
  })

  it('UnauthorizedError defaults to 401', () => {
    const error = new UnauthorizedError()
    expect(error.statusCode).toBe(401)
    expect(error.message).toBe('Unauthorized')
  })

  it('ForbiddenError defaults to 403', () => {
    const error = new ForbiddenError()
    expect(error.statusCode).toBe(403)
    expect(error.message).toBe('Insufficient permissions')
  })

  it('NotFoundError includes resource name', () => {
    const error = new NotFoundError('Experiment')
    expect(error.statusCode).toBe(404)
    expect(error.message).toBe('Experiment not found')
  })

  it('ValidationError includes fields', () => {
    const error = new ValidationError('Invalid input', { email: 'Required' })
    expect(error.statusCode).toBe(400)
    expect(error.fields).toEqual({ email: 'Required' })
  })

  it('RateLimitError includes retryAfter', () => {
    const error = new RateLimitError(30)
    expect(error.statusCode).toBe(429)
    expect(error.retryAfter).toBe(30)
  })

  it('AIProviderError includes provider name', () => {
    const error = new AIProviderError('deepseek', 'API timeout')
    expect(error.statusCode).toBe(502)
    expect(error.provider).toBe('deepseek')
    expect(error.message).toContain('deepseek')
  })
})

describe('withErrorHandling', () => {
  it('returns success with data on successful execution', async () => {
    const result = await withErrorHandling('test', async () => {
      return { id: '123', name: 'Test' }
    })

    expect(result).toEqual({
      success: true,
      data: { id: '123', name: 'Test' },
    })
  })

  it('catches AppError and returns structured failure', async () => {
    const result = await withErrorHandling('test', async () => {
      throw new UnauthorizedError()
    })

    expect(result).toEqual({
      success: false,
      error: 'Unauthorized',
      code: 401,
    })
  })

  it('catches unexpected errors and returns generic message in production', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const result = await withErrorHandling('test', async () => {
      throw new Error('Database connection failed')
    })

    expect(result.success).toBe(false)
    expect((result as any).error).toBe('An unexpected error occurred. Please try again.')

    process.env.NODE_ENV = originalEnv
  })

  it('returns actual error message in development', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const result = await withErrorHandling('test', async () => {
      throw new Error('Database connection failed')
    })

    expect(result.success).toBe(false)
    expect((result as any).error).toBe('Database connection failed')

    process.env.NODE_ENV = originalEnv
  })
})
