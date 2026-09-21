---
name: news_search
description: Search RaiseSEA news by company, market, sector, or topic.
---

# Search Published News

Use the text after `/news_search` as the query. If it is empty, ask for keywords. Otherwise run:

`npm run news:control -- --command=search --query="<keywords>" --limit=10`

Shell-quote the query safely. Return matching headlines, dates, markets and source links. Include item IDs for later edit/delist commands.
