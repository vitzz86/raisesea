---
name: news_run_daily
description: Run RaiseSEA news ingestion and refresh Weekly news.
---

# Run Daily News

From the deployed RaiseSEA directory run:

`npm run news:hermes -- --mode=daily --force`

This slash command is an explicit operator-triggered run, so `--force` is allowed. Do not ask for routine approval. Return only the run status, fetched/processed/new/published/skipped/error counts, source health, regional mix, and editorial refresh result. Never print secrets.
