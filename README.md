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
4. **Interview a persona.** The Chat tab keeps a per-persona conversation
   history and answers in character, grounded in that persona's profile and
   original feedback.

## Project layout

```
src/
├── App.tsx                    tab shell (Configuration / Results / Interviews)
├── components/
│   ├── CustomerForm.tsx       focus-group configuration form
│   ├── InsightsViewer.tsx     persona cards + streaming executive report
│   └── PersonaChat.tsx        1-on-1 chat with a persona
└── lib/
    ├── gemini.ts              prompt building, structured output schema,
    │                          streaming report, in-character chat
    └── utils.ts
```

## Running locally

Requires Node.js 18+ and a Gemini API key from
[Google AI Studio](https://aistudio.google.com/app/apikey).

```bash
npm install
```

Create a `.env` file in the project root:

```text
VITE_GEMINI_API_KEY=your_api_key
GEMINI_API_KEY=your_api_key
```

Then:

```bash
npm run dev
```

and open <http://localhost:3000>. `npm run build` produces a static bundle
in `dist/`; `npm run lint` type-checks.

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for a step-by-step walkthrough aimed at
non-developers.
