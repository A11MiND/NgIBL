import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    platform: 'ibl',
    capabilities: [
      'users.sync',
      'classes.sync',
      'entitlements.apply',
      'students.summary',
      'events.export',
    ],
  })
}
