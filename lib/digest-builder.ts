// ═══════════════════════════════════════════════════════════════
// lib/digest-builder.ts
// Builds + sends the weekly news digest.
//
// Flow:
//   1. Pull all approved news_items from last 7 days
//   2. Pull the approved editors_take for this week (if any)
//   3. For each subscriber with email_digest_enabled=true:
//      • Filter Section 1 (fundraising) by their news_sectors
//      • If fewer than 3 items match, fall back to adjacent sectors (Option C)
//      • Send personalized email via Resend
//   4. Record in news_digests + update last_digest_sent_at
// ═══════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto'
import { supabaseAdmin } from './supabase'
import { sendEmail, sendEmailBatch, wrapEmailHTML } from './resend'
import { verifyTake } from './editorial-verify'
import { TOP_STORY_CATEGORIES, type CategorizedTopStories } from './news-clustering'

type NewsItem = {
  id: string
  category: string
  title: string
  company_name: string | null
  amount_usd: number | null
  stage: string | null
  sector: string | null
  country: string | null
  lead_investor: string | null
  source_url: string
  source_name: string | null
  ai_summary: string | null
  ai_why_it_matters: string | null
  published_at: string | null
  region_scope?: string | null
}

type Subscriber = {
  id: string
  email: string
  full_name: string | null
  news_sectors: string[]
  last_digest_sent_at?: string | null
}

// Basic RFC-ish email validation. Resend batch uses STRICT validation — one
// malformed address fails the entire batch — so we filter before sending.
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const MIN_ITEMS_IN_SECTION_1 = 3

/**
 * Run the full digest send.
 * Returns counts for reporting + creates a news_digests audit row.
 */
