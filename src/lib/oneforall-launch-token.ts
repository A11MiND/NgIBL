import crypto from 'node:crypto'

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return Buffer.from(padded, 'base64').toString('utf8')
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export type OneForAllLaunchClaims = {
  iss: string
  typ: string
  exp: number
  global_user_id: string
  school_id: number | string
  platform: string
  role: string
  email: string
  name?: string
}

export function verifyOneForAllLaunchToken(token: string): OneForAllLaunchClaims {
  const [encodedHeader, encodedPayload, signature] = token.split('.')
  if (!encodedHeader || !encodedPayload || !signature) throw new Error('Invalid launch token')

  const expected = base64Url(
    crypto
      .createHmac('sha256', process.env.ONE_FOR_ALL_LAUNCH_SECRET || 'one-for-all-dev-launch-secret')
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest()
  )
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid launch token signature')
  }

  const claims = JSON.parse(base64UrlDecode(encodedPayload)) as OneForAllLaunchClaims
  if (claims.iss !== 'one-for-all' || claims.typ !== 'platform_launch') {
    throw new Error('Invalid launch token claims')
  }
  if (claims.platform !== 'ibl') {
    throw new Error('Launch token is not for IBL')
  }
  if (!claims.exp || claims.exp * 1000 < Date.now()) {
    throw new Error('Launch token expired')
  }
  if (!claims.email || !claims.global_user_id) {
    throw new Error('Launch token missing identity')
  }
  return claims
}
