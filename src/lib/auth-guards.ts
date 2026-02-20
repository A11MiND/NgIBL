/**
 * RBAC (Role-Based Access Control) Auth Guards
 * 
 * Provides middleware-style functions to enforce role-based permissions
 * in server actions and API routes.
 */

import { auth } from '@/auth'
import { prisma } from './prisma'
import { UnauthorizedError, ForbiddenError } from './error-handler'
import { logger } from './logger'

// Re-export the Role enum type
export type { Role } from '@prisma/client'

// ─── Auth Guards ────────────────────────────────────────────────────

/**
 * Require an authenticated user. Returns the user object.
 * Throws UnauthorizedError if not logged in.
 */
export async function requireAuth() {
  const session = await auth()
  if (!session?.user?.email) {
    throw new UnauthorizedError()
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })

  if (!user) {
    throw new UnauthorizedError('User not found')
  }

  return user
}

/**
 * Require an authenticated user with a specific role.
 * Throws ForbiddenError if the user doesn't have the required role.
 */
export async function requireRole(requiredRole: 'STUDENT' | 'TEACHER' | 'ADMIN') {
  const user = await requireAuth()

  const roleHierarchy = { STUDENT: 0, TEACHER: 1, ADMIN: 2 }
  const userLevel = roleHierarchy[user.role] ?? 0
  const requiredLevel = roleHierarchy[requiredRole] ?? 0

  if (userLevel < requiredLevel) {
    logger.warn({
      userId: user.id,
      userRole: user.role,
      requiredRole,
    }, 'Insufficient permissions')
    throw new ForbiddenError(`Requires ${requiredRole} role or higher`)
  }

  return user
}

/**
 * Require that the current user owns the specified experiment.
 */
export async function requireExperimentOwner(experimentId: string) {
  const user = await requireAuth()

  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    select: { userId: true },
  })

  if (!experiment) {
    const { NotFoundError } = await import('./error-handler')
    throw new NotFoundError('Experiment')
  }

  // Admins can access any experiment
  if (experiment.userId !== user.id && user.role !== 'ADMIN') {
    throw new ForbiddenError('You do not own this experiment')
  }

  return user
}

/**
 * Require that the current user owns the specified simulation.
 */
export async function requireSimulationOwner(simulationId: string) {
  const user = await requireAuth()

  const simulation = await prisma.simulation.findUnique({
    where: { id: simulationId },
    select: { userId: true },
  })

  if (!simulation) {
    const { NotFoundError } = await import('./error-handler')
    throw new NotFoundError('Simulation')
  }

  if (simulation.userId !== user.id && user.role !== 'ADMIN') {
    throw new ForbiddenError('You do not own this simulation')
  }

  return user
}

// ─── Audit Logging ──────────────────────────────────────────────────

/**
 * Log an auditable action. Fire-and-forget (non-blocking).
 */
export function auditLog(params: {
  userId: string
  action: string
  entity: string
  entityId?: string
  metadata?: Record<string, unknown>
}) {
  // Fire-and-forget — don't block the main flow
  prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
    },
  }).catch((error) => {
    logger.error({ error, ...params }, 'Failed to write audit log')
  })
}
