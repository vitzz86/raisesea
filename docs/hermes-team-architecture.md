# RaiseSEA Hermes team: phases 1–5

## Outcome

Four Hermes profiles share a durable Markdown knowledge base while keeping prompts, tools, models and Telegram credentials isolated. Obsidian can open the knowledge directory, but no paid Obsidian Sync service is required.

## Phase 1 — Knowledge OS

The repository's `knowledge/` directory is canonical and Git-reviewed. `hermes/install-team.sh` copies it to `/opt/data/raisesea-knowledge/canonical`. Agents append unreviewed material to `/opt/data/raisesea-knowledge/inbox`; reviewed changes return to Git before becoming canonical.

This structure preserves knowledge across model changes. It intentionally excludes credentials and transient chat history.

## Phase 2 — News Intelligence validation

The existing `raisesea-news-intelligence` profile remains the production owner. Validate it with:

1. `npm run test:news-hermes`
2. `npm run typecheck:news-hermes`
3. `/news_status` and `/news_sources`
4. confirm both 08:00 Asia/Jakarta schedules are enabled
5. confirm a forced operator run reaches RaiseSEA Weekly News

Do not replace its publish-or-skip rules or reintroduce approval rows.

## Phase 3 — Software Engineer

Create profile `raisesea-software-engineer`, then install its prompt and skills. Its model path is protected: ChatGPT/Codex → DeepSeek → an approved OpenRouter coding model. A model fallback never grants permission to merge, deploy or run destructive migrations.

## Phase 4 — Social Media Manager and Chief of Staff

Create `raisesea-social-media-manager` and `raisesea-chief-of-staff`. The Chief of Staff owns intake and Kanban; specialists own execution. Native Hermes delegation and Kanban are sufficient on one installation. Add Honcho or A2A only after a measured cross-machine need.

Each Telegram-enabled profile needs its own BotFather token. Do not reuse the News Intelligence token. Vito administers the backend; Vito and Dipti can share the Telegram group.

## Phase 5 — Model and cost strategy

Apply `knowledge/50-models/routing-policy.md`. Cheap or free models are limited to idea capture, classification, reminders and formatting. Nemotron is explicitly prohibited for coding. Model IDs and pricing are operational data: verify them before activation and benchmark them on RaiseSEA tasks.

## Installation

```bash
cd /path/to/raisesea
bash hermes/install-team.sh
npm run test:hermes-team
```

Create missing profiles first. The installer will not overwrite an existing `SOUL.md` unless `FORCE_PROFILE_PROMPTS=1` is set. After skills or command-menu changes, start a new profile session; restart the gateway only when Hermes indicates the channel configuration requires it.

## Approval matrix

| Action | Default |
|---|---|
| Read knowledge, draft content, save idea, create task | autonomous |
| Publish qualified news through the existing pipeline | autonomous |
| Edit/delist news | exact target + confirmation |
| Publish social content | human approval |
| Open a code pull request | autonomous after tests |
| Merge/deploy/apply destructive migration | Vito approval |
| Change credentials or Telegram tokens | Vito only |
