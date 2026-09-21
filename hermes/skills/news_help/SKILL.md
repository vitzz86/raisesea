---
name: news_help
description: Show RaiseSEA news commands available in Telegram.
---

# RaiseSEA News Commands

Reply with this concise command list:

- `/news_run_daily` — run ingestion now and refresh Weekly news
- `/news_status` — latest automation run and health
- `/news_latest` — latest published stories
- `/news_weekly` — current editor's take and top stories
- `/news_retry_weekly` — regenerate the current weekly brief without sending email
- `/news_search <keywords>` — find published stories
- `/news_coverage` — 7-day region, country and category mix
- `/news_sources` — live RSS source health audit
- `/news_edit <item id> <change>` — edit a published story (confirmation required)
- `/news_delist <item id>` — remove a story from the site (confirmation required and reversible)

Keep the response under 12 lines. Never reveal environment variables.
