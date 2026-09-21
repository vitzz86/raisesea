---
name: raisesea-news-intelligence
description: Run and monitor RaiseSEA's autonomous daily and weekly news intelligence pipeline.
---

# RaiseSEA News Intelligence

Use this skill for the scheduled RaiseSEA news workflow. The deterministic runner owns ingestion, AI extraction, regional balancing, automatic quality decisions, editorial generation, digest delivery and run logging.

## Commands

Run from the deployed RaiseSEA directory:

- Daily ingestion: `npm run news:hermes -- --mode=daily`
- Monday ingestion + editorial + digest: `npm run news:hermes -- --mode=weekly`
- No-content-write live validation: `npm run news:hermes -- --mode=dry-run --force`
- Source-only health audit: `npm run news:hermes -- --mode=source-audit`

## Operating rules

1. Run unattended. Do not request routine human approval.
2. Strong records are published automatically. Pending records are an optional exception queue and never block later records.
3. Never print, copy, or summarize environment-variable values.
4. Never use `--force` for a scheduled daily or weekly run. It is only for an explicit operator test.
5. Treat a non-zero exit as a failed run. Report the final JSON error and the run key; do not silently retry more than once.
6. Do not send a digest manually outside the weekly runner. The runner has recipient idempotency and a content safety floor.
7. Telegram is not part of this skill. A future Telegram assistant may read `news_pipeline_runs`, but it must not change this workflow's publication rules.

## Expected output

Return a short status containing: run key, mode, fetched/processed/new counts, approved/pending/skipped/errors, scope counts, source-health ratio, editorial result, and digest result when applicable.
