---
name: news_status
description: Show the latest RaiseSEA news automation run and health.
---

# News Status

From the deployed RaiseSEA directory run:

`npm run news:control -- --command=status`

Summarize the most recent run in at most eight lines: state, mode, start/completion time, counts, source health, editorial refresh, digest result, and error if present. Never expose secrets or raw tool reasoning.
