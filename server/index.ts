import "dotenv/config";
import path from "path";
import { randomUUID } from "crypto";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import type { User } from "@supabase/supabase-js";
import { analyzePersonaDataStream, chatWithPersona, generatePersonaBatch } from "./gemini";
import * as db from "./db";
import { MAX_ALTERNATIVE_VARIANTS, type CustomerData, type PanelPersona, type SimulateEvent } from "../src/lib/types";
import { greetingFor, toPanelPersona } from "../src/lib/personas";
import { variantCount, variantTexts } from "../src/lib/variants";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration (all overridable through environment variables)
// ─────────────────────────────────────────────────────────────────────────────
const isDev = process.argv.includes("--dev");
const PORT = Number(process.env.PORT) || 3000;

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

// Per-user limits (stored in the database, so they survive restarts)
const SIMULATIONS_PER_HOUR = envInt("SIMULATIONS_PER_HOUR", 10);
const CHAT_MESSAGES_PER_HOUR = envInt("CHAT_MESSAGES_PER_HOUR", 100);
// Whole-service limits, a hard ceiling on spend regardless of how many users call
const DAILY_SIMULATION_CAP = envInt("DAILY_SIMULATION_CAP", 200);
const DAILY_CHAT_CAP = envInt("DAILY_CHAT_CAP", 2000);
// Per-IP request ceiling across the whole API (abuse guard in front of auth)
const API_REQUESTS_PER_15_MIN = envInt("API_REQUESTS_PER_15_MIN", 300);

// Input size limits
const MAX_FIELD_CHARS = 300;
const MAX_QUESTION_CHARS = 2000;
const MAX_CHAT_MESSAGE_CHARS = 1000;
const MAX_CHAT_USER_TURNS = 20;
const MAX_PANEL_NAME_CHARS = 120;
const MAX_PANELS_PER_USER = 50;

