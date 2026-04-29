import { NextResponse } from 'next/server'

export function requireAdapterToken(request: Request): NextResponse | null {
  const expected = process.env.ADAPTER_TOKEN || process.env.ONE_FOR_ALL_ADAPTER_TOKEN

  if (!expected && process.env.NODE_ENV !== 'production') {
    return null
  }

  const authHeader = request.headers.get('authorization') || ''
  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : ''
  const explicit = request.headers.get('x-adapter-token') || ''
  const supplied = bearer || explicit

  if (!expected || supplied !== expected) {
    return NextResponse.json({ error: 'Invalid adapter token' }, { status: 401 })
  }

  return null
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}
