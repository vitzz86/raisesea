---
name: news_edit
description: Safely edit a published RaiseSEA story by exact item ID.
---

# Edit Published News

This is a mutation. Require an exact news item UUID and at least one field change. If the user gives a title instead, run `/news_search` logic first and show candidates. Never choose an ambiguous match.

Before changing anything, restate the exact item and proposed fields and ask for confirmation. Only after explicit confirmation run:

`npm run news:control -- --command=edit --id=<uuid> [--title="..."] [--category=fundraising|tech|policy|exit] [--company="..."] [--amount=123] [--stage="..."] [--sector="..."] [--country="..."] [--lead-investor="..."] [--summary="..."] [--why="..."] --confirm`

Shell-quote all text safely. Report the changed fields and final story. Never expose secrets.
