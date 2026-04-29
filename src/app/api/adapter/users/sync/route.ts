import { NextResponse } from 'next/server'
import { Platform } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdapterToken } from '@/lib/adapter-auth'

type UserSyncItem = {
  global_user_id?: string
  globalUserId?: string
  local_user_id?: string
  localUserId?: string
  user_id?: string
  userId?: string
  platform?: string
  role?: string
  status?: string
}

export async function POST(request: Request) {
  const denied = requireAdapterToken(request)
  if (denied) return denied

  const body = await request.json().catch(() => null)
  const users = Array.isArray(body?.users) ? body.users as UserSyncItem[] : []
  if (!users.length) return jsonError('users array is required')

  let upserted = 0
  for (const item of users) {
    const globalUserId = String(item.global_user_id || item.globalUserId || '').trim()
    const localUserId = String(item.local_user_id || item.localUserId || item.user_id || item.userId || '').trim()
    const userId = String(item.user_id || item.userId || '').trim() || null
    if (!globalUserId || !localUserId) continue

    await prisma.globalUser.upsert({
      where: { id: globalUserId },
      create: { id: globalUserId },
      update: {},
    })

    await prisma.platformUserMapping.upsert({
      where: {
        platform_localUserId: {
          platform: Platform.IBL,
          localUserId,
        },
      },
      create: {
        globalUserId,
        platform: Platform.IBL,
        localUserId,
        userId,
      },
      update: {
        globalUserId,
        userId,
      },
    })
    upserted += 1
  }

  return NextResponse.json({ upserted })
}
