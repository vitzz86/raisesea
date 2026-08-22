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

test('database rate limiting is atomic and service-role only', async () => {
  const sql = await readFile(new URL('../supabase/migrations/v24_api_rate_limits.sql', import.meta.url), 'utf8')
  assert.match(sql, /ON CONFLICT \(principal_id, action, window_started_at\)/)
  assert.match(sql, /request_count = public\.api_rate_limits\.request_count \+ 1/)
  assert.match(sql, /SECURITY DEFINER/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.consume_api_rate_limit[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.consume_api_rate_limit[\s\S]*TO service_role/)
})

test('resource-intensive routes enforce the shared database limiter', async () => {
  const routes = [
    '../app/api/submit/route.ts',
    '../app/api/upload/signed-url/route.ts',
    '../app/api/crm/scan-card/route.ts',
    '../app/api/mock-pitch/start/route.ts',
    '../app/api/mock-pitch/debrief/route.ts',
    '../app/api/analyze/deck/route.ts',
    '../app/api/analyze/market/route.ts',
    '../app/api/analyze/competitors/route.ts',
    '../app/api/meetings/request/route.ts',
  ]

  for (const route of routes) {
    const source = await readFile(new URL(route, import.meta.url), 'utf8')
    assert.match(source, /enforceApiRateLimit\(/, `${route} must enforce a database rate limit`)
  }
})

test('rate limiting only fails open while the v24 RPC is not installed', async () => {
  const source = await readFile(new URL('../lib/rate-limit.ts', import.meta.url), 'utf8')
  assert.match(source, /error\.code === 'PGRST202'/)
  assert.match(source, /error\.code === '42883'/)
  assert.match(source, /Every other database failure remains fail-closed/)
  assert.match(source, /RATE_LIMIT_UNAVAILABLE/)
})

test('CI enforces checks, a production build, and a dependency audit', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  assert.match(workflow, /npm ci/)
  assert.match(workflow, /npm run check/)
  assert.match(workflow, /npm run build/)
  assert.match(workflow, /npm audit --audit-level=high/)
})
