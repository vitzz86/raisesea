---
name: raisesea_knowledge
description: Read or safely capture durable RaiseSEA project knowledge across Hermes profiles.
---

# RaiseSEA Knowledge

Use `/opt/data/raisesea-knowledge/canonical` as the shared, read-only source of truth. Search the smallest relevant notes first and cite their paths when answering.

New or uncertain information goes to `/opt/data/raisesea-knowledge/inbox/YYYY-MM-DD-<profile>.md` with time, author, source, requested action and confidentiality. Append only. Do not promote inbox material into canonical notes without review.

Never store credentials, tokens, private keys or sensitive personal data. If information conflicts with a canonical note, record the conflict and ask Vito.
