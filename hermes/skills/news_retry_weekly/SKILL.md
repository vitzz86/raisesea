---
name: news_retry_weekly
description: Regenerate the current RaiseSEA weekly brief and top stories without sending another email digest.
---

# Retry Current Weekly Brief

This replaces the current public Editor's Take and category top stories. It does not ingest news and never sends an email digest.

Before running, tell the operator that the current public weekly brief will be regenerated from the latest seven days of approved stories and ask for explicit confirmation. After confirmation run:

`npm run news:control -- --command=retry-weekly --confirm`

Report whether the weekly artifact was created or updated, whether a manual version was preserved, and any verification issues. Never expose secrets or raw tool reasoning.