export async function sendWeeklyDigest(opts: {
  triggeredBy: 'cron' | 'manual_admin'
  triggeredByUserId?: string | null
  dryRun?: boolean   // when true, doesn't send emails, just returns the plan
  returnHtml?: boolean  // when true (with dryRun), also returns rendered sample HTML
  force?: boolean    // when true, re-send even to subscribers already sent this week
}): Promise<{
  recipients: number
  items: number
  digest_id: string | null
  preview?: { subscriber_email: string; section1_count: number }[]
  skippedReason?: string
  alreadySent?: number
  previewHtml?: string
}> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400 * 1000).toISOString()

  // Load all approved items from last 7 days
  const { data: items } = await supabaseAdmin
    .from('news_items')
    .select('id, category, title, company_name, amount_usd, stage, sector, country, lead_investor, source_url, source_name, ai_summary, ai_why_it_matters, published_at, region_scope')
    .eq('status', 'approved')
    .gte('published_at', sevenDaysAgo)
    .order('amount_usd', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false })

  const allItems = (items || []) as NewsItem[]
  if (allItems.length === 0) {
    console.log('[digest] no approved items in last 7 days — skipping send')
    return { recipients: 0, items: 0, digest_id: null }
  }

  // Load this week's approved editor's take (most recent) — structured
  const { data: takes } = await supabaseAdmin
    .from('editors_takes')
    .select('content, headline, body, takeaway, top_stories')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
  const t0 = takes?.[0]
  const editorsTake = t0?.content || null
  const takeHeadline = t0?.headline || null
  const takeTakeaway = t0?.takeaway || null
  // Categorized AI top stories attached to the approved take (same artifact the
  // /news page renders). Null for old takes / quiet weeks → legacy list is used.
  const takeTopStories = (t0?.top_stories as CategorizedTopStories | null) || null
  // Prefer the clean `body` column; fall back to deriving it from `content`
  // for OLD takes (strip the duplicated headline + takeaway).
  let takeBody = t0?.body || null
  if (!takeBody && t0?.content) {
    takeBody = t0.content
    if (t0.headline && takeBody.startsWith(t0.headline)) takeBody = takeBody.slice(t0.headline.length).trim()
    if (t0.takeaway && takeBody.endsWith(t0.takeaway)) takeBody = takeBody.slice(0, takeBody.length - t0.takeaway.length).trim()
    if (t0.headline && takeBody.startsWith(t0.headline)) takeBody = takeBody.slice(t0.headline.length).trim()
  }

  // ── SAFETY FLOOR (cron auto-send only) ──
  // Protect subscribers from a thin/empty/broken digest. When the cron triggers
  // the weekly auto-send, require at least 3 approved items AND a complete
  // editor's take. Manual admin sends bypass this (admin deliberately chose to).
  const MIN_ITEMS_FOR_AUTOSEND = 3
  if (opts.triggeredBy === 'cron' && !opts.dryRun) {
    // Lenient take check: presence + minimum length only (won't false-positive
    // on a legit take that happens to end on a number/URL).
    const takeCheck = verifyTake(
      { headline: takeHeadline, body: takeBody, takeaway: takeTakeaway, content: editorsTake },
      { strict: false },
    )
    if (allItems.length < MIN_ITEMS_FOR_AUTOSEND || !editorsTake || !takeCheck.ok) {
      const takeNote = !editorsTake ? ', no editor\u2019s take' : (!takeCheck.ok ? `, take incomplete (${takeCheck.issues.join('; ')})` : '')
      console.warn(`[digest] SAFETY FLOOR: auto-send skipped — only ${allItems.length} approved item(s)${takeNote}. Need ${MIN_ITEMS_FOR_AUTOSEND}+ items + a complete take. Notifying admin instead.`)
      await notifyAdminDigestSkipped(allItems.length, !!editorsTake)
      return { recipients: 0, items: allItems.length, digest_id: null, skippedReason: 'safety_floor' }
    }
  }

  // Load all subscribers (founders + experts, email_digest_enabled=true)
  const { data: subs } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name, news_sectors, last_digest_sent_at')
    .eq('email_digest_enabled', true)

  // Keep only deliverable addresses (batch validation is strict — see isValidEmail)
  const subscribers = (subs || []).filter(s => s.email && isValidEmail(s.email)) as Subscriber[]
  if (subscribers.length === 0) {
    console.log('[digest] no active subscribers with valid email — skipping send')
    return { recipients: 0, items: 0, digest_id: null }
  }

  // ─── Group items by category for sections 2-4 (universal content) ───
  // SEA-first ordering within every section (then newest).
  const seaFirst = (a: NewsItem, b: NewsItem) => {
    const aw = (a.region_scope || 'sea') === 'sea' ? 0 : 1
    const bw = (b.region_scope || 'sea') === 'sea' ? 0 : 1
    if (aw !== bw) return aw - bw
    return (b.published_at || '').localeCompare(a.published_at || '')
  }
  const techItems   = allItems.filter(i => i.category === 'tech').sort(seaFirst).slice(0, 4)
  const policyItems = allItems.filter(i => i.category === 'policy').sort(seaFirst).slice(0, 3)
  const exitItems   = allItems.filter(i => i.category === 'exit').sort(seaFirst).slice(0, 2)
  const allFundraising = allItems.filter(i => i.category === 'fundraising').sort(seaFirst)

  // Top stories for the email — multi-source clusters or big raises, SEA-first
  const emailTopStories = computeEmailTopStories(allItems)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const weekLabel = `Week of ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`

  // ─── Render one subscriber's email (personalized Section 1) ───
  const subject = `Weekly SEA Fundraising Digest - ${weekLabel}`
  const renderForSub = (sub: Subscriber): { html: string; text: string; section1Count: number } => {
    let section1 = allFundraising.filter(i => i.sector && sub.news_sectors.includes(i.sector))
    // Smart fallback (Option C): if fewer than MIN_ITEMS_IN_SECTION_1, fill from rest
    if (section1.length < MIN_ITEMS_IN_SECTION_1) {
      const used = new Set(section1.map(i => i.id))
      const others = allFundraising.filter(i => !used.has(i.id))
      section1 = [...section1, ...others.slice(0, MIN_ITEMS_IN_SECTION_1 - section1.length + 3)]
    }
    section1 = section1.slice(0, 8)  // cap

    const usedSectorFilter = sub.news_sectors.length > 0
    const lightWeekNote = usedSectorFilter && section1.filter(i => sub.news_sectors.includes(i.sector || '')).length < 2

    const html = wrapEmailHTML({
      title: subject,
      body: buildDigestBody({
        firstName: sub.full_name?.split(' ')[0] || null,
        weekLabel,
        editorsTake,
        takeHeadline, takeBody, takeTakeaway,
        topStories: emailTopStories,
        categorizedTopStories: takeTopStories,
        totalApproved: allItems.length,
        section1, techItems, policyItems, exitItems,
        sectors: sub.news_sectors,
        lightWeekNote,
        baseUrl,
      }),
      footer: `You're getting this because you signed up for RaiseSEA. ${sub.news_sectors.length > 0 ? 'Section 1 is personalized for your sectors: ' + sub.news_sectors.join(', ') + '.' : 'Pick sectors in your settings to personalize.'}`,
      unsubscribeUrl: `${baseUrl}/api/email/unsubscribe?u=${sub.id}`,
    })
    const text = buildDigestText({ firstName: sub.full_name?.split(' ')[0] || null, section1, techItems, policyItems, exitItems, baseUrl })
    return { html, text, section1Count: section1.length }
  }

  // ─── Dry run: render only, send nothing ───────────────────────
  if (opts.dryRun) {
    const preview: { subscriber_email: string; section1_count: number }[] = []
    let previewHtml: string | undefined
    for (const sub of subscribers) {
      const { html, section1Count } = renderForSub(sub)
      preview.push({ subscriber_email: sub.email, section1_count: section1Count })
      if (!previewHtml) previewHtml = html
    }
    return { recipients: subscribers.length, items: allItems.length, digest_id: null, preview, previewHtml }
  }

  // ─── Idempotency / resume guard ───────────────────────────────
  // Skip anyone already sent THIS week's digest, so a re-run (timeout, retry,
  // double-click) resumes instead of double-emailing. `force` overrides it.
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7))
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekStartIso = weekStart.toISOString()
  const weekKey = weekStartIso.slice(0, 10)

  const toSend = opts.force
    ? subscribers
    : subscribers.filter(s => !s.last_digest_sent_at || s.last_digest_sent_at < weekStartIso)
  const alreadySent = subscribers.length - toSend.length

  if (toSend.length === 0) {
    console.log(`[digest] all ${subscribers.length} subscribers already received this week's digest — nothing to send`)
    return { recipients: 0, items: allItems.length, digest_id: null, alreadySent, skippedReason: 'already_sent_this_week' }
  }

  // ─── Batch send (chunks of 100) with per-chunk commit ─────────
  const CHUNK = 100
  let sentCount = 0
  const sentNowIso = now.toISOString()

  for (let i = 0; i < toSend.length; i += CHUNK) {
    const chunk = toSend.slice(i, i + CHUNK)
    const chunkIndex = i / CHUNK
    const payloads = chunk.map(sub => {
      const { html, text } = renderForSub(sub)
      return { to: sub.email, subject, html, text, tags: [{ name: 'category', value: 'weekly_digest' }] }
    })

    // Idempotency key MUST fingerprint the actual payload, not just (week,
    // chunk#). Resend returns 409 if the same key is reused within 24h with a
    // *different* body — which happens whenever the email body changes (a
    // redeploy) or a later run targets a different set of recipients (the resume
    // guard). Hashing recipients+html means: a true retry of the identical batch
    // dedupes (same key), but any real change gets a fresh key and sends.
    const fingerprint = createHash('sha256')
      .update(payloads.map(p => `${p.to}\u0001${p.html}`).join('\u0002'))
      .digest('hex').slice(0, 16)
    const res = await sendEmailBatch(payloads, { idempotencyKey: `digest-${weekKey}-${fingerprint}` })

    if (res.ok) {
      sentCount += chunk.length
      // Mark this chunk sent immediately, so a later failure/retry doesn't re-send it.
      await supabaseAdmin
        .from('user_profiles')
        .update({ last_digest_sent_at: sentNowIso })
        .in('id', chunk.map(s => s.id))
    } else {
      // Leave this chunk unmarked → a future run will retry exactly these subscribers.
      console.error(`[digest] batch chunk ${chunkIndex} failed (${chunk.length} recipients): ${res.error}`)
    }

    // Pace between chunks to stay under Resend's 2 req/s (only matters past 100 subs).
    if (i + CHUNK < toSend.length) await new Promise(r => setTimeout(r, 600))
  }
  if (alreadySent > 0) console.log(`[digest] skipped ${alreadySent} already-sent subscriber(s) this week`)

  // ─── Record audit log + mark items as included ──────────────
  const { data: digest } = await supabaseAdmin
    .from('news_digests')
    .insert({
      week_label:           weekLabel,
      editors_take:         editorsTake,
      total_recipients:     sentCount,
      total_items:          allItems.length,
      item_ids:             allItems.map(i => i.id),
      triggered_by:         opts.triggeredBy,
      triggered_by_user_id: opts.triggeredByUserId || null,
    })
    .select('id')
    .single()

  if (digest) {
    await supabaseAdmin
      .from('news_items')
      .update({ included_in_digest_id: digest.id })
      .in('id', allItems.map(i => i.id))
  }

  console.log(`[digest] sent to ${sentCount}/${toSend.length} targeted subscribers (${alreadySent} already sent this week), ${allItems.length} items`)
  return { recipients: sentCount, items: allItems.length, digest_id: digest?.id || null, alreadySent }
}

