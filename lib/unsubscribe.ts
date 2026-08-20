import { createHmac, timingSafeEqual } from 'crypto'

function signingSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_KEY
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is not configured')
  return secret
}

export function createUnsubscribeToken(userId: string): string {
  return createHmac('sha256', signingSecret()).update(`raisesea-unsubscribe:${userId}`).digest('hex')
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(token)) return false
  const expected = Buffer.from(createUnsubscribeToken(userId), 'hex')
  const provided = Buffer.from(token, 'hex')
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

export function buildUnsubscribeUrl(baseUrl: string, userId: string): string {
  const url = new URL('/api/email/unsubscribe', baseUrl)
  url.searchParams.set('u', userId)
  url.searchParams.set('t', createUnsubscribeToken(userId))
  return url.toString()
}
