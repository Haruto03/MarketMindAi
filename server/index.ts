import "dotenv/config";
import path from "path";
import express, { type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { analyzePersonaDataStream, chatWithPersona, generatePersonaBatch, validatePersona } from "./gemini";
import { MAX_ALTERNATIVE_VARIANTS, type ChatTurn, type CustomerData, type SimulateEvent } from "../src/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration (all overridable through environment variables)
// ─────────────────────────────────────────────────────────────────────────────
const isDev = process.argv.includes("--dev");
const PORT = Number(process.env.PORT) || 3000;

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

// Per-IP limits
const SIMULATIONS_PER_HOUR = envInt("SIMULATIONS_PER_HOUR", 10);
const CHAT_MESSAGES_PER_HOUR = envInt("CHAT_MESSAGES_PER_HOUR", 100);
// Whole-server limits, a hard ceiling on spend regardless of how many IPs call
const DAILY_SIMULATION_CAP = envInt("DAILY_SIMULATION_CAP", 200);
const DAILY_CHAT_CAP = envInt("DAILY_CHAT_CAP", 2000);

// Input size limits
const MAX_FIELD_CHARS = 300;
const MAX_QUESTION_CHARS = 2000;
const MAX_CHAT_MESSAGE_CHARS = 1000;
const MAX_CHAT_HISTORY_TURNS = 40;
const MAX_PERSONA_FIELD_CHARS = 1500;
const MAX_MODEL_TURN_CHARS = MAX_QUESTION_CHARS + MAX_PERSONA_FIELD_CHARS + 1000;

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set. Add it to .env (see README) and restart.");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────
class BadRequest extends Error {}

function optionalString(value: unknown, field: string, maxChars: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new BadRequest(`"${field}" must be a string.`);
  if (value.length > maxChars) throw new BadRequest(`"${field}" must be at most ${maxChars} characters.`);
  return value;
}

function parseCustomerData(body: unknown): CustomerData {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    ageRange: optionalString(b.ageRange, "ageRange", MAX_FIELD_CHARS),
    gender: optionalString(b.gender, "gender", MAX_FIELD_CHARS),
    habits: optionalString(b.habits, "habits", MAX_FIELD_CHARS),
    location: optionalString(b.location, "location", MAX_FIELD_CHARS),
    incomeLevel: optionalString(b.incomeLevel, "incomeLevel", MAX_FIELD_CHARS),
    questionOrProductInfo: optionalString(b.questionOrProductInfo, "questionOrProductInfo", MAX_QUESTION_CHARS),
    alternativeVariants: parseAlternativeVariants(b.alternativeVariants),
  };
}

function parseAlternativeVariants(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new BadRequest(`"alternativeVariants" must be an array.`);
  if (value.length > MAX_ALTERNATIVE_VARIANTS) {
    throw new BadRequest(`At most ${MAX_ALTERNATIVE_VARIANTS} alternative variants are allowed.`);
  }
  const variants = value.map((v, i) => optionalString(v, `alternativeVariants[${i}]`, MAX_QUESTION_CHARS)?.trim() ?? "");
  if (variants.some((v) => !v)) throw new BadRequest("A/B variants must not be empty.");
  return variants.length > 0 ? variants : undefined;
}

function parseChatRequest(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;

  const message = optionalString(b.message, "message", MAX_CHAT_MESSAGE_CHARS)?.trim();
  if (!message) throw new BadRequest(`"message" is required.`);

  if (!Array.isArray(b.history)) throw new BadRequest(`"history" must be an array.`);
  if (b.history.length > MAX_CHAT_HISTORY_TURNS) {
    throw new BadRequest("This interview is too long. Switch persona or start a new simulation.");
  }
  const history: ChatTurn[] = b.history.map((turn, i) => {
    const t = (turn ?? {}) as Record<string, unknown>;
    if (t.role !== "user" && t.role !== "model") throw new BadRequest(`history[${i}].role is invalid.`);
    // Model turns include the greeting, which quotes the question and the persona's answer
    const limit = t.role === "user" ? MAX_CHAT_MESSAGE_CHARS : MAX_MODEL_TURN_CHARS;
    return { role: t.role, text: optionalString(t.text, `history[${i}].text`, limit) ?? "" };
  });

  if (!Array.isArray(b.variants) || b.variants.length < 1 || b.variants.length > 1 + MAX_ALTERNATIVE_VARIANTS) {
    throw new BadRequest(`"variants" must be an array of 1 to ${1 + MAX_ALTERNATIVE_VARIANTS} strings.`);
  }
  const variants = b.variants.map((v, i) => optionalString(v, `variants[${i}]`, MAX_QUESTION_CHARS) ?? "");

  let persona;
  try {
    persona = validatePersona(b.persona, 0, variants.length - 1);
  } catch (e) {
    throw new BadRequest(e instanceof Error ? e.message : "Invalid persona.");
  }
  const responses = [persona, ...(persona.alternatives ?? [])];
  for (const obj of responses) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string" && value.length > MAX_PERSONA_FIELD_CHARS) {
        throw new BadRequest(`persona.${key} is too long.`);
      }
    }
  }

  return { message, history, persona, variants };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────────────────────