// ─── Email body templates (inline styles only for Gmail compat) ──

const TOP_STORY_EMAIL_META: Record<string, { emoji: string; label: string }> = {
  fundraising: { emoji: '💰', label: 'Fundraising' },
  tech:        { emoji: '⚡', label: 'Tech' },
  policy:      { emoji: '🏛', label: 'Policy' },
  exit:        { emoji: '🚪', label: 'Exit' },
}

// New: the categorized AI top stories (one per category), matching /news.
function renderCategorizedTopStoriesEmail(stories: CategorizedTopStories): string {
  const cats = TOP_STORY_CATEGORIES.filter(c => stories[c])
  if (cats.length === 0) return ''
  const rows = cats.map((c, idx) => {
    const s = stories[c]!
    const meta = TOP_STORY_EMAIL_META[c]
    const sub = [s.country, s.sector, s.coverage >= 2 ? `${s.coverage} sources` : null].filter(Boolean).join(' · ')
    const sources = (s.sources || []).slice(0, 5)
      .map(src => `<a href="${src.url}" style="color:#1a4d2e;text-decoration:none;margin-right:8px;">${escapeHTML(src.name)} ↗</a>`).join('')
    return `<div style="padding:8px 0;${idx < cats.length - 1 ? 'border-bottom:1px solid #f3e9d6;' : ''}">
      <div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">${meta.emoji} ${meta.label}</div>
      <div style="font-size:13px;font-weight:600;color:#1a1a1a;">${escapeHTML(s.headline)}</div>
      ${s.why ? `<div style="font-size:12px;color:#555;line-height:1.5;margin-top:2px;">${escapeHTML(s.why)}</div>` : ''}
      ${sub ? `<div style="font-size:11px;color:#888;margin-top:2px;">${escapeHTML(sub)}</div>` : ''}
      ${sources ? `<div style="font-size:11px;margin-top:3px;">${sources}</div>` : ''}
    </div>`
  }).join('')
  return `<div style="background:#fff8ed;border:1px solid #fde2b8;border-radius:10px;padding:16px 18px;margin:16px 0;">
  <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:10px;">🔥 Top stories this week <span style="font-weight:400;color:#999;font-size:11px;">most important per category</span></div>
  ${rows}
</div>`
}

