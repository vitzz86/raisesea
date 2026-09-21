# Hermes news-intelligence migration

## Ownership boundary

Hermes owns the schedule, source ingestion, model calls, quality decisions, weekly editorial artifact, digest trigger and operational run record. Supabase remains the source of truth; the RaiseSEA application remains the public UI and email renderer.

No routine approval is required. Complete, relevant and well-supported records become `approved` during ingestion. Incomplete, weak, irrelevant and duplicate records are skipped; new runs never create `pending` items. Operators use edit/delist controls for exceptions after publication.

## Coverage policy

- Southeast Asia: 40%
- China, Japan and South Korea: 40%
  - China: 45% of the APAC allocation
  - Japan: 30% of the APAC allocation
  - South Korea: 25% of the APAC allocation
- Major global signals relevant to SEA founders: 20%

The source registry combines direct specialist feeds with Google News discovery feeds. A failing feed is isolated and recorded in `news_pipeline_runs.source_health`.

## Schedule

Use two Hermes cron jobs so Monday cannot send twice:

- Tuesday-Sunday, 01:00 UTC: `daily`
- Monday, 01:00 UTC: `weekly`

The runner uses a unique period key and the digest has per-recipient idempotency, so a retry does not duplicate a completed run or email.

The production jobs are named `RaiseSEA Daily News Intelligence` and `RaiseSEA Weekly Intelligence & Digest`. Both load the `raisesea-news-intelligence` skill and the terminal toolset, run without routine approval, and resolve to 08:00 Asia/Jakarta in the Hermes dashboard. The Vercel cron is disabled in `vercel.json`; the authenticated API route remains available as a manual rollback path.

## Deployment sequence

1. Apply `v23_hermes_news_intelligence.sql` and `v24_retire_news_approval_queue.sql`.
2. Install the repository on Hermes and configure the variables in `hermes/news-intelligence.env.example` through Hermes Keys.
3. Run `source-audit`, then `dry-run`.
4. Run one forced daily shadow test and inspect `news_pipeline_runs` plus inserted records.
5. Enable the two Hermes schedules.
6. Disable the Vercel news cron only after Hermes reports a successful real run.

## Telegram operations

Run `hermes/install-news-skills.sh` on the Hermes host, merge `hermes/telegram-command-menu.yaml.example` into the Hermes config, and restart the gateway once. The RaiseSEA bot then exposes `/news_run_daily`, `/news_status`, `/news_latest`, `/news_weekly`, `/news_retry_weekly`, `/news_search`, `/news_coverage`, `/news_sources`, `/news_edit`, and `/news_delist`.

Read-only commands run immediately. Editing, delisting and restoring require the exact item UUID plus explicit operator confirmation. Delisting is a reversible status change, not permanent deletion.

## Rollback

Pause the Hermes schedules and restore the Vercel cron entry. The schema additions are backward-compatible; no rollback migration or data deletion is required.
