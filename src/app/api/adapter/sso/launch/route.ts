import { NextResponse } from 'next/server'
import { verifyOneForAllLaunchToken } from '@/lib/oneforall-launch-token'
import { provisionOneForAllUser } from '@/lib/oneforall-jit'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const token = String(body?.token || '').trim()
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })

  let claims
  try {
    claims = verifyOneForAllLaunchToken(token)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid launch token' }, { status: 401 })
  }

  const { user, organization, created } = await provisionOneForAllUser(claims)

  return NextResponse.json({
    ok: true,
    platform: 'ibl',
    global_user_id: claims.global_user_id,
    local_user_id: user.id,
    email: user.email,
    organization_id: organization.id,
    created,
  })
}
