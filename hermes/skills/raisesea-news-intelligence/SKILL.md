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
2. Use publish-or-skip: qualified records publish automatically; incomplete, weak, irrelevant or duplicate records are skipped. Never create a manual approval queue.
3. Never print, copy, or summarize environment-variable values.
4. Never use `--force` for a scheduled daily or weekly run. It is only for an explicit operator test.
5. Treat a non-zero exit as a failed run. Report the final JSON error and the run key; do not silently retry more than once.
6. Do not send a digest manually outside the weekly runner. The runner has recipient idempotency and a content safety floor.
7. Telegram control is provided by the `news_*` skills. Read-only commands run immediately; edit, delist and digest-send mutations require the operator to confirm the exact action.

## Expected output

Return a short status containing: run key, mode, fetched/processed/new counts, published/skipped/errors, scope counts, source-health ratio, editorial result, and digest result when applicable.
