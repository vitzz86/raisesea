# RaiseSEA

Fundraising intelligence and execution workspace for Southeast Asian founders.

## Quick start

```bash
cp .env.local.example .env.local
# Fill in the required values without committing the file.
npm ci
npm run dev
```

## Setup order

1. Create a Supabase project and configure Google authentication.
2. Apply every file in `supabase/migrations/` in version order.
3. Create the private `pitch-decks` Storage bucket.
4. Copy `.env.local.example` to `.env.local` and provide the required keys.
5. Run `npm ci && npm run check && npm run build` before starting development.

Never expose `SUPABASE_SERVICE_KEY`, OAuth tokens, or provider API keys to
browser code. Only variables prefixed with `NEXT_PUBLIC_` may be public.

## Stack

- Next.js 16 App Router, React 19, TypeScript and Tailwind CSS
- Supabase Postgres, Auth and private Storage
- Gemini for deck analysis, business-card extraction and mock pitch
- DeepSeek for the news pipeline
- Google Calendar OAuth for opted-in meeting scheduling
- Vercel for previews, production and scheduled news ingestion

## Key files

| File | Purpose |
|------|---------|
| `lib/gemini.ts` | All AI functions — deck extraction, analysis, competitive, market |
| `lib/intelligence-db.ts` | Pre-built SEA benchmarks database (validated by Gemini in real-time) |
| `lib/matching.ts` | Investor matching algorithm |
| `app/api/submit/route.ts` | Main submission handler |
| `app/match/[id]/page.tsx` | 6-tab results dashboard |
| `components/results/` | Tab components — Overview, Deck, Market, Competitors, Investors, Meet |
| `lib/supabase-server.ts` | Authenticated server-side Supabase access |
| `lib/rate-limit.ts` | Database-backed protection for expensive routes |
| `supabase/migrations/` | Ordered database migrations |
| `.github/workflows/ci.yml` | Required code, build and dependency checks |

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run check
npm run build
npm audit --audit-level=high
```

## Product priorities

1. Make the journey from deck upload to a real fundraising action reliable.
2. Measure analysis completion, second actions and 30-day retained use.
3. Pilot meetings with a small, explicitly opted-in expert network.
4. Add verified funding opportunities only after the core journey is measured.
5. Test monetization after repeated founder or institutional value is proven.

The current north-star outcome is an active fundraising journey: a founder
completes a deck analysis and at least one meaningful preparation or execution
action within 30 days.

## Migration and deployment order

- A migration that is backward-compatible may be applied before its code deploy.
- A migration that removes an old access path must be coordinated with its code
  deployment in the same maintenance window.
- Pull requests must document the exact migration order and pass CI plus Vercel
  preview checks before merge.
