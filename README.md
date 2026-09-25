# MarketMind AI

A simulated focus group for marketers. Describe a target market and a
product idea, and MarketMind AI uses Gemini to recruit ten realistic virtual
consumer personas, has each of them answer your question, streams an
executive report on the results, and then lets you interview any persona
one-on-one.

Built by Haruto Iriyama with React, TypeScript, Vite, Tailwind CSS, Express
and Supabase.

## How it works

1. **Configure the focus group.** Age range, gender, habits, location and
   income level. Any field left blank is treated as *diverse / random* and the
   model is instructed to maximise variety across the ten personas on that
   dimension. Then describe your product and the question you want answered.
2. **Generate personas.** One structured-output call (`gemini-3.1-flash-lite`)
   returns ten personas as JSON — name, demographics, background, a verbatim
   answer to your question, free-form feedback, keywords, and a sentiment
   score assigned against a fixed rubric so that scores are comparable
   between runs.
3. **Read the report.** A second call (`gemini-2.5-flash`) streams a
   strategic summary — overall enthusiasm, recurring themes, objections and
   recommendations — token by token into the Insights tab while the persona
   cards fill in.
4. **Explore the charts.** Score distribution across the scoring rubric,
   every persona's score, and the most common themes.
5. **Interview a persona.** The Chat tab keeps a per-persona conversation
   history and answers in character, grounded in that persona's profile and
   original feedback.

**A/B testing.** Add up to two more variants (a different price, feature set
or headline) and the same ten personas score every variant independently.
Results show each variant's average, median, likely adopters and rejecters,
call the leading variant (or "too close to call"), and chart which personas
changed their minds.

**Accounts and saved simulations.** Users sign in with email and password
(Supabase Auth). Every completed run — inputs, personas, report and
interview transcripts — is saved to the user's account and can be reopened
from the Saved Simulations tab.

**Re-usable panels.** Save the ten people from any result as a named panel,
then ask that same panel new questions later. Only their answers are
regenerated — who they are stays fixed — so results can be compared across
questions without the noise of a new random cohort each time.

**Export and share.** Download a run as Markdown (full write-up, including
interview transcripts), CSV (one row per persona, a column set per variant)
or PDF (via the browser's print dialog). A public read-only share link can
be switched on and off per run; shared pages never include interview
transcripts.

## Architecture

The browser never talks to Gemini or the database directly. A small Express
server (`server/`) holds the secrets, verifies the user's Supabase access
token on every request, and exposes the API:

| Endpoint | Purpose |
|---|---|
| `POST /api/simulate` | Generate personas (new, or a saved panel) and stream the report as NDJSON; the finished run is saved |
| `GET/DELETE /api/runs[/:id]` | List, open and delete the user's saved runs |
| `POST/DELETE /api/runs/:id/share` | Turn the public share link on/off |
| `GET /api/share/:shareId` | Public read-only view of a shared run (no sign-in) |
| `POST /api/chat` | One interview turn; the persona and transcript are loaded from the saved run, not trusted from the browser |
| `GET/POST/DELETE /api/panels` | Saved persona panels |

**Security model.**

- The Gemini key and the Supabase service-role key exist only on the server.
- The browser only loads the Supabase **auth** module, with the public anon
  key. Every table has row-level security enabled and table privileges
  revoked from the `anon` and `authenticated` roles, so the anon key cannot
  read or write any data; all queries run on the server and are scoped to
  the signed-in user.
- Usage limits are enforced per user and service-wide from a
  `usage_events` table, so they survive restarts and work across multiple
  server instances. An additional per-IP limit guards the whole API.
- Requests are validated and size-limited; CSV exports neutralise
  spreadsheet formula injection.

The schema lives in [`supabase/migrations`](supabase/migrations).

## Project layout

```
server/
├── index.ts                   Express API: auth, validation, usage limits,
│                              routes; serves the app (Vite in dev, dist/ in prod)
├── db.ts                      Supabase queries (service role, user-scoped)
└── gemini.ts                  prompts, structured output schemas, panel
                               re-use, streaming report, in-character chat
supabase/
├── config.toml                local Supabase stack settings
└── migrations/                database schema
src/
├── App.tsx                    auth gate + workspace (tabs, run state)
├── main.tsx                   routes /share/:id to the public share page
├── components/
│   ├── AuthScreen.tsx         sign in / create account
│   ├── CustomerForm.tsx       setup form: new personas or saved panel, A/B variants
│   ├── InsightsViewer.tsx     persona cards, charts tab, streaming report
│   ├── RunActions.tsx         save panel, export (MD/CSV/PDF), share link
│   ├── PrintReport.tsx        print-only document used for PDF export
│   ├── SentimentCharts.tsx    recharts visualisations (lazy-loaded)
│   ├── VariantSummary.tsx     A/B comparison tiles
│   ├── PersonaChat.tsx        1-on-1 interviews
│   ├── HistoryPanel.tsx       saved simulations and panels
│   └── SharePage.tsx          public read-only view
└── lib/
    ├── api.ts                 browser client for the API server
    ├── supabase.ts            browser auth client
    ├── exporters.ts           Markdown / CSV export
    ├── personas.ts            shared persona helpers
    ├── types.ts               types shared by browser and server
    ├── variants.ts            per-variant scores and statistics (shared)
    └── utils.ts
```

## Running locally

Requires Node.js 18+, [Docker Desktop](https://www.docker.com/products/docker-desktop/)
(for the local Supabase stack) and a Gemini API key from
[Google AI Studio](https://aistudio.google.com/app/apikey).

```bash
npm install
npx supabase start     # starts Postgres + Auth locally and applies migrations
npx supabase status    # prints the local URL, anon key and service_role key
```

Copy `.env.example` to `.env` and fill in `GEMINI_API_KEY`,
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`. Then:

```bash
npm run dev
```

and open <http://localhost:3000>. Locally, new accounts are confirmed
automatically; emails the app sends appear in Mailpit at
<http://127.0.0.1:54324>. `npm run lint` type-checks.

## Production

1. Create a project at [supabase.com](https://supabase.com) and apply the
   schema — either `npx supabase link` then `npx supabase db push`, or paste
   the migration SQL into the dashboard's SQL editor.
2. In **Authentication → URL Configuration**, set the Site URL to your
   deployed domain (used in confirmation emails).
3. Build and run:

```bash
npm run build   # client bundle in dist/, server bundle in build/server.js
npm start       # serves the app and API on $PORT (default 3000)
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set when building
(they are compiled into the client). `GEMINI_API_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` must be set in the server's runtime environment —
never commit them. Set `TRUST_PROXY=1` behind a reverse proxy (Cloud Run,
Render, Railway, Nginx…) so per-IP limits see real client IPs.

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for a step-by-step walkthrough aimed at
non-developers.
