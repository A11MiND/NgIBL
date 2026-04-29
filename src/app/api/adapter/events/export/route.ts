import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdapterToken } from '@/lib/adapter-auth'

type AdapterEvent = {
  event_type?: string
  eventType?: string
  user_id?: string
  userId?: string
  organization_id?: string
  organizationId?: string
  entity?: string
  entity_id?: string
  entityId?: string
  payload?: Record<string, unknown>
}

export async function POST(request: Request) {
  const denied = requireAdapterToken(request)
  if (denied) return denied

  const body = await request.json().catch(() => null)
  const events = Array.isArray(body?.events) ? body.events as AdapterEvent[] : []

  let accepted = 0
  let persisted = 0
  for (const event of events) {
    const action = String(event.event_type || event.eventType || '').trim()
    if (!action) continue
    accepted += 1

    const userId = String(event.user_id || event.userId || '').trim()
    if (!userId) continue

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) continue
    const metadata = event.payload
      ? JSON.parse(JSON.stringify(event.payload)) as Prisma.InputJsonValue
      : undefined

    await prisma.auditLog.create({
      data: {
        userId,
        organizationId: String(event.organization_id || event.organizationId || '').trim() || null,
        action,
        entity: String(event.entity || 'LearningEvent'),
        entityId: String(event.entity_id || event.entityId || '').trim() || null,
        metadata,
      },
    })
    persisted += 1
  }

  return NextResponse.json({ accepted, persisted })
}
