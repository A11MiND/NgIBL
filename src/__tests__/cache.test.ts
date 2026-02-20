/**
 * Tests for cache utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @vercel/kv before importing cache module
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    scan: vi.fn().mockResolvedValue([0, []]),
  },
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { CacheKeys } from '@/lib/cache'

describe('CacheKeys', () => {
  it('generates correct class analysis key', () => {
    expect(CacheKeys.classAnalysis('exp-123')).toBe('analysis:class:exp-123')
  })

  it('generates correct student analysis key', () => {
    expect(CacheKeys.studentAnalysis('exp-123', 'sub-456')).toBe('analysis:student:exp-123:sub-456')
  })

  it('generates correct experiment key', () => {
    expect(CacheKeys.experiment('exp-123')).toBe('experiment:exp-123')
  })

  it('generates correct user settings key', () => {
    expect(CacheKeys.userSettings('user-789')).toBe('user:settings:user-789')
  })

  it('generates correct simulation key', () => {
    expect(CacheKeys.simulation('sim-abc')).toBe('simulation:sim-abc')
  })
})
