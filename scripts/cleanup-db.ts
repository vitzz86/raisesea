// ═══════════════════════════════════════════════════════════════
// scripts/cleanup-db.ts
//
// Pre-launch database cleanup with approval gates.
//
// USAGE:
//   npm run db:cleanup                         → preview ALL categories (no changes)
//   npm run db:cleanup -- --category=<name>    → preview specific category
//   npm run db:cleanup -- --confirm            → run ALL with per-category confirm prompts
//   npm run db:cleanup -- --category=<name> --confirm
//                                              → run only that category
//
// CATEGORIES:
//   test-submissions   — submissions where company_name matches test patterns
//   abandoned-decks    — submissions older than 10 days with NULL deck_analysis
//   stale-mock-pitch   — abandoned/in_progress mock pitch sessions older than 10 days
//   dead-meetings      — meeting_requests with terminal status (pending/declined/expired/cancelled) older than 10 days
//   old-news           — news_items older than 90 days (content history threshold)
//   orphan-storage     — pitch-decks bucket files not referenced in submissions
//   test-crm-contacts  — CRM contacts matching test patterns
//   super-admin-extras — super_admins not matching whitelist
//
// SAFETY:
//   • Preview-by-default. No --confirm = NO DELETIONS.
//   • Every deletion prompts y/N (default N).
//   • Connects to the project URL in your .env.local — prints it at startup.
//     If wrong, abort with Ctrl+C BEFORE confirming.
//   • All actions logged to scripts/cleanup-log.txt with timestamp.
//   • Whitelisted super-admins NEVER touched:
//       - samudravito4@gmail.com
//       - vito.samudra@newenergynexus.com
// ═══════════════════════════════════════════════════════════════

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { readFileSync, appendFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createInterface } from 'readline'

// ─── Constants ─────────────────────────────────────────────────

const WHITELISTED_ADMINS = [
  'samudravito4@gmail.com',
  'vito.samudra@newenergynexus.com',
]

// Test patterns — case-insensitive substring match on company_name / crm name
const TEST_PATTERNS = [
  'botmd',
  'teamsolve',
  'amili',
  'test',
  'demo',
  'example',
  'asdf',
  'qwerty',
  'lorem',
]

const STORAGE_BUCKET = 'pitch-decks'

const LOG_FILE = resolve(process.cwd(), 'scripts', 'cleanup-log.txt')

// Days thresholds — unified 10-day rule for abandoned/failed/pending categories,
// 90-day for news archive (quarterly cadence).
const ABANDONED_DECK_DAYS    = 10
const STALE_MOCKPITCH_DAYS   = 10
const STALE_MEETING_DAYS     = 10
const OLD_NEWS_DAYS          = 90

// ─── ANSI color helpers (no chalk dependency) ──────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
}
const banner = (text: string) =>
  `\n${c.bold}${c.cyan}═══ ${text} ${'═'.repeat(Math.max(0, 65 - text.length))}${c.reset}\n`
const ok    = (text: string) => `${c.green}✓${c.reset} ${text}`
const warn  = (text: string) => `${c.yellow}⚠${c.reset} ${text}`
const danger = (text: string) => `${c.red}✗${c.reset} ${text}`
const dim   = (text: string) => `${c.gray}${text}${c.reset}`

