import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdapterToken } from '@/lib/adapter-auth'

type ClassSyncItem = {
  id?: string
  name?: string
  code?: string
}

export async function POST(request: Request) {
  const denied = requireAdapterToken(request)
  if (denied) return denied

  const body = await request.json().catch(() => null)
  const organizationId = String(body?.organization_id || body?.organizationId || body?.school_id || body?.schoolId || '').trim()
  const classes = Array.isArray(body?.classes) ? body.classes as ClassSyncItem[] : []

  if (!organizationId) return jsonError('organization_id/school_id is required')
  if (!classes.length) return jsonError('classes array is required')

  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })
  if (!organization) return jsonError('Organization not found', 404)

  let upserted = 0
  for (const item of classes) {
    const name = String(item.name || '').trim()
    if (!name) continue
    await prisma.classroom.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name,
        },
      },
      create: {
        organizationId,
        name,
        code: item.code || item.id || null,
      },
      update: {
        code: item.code || item.id || null,
      },
    })
    upserted += 1
  }

  return NextResponse.json({ upserted, organization_id: organizationId })
}
