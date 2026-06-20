# Prithvi — your carbon footprint, the Indian way

A personal carbon tracker built for India, not ported from the West. Snap your
electricity bill or fuel receipt and **Gemini reads it**; a **deterministic,
fully-sourced engine does the CO₂ math**. Track your week, see where you stand
against the average Indian, and get reduction actions ranked by impact for *your*
footprint.

> Built for **Google PromptWars · Challenge 3 — Carbon Footprint**
> *"Design a solution that helps individuals understand, track, and reduce their
> carbon footprint through simple actions and personalized insights."*

Prithvi maps 1:1 to the three verbs in that brief:
- **Understand** -> India-calibrated, auditable emission math with a transparent `/methodology` page.
- **Track** -> fast logging (manual + Gemini bill/receipt scan), a 7-day trend, streak stats.
- **Reduce** -> an impact x feasibility engine that surfaces *your* biggest lever first.

## The headline idea: AI reads, audited math calculates

> **Gemini extracts the numbers from your document. It never invents an emission figure.**
> Every kg of CO₂ is computed by `lib/factors.ts` from published, India-specific
> factors. That separation is the credibility line — no hallucinated carbon.

## Architecture

```
app/
  page.tsx            UI: onboarding · dashboard · logger (client)
  layout.tsx          root layout with meta, viewport, nav, skip-link
  error.tsx           client error boundary for graceful recovery
  methodology/        the auditable factor table (server-rendered)
  api/scan/route.ts   thin controller: rate-limit -> validate -> service -> respond
lib/
  factors.ts          deterministic emission engine + sources (pure)
  store.ts            types, persistence, aggregation, demo seed (pure)
  recommend.ts        impact x feasibility recommendation engine (pure)
  gemini.ts           the ONLY module that calls the Gemini API (isolated)
  scan-schema.ts      Zod contracts + size/mime limits for the endpoint
  rate-limit.ts       fixed-window limiter with automatic stale-entry purging
tests/                40 unit tests (engine · validation · rate-limit · recos)
```

Separation of concerns is deliberate: the UI never touches the network for AI;
the route holds no business logic; the Gemini call is isolated behind one
swappable, mockable interface; all emission math is pure and unit-tested.

## Security

- **API key is server-only.** Gemini is called exclusively from `app/api/scan`
  (Node runtime) with the key passed via `x-goog-api-key` header — it never
  reaches the browser bundle or appears in server logs.
- **Input validation.** Every request is Zod-validated: base64 charset, a ~4.5 MB
  size cap, a mime allowlist (jpeg/png/webp), and Content-Type enforcement.
- **Rate limiting.** A fixed-window limiter (12 scans/min/IP) with automatic
  stale-entry purging protects the paid endpoint; swap in Upstash Redis for
  multi-instance prod.
- **Untrusted model output.** Gemini's JSON is re-validated against a strict Zod
  schema before use; out-of-range or malformed values are rejected.
- **Prompt-injection aware.** The prompt instructs the model to treat any text in
  the image as data, not instructions, and to return a constrained JSON shape.
- **No secrets in source.** `.env.local` is gitignored; `.env.example` documents setup.
- **Security headers.** `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, and `X-DNS-Prefetch-Control` set on all responses.
  `X-Powered-By` is disabled.

## Tests

```bash
npm test          # 40 unit tests, ~1s
npm run typecheck # TypeScript type checking
```

Coverage spans the deterministic engine (grid/transport/diet/fuel math and
invariants), store aggregation (household splitting, fuel handling, demo seed),
input validation and Gemini output parsing (security boundaries), the rate
limiter, and the recommendation ranking.

## Run locally

**Requirements:** Node 18.18+ or 20+ and npm.

```bash
git clone https://github.com/bansalbhunesh/Prithvi_Carbon.git
cd Prithvi_Carbon
npm install
cp .env.example .env.local   # add your free AI Studio key (optional)
npm run dev                  # http://localhost:3000
```

The app works without an API key — scanning falls back to manual entry, everything
else runs fully. Run the tests with `npm test`.

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | No (but needed for scanning) | — | Google AI Studio API key for bill/receipt scanning |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model to use for document extraction |

**How to get your API key:**
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Create API key"
3. Copy the key — it looks like `AIzaSy...`
4. Paste it as the `GEMINI_API_KEY` value

## Deploy to Vercel

### Option 1: One-click (recommended)

1. Push this repo to GitHub (or fork it).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. In the **Environment Variables** section, add:
   - `GEMINI_API_KEY` = your Google AI Studio API key
4. Click **Deploy**. Done.

### Option 2: CLI

```bash
npm i -g vercel
vercel login
vercel --prod
# When prompted, add GEMINI_API_KEY in Vercel dashboard > Settings > Environment Variables
```

### What you need for deployment

| What | Where to get it | Required? |
|---|---|---|
| Vercel account | [vercel.com](https://vercel.com) (free) | Yes |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free) | Only for AI scanning |

The app runs on port 3000 locally. On Vercel, port assignment is automatic.
No `vercel.json` is needed — Next.js is auto-detected.

## Built with Google Antigravity

Developed using Google Antigravity (PromptWars requirement). The agentic workflow
scaffolded the Next.js app, built the deterministic emission engine from researched
India factors, added the Gemini scan pipeline, and hardened the API route
(validation, rate limiting, isolated service). Antigravity's AI Code Review was run
in Security, Architecture, and Test modes before submission.

## Factor sources

| Category | Factor | Source |
|---|---|---|
| Grid electricity | 0.71 kg CO₂/kWh + state multipliers | CEA Baseline Database v21.0 (Nov 2025) |
| LPG cylinder | 42 kg CO₂ | CarbonCrux India 2026 |
| Petrol / diesel | 2.31 / 2.68 kg CO₂/litre | IPCC / DEFRA combustion |
| Petrol car | 0.155 kg/km | ICCT / India avg |
| Two-wheeler | 0.05 kg/km | India-specific study |
| Auto-rickshaw | 0.107 kg/km | India CNG 3-wheeler EF |
| Metro / rail | 0.018 / 0.012 kg/pkm | electric, grid-adjusted |
| Domestic flight | 0.133 kg/pkm | DEFRA short-haul |
| Diet (veg->non-veg) | 4.6 -> 8.3 kg/day | ICAR-IARI (Pathak et al.) + CarbonCrux |

Factors are documented and directional; swap in newer CEA versions as published.