// ─── Env loader (skip dotenv dep — read .env.local manually) ───

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) {
    console.error(danger(`No .env.local found at ${envPath}`))
    console.error(dim('Run this from the project root directory.'))
    process.exit(1)
  }
  const raw = readFileSync(envPath, 'utf-8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

// ─── Supabase admin client ─────────────────────────────────────

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    console.error(danger('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local'))
    process.exit(1)
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─── CLI arg parsing ───────────────────────────────────────────

const argv = process.argv.slice(2)
const CONFIRM     = argv.includes('--confirm')
const VERBOSE     = argv.includes('--verbose') || argv.includes('-v')
const categoryArg = argv.find(a => a.startsWith('--category='))?.split('=')[1] || null

// ─── Audit log ─────────────────────────────────────────────────

function log(message: string) {
  const ts = new Date().toISOString()
  appendFileSync(LOG_FILE, `[${ts}] ${message}\n`)
}

// ─── Confirmation prompt (y/N, default N) ──────────────────────

async function confirmPrompt(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(`${c.yellow}? ${question} [y/N]: ${c.reset}`, answer => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

// ═══════════════════════════════════════════════════════════════
// CLEANUP CATEGORIES
// ═══════════════════════════════════════════════════════════════

interface Category {
  key:         string
  title:       string
  description: string
  run:         (sb: SupabaseClient, confirm: boolean) => Promise<void>
}

// Helper: build OR filter for test patterns matching a column
function testPatternFilter(column: string): string {
  return TEST_PATTERNS.map(p => `${column}.ilike.%${p}%`).join(',')
}

// 1. TEST SUBMISSIONS ─────────────────────────────────────────
// Smart dedup logic: for each company name matching test patterns:
//   - KEEP the most recent submission with successful analysis (deck_analysis NOT NULL)
//   - DELETE older/failed duplicates within the same company group
//   - If NO successful submission exists in a group, KEEP the most recent attempt
//   - Solo submissions (no duplicates) are ALWAYS KEPT — nothing to deduplicate
const testSubmissions: Category = {
  key:         'test-submissions',
  title:       'Test submissions (duplicate cleanup)',
  description: `For company names matching: ${TEST_PATTERNS.join(', ')} — keep latest successful version per company, delete older duplicates`,
  async run(sb, confirm) {
    const { data, error } = await sb
      .from('submissions')
      .select('id, company_name, country, stage, deck_url, created_at, user_id, deck_analysis, match_results')
      .or(testPatternFilter('company_name'))
      .order('created_at', { ascending: false })

    if (error) { console.error(danger(`Query failed: ${error.message}`)); return }
    if (!data || data.length === 0) { console.log(ok('No test submissions found.')); return }

    // ─── Group by normalized company name ───
    const normalize = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ')
    const groups = new Map<string, typeof data>()
    for (const sub of data) {
      const key = normalize(sub.company_name as string)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(sub)
    }

    // ─── Decide KEEP vs DELETE per group ───
    type GroupDecision = {
      displayName:  string
      keep:         typeof data[0]
      deleteList:   typeof data
      reason:       string
      isSolo:       boolean
    }
    const decisions: GroupDecision[] = []
    const toKeep:   typeof data = []
    const toDelete: typeof data = []

    for (const [_, subs] of groups) {
      // Data is sorted by created_at DESC from the query
      const successful = subs.find(s => s.deck_analysis !== null)
      const isSolo = subs.length === 1

      let keeper: typeof data[0]
      let reason: string

      if (isSolo) {
        keeper = subs[0]
        reason = 'solo submission — always preserved'
      } else if (successful) {
        keeper = successful
        reason = 'latest with successful analysis'
      } else {
        keeper = subs[0]
        reason = 'newest attempt (no group member has analysis)'
      }

      const deleteList = subs.filter(s => s.id !== keeper.id)
      toKeep.push(keeper)
      toDelete.push(...deleteList)
      decisions.push({
        displayName: subs[0].company_name as string,
        keep: keeper,
        deleteList,
        reason,
        isSolo,
      })
    }

    // ─── Show preview ───
    const soloGroups = decisions.filter(d => d.isSolo)
    const dupGroups  = decisions.filter(d => !d.isSolo)

    console.log(warn(`Found ${data.length} test submission(s) across ${groups.size} company group(s).`));
    console.log(`  ${c.green}KEEP${c.reset}:   ${toKeep.length} (${soloGroups.length} solo + ${dupGroups.length} latest-per-group)`)
    console.log(`  ${c.red}DELETE${c.reset}: ${toDelete.length} (older/duplicate versions)`)
    console.log()

    for (const d of decisions) {
      const totalInGroup = d.deleteList.length + 1
      console.log(`${c.bold}${d.displayName}${c.reset} ${dim(`(${totalInGroup} submission${totalInGroup === 1 ? '' : 's'})`)}`)
      const keepDate = new Date(d.keep.created_at as string).toISOString().split('T')[0]
      const keepHasAnalysis = d.keep.deck_analysis !== null ? '✓ analyzed' : '⚠ no analysis'
      console.log(`  ${c.green}✓ KEEP${c.reset}   ${keepDate} ${dim(`— ${(d.keep.id as string).slice(0, 8)} — ${keepHasAnalysis} — ${d.reason}`)}`)
      for (const del of d.deleteList) {
        const delDate = new Date(del.created_at as string).toISOString().split('T')[0]
        const delHasAnalysis = del.deck_analysis !== null ? 'analyzed' : 'no analysis'
        console.log(`  ${c.red}✗ DELETE${c.reset} ${delDate} ${dim(`— ${(del.id as string).slice(0, 8)} — ${delHasAnalysis}`)}`)
      }
    }

    if (toDelete.length === 0) {
      console.log()
      console.log(ok('Nothing to delete — every test company has only its best version present.'))
      return
    }

    // ─── Side-effect counts (only for to-delete set) ───
    const deleteIds = toDelete.map(s => s.id as string)
    const { data: mockPitches } = await sb
      .from('mock_pitch_sessions')
      .select('id, mode, status')
      .in('submission_id', deleteIds)
    const { count: meetingCount } = await sb
      .from('meeting_requests')
      .select('*', { count: 'exact', head: true })
      .in('submission_id', deleteIds)

    const pitchCount       = mockPitches?.filter(m => m.mode === 'pitch').length || 0
    const qaCount          = mockPitches?.filter(m => m.mode === 'qa').length    || 0
    const completedPitches = mockPitches?.filter(m => m.status === 'completed').length || 0

    console.log()
    console.log(dim('  ── Linked data that will be deleted along with the duplicate submissions: ──'))
    console.log(dim(`     • ${pitchCount} mock pitch session(s) (${completedPitches} with completed debriefs)`))
    console.log(dim(`     • ${qaCount} Q&A session(s)`))
    console.log(dim(`     • ${meetingCount || 0} meeting request(s)`))
    console.log(dim(`     • ${toDelete.filter(s => s.deck_url).length} deck PDF(s) from storage`))

    if (!confirm) {
      console.log(dim('  (preview mode — pass --confirm to delete)'))
      return
    }

    const proceed = await confirmPrompt(`Delete ${toDelete.length} duplicate submissions + ${pitchCount + qaCount} mock sessions + ${meetingCount || 0} meetings?`)
    if (!proceed) { console.log(dim('Skipped.')); return }

    const storagePaths = toDelete.map(s => s.deck_url as string).filter(Boolean)

    // Delete dependent rows first
    const { error: e1 } = await sb.from('mock_pitch_sessions').delete().in('submission_id', deleteIds)
    if (e1) console.error(danger(`mock_pitch_sessions delete failed: ${e1.message}`))

    const { error: e2 } = await sb.from('meeting_requests').delete().in('submission_id', deleteIds)
    if (e2) console.error(danger(`meeting_requests delete failed: ${e2.message}`))

    const { error: e3 } = await sb.from('submissions').delete().in('id', deleteIds)
    if (e3) { console.error(danger(`submissions delete failed: ${e3.message}`)); return }

    if (storagePaths.length > 0) {
      const { error: e4 } = await sb.storage.from(STORAGE_BUCKET).remove(storagePaths)
      if (e4) console.error(warn(`Storage cleanup partial: ${e4.message}`))
      else console.log(ok(`Removed ${storagePaths.length} deck files from storage.`))
    }

    console.log(ok(`Deleted ${toDelete.length} duplicate submissions. Preserved ${toKeep.length} latest version(s).`))
    log(`Deleted ${toDelete.length} duplicate test submissions (kept ${toKeep.length} latest-per-company). Linked: ${pitchCount + qaCount} mock sessions, ${meetingCount || 0} meetings`)
  },
}

// 2. ABANDONED DECKS ──────────────────────────────────────────
const abandonedDecks: Category = {
  key:         'abandoned-decks',
  title:       'Abandoned / failed deck analyses',
  description: `Submissions older than ${ABANDONED_DECK_DAYS} days with no deck_analysis (likely failed mid-analysis)`,
  async run(sb, confirm) {
    const cutoff = new Date(Date.now() - ABANDONED_DECK_DAYS * 86400_000).toISOString()
    const { data, error } = await sb
      .from('submissions')
      .select('id, company_name, created_at, deck_url')
      .is('deck_analysis', null)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: false })

    if (error) { console.error(danger(`Query failed: ${error.message}`)); return }
    if (!data || data.length === 0) { console.log(ok('No abandoned decks found.')); return }

    console.log(warn(`Found ${data.length} abandoned deck(s) older than ${ABANDONED_DECK_DAYS} days:`));
    (VERBOSE ? data : data.slice(0, 10)).forEach((s, i) => {
      const date = new Date(s.created_at as string).toISOString().split('T')[0]
      console.log(`  ${dim(String(i + 1).padStart(2, ' '))}. ${s.company_name} ${dim(`— ${date}`)}`)
    })
    if (data.length > 10 && !VERBOSE) console.log(dim(`  ... and ${data.length - 10} more (re-run with --verbose to see all)`))

    // Side-effect query: count linked mock pitches + meetings (these are usually 0 for failed analyses since user never reached those features)
    const ids = data.map(s => s.id as string)
    const { data: mockPitches } = await sb
      .from('mock_pitch_sessions')
      .select('id, mode')
      .in('submission_id', ids)
    const { count: meetingCount } = await sb
      .from('meeting_requests')
      .select('*', { count: 'exact', head: true })
      .in('submission_id', ids)

    const pitchCount = mockPitches?.filter(m => m.mode === 'pitch').length || 0
    const qaCount    = mockPitches?.filter(m => m.mode === 'qa').length || 0

    console.log()
    console.log(dim('  ── Linked data that will also be deleted if you proceed: ──'))
    console.log(dim(`     • ${pitchCount} mock pitch session(s)`))
    console.log(dim(`     • ${qaCount} Q&A session(s)`))
    console.log(dim(`     • ${meetingCount || 0} meeting request(s)`))
    console.log(dim(`     • Deck PDFs in storage (${data.filter(s => s.deck_url).length} files)`))

    if (!confirm) { console.log(dim('  (preview mode)')); return }
    const proceed = await confirmPrompt(`Delete ${data.length} abandoned submissions + ${pitchCount + qaCount} mock sessions + ${meetingCount || 0} meetings?`)
    if (!proceed) { console.log(dim('Skipped.')); return }

    const storagePaths = data.map(s => s.deck_url as string).filter(Boolean)

    await sb.from('mock_pitch_sessions').delete().in('submission_id', ids)
    await sb.from('meeting_requests').delete().in('submission_id', ids)
    const { error: e3 } = await sb.from('submissions').delete().in('id', ids)
    if (e3) { console.error(danger(`submissions delete failed: ${e3.message}`)); return }
    if (storagePaths.length > 0) await sb.storage.from(STORAGE_BUCKET).remove(storagePaths)

    console.log(ok(`Deleted ${data.length} abandoned submissions + linked data.`))
    log(`Deleted ${data.length} abandoned submissions, ${pitchCount + qaCount} mock sessions, ${meetingCount || 0} meetings (older than ${ABANDONED_DECK_DAYS}d)`)
  },
}

// 3. STALE MOCK PITCH ─────────────────────────────────────────
const staleMockPitch: Category = {
  key:         'stale-mock-pitch',
  title:       'Abandoned mock pitch sessions',
  description: `Mock pitch sessions older than ${STALE_MOCKPITCH_DAYS} days with status 'abandoned' OR 'in_progress' (never completed). Completed sessions with debriefs are preserved.`,
  async run(sb, confirm) {
    const cutoff = new Date(Date.now() - STALE_MOCKPITCH_DAYS * 86400_000).toISOString()
    const { data, error } = await sb
      .from('mock_pitch_sessions')
      .select('id, started_at, mode, status, submission_id')
      .in('status', ['abandoned', 'in_progress'])
      .lt('started_at', cutoff)
      .order('started_at', { ascending: false })

    if (error) { console.error(danger(`Query failed: ${error.message}`)); return }
    if (!data || data.length === 0) { console.log(ok('No stale mock pitches found.')); return }

    console.log(warn(`Found ${data.length} abandoned mock pitch session(s):`));
    (VERBOSE ? data : data.slice(0, 10)).forEach((s, i) => {
      const date = new Date(s.started_at as string).toISOString().split('T')[0]
      console.log(`  ${dim(String(i + 1).padStart(2, ' '))}. ${s.mode} (${s.status}) ${dim(`— ${date} — ${(s.id as string).slice(0, 8)}`)}`)
    })
    if (data.length > 10 && !VERBOSE) console.log(dim(`  ... and ${data.length - 10} more (re-run with --verbose to see all)`))

    if (!confirm) { console.log(dim('  (preview mode)')); return }
    const proceed = await confirmPrompt(`Delete ${data.length} abandoned sessions?`)
    if (!proceed) { console.log(dim('Skipped.')); return }

    const ids = data.map(s => s.id as string)
    const { error: e1 } = await sb.from('mock_pitch_sessions').delete().in('id', ids)
    if (e1) { console.error(danger(`Delete failed: ${e1.message}`)); return }
    console.log(ok(`Deleted ${data.length} sessions.`))
    log(`Deleted ${data.length} abandoned mock_pitch_sessions`)
  },
}

// 4. DEAD MEETING REQUESTS ────────────────────────────────────
// Catches: stale pending + all terminal statuses older than threshold
// Preserves: confirmed (real meetings), completed (history), recent pending (might still be acted on)
const deadMeetings: Category = {
  key:         'dead-meetings',
  title:       'Dead meeting requests',
  description: `Meeting requests older than ${STALE_MEETING_DAYS} days with status: pending (stale), declined (rejected), expired (auto-killed), or cancelled. Preserves confirmed + completed.`,
  async run(sb, confirm) {
    const cutoff = new Date(Date.now() - STALE_MEETING_DAYS * 86400_000).toISOString()
    const { data, error } = await sb
      .from('meeting_requests')
      .select('id, status, created_at, meeting_goal, vc_profile_id')
      .in('status', ['pending', 'declined', 'expired', 'cancelled'])
      .lt('created_at', cutoff)
      .order('created_at', { ascending: false })

    if (error) { console.error(danger(`Query failed: ${error.message}`)); return }
    if (!data || data.length === 0) { console.log(ok('No dead meeting requests found.')); return }

    // Group by status for clearer preview
    const byStatus: Record<string, number> = {}
    for (const r of data) {
      const s = r.status as string
      byStatus[s] = (byStatus[s] || 0) + 1
    }
    const statusBreakdown = Object.entries(byStatus)
      .map(([s, n]) => `${s}=${n}`)
      .join(', ')

    console.log(warn(`Found ${data.length} dead meeting request(s): ${statusBreakdown}`));
    (VERBOSE ? data : data.slice(0, 10)).forEach((s, i) => {
      const date = new Date(s.created_at as string).toISOString().split('T')[0]
      console.log(`  ${dim(String(i + 1).padStart(2, ' '))}. [${s.status}] ${s.meeting_goal} ${dim(`— ${date} — ${(s.id as string).slice(0, 8)}`)}`)
    })
    if (data.length > 10 && !VERBOSE) console.log(dim(`  ... and ${data.length - 10} more (re-run with --verbose to see all)`))

    if (!confirm) { console.log(dim('  (preview mode)')); return }
    const proceed = await confirmPrompt(`Delete ${data.length} dead meeting requests?`)
    if (!proceed) { console.log(dim('Skipped.')); return }

    const ids = data.map(s => s.id as string)
    const { error: e1 } = await sb.from('meeting_requests').delete().in('id', ids)
    if (e1) { console.error(danger(`Delete failed: ${e1.message}`)); return }
    console.log(ok(`Deleted ${data.length} meeting requests.`))
    log(`Deleted ${data.length} dead meeting requests (statuses: ${statusBreakdown})`)
  },
}

// 5. OLD NEWS ─────────────────────────────────────────────────
const oldNews: Category = {
  key:         'old-news',
  title:       'Old news items',
  description: `news_items older than ${OLD_NEWS_DAYS} days`,
  async run(sb, confirm) {
    const cutoff = new Date(Date.now() - OLD_NEWS_DAYS * 86400_000).toISOString()
    const { count, error: countError } = await sb
      .from('news_items')
      .select('*', { count: 'exact', head: true })
      .lt('published_at', cutoff)

    if (countError) { console.error(danger(`Count failed: ${countError.message}`)); return }
    if (!count) { console.log(ok('No old news items found.')); return }

    // Sample 5 oldest for preview
    const { data: sample } = await sb
      .from('news_items')
      .select('id, title, published_at')
      .lt('published_at', cutoff)
      .order('published_at', { ascending: true })
      .limit(5)

    console.log(warn(`Found ${count} news item(s) older than ${OLD_NEWS_DAYS} days. Sample (oldest first):`));
    sample?.forEach((s, i) => {
      const date = new Date(s.published_at as string).toISOString().split('T')[0]
      const title = (s.title as string).slice(0, 70)
      console.log(`  ${dim(String(i + 1).padStart(2, ' '))}. ${dim(date)} — ${title}${(s.title as string).length > 70 ? '…' : ''}`)
    })

    if (!confirm) { console.log(dim('  (preview mode)')); return }
    const proceed = await confirmPrompt(`Delete ${count} old news items?`)
    if (!proceed) { console.log(dim('Skipped.')); return }

    const { error: e1 } = await sb.from('news_items').delete().lt('published_at', cutoff)
    if (e1) { console.error(danger(`Delete failed: ${e1.message}`)); return }
    console.log(ok(`Deleted ${count} news items.`))
    log(`Deleted ${count} old news_items (older than ${OLD_NEWS_DAYS}d)`)
  },
}

// 6. ORPHAN STORAGE ───────────────────────────────────────────
const orphanStorage: Category = {
  key:         'orphan-storage',
  title:       'Orphan storage files',
  description: 'Files in pitch-decks bucket not referenced by any submission.deck_url',
  async run(sb, confirm) {
    // Recursively list all files (top-level dirs are user_id or 'anonymous')
    const { data: dirs, error: dirErr } = await sb.storage.from(STORAGE_BUCKET).list('', { limit: 1000 })
    if (dirErr) { console.error(danger(`Storage list failed: ${dirErr.message}`)); return }

    const allFiles: string[] = []
    for (const dir of dirs || []) {
      // Each top-level entry is a folder (user_id or 'anonymous')
      const { data: files } = await sb.storage.from(STORAGE_BUCKET).list(dir.name, { limit: 1000 })
      for (const f of files || []) {
        allFiles.push(`${dir.name}/${f.name}`)
      }
    }

    if (allFiles.length === 0) { console.log(ok('Storage bucket empty.')); return }

    // Get all referenced deck_urls from submissions
    const { data: subs, error: subsErr } = await sb
      .from('submissions')
      .select('deck_url')
      .not('deck_url', 'is', null)
    if (subsErr) { console.error(danger(`Submissions query failed: ${subsErr.message}`)); return }

    const referenced = new Set(subs?.map(s => s.deck_url as string) || [])
    const orphans = allFiles.filter(f => !referenced.has(f))

    if (orphans.length === 0) {
      console.log(ok(`All ${allFiles.length} storage files are referenced.`))
      return
    }

    console.log(warn(`Found ${orphans.length} orphan file(s) of ${allFiles.length} total:`));
    (VERBOSE ? orphans : orphans.slice(0, 10)).forEach((f, i) => {
      console.log(`  ${dim(String(i + 1).padStart(2, ' '))}. ${f}`)
    })
    if (orphans.length > 10 && !VERBOSE) console.log(dim(`  ... and ${orphans.length - 10} more (re-run with --verbose to see all)`))

    if (!confirm) { console.log(dim('  (preview mode)')); return }
    const proceed = await confirmPrompt(`Delete ${orphans.length} orphan files?`)
    if (!proceed) { console.log(dim('Skipped.')); return }

    const { error: e1 } = await sb.storage.from(STORAGE_BUCKET).remove(orphans)
    if (e1) { console.error(danger(`Delete failed: ${e1.message}`)); return }
    console.log(ok(`Deleted ${orphans.length} orphan files.`))
    log(`Deleted ${orphans.length} orphan storage files`)
  },
}

// 7. TEST CRM CONTACTS ────────────────────────────────────────
const testCrm: Category = {
  key:         'test-crm-contacts',
  title:       'Test CRM contacts',
  description: 'CRM contacts whose name or company matches test patterns',
  async run(sb, confirm) {
    const { data, error } = await sb
      .from('crm_contacts')
      .select('id, name, company, notes')
      .or(`${testPatternFilter('name')},${testPatternFilter('company')}`)

    if (error) { console.error(danger(`Query failed: ${error.message}`)); return }
    if (!data || data.length === 0) { console.log(ok('No test CRM contacts found.')); return }

    console.log(warn(`Found ${data.length} test CRM contact(s):`));
    (VERBOSE ? data : data.slice(0, 10)).forEach((s, i) => {
      console.log(`  ${dim(String(i + 1).padStart(2, ' '))}. ${s.name} @ ${s.company || '—'}`)
    })
    if (data.length > 10 && !VERBOSE) console.log(dim(`  ... and ${data.length - 10} more (re-run with --verbose to see all)`))

    if (!confirm) { console.log(dim('  (preview mode)')); return }
    const proceed = await confirmPrompt(`Delete ${data.length} CRM contacts?`)
    if (!proceed) { console.log(dim('Skipped.')); return }

    const ids = data.map(s => s.id as string)
    const { error: e1 } = await sb.from('crm_contacts').delete().in('id', ids)
    if (e1) { console.error(danger(`Delete failed: ${e1.message}`)); return }
    console.log(ok(`Deleted ${data.length} CRM contacts.`))
    log(`Deleted ${data.length} test crm_contacts`)
  },
}

// 8. SUPER ADMIN EXTRAS ───────────────────────────────────────
const superAdminExtras: Category = {
  key:         'super-admin-extras',
  title:       'Super admin extras',
  description: `Super admin entries NOT in whitelist: ${WHITELISTED_ADMINS.join(', ')}`,
  async run(sb, confirm) {
    const { data, error } = await sb
      .from('super_admins')
      .select('email, user_id, created_at')
      .not('email', 'in', `(${WHITELISTED_ADMINS.map(e => `"${e}"`).join(',')})`)

    if (error) { console.error(danger(`Query failed: ${error.message}`)); return }
    if (!data || data.length === 0) {
      console.log(ok(`Only whitelisted super-admins present (${WHITELISTED_ADMINS.length}).`))
      return
    }

    console.log(warn(`Found ${data.length} non-whitelisted super admin(s):`));
    data.forEach((s, i) => {
      console.log(`  ${dim(String(i + 1).padStart(2, ' '))}. ${s.email}`)
    })

    if (!confirm) { console.log(dim('  (preview mode)')); return }
    const proceed = await confirmPrompt(`Remove ${data.length} non-whitelisted super-admins?`)
    if (!proceed) { console.log(dim('Skipped.')); return }

    const emails = data.map(s => s.email as string)
    const { error: e1 } = await sb.from('super_admins').delete().in('email', emails)
    if (e1) { console.error(danger(`Delete failed: ${e1.message}`)); return }
    console.log(ok(`Removed ${data.length} super admin entries.`))
    log(`Removed ${data.length} non-whitelisted super_admins`)
  },
}

// ─── Registry ──────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  testSubmissions,
  abandonedDecks,
  staleMockPitch,
  deadMeetings,
  oldNews,
  orphanStorage,
  testCrm,
  superAdminExtras,
]

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  const sb = getClient()
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '(unknown)'

  console.log(banner('RaiseSEA DB Cleanup'))
  console.log(`Project: ${c.bold}${projectUrl}${c.reset}`)
  console.log(`Mode:    ${CONFIRM ? `${c.red}${c.bold}DELETE (--confirm)${c.reset}` : `${c.green}PREVIEW (no changes)${c.reset}`}`)
  console.log(`Log:     ${LOG_FILE}`)

  if (CONFIRM) {
    console.log()
    console.log(warn('This will permanently delete data. You will confirm each category.'));
    const proceed = await confirmPrompt(`Continue against ${projectUrl}?`)
    if (!proceed) { console.log(dim('Aborted.')); return }
    log(`=== Cleanup run started against ${projectUrl} ===`)
  }

  // Run all categories or just one
  const toRun = categoryArg
    ? CATEGORIES.filter(cat => cat.key === categoryArg)
    : CATEGORIES

  if (categoryArg && toRun.length === 0) {
    console.error(danger(`Unknown category: ${categoryArg}`))
    console.error(dim(`Available: ${CATEGORIES.map(c => c.key).join(', ')}`))
    process.exit(1)
  }

  for (const cat of toRun) {
    console.log(banner(cat.title))
    console.log(dim(cat.description))
    console.log()
    try {
      await cat.run(sb, CONFIRM)
    } catch (err) {
      console.error(danger(`Category failed: ${err instanceof Error ? err.message : String(err)}`))
      log(`ERROR in ${cat.key}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(banner('Done'))
  if (CONFIRM) {
    console.log(ok('Cleanup complete. Check scripts/cleanup-log.txt for full log.'))
    log(`=== Cleanup run completed ===`)
  } else {
    console.log(dim('Preview only. To delete: re-run with --confirm'))
  }
}

main().catch(err => {
  console.error(danger(`Fatal: ${err instanceof Error ? err.message : String(err)}`))
  log(`FATAL: ${err instanceof Error ? err.stack : String(err)}`)
  process.exit(1)
})
