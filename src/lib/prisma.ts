/**
 * Prisma Client with Connection Pooling
 * 
 * Optimized for Vercel serverless:
 * - Singleton pattern prevents connection exhaustion
 * - Conditional logging (verbose in dev, errors only in prod)
 * - Compatible with Prisma Accelerate / PgBouncer pooled connections
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}