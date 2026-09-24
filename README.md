# MarketMind AI

A simulated focus group for marketers. Describe a target market and a
product idea, and MarketMind AI uses Gemini to recruit ten realistic virtual
consumer personas, has each of them answer your question, streams an
executive report on the results, and then lets you interview any persona
one-on-one.

Built by Haruto Iriyama with React, TypeScript, Vite and Tailwind CSS.

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

**Saved simulations.** Every completed run — inputs, personas, report and
interview transcripts — is saved in the browser and can be reopened from the
Saved Simulations tab. The last open run is restored on reload.

## Architecture

The browser never talks to Gemini directly. A small Express server
(`server/`) holds the API key, calls Gemini, and exposes two endpoints:

- `POST /api/simulate` — generates the personas and streams the report back
  as newline-delimited JSON, in a single request.
- `POST /api/chat` — one in-character interview reply.

The server validates and size-limits every request, and rate-limits usage
per IP (simulations and chat messages per hour) plus a server-wide daily
cap, so a public deployment can't run up an unbounded Gemini bill. Limits are
configurable through environment variables — see [.env.example](.env.example).

## Project layout

```
server/
├── index.ts                   Express API, validation, rate limits; serves
│                              the app (Vite middleware in dev, dist/ in prod)
└── gemini.ts                  prompt building, structured output schema,
                               streaming report, in-character chat
src/
├── App.tsx                    tab shell, run state, saving to history
├── components/
│   ├── CustomerForm.tsx       focus-group configuration + A/B variants
│   ├── InsightsViewer.tsx     persona cards, charts tab, streaming report
│   ├── SentimentCharts.tsx    recharts visualisations (lazy-loaded)
│   ├── VariantSummary.tsx     A/B comparison tiles
│   ├── PersonaChat.tsx        1-on-1 chat with a persona
│   └── HistoryPanel.tsx       saved simulations list
└── lib/
    ├── api.ts                 browser client for the API server
    ├── history.ts             localStorage persistence for saved runs
    ├── types.ts               types shared by browser and server
    ├── variants.ts            per-variant scores and statistics (shared)
    └── utils.ts
```

## Running locally

Requires Node.js 18+ and a Gemini API key from
[Google AI Studio](https://aistudio.google.com/app/apikey).

```bash
npm install
```

Copy `.env.example` to `.env` and set your key:

```text
GEMINI_API_KEY=your_api_key
```

Then:

```bash
npm run dev
```

and open <http://localhost:3000>. `npm run lint` type-checks.

## Production

```bash
npm run build   # client bundle in dist/, server bundle in build/server.js
npm start       # serves the app and API on $PORT (default 3000)
```

Set `GEMINI_API_KEY` in the host's environment rather than committing a
`.env` file, and set `TRUST_PROXY=1` when running behind a reverse proxy
(Cloud Run, Render, Railway, Nginx…) so rate limits apply per real client IP.

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for a step-by-step walkthrough aimed at
non-developers.
