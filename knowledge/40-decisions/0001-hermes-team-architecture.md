---
owner: Vito
status: accepted
last_verified: 2026-09-21
sources:
  - project working sessions
agents:
  - raisesea-chief-of-staff
  - raisesea-software-engineer
---

# ADR-0001: Hermes team architecture

## Decision

Run four isolated Hermes profiles on the existing SumoPod installation and give them one shared, Git-backed Markdown knowledge base. Vito and Dipti collaborate through Telegram. Vito alone administers the backend.

Use native Hermes delegation and Kanban for same-installation coordination. Each Telegram-connected profile uses its own bot token. Obsidian is an optional editor for the Markdown vault, not a synchronization service or runtime dependency.

## Why

Profile isolation prevents one role's prompts, credentials and tools from leaking into another. Shared Markdown avoids model lock-in and makes knowledge usable by DeepSeek, Qwen, OpenRouter models and future tools. Native coordination keeps the initial system small and observable.

## Deferred

- Honcho: unnecessary while all profiles run on one Hermes installation.
- A2A: revisit only for cross-machine or cross-framework agents.
- Automatic social publishing: add after draft quality and channel controls are proven.
- Google Drive ingestion: next integration after the core four-profile system is stable.
