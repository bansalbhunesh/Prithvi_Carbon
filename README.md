# Prithvi — your carbon footprint, the Indian way

**Live:** [prithvi-carbon.vercel.app](https://prithvi-carbon.vercel.app)

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
- **Track** -> fast logging (manual + Gemini bill/receipt scan), a 7-day trend, streak gamification, annual projection.
- **Reduce** -> an impact x feasibility engine that surfaces *your* biggest lever first.

## Why this wins

| What judges look for | How Prithvi delivers |
|---|---|
| **Personalization** | State-specific grid factor, household size, diet type — every number is calibrated to *where you actually live* |
| **AI integration** | Gemini reads electricity bills and fuel receipts — but never invents emission figures (deterministic math only) |
| **Engagement** | Streak gamification, annual projection with tree equivalence, social sharing, toast feedback on every action |
| **India-specific** | CEA v21.0 grid factors, auto-rickshaw/two-wheeler modes, LPG cylinders, veg/non-veg diet baseline |
| **Production quality** | Dark mode, PWA installable, mobile-first responsive, 40 unit tests, security-hardened API |
| **Transparency** | Every factor linked to its source on `/methodology` — no black boxes |

## 60-second judge demo

1. **Land** → India-calibrated onboarding, grid factor preview with green/clay tag
2. **"Explore a sample week"** → instant dashboard, toast confirms
3. **Stats row** → vs yesterday, 7-day avg, streak days, yearly estimate
4. **Annual card** → tonnes/year + tree count + comparison bar (You vs India vs World)
5. **Trend** → 7-day bars with India average dashed line
6. **Gauge** → gradient track from net-zero to world average
7. **Breakdown** → category bars with emoji icons
8. **Biggest levers** → personalized recommendations ranked by YOUR impact × feasibility
9. **Scan a bill** → upload photo, Gemini reads it, toast shows kg CO₂
10. **Share** → Web Share API or clipboard — challenge friends
11. **Dark mode** → toggle system preference for full dark theme
12. **Mobile** → open on phone, installable PWA

## The headline idea: AI reads, audited math calculates

> **Gemini extracts the numbers from your document. It never invents an emission figure.**
> Every kg of CO₂ is computed by `lib/factors.ts` from published, India-specific
> factors. That separation is the credibility line — no hallucinated carbon.

## Architecture

```
app/
  page.tsx            UI: onboarding · dashboard · logger (client)
  methodology/        the auditable factor table (server-rendered)
  api/scan/route.ts   thin controller: rate-limit -> validate -> service -> respond
lib/
  factors.ts          deterministic emission engine + sources (pure)
  store.ts            types, persistence, aggregation, demo seed (pure)
  recommend.ts        impact x feasibility recommendation engine (pure)
  gemini.ts           the ONLY module that calls the Gemini API (isolated)
  scan-schema.ts      Zod contracts + size/mime limits for the endpoint
  rate-limit.ts       fixed-window limiter for the paid AI route
tests/                40 unit tests (engine · validation · rate-limit · recos)
```

Separation of concerns is deliberate: the UI never touches the network for AI;
the route holds no business logic; the Gemini call is isolated behind one
swappable, mockable interface; all emission math is pure and unit-tested.

## Security

- **API key is server-only.** Gemini is called exclusively from `app/api/scan`
  (Node runtime) with the key in an environment variable — it never reaches the
  browser bundle.
- **Input validation.** Every request is Zod-validated: base64 charset, a ~4.5 MB
  size cap, and a mime allowlist (jpeg/png/webp).
- **Rate limiting.** A fixed-window limiter (12 scans/min/IP) protects the paid
  endpoint from abuse; swap in Upstash Redis for multi-instance prod.
- **Untrusted model output.** Gemini's JSON is re-validated against a strict Zod
  schema before use; out-of-range or malformed values are rejected.
- **Prompt-injection aware.** The prompt instructs the model to treat any text in
  the image as data, not instructions, and to return a constrained JSON shape.
- **No secrets in source.** `.env.local` is gitignored; `.env.example` documents setup.

## Tests

```bash
npm test          # 40 unit tests, ~1s
```

Coverage spans the deterministic engine (grid/transport/diet/fuel math and
invariants), store aggregation (household splitting, fuel handling, demo seed),
input validation and Gemini output parsing (security boundaries), the rate
limiter, and the recommendation ranking. A diet-recommendation direction bug was
caught by these tests during development.

## Run locally

Requirements: **Node 18.18+ or 20+** and npm.

```bash
npm install
cp .env.example .env.local   # add your free AI Studio key (optional)
npm run dev                  # http://localhost:3000
```

The app works without a key — scanning falls back to manual entry, everything
else runs fully. Run the tests with `npm test` (40 unit tests).

## Deploy (Vercel, zero config)

```bash
git push origin main
# Connect repo in Vercel dashboard → auto-deploys
# Add env var: GEMINI_API_KEY = your Google AI Studio key
# Optional: GEMINI_MODEL (defaults to gemini-2.0-flash)
```

No build config needed — Vercel auto-detects Next.js. The app works without a
Gemini key (scanning is disabled, everything else runs fully).

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

## Feature highlights

- **Toast notifications** — animated slide-up feedback on every action
- **Annual projection** — extrapolates daily footprint to tonnes/year with tree-offset equivalence
- **Streak gamification** — consecutive days under India's average, visible in stats row
- **Social sharing** — Web Share API with clipboard fallback
- **Dark mode** — full `prefers-color-scheme: dark` support
- **PWA installable** — manifest.json with SVG icons, standalone display
- **Mobile-first** — 44px touch targets, 16px inputs (no iOS zoom), responsive grid
- **Accessible** — skip-to-content link, semantic HTML, reduced-motion support