// Legacy fallback: the old mixed "most covered across sources" top-5 list.
function renderLegacyTopStoriesEmail(
  topStories: { headline: string; sector: string | null; country: string | null; coverage: number; sources: { name: string; url: string }[] }[],
): string {
  return `<div style="background:#fff8ed;border:1px solid #fde2b8;border-radius:10px;padding:16px 18px;margin:16px 0;">
  <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:10px;">🔥 Top stories this week <span style="font-weight:400;color:#999;font-size:11px;">most covered across sources</span></div>
  ${topStories.map((s, idx) => `
    <div style="padding:6px 0;${idx < topStories.length - 1 ? 'border-bottom:1px solid #f3e9d6;' : ''}">
      <div style="font-size:13px;font-weight:600;color:#1a1a1a;">${idx + 1}. ${escapeHTML(s.headline)}</div>
      <div style="font-size:11px;color:#888;margin-top:2px;">${[s.country, s.sector, s.coverage >= 2 ? s.coverage + ' sources' : null].filter(Boolean).join(' · ')}</div>
      <div style="font-size:11px;margin-top:3px;">${s.sources.slice(0, 5).map(src => `<a href="${src.url}" style="color:#1a4d2e;text-decoration:none;margin-right:8px;">${escapeHTML(src.name)} ↗</a>`).join('')}</div>
    </div>`).join('')}
</div>`
}

