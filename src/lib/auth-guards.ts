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
 * Resolve current org context from user default organization or explicit input.
 */
export async function requireOrgMember(organizationId?: string) {
  const user = await requireAuth()
  const targetOrgId = organizationId || user.organizationId || undefined

  if (!targetOrgId) {
    throw new ForbiddenError('No organization context available')
  }

  const membership = await prisma.userOrganizationMembership.findFirst({
    where: {
      userId: user.id,
      organizationId: targetOrgId,
      status: 'ACTIVE',
    },
    select: { role: true },
  })

  if (!membership && user.role !== 'ADMIN') {
    throw new ForbiddenError('User is not a member of this organization')
  }

  return { user, organizationId: targetOrgId, membershipRole: membership?.role }
}

/**
 * Require org admin/owner permissions.
 */
export async function requireOrgAdmin(organizationId?: string) {
  const { user, organizationId: orgId, membershipRole } = await requireOrgMember(organizationId)
  const isOrgAdmin = membershipRole === 'ADMIN' || membershipRole === 'OWNER'

  if (!isOrgAdmin && user.role !== 'ADMIN') {
    throw new ForbiddenError('Requires organization admin permission')
  }

  return { user, organizationId: orgId, membershipRole }
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
    select: { userId: true, organizationId: true },
  })

  if (!experiment) {
    const { NotFoundError } = await import('./error-handler')
    throw new NotFoundError('Experiment')
  }

  // Admins can access any experiment
  if (experiment.userId !== user.id && user.role !== 'ADMIN') {
    // Transitional compatibility: allow org-level admins for org-scoped resources.
    if (experiment.organizationId) {
      const membership = await prisma.userOrganizationMembership.findFirst({
        where: {
          userId: user.id,
          organizationId: experiment.organizationId,
          status: 'ACTIVE',
          role: { in: ['ADMIN', 'OWNER'] },
        },
        select: { id: true },
      })
      if (membership) return user
    }
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
    select: { userId: true, organizationId: true },
  })

  if (!simulation) {
    const { NotFoundError } = await import('./error-handler')
    throw new NotFoundError('Simulation')
  }

  if (simulation.userId !== user.id && user.role !== 'ADMIN') {
    if (simulation.organizationId) {
      const membership = await prisma.userOrganizationMembership.findFirst({
        where: {
          userId: user.id,
          organizationId: simulation.organizationId,
          status: 'ACTIVE',
          role: { in: ['ADMIN', 'OWNER'] },
        },
        select: { id: true },
      })
      if (membership) return user
    }
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
  organizationId?: string
  action: string
  entity: string
  entityId?: string
  metadata?: Record<string, unknown>
}) {
  // Fire-and-forget — don't block the main flow
  prisma.auditLog.create({
    data: {
      userId: params.userId,
      organizationId: params.organizationId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
    },
  }).catch((error) => {
    logger.error({ error, ...params }, 'Failed to write audit log')
  })
}