const tooManyRequests = (message: string) => (_req: Request, res: Response) => {
  res.status(429).json({ error: message });
};

const simulateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: SIMULATIONS_PER_HOUR,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: tooManyRequests(`You can run up to ${SIMULATIONS_PER_HOUR} simulations per hour. Please try again later.`),
});

const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: CHAT_MESSAGES_PER_HOUR,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: tooManyRequests(`You can send up to ${CHAT_MESSAGES_PER_HOUR} interview messages per hour. Please try again later.`),
});

/** In-memory counter that resets at UTC midnight. Caps total spend per server instance. */
function dailyCap(limit: number, message: string) {
  let day = "";
  let count = 0;
  return (_req: Request, res: Response, next: NextFunction) => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      count = 0;
    }
    if (count >= limit) {
      res.status(429).json({ error: message });
      return;
    }
    count++;
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Error mapping — details stay in the server log, the browser gets a safe message
// ─────────────────────────────────────────────────────────────────────────────
function publicErrorMessage(error: unknown): string {
  const status = (error as { status?: number })?.status;
  if (status === 429) {
    return "The AI service is at capacity right now. Please wait a minute and try again.";
  }
  if (error instanceof Error && error.message.startsWith("Failed to parse data from AI")) {
    return error.message;
  }
  return "The AI service failed to respond. Please try again.";
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
const app = express();

// Behind a reverse proxy (Cloud Run, Render, Nginx…) set TRUST_PROXY=1 so
// rate limiting sees the real client IP instead of the proxy's.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

app.use("/api", express.json({ limit: "64kb" }));

/**
 * Runs a full focus-group simulation and streams the result as NDJSON:
 * one "personas" event, then "report" deltas, then "done" (or "error").
 * Personas and report are generated in one request so the report can only
 * ever be produced from server-generated personas.
 */
app.post(
  "/api/simulate",
  simulateLimiter,
  dailyCap(DAILY_SIMULATION_CAP, "The daily simulation limit for this demo has been reached. Please try again tomorrow."),
  async (req, res) => {
    let data: CustomerData;
    try {
      data = parseCustomerData(req.body);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let clientGone = false;
    res.on("close", () => { clientGone = true; });
    const send = (event: SimulateEvent) => {
      if (!clientGone) res.write(JSON.stringify(event) + "\n");
    };

    try {
      const personas = await generatePersonaBatch(data);
      send({ type: "personas", personas });
      if (clientGone) return;

      await analyzePersonaDataStream(personas, data, (delta) => {
        send({ type: "report", delta });
      });
      send({ type: "done" });
    } catch (error) {
      console.error("[simulate]", error);
      send({ type: "error", message: publicErrorMessage(error) });
    } finally {
      res.end();
    }
  },
);

app.post(
  "/api/chat",
  chatLimiter,
  dailyCap(DAILY_CHAT_CAP, "The daily interview limit for this demo has been reached. Please try again tomorrow."),
  async (req, res) => {
    let parsed;
    try {
      parsed = parseChatRequest(req.body);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
      return;
    }

    try {
      const reply = await chatWithPersona(parsed.history, parsed.message, parsed.persona, parsed.variants);
      res.json({ reply });
    } catch (error) {
      console.error("[chat]", error);
      res.status(502).json({ error: publicErrorMessage(error) });
    }
  },
);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Malformed JSON bodies and oversize payloads from express.json()
app.use((err: Error & { status?: number }, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? "Internal server error" : err.message });
});

async function start() {
  if (isDev) {
    // Serve the React app through Vite (with HMR) from the same port as the API
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir, { index: false }));
    app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
  }

  app.listen(PORT, () => {
    console.log(`MarketMind AI running at http://localhost:${PORT} (${isDev ? "development" : "production"})`);
  });
}

start();