function buildDigestBody(opts: {
  firstName: string | null
  weekLabel: string
  editorsTake: string | null
  takeHeadline: string | null
  takeBody: string | null
  takeTakeaway: string | null
  topStories: { headline: string; sector: string | null; country: string | null; coverage: number; sources: { name: string; url: string }[] }[]
  categorizedTopStories: CategorizedTopStories | null
  totalApproved: number
  section1: NewsItem[]
  techItems: NewsItem[]
  policyItems: NewsItem[]
  exitItems: NewsItem[]
  sectors: string[]
  lightWeekNote: boolean
  baseUrl: string
}): string {
  const greeting = opts.firstName ? `Hi ${escapeHTML(opts.firstName)},` : 'Hi,'
  const renderItem = (i: NewsItem) => {
    const amount = i.amount_usd ? `$${(i.amount_usd / 1e6).toFixed(1)}M ` : ''
    const meta = [i.country, i.sector, i.stage, i.lead_investor ? `led by ${i.lead_investor}` : null].filter(Boolean).join(' · ')
    return `<div style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
      <div style="font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:2px;">
        ${i.company_name ? escapeHTML(i.company_name) + (amount ? ' raised ' + amount : '') + (i.stage ? escapeHTML(i.stage) : '') : escapeHTML(i.title)}
      </div>
      ${meta ? `<div style="font-size:12px;color:#666;margin-bottom:6px;">${escapeHTML(meta)}</div>` : ''}
      ${i.ai_why_it_matters ? `<div style="font-size:13px;color:#333;line-height:1.5;margin-bottom:6px;">${escapeHTML(i.ai_why_it_matters)}</div>` : ''}
      <a href="${i.source_url}" style="font-size:12px;color:#1a4d2e;text-decoration:none;">Read on ${escapeHTML(i.source_name || 'source')} →</a>
    </div>`
  }
  const renderSection = (title: string, items: NewsItem[]) => {
    if (items.length === 0) return ''
    return `<div style="margin-top:24px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px;">${title}</div>
      ${items.map(renderItem).join('')}
    </div>`
  }
  const shownCount = opts.section1.length + opts.techItems.length + opts.policyItems.length + opts.exitItems.length
  const moreCount = Math.max(0, opts.totalApproved - shownCount)
  const structuredTake = opts.takeHeadline || opts.takeBody
  // Top stories: prefer the categorized AI block (matches /news). Fall back to
  // the legacy "most covered" list only when the take has no categorized stories.
  const cat = opts.categorizedTopStories
  const hasCategorized = !!cat && TOP_STORY_CATEGORIES.some(c => cat[c])
  const topStoriesHtml = hasCategorized
    ? renderCategorizedTopStoriesEmail(cat!)
    : (opts.topStories.length > 0 ? renderLegacyTopStoriesEmail(opts.topStories) : '')
  return `
<h1 style="font-size:20px;color:#1a1a1a;margin:0 0 4px 0;">Weekly SEA Fundraising Digest</h1>
<div style="font-size:13px;color:#666;margin-bottom:20px;">${opts.weekLabel}</div>

<p style="font-size:14px;color:#333;margin:0 0 16px 0;">${greeting}</p>

${structuredTake ? `
<div style="background:#f4f9f5;border:1px solid #d6e6da;border-radius:10px;padding:16px 18px;margin:16px 0;">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a4d2e;margin-bottom:8px;">✍️ Editor's Take</div>
  ${opts.takeHeadline ? `<div style="font-size:17px;font-weight:700;color:#1a1a1a;line-height:1.3;margin-bottom:8px;">${escapeHTML(opts.takeHeadline)}</div>` : ''}
  ${opts.takeBody ? `<div style="font-size:14px;line-height:1.6;color:#333;margin-bottom:${opts.takeTakeaway ? '10px' : '0'};">${escapeHTML(opts.takeBody).replace(/\n/g, '<br>')}</div>` : ''}
  ${opts.takeTakeaway ? `<div style="background:#ffffff;border-left:3px solid #1a4d2e;padding:8px 12px;font-size:13px;color:#1a4d2e;font-weight:500;">→ ${escapeHTML(opts.takeTakeaway)}</div>` : ''}
</div>` : ''}

${opts.lightWeekNote ? `<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:12px;">Light week in your sectors — including notable deals from adjacent sectors.</div>` : ''}

${topStoriesHtml}

${renderSection('Fundraising' + (opts.sectors.length > 0 ? ' — your sectors' : ''), opts.section1)}
${renderSection('Tech & product', opts.techItems)}
${renderSection('Economic & policy', opts.policyItems)}
${renderSection('Exit market', opts.exitItems)}

<div style="margin-top:24px;padding-top:16px;border-top:1px solid #f0f0f0;text-align:center;">
  ${moreCount > 0 ? `<div style="font-size:13px;color:#666;margin-bottom:12px;">+ ${moreCount} more ${moreCount === 1 ? 'story' : 'stories'} this week — read them all on your dashboard.</div>` : ''}
  <a href="${opts.baseUrl}/news" style="display:inline-block;background:#1a4d2e;color:white;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;">
    View all ${opts.totalApproved} stories on RaiseSEA →
  </a>
</div>
`
}

function buildDigestText(opts: {
  firstName: string | null
  section1: NewsItem[]
  techItems: NewsItem[]
  policyItems: NewsItem[]
  exitItems: NewsItem[]
  baseUrl: string
}): string {
  const renderItem = (i: NewsItem) => {
    const amount = i.amount_usd ? `$${(i.amount_usd / 1e6).toFixed(1)}M ` : ''
    return `• ${i.company_name || i.title}${amount ? ' — ' + amount + (i.stage || '') : ''}\n  ${i.ai_why_it_matters || ''}\n  ${i.source_url}`
  }
  return `Weekly SEA Fundraising Digest\n\n${opts.firstName ? 'Hi ' + opts.firstName + ',' : 'Hi,'}\n\nFUNDRAISING\n${opts.section1.map(renderItem).join('\n\n')}\n\nTECH & PRODUCT\n${opts.techItems.map(renderItem).join('\n\n')}\n\nECONOMIC & POLICY\n${opts.policyItems.map(renderItem).join('\n\n')}\n\nEXIT MARKET\n${opts.exitItems.map(renderItem).join('\n\n')}\n\nView full week: ${opts.baseUrl}/news`
}

function escapeHTML(s: string | null | undefined): string {
  if (!s) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Notify the super admin(s) when the cron auto-send is skipped by the safety floor.
 * Sends to SUPER_ADMIN_EMAILS so they know to approve more items / generate a take.
 */
async function notifyAdminDigestSkipped(itemCount: number, hasTake: boolean): Promise<void> {
  try {
    const adminEmails = (process.env.SUPER_ADMIN_EMAILS || '')
      .split(',').map(e => e.trim()).filter(Boolean)
    if (adminEmails.length === 0) return
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const reasons: string[] = []
    if (itemCount < 3) reasons.push(`only ${itemCount} approved item(s) (need 3+)`)
    if (!hasTake) reasons.push('no approved editor\u2019s take')
    const body = `
<h2 style="font-size:18px;margin:0 0 12px 0;color:#1a1a1a;">Weekly digest was NOT sent</h2>
<p style="font-size:14px;color:#333;margin:0 0 12px 0;">
  The Monday auto-send was skipped by the safety floor because: <strong>${reasons.join(' and ')}</strong>.
</p>
<p style="font-size:13px;color:#666;margin:0 0 16px 0;">
  No thin digest went out to subscribers. To send this week, approve more items + an editor's take, then send manually.
</p>
<a href="${baseUrl}/admin/news" style="display:inline-block;background:#1a4d2e;color:white;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;">Review news queue →</a>`
    for (const email of adminEmails) {
      await sendEmail({
        to: email,
        subject: 'RaiseSEA: weekly digest skipped (needs your review)',
        html: wrapEmailHTML({ title: 'Digest skipped', body, unsubscribeUrl: `${baseUrl}/settings` }),
        text: `Weekly digest skipped: ${reasons.join(' and ')}. Review at ${baseUrl}/admin/news`,
        tags: [{ name: 'category', value: 'digest_skipped' }],
      })
    }
  } catch (err) {
    console.error('[digest] failed to notify admin of skip:', err)
  }
}

// Compute top stories for the email (SEA-first, ranked by multi-source coverage / raise size)
type EmailTopStory = { headline: string; sector: string | null; country: string | null; coverage: number; sources: { name: string; url: string }[] }
function computeEmailTopStories(items: NewsItem[]): EmailTopStory[] {
  const stop = new Set(['the','a','an','to','of','in','on','for','and','or','with','at','by','from','as','is','its','it','this','that','raises','raise','startup','million','funding'])
  const tok = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stop.has(w)))
  const jac = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let n = 0; for (const w of a) if (b.has(w)) n++; return n / (a.size + b.size - n) }
  const clusters: { items: NewsItem[]; tokens: Set<string> }[] = []
  for (const it of items) {
    const tokens = tok(it.company_name ? `${it.company_name} ${it.title}` : it.title)
    let placed = false
    for (const c of clusters) {
      const same = it.company_name && c.items.some(ci => ci.company_name && ci.company_name.toLowerCase() === it.company_name!.toLowerCase())
      if (jac(tokens, c.tokens) >= 0.45 || same) { c.items.push(it); for (const t of tokens) c.tokens.add(t); placed = true; break }
    }
    if (!placed) clusters.push({ items: [it], tokens })
  }
  return clusters.map(c => {
    const sorted = [...c.items].sort((a, b) => (b.amount_usd || 0) - (a.amount_usd || 0))
    const primary = sorted[0]
    const sources = c.items.map(i => ({ name: i.source_name || 'source', url: i.source_url })).filter((s, idx, arr) => arr.findIndex(x => x.url === s.url) === idx)
    const isSea = (primary.region_scope || 'sea') === 'sea'
    return { primary, sources, coverage: sources.length, isSea }
  })
  .filter(s => s.coverage >= 2 || (s.primary.amount_usd || 0) >= 5_000_000)
  .sort((a, b) => {
    if (a.isSea !== b.isSea) return a.isSea ? -1 : 1  // SEA first
    if (b.coverage !== a.coverage) return b.coverage - a.coverage
    return (b.primary.amount_usd || 0) - (a.primary.amount_usd || 0)
  })
  .slice(0, 5)
  .map(s => ({
    headline: s.primary.company_name ? `${s.primary.company_name}${s.primary.amount_usd ? ' raised $' + (s.primary.amount_usd / 1e6).toFixed(1) + 'M' : ''}` : s.primary.title,
    sector: s.primary.sector, country: s.primary.country, coverage: s.coverage, sources: s.sources,
  }))
}
