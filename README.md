# RaiseSEA v2

SEA founder-investor matchmaking + AI intelligence platform.

## Quick start

```bash
cp .env.local.example .env.local
# Fill in your keys (see .env.local.example)
npm install
npm run dev
```

## Setup order

1. **Supabase**: Run `supabase/migrations/v2_schema.sql` in your Supabase SQL editor
2. **Gemini API key**: Used for deck analysis → add to `.env.local`
3. **DeepSeek API key**: Used for the news pipeline → add to `.env.local`
4. **Google Drive**: Add OAuth credentials to `.env.local`
5. **Run**: `npm install && npm run dev`

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth)
- Gemini 2.5 Flash (deck AI)
- DeepSeek v4 Flash/Pro (news AI)
- Google Drive (deck storage)
- Render.com (deployment)

## Key files

| File | Purpose |
|------|---------|
| `lib/gemini.ts` | All AI functions — deck extraction, analysis, competitive, market |
| `lib/intelligence-db.ts` | Pre-built SEA benchmarks database (validated by Gemini in real-time) |
| `lib/matching.ts` | Investor matching algorithm |
| `app/api/submit/route.ts` | Main submission handler |
| `app/match/[id]/page.tsx` | 6-tab results dashboard |
| `components/results/` | Tab components — Overview, Deck, Market, Competitors, Investors, Meet |
| `supabase/migrations/v2_schema.sql` | Database schema |

## Phase roadmap

- ✅ Phase 1: Gemini migration + schema
- ✅ Phase 2: Deck intelligence (8 dimensions, adaptive spider chart)
- ✅ Phase 3: Market analysis + football field valuation + competitive analysis
- 🔲 Phase 4: Meeting scheduler (/meet page, investor/expert profiles)
- 🔲 Phase 5: Monetization (Stripe — Starter $9, Pro $29, Featured $49/mo)
