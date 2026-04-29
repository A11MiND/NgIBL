import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdapterToken } from '@/lib/adapter-auth'

type EntitlementInput = {
  key?: string
  feature?: string
  enabled?: boolean
  quota?: number
  metadata?: Record<string, unknown>
}

export async function POST(request: Request) {
  const denied = requireAdapterToken(request)
  if (denied) return denied

  const body = await request.json().catch(() => null)
  const organizationId = String(body?.organization_id || body?.organizationId || body?.school_id || body?.schoolId || '').trim()
  const entitlements = Array.isArray(body?.entitlements) ? body.entitlements as EntitlementInput[] : []

  if (!organizationId) return jsonError('organization_id/school_id is required')
  if (!entitlements.length) return jsonError('entitlements array is required')

  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })
  if (!organization) return jsonError('Organization not found', 404)

  let upserted = 0
  for (const item of entitlements) {
    const key = String(item.key || item.feature || '').trim()
    if (!key) continue
    const metadata = item.metadata
      ? JSON.parse(JSON.stringify(item.metadata)) as Prisma.InputJsonValue
      : undefined
    await prisma.entitlement.upsert({
      where: {
        organizationId_key: {
          organizationId,
          key,
        },
      },
      create: {
        organizationId,
        key,
        enabled: item.enabled !== false,
        quota: typeof item.quota === 'number' ? item.quota : null,
        metadata,
      },
      update: {
        enabled: item.enabled !== false,
        quota: typeof item.quota === 'number' ? item.quota : null,
        metadata,
      },
    })
    upserted += 1
  }

  return NextResponse.json({ upserted, organization_id: organizationId })
}
