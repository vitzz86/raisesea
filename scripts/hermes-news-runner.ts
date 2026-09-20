#!/usr/bin/env tsx

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

type Mode = 'daily' | 'weekly' | 'dry-run' | 'source-audit'

const VALID_MODES = new Set<Mode>(['daily', 'weekly', 'dry-run', 'source-audit'])

function loadRuntimeEnvironment() {
  const candidates = [
    process.env.NEWS_ENV_FILE,
    '/opt/data/.env',
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), '.env'),
  ].filter((candidate): candidate is string => Boolean(candidate))
  const envFile = candidates.find(existsSync)
  if (envFile) process.loadEnvFile(envFile)
}

function readMode(): Mode {
  const raw = process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'daily'
  if (!VALID_MODES.has(raw as Mode)) {
    throw new Error(`Invalid --mode=${raw}. Expected daily, weekly, dry-run, or source-audit.`)
  }
  return raw as Mode
}

function mondayKey(now: Date): string {
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7))
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

function requiredEnvironment(mode: Mode): string[] {
  const common = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY',
  ]
  if (mode === 'source-audit') return []
  const modelKeyPresent = process.env.NEWS_AI_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY
  const missing = common.filter(name => !process.env[name])
  if (!modelKeyPresent) missing.push('NEWS_AI_API_KEY')
  if (mode === 'weekly' && !process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY')
  return missing
}

async function main() {
  loadRuntimeEnvironment()
  const [
    { supabaseAdmin },
    { autoGenerateTakeIfMissing },
    { sendWeeklyDigest },
    { auditNewsSources, runNewsPipeline },
  ] = await Promise.all([
    import('../lib/supabase'),
    import('../lib/editorial-autofill'),
    import('../lib/digest-builder'),
    import('../lib/news-pipeline'),
  ])
  const mode = readMode()
  const now = new Date()
  const force = process.argv.includes('--force')
  const missing = requiredEnvironment(mode)
  if (missing.length > 0) throw new Error(`Missing required environment variables: ${missing.join(', ')}`)

  if (mode === 'source-audit') {
    const sourceHealth = await auditNewsSources()
    const ok = sourceHealth.filter(source => source.ok).length
    console.log(JSON.stringify({ ok: ok === sourceHealth.length, mode, healthy: ok, total: sourceHealth.length, sourceHealth }, null, 2))
    if (ok < Math.ceil(sourceHealth.length * 0.7)) process.exitCode = 1
    return
  }

  const period = mode === 'weekly' ? mondayKey(now) : now.toISOString().slice(0, 10)
  const baseRunKey = `hermes:${mode}:${period}`
  const runKey = force ? `${baseRunKey}:manual:${now.getTime()}` : baseRunKey

  if (!force) {
    const { data: existing } = await supabaseAdmin
      .from('news_pipeline_runs')
      .select('id, status, completed_at')
      .eq('run_key', runKey)
      .maybeSingle()
    if (existing?.status === 'succeeded' || existing?.status === 'dry_run') {
      console.log(JSON.stringify({ ok: true, skipped: true, reason: 'run_already_completed', runKey, completedAt: existing.completed_at }))
      return
    }
  }

  const { data: run, error: runError } = await supabaseAdmin
    .from('news_pipeline_runs')
    .upsert({
      run_key: runKey,
      mode,
      status: 'running',
      triggered_by: 'hermes',
      model: process.env.NEWS_AI_MODELS || process.env.NEWS_AI_MODEL || 'deepseek-v4-flash,deepseek-v4-pro',
      started_at: now.toISOString(),
      completed_at: null,
      stats: {},
      source_health: [],
      error_message: null,
    }, { onConflict: 'run_key' })
    .select('id')
    .single()
  if (runError || !run) throw new Error(`Could not create pipeline run: ${runError?.message || 'unknown error'}`)

  try {
    const pipeline = await runNewsPipeline({ dryRun: mode === 'dry-run', runId: run.id })
    const healthySources = pipeline.sourceHealth.filter(source => source.ok).length
    const sourceRatio = pipeline.sourceHealth.length > 0 ? healthySources / pipeline.sourceHealth.length : 0
    if (sourceRatio < 0.7) throw new Error(`Source health below threshold: ${healthySources}/${pipeline.sourceHealth.length}`)
    if (pipeline.processed > 0 && pipeline.errors / pipeline.processed > 0.25) {
      throw new Error(`Model/extraction error rate above threshold: ${pipeline.errors}/${pipeline.processed}`)
    }

    let editorial: Awaited<ReturnType<typeof autoGenerateTakeIfMissing>> | null = null
    let digest: Awaited<ReturnType<typeof sendWeeklyDigest>> | null = null
    if (mode === 'weekly') {
      editorial = await autoGenerateTakeIfMissing(now)
      digest = await sendWeeklyDigest({ triggeredBy: 'cron' })
      if (digest.skippedReason === 'safety_floor') {
        throw new Error(`Weekly digest blocked by safety floor: ${JSON.stringify({ editorial, digest })}`)
      }
    }

    const status = mode === 'dry-run' ? 'dry_run' : 'succeeded'
    const stats = { pipeline, editorial, digest }
    await supabaseAdmin
      .from('news_pipeline_runs')
      .update({ status, completed_at: new Date().toISOString(), stats, source_health: pipeline.sourceHealth })
      .eq('id', run.id)

    console.log(JSON.stringify({ ok: true, runId: run.id, runKey, mode, status, stats }, null, 2))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await supabaseAdmin
      .from('news_pipeline_runs')
      .update({ status: 'failed', completed_at: new Date().toISOString(), error_message: message.slice(0, 2000) })
      .eq('id', run.id)
    throw error
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exitCode = 1
})