{
  const missing = [
    !process.env.GEMINI_API_KEY && "GEMINI_API_KEY",
    !db.supabaseConfig().url && "SUPABASE_URL (or VITE_SUPABASE_URL)",
    !db.supabaseConfig().serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  if (missing.length > 0) {
    console.error(`Missing environment variables: ${missing.join(", ")}. Add them to .env (see README) and restart.`);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors and async helpers
// ─────────────────────────────────────────────────────────────────────────────
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const badRequest = (message: string) => new HttpError(400, message);
const notFound = (what: string) => new HttpError(404, `${what} not found.`);

/** Async route handler: rejected promises go to the error handler (Express 4). */
const route = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => { fn(req, res).catch(next); };

/** Async middleware: continues to the next handler when fn resolves. */
const middleware = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => { fn(req, res).then(() => next(), next); };

const currentUser = (res: Response): User => res.locals.user as User;

function publicAiErrorMessage(error: unknown): string {
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
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────
function optionalString(value: unknown, field: string, maxChars: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw badRequest(`"${field}" must be a string.`);
  if (value.length > maxChars) throw badRequest(`"${field}" must be at most ${maxChars} characters.`);
  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw badRequest(`"${field}" must be a valid id.`);
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
  if (!Array.isArray(value)) throw badRequest(`"alternativeVariants" must be an array.`);
  if (value.length > MAX_ALTERNATIVE_VARIANTS) {
    throw badRequest(`At most ${MAX_ALTERNATIVE_VARIANTS} alternative variants are allowed.`);
  }
  const variants = value.map((v, i) => optionalString(v, `alternativeVariants[${i}]`, MAX_QUESTION_CHARS)?.trim() ?? "");
  if (variants.some((v) => !v)) throw badRequest("A/B variants must not be empty.");
  return variants.length > 0 ? variants : undefined;
}

/** Demographic settings only — what a panel remembers about how it was recruited. */
function demographicsOf(data: CustomerData): CustomerData {
  const { ageRange, gender, habits, location, incomeLevel } = data;
  return { ageRange, gender, habits, location, incomeLevel };
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware: authentication and usage limits
// ─────────────────────────────────────────────────────────────────────────────

/** Requires a valid Supabase access token in `Authorization: Bearer <token>`. */
const requireUser = middleware(async (req, res) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = token ? await db.userFromToken(token) : null;
  if (!user) throw new HttpError(401, "Please sign in to continue.");
  res.locals.user = user;
});

/**
 * Checks the user's hourly allowance and the service-wide daily cap for an AI
 * call, then records the call. Recording happens before the AI request so
 * failed or abandoned requests still count against the limit.
 */
function usageGuard(kind: db.UsageKind, perHour: number, perDay: number, messages: { hour: string; day: string }) {
  return middleware(async (_req, res) => {
    const user = currentUser(res);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const startOfUtcDay = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;

    const [userCount, allCount] = await Promise.all([
      db.countUserUsage(user.id, kind, hourAgo),
      db.countAllUsage(kind, startOfUtcDay),
    ]);
    if (userCount >= perHour) throw new HttpError(429, messages.hour);
    if (allCount >= perDay) throw new HttpError(429, messages.day);
    await db.recordUsage(user.id, kind);
  });
}

const simulationAllowance = usageGuard("simulation", SIMULATIONS_PER_HOUR, DAILY_SIMULATION_CAP, {
  hour: `You can run up to ${SIMULATIONS_PER_HOUR} simulations per hour. Please try again later.`,
  day: "The daily simulation limit for this service has been reached. Please try again tomorrow.",
});

const chatAllowance = usageGuard("chat", CHAT_MESSAGES_PER_HOUR, DAILY_CHAT_CAP, {
  hour: `You can send up to ${CHAT_MESSAGES_PER_HOUR} interview messages per hour. Please try again later.`,
  day: "The daily interview limit for this service has been reached. Please try again tomorrow.",
});

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
const app = express();

// Behind a reverse proxy (Cloud Run, Render, Nginx…) set TRUST_PROXY=1 so
// rate limiting sees the real client IP instead of the proxy's.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: API_REQUESTS_PER_15_MIN,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => { res.status(429).json({ error: "Too many requests. Please slow down." }); },
  }),
  express.json({ limit: "64kb" }),
);

// ── Simulations ──────────────────────────────────────────────────────────────

/**
 * Runs a full focus-group simulation and streams the result as NDJSON:
 * "personas", then "report" deltas, then "saved" (the stored run) and "done"
 * — or "error". Personas and report are generated in one request so the
 * report can only ever be produced from server-generated personas.
 */
app.post(
  "/api/simulate",
  requireUser,
  // Validate before counting usage, so malformed requests don't use up the allowance
  middleware(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data = parseCustomerData(body);
    let panel: Awaited<ReturnType<typeof db.getPanel>> = null;
    if (body.panelId !== undefined && body.panelId !== null && body.panelId !== "") {
      panel = await db.getPanel(currentUser(res).id, uuid(body.panelId, "panelId"));
      if (!panel) throw notFound("Panel");
    }
    res.locals.data = data;
    res.locals.panel = panel;
  }),
  simulationAllowance,
  async (_req, res) => {
    const user = currentUser(res);
    const panel = res.locals.panel as Awaited<ReturnType<typeof db.getPanel>>;
    const input = res.locals.data as CustomerData;
    // A re-used panel keeps the demographics it was recruited with
    const data: CustomerData = panel ? { ...input, ...demographicsOf(panel.customerData) } : input;

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
      const personas = await generatePersonaBatch(data, panel?.personas);
      send({ type: "personas", personas });

      // Keep going if the tab closes: the run is saved and shows up in history
      const report = await analyzePersonaDataStream(personas, data, (delta) => {
        send({ type: "report", delta });
      });

      const run = await db.insertRun(user.id, { customerData: data, personas, report, panelId: panel?.id ?? null });
      send({ type: "saved", run });
      send({ type: "done" });
    } catch (error) {
      console.error("[simulate]", error);
      send({ type: "error", message: publicAiErrorMessage(error) });
    } finally {
      res.end();
    }
  },
);

// ── Saved runs ───────────────────────────────────────────────────────────────

app.get("/api/runs", requireUser, route(async (_req, res) => {
  res.json({ runs: await db.listRuns(currentUser(res).id) });
}));

app.get("/api/runs/:id", requireUser, route(async (req, res) => {
  const run = await db.getRun(currentUser(res).id, uuid(req.params.id, "id"));
  if (!run) throw notFound("Simulation");
  res.json({ run });
}));

app.delete("/api/runs/:id", requireUser, route(async (req, res) => {
  const deleted = await db.deleteRun(currentUser(res).id, uuid(req.params.id, "id"));
  if (!deleted) throw notFound("Simulation");
  res.status(204).end();
}));

/** Turns on the public share link (idempotent — keeps an existing link). */
app.post("/api/runs/:id/share", requireUser, route(async (req, res) => {
  const userId = currentUser(res).id;
  const runId = uuid(req.params.id, "id");
  const existing = await db.getRun(userId, runId);
  if (!existing) throw notFound("Simulation");
  const run = existing.shareId ? existing : await db.setRunShareId(userId, runId, randomUUID());
  res.json({ run });
}));

/** Turns off the public share link; the old link stops working. */
app.delete("/api/runs/:id/share", requireUser, route(async (req, res) => {
  const run = await db.setRunShareId(currentUser(res).id, uuid(req.params.id, "id"), null);
  if (!run) throw notFound("Simulation");
  res.json({ run });
}));

