---
owner: raisesea-news-intelligence
status: active
last_verified: 2026-09-21
sources:
  - docs/hermes-news-migration.md
  - hermes/skills/raisesea-news-intelligence/SKILL.md
  - supabase/migrations/v23_hermes_news_intelligence.sql
  - supabase/migrations/v24_retire_news_approval_queue.sql
agents:
  - raisesea-news-intelligence
  - raisesea-chief-of-staff
---

# News Intelligence system

Hermes owns scheduling, source ingestion, AI extraction, deterministic quality decisions, weekly editorial generation, digest delivery and operational run records. Supabase is the source of truth. The RaiseSEA application renders the public Weekly News page and emails.

## Automation contract

- Qualified, complete, supported and relevant records publish automatically.
- Weak, incomplete, irrelevant and duplicate records are skipped. No routine approval queue exists.
- Operators handle exceptions with reversible edit, delist and restore controls.
- Daily schedule: Tuesday–Sunday at 08:00 Asia/Jakarta.
- Weekly schedule: Monday at 08:00 Asia/Jakarta.
- The weekly runner is idempotent and owns digest delivery.

## Coverage target

- Southeast Asia: 40%
- China, Japan and South Korea: 40% combined
- Major global signals relevant to Southeast Asian founders: 20%

Within the East Asia allocation, target China 45%, Japan 30% and South Korea 25%. Gaps should be reported, not filled with low-quality stories.

## Telegram controls

`/news_run_daily`, `/news_status`, `/news_latest`, `/news_weekly`, `/news_retry_weekly`, `/news_search`, `/news_coverage`, `/news_sources`, `/news_edit`, `/news_delist`.

Read operations run immediately. Editing and delisting require an exact item UUID and confirmation. Delisting is reversible; permanent deletion is not available from Telegram.

## Health checks

Confirm both Hermes schedules are enabled, the latest run completed, source-health ratio is visible, regional balance is within tolerance, and the public Weekly News page reflects the current editorial artifact. Never expose environment values in reports.
