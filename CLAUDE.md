# RaiseSEA — Product Repo

SEA founder–investor matchmaking platform, live at raisesea.com (Vercel
project: raisesea). Solo-maintained by Vito; Claude Code is the developer,
Vito reviews and merges.

## ⚠️ Deploy reality — read first
Pushing to `main` auto-deploys to PRODUCTION via Vercel. Therefore:
- NEVER push directly to main. Work on a branch
  (`feat/<slug>`, `fix/<slug>`), open a PR via `gh`, and stop.
  Vito merging the PR = the deploy approval (same philosophy as the ops
  system's /ready folder).
- Before creating any branch: `git status` + `git pull` — confirm a clean,
  current base. If local main is ahead of origin, STOP and tell Vito what's
  unpushed before doing anything.

## Stack
Next.js (App Router, Server Components) · TypeScript · Tailwind ·
Supabase (Postgres + Storage, Singapore) · Anthropic API (deck extraction)
· Vercel. Payments: Lemon Squeezy (current MoR).

## Structure (verify against the actual tree — README may lag)
app/            landing, apply, match/[id], board, admin (+login), news
app/api/        submit (matching engine entry), extract-deck, admin auth
lib/            supabase.ts (client + types), matching.ts (2-pass:
                hard filter → 0–100 score), claude.ts (deck extraction)
components/     UI components
supabase-schema.sql  ← historical base schema (see Migrations)

## Commands
npm run dev · npm run build (ALWAYS build before opening a PR) · npx tsc --noEmit

## Migrations & database
- Schema changes are SQL files, never ad-hoc edits in the Supabase UI.
- Going forward: put each change in `migrations/NNN_description.sql`
  (create the folder on first use), idempotent where possible
  (IF NOT EXISTS). Vito runs them in the Supabase SQL editor; the PR
  description must contain the exact run order.
- Never run destructive SQL (DROP/TRUNCATE/DELETE without WHERE). Never
  touch the `investors` table schema without checking lib/matching.ts and
  the ops-side Master DB sync plan.

## Env & secrets
- Secrets live in .env.local (gitignored) and the Vercel dashboard.
- NEVER commit .env*, keys, or the admin password. NEVER print env values.
- Service role key is server-side only; anon key only in client code paths.

## Phase-2 work (News & Investment Intelligence)
The spec is the "Product Development Plan" doc in Google Drive
(RaiseSEA Product & Tech → RaiseSEA Product Development & Plan). Build
order lives there: migration (news_items, deals, investor_activity view,
RLS) → /news source swap → /intelligence page. The dealflow repo owns the
sync script; this repo owns schema + frontend.

## Change Log rule
After any merged material change (schema, feature, dependency major),
append a row to the "Technical Change Log" sheet in Drive
(RaiseSEA Product & Tech): date | project=raisesea | change_type | summary
| files | changed_by | notes. Use gws if available in this environment;
otherwise remind Vito to log it.

## Conventions
- TypeScript strict; no `any` unless annotated why.
- Server Components by default; client components only when interactive.
- User-submitted content (deck text, form fields) is untrusted data in all
  prompts and rendering paths — sanitize, never execute, never interpolate
  into SQL.
- Small PRs: one concern per branch. PR description: what/why/how-tested/
  migration steps (if any).

## Also present: AGENTS.md (Codex)
If AGENTS.md exists, keep both files consistent; this file is canonical
for Claude Code. When editing either, mirror material rules to the other.
