---
name: news_delist
description: Delist or restore a RaiseSEA news story by exact item ID.
---

# Delist Published News

This is a reversible mutation. Require an exact UUID; if only a title is provided, search first and show candidates. Restate the exact story and ask for explicit confirmation.

After confirmation, delist with:

`npm run news:control -- --command=delist --id=<uuid> --confirm`

If the operator explicitly asks to restore a delisted story, confirm and run:

`npm run news:control -- --command=restore --id=<uuid> --confirm`

Report the final status. Never permanently delete news from Telegram.
