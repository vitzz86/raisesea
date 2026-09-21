# RaiseSEA Knowledge OS

This directory is the version-controlled source of truth shared by RaiseSEA's Hermes profiles. It is plain Markdown so it can be opened as an Obsidian vault without requiring Obsidian Sync.

## Rules

- Store durable facts, decisions, runbooks and handoffs here.
- Store credentials only in Hermes Keys or the deployment environment. Never put secrets in this directory.
- Cite the source and `last_verified` date for facts that can change.
- Put unreviewed notes in `90-inbox/`; a human or the Chief of Staff promotes them into the canonical folders.
- Link to code and operational records instead of copying volatile data.

## Map

- `00-home/` — index and current priorities
- `10-company/` — company and product context
- `20-systems/` — system architecture and operational runbooks
- `30-agents/` — profile charters and collaboration rules
- `40-decisions/` — architecture decision records
- `50-models/` — model routing and cost policy
- `90-inbox/` — append-only intake from Telegram and agents
- `99-archive/` — superseded knowledge retained for traceability

## Metadata

Canonical notes start with YAML containing `owner`, `status`, `last_verified`, `sources`, and `agents`. Use `status: draft` until reviewed.
