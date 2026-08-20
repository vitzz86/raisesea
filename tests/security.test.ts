import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { safeInternalRedirect } from '../lib/safe-redirect'
import { buildUnsubscribeUrl, createUnsubscribeToken, verifyUnsubscribeToken } from '../lib/unsubscribe'

test('redirect validation accepts internal paths and rejects parser bypasses', () => {
  assert.equal(safeInternalRedirect('/dashboard?tab=one'), '/dashboard?tab=one')
  assert.equal(safeInternalRedirect('https://evil.example'), '/dashboard')
  assert.equal(safeInternalRedirect('//evil.example'), '/dashboard')
  assert.equal(safeInternalRedirect('/\\\\evil.example'), '/dashboard')
  assert.equal(safeInternalRedirect('/safe\npath'), '/dashboard')
})
test('unsubscribe links require a valid keyed signature', () => {
  process.env.UNSUBSCRIBE_SECRET = 'qa-only-secret-that-is-not-used-in-production'
  const userId = '2f1c255d-6a83-4d49-8ed6-645d6f97a5bd'
  const token = createUnsubscribeToken(userId)
  assert.equal(token.length, 64)
  assert.equal(verifyUnsubscribeToken(userId, token), true)
  assert.equal(verifyUnsubscribeToken('9fd916eb-0420-4898-abcf-60ed2d7538dd', token), false)
  const url = new URL(buildUnsubscribeUrl('https://www.raisesea.com', userId))
  assert.equal(url.searchParams.get('u'), userId)
  assert.equal(url.searchParams.get('t'), token)
})

test('database hardening migration revokes anonymous privileged RPC access', async () => {
  const sql = await readFile(new URL('../supabase/migrations/v23_security_hardening.sql', import.meta.url), 'utf8')
  for (const fn of ['get_oauth_token', 'set_oauth_token', 'claim_submissions_by_email', 'get_platform_stats']) {
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}`))
  }
  assert.match(sql, /DROP POLICY IF EXISTS "Public can view if is_public"/)
})