// ── Public share links ───────────────────────────────────────────────────────

app.get(
  "/api/share/:shareId",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => { res.status(429).json({ error: "Too many requests. Please slow down." }); },
  }),
  route(async (req, res) => {
    const run = await db.getSharedRun(uuid(req.params.shareId, "shareId"));
    if (!run) throw notFound("Shared simulation");
    res.json({ run });
  }),
);

// ── Interviews ───────────────────────────────────────────────────────────────

/**
 * One interview turn. The persona and transcript are loaded from the stored
 * run — the browser only says which run and which participant — so the
 * roleplay prompt can't be tampered with, and the transcript is saved here.
 */
app.post(
  "/api/chat",
  requireUser,
  middleware(async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const message = optionalString(b.message, "message", MAX_CHAT_MESSAGE_CHARS)?.trim();
    if (!message) throw badRequest(`"message" is required.`);
    const personaIndex = Number(b.personaIndex);

    const run = await db.getRun(currentUser(res).id, uuid(b.runId, "runId"));
    if (!run) throw notFound("Simulation");
    const persona = run.personas[personaIndex];
    if (!Number.isInteger(personaIndex) || !persona) throw badRequest(`"personaIndex" is invalid.`);

    const variants = variantTexts(run.customerData).slice(0, variantCount(run.personas));
    const transcript = run.chats[personaIndex]?.length ? run.chats[personaIndex] : [greetingFor(persona, variants)];
    if (transcript.filter((t) => t.role === "user").length >= MAX_CHAT_USER_TURNS) {
      throw badRequest(`Interviews are limited to ${MAX_CHAT_USER_TURNS} questions per participant.`);
    }
    res.locals.chat = { run, persona, personaIndex, variants, transcript, message };
  }),
  chatAllowance,
  route(async (_req, res) => {
    const userId = currentUser(res).id;
    const { run, persona, personaIndex, variants, transcript, message } = res.locals.chat as {
      run: NonNullable<Awaited<ReturnType<typeof db.getRun>>>;
      persona: (typeof run.personas)[number];
      personaIndex: number;
      variants: string[];
      transcript: typeof run.chats[number];
      message: string;
    };

    let reply: string;
    try {
      reply = await chatWithPersona(transcript, message, persona, variants);
    } catch (error) {
      console.error("[chat]", error);
      throw new HttpError(502, publicAiErrorMessage(error));
    }
    const messages = [
      ...transcript,
      { role: "user" as const, text: message },
      { role: "model" as const, text: reply || "I'm sorry, I couldn't form a response right now. Could you try asking again?" },
    ];

    // Re-read just before writing so a concurrent interview with another
    // participant in the same run isn't overwritten.
    const latest = (await db.getRun(userId, run.id)) ?? run;
    await db.updateRunChats(userId, run.id, { ...latest.chats, [personaIndex]: messages });
    res.json({ messages });
  }),
);

// ── Panels (re-usable persona cohorts) ───────────────────────────────────────

app.get("/api/panels", requireUser, route(async (_req, res) => {
  res.json({ panels: await db.listPanels(currentUser(res).id) });
}));

/** Saves the people from a run as a panel that can answer future questions. */
app.post("/api/panels", requireUser, route(async (req, res) => {
  const userId = currentUser(res).id;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const name = optionalString(b.name, "name", MAX_PANEL_NAME_CHARS)?.trim();
  if (!name) throw badRequest(`"name" is required.`);

  const run = await db.getRun(userId, uuid(b.runId, "runId"));
  if (!run) throw notFound("Simulation");
  if (run.panelId) throw new HttpError(409, "These personas already belong to a saved panel.");
  if ((await db.listPanels(userId)).length >= MAX_PANELS_PER_USER) {
    throw badRequest(`You can save up to ${MAX_PANELS_PER_USER} panels. Delete one to save another.`);
  }

  const personas: PanelPersona[] = run.personas.map(toPanelPersona);
  const panel = await db.insertPanel(userId, { name, customerData: demographicsOf(run.customerData), personas });
  // The run's personas now belong to this panel (also prevents saving them twice)
  await db.setRunPanelId(userId, run.id, panel.id);
  res.status(201).json({ panel });
}));

app.delete("/api/panels/:id", requireUser, route(async (req, res) => {
  const deleted = await db.deletePanel(currentUser(res).id, uuid(req.params.id, "id"));
  if (!deleted) throw notFound("Panel");
  res.status(204).end();
}));

// ─────────────────────────────────────────────────────────────────────────────

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// HttpErrors carry their own status; JSON parse / payload errors come from express.json()
app.use((err: Error & { status?: number }, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  const status = err instanceof HttpError ? err.status : err.status && err.status < 500 ? err.status : 500;
  if (status >= 500) console.error(err);
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
