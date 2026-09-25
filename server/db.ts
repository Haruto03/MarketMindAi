// Database access. Uses the Supabase service-role key, so every query here
// MUST be scoped to the authenticated user explicitly (user_id filters).
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { ChatTurn, CustomerData, Panel, PanelPersona, Persona, SavedRun, SharedRun } from "../src/lib/types";

let admin: SupabaseClient | null = null;

export function supabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function db(): SupabaseClient {
  if (!admin) {
    const { url, serviceRoleKey } = supabaseConfig();
    if (!url || !serviceRoleKey) throw new Error("Supabase is not configured");
    admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

/** Throws the Supabase error so route handlers can turn it into a 500. */
function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

/** Resolves a Supabase access token (JWT) to its user, or null if invalid/expired. */
export async function userFromToken(token: string): Promise<User | null> {
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage limits
// ─────────────────────────────────────────────────────────────────────────────

export type UsageKind = "simulation" | "chat";

export async function countUserUsage(userId: string, kind: UsageKind, sinceIso: string): Promise<number> {
  const { count, error } = await db()
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", sinceIso);
  if (error) throw error;
  return count ?? 0;
}

export async function countAllUsage(kind: UsageKind, sinceIso: string): Promise<number> {
  const { count, error } = await db()
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .gte("created_at", sinceIso);
  if (error) throw error;
  return count ?? 0;
}

export async function recordUsage(userId: string, kind: UsageKind): Promise<void> {
  check(await db().from("usage_events").insert({ user_id: userId, kind }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Runs
// ─────────────────────────────────────────────────────────────────────────────

interface RunRow {
  id: string;
  user_id: string;
  panel_id: string | null;
  customer_data: CustomerData;
  personas: Persona[];
  report: string;
  chats: Record<number, ChatTurn[]>;
  share_id: string | null;
  created_at: string;
}

const RUN_COLUMNS = "id, user_id, panel_id, customer_data, personas, report, chats, share_id, created_at";

function toRun(row: RunRow): SavedRun {
  return {
    id: row.id,
    createdAt: row.created_at,
    customerData: row.customer_data,
    personas: row.personas,
    report: row.report,
    chats: row.chats ?? {},
    panelId: row.panel_id,
    shareId: row.share_id,
  };
}

const MAX_LISTED_RUNS = 50;

export async function listRuns(userId: string): Promise<SavedRun[]> {
  const rows = check(
    await db()
      .from("runs")
      .select(RUN_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_LISTED_RUNS),
  ) as RunRow[];
  return rows.map(toRun);
}

export async function getRun(userId: string, runId: string): Promise<SavedRun | null> {
  const row = check(
    await db().from("runs").select(RUN_COLUMNS).eq("user_id", userId).eq("id", runId).maybeSingle(),
  ) as RunRow | null;
  return row ? toRun(row) : null;
}

export async function insertRun(
  userId: string,
  run: { customerData: CustomerData; personas: Persona[]; report: string; panelId: string | null },
): Promise<SavedRun> {
  const row = check(
    await db()
      .from("runs")
      .insert({
        user_id: userId,
        panel_id: run.panelId,
        customer_data: run.customerData,
        personas: run.personas,
        report: run.report,
      })
      .select(RUN_COLUMNS)
      .single(),
  ) as RunRow;
  return toRun(row);
}

export async function setRunPanelId(userId: string, runId: string, panelId: string): Promise<void> {
  check(await db().from("runs").update({ panel_id: panelId }).eq("user_id", userId).eq("id", runId));
}

export async function updateRunChats(userId: string, runId: string, chats: Record<number, ChatTurn[]>): Promise<void> {
  check(await db().from("runs").update({ chats }).eq("user_id", userId).eq("id", runId));
}

/** Returns true if a run was deleted. */
export async function deleteRun(userId: string, runId: string): Promise<boolean> {
  const rows = check(
    await db().from("runs").delete().eq("user_id", userId).eq("id", runId).select("id"),
  ) as { id: string }[];
  return rows.length > 0;
}

/** Sets or clears the run's public share id. Returns null if the run isn't the user's. */
export async function setRunShareId(userId: string, runId: string, shareId: string | null): Promise<SavedRun | null> {
  const row = check(
    await db()
      .from("runs")
      .update({ share_id: shareId })
      .eq("user_id", userId)
      .eq("id", runId)
      .select(RUN_COLUMNS)
      .maybeSingle(),
  ) as RunRow | null;
  return row ? toRun(row) : null;
}

/** Public read of a shared run — interview transcripts are never exposed. */
export async function getSharedRun(shareId: string): Promise<SharedRun | null> {
  const row = check(
    await db()
      .from("runs")
      .select("id, customer_data, personas, report, created_at")
      .eq("share_id", shareId)
      .maybeSingle(),
  ) as Pick<RunRow, "id" | "customer_data" | "personas" | "report" | "created_at"> | null;
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    customerData: row.customer_data,
    personas: row.personas,
    report: row.report,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Panels
// ─────────────────────────────────────────────────────────────────────────────

interface PanelRow {
  id: string;
  user_id: string;
  name: string;
  customer_data: CustomerData;
  personas: PanelPersona[];
  created_at: string;
}

const PANEL_COLUMNS = "id, user_id, name, customer_data, personas, created_at";

function toPanel(row: PanelRow): Panel {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    customerData: row.customer_data,
    personas: row.personas,
  };
}

export async function listPanels(userId: string): Promise<Panel[]> {
  const rows = check(
    await db().from("panels").select(PANEL_COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }),
  ) as PanelRow[];
  return rows.map(toPanel);
}

export async function getPanel(userId: string, panelId: string): Promise<Panel | null> {
  const row = check(
    await db().from("panels").select(PANEL_COLUMNS).eq("user_id", userId).eq("id", panelId).maybeSingle(),
  ) as PanelRow | null;
  return row ? toPanel(row) : null;
}

export async function insertPanel(
  userId: string,
  panel: { name: string; customerData: CustomerData; personas: PanelPersona[] },
): Promise<Panel> {
  const row = check(
    await db()
      .from("panels")
      .insert({ user_id: userId, name: panel.name, customer_data: panel.customerData, personas: panel.personas })
      .select(PANEL_COLUMNS)
      .single(),
  ) as PanelRow;
  return toPanel(row);
}

export async function deletePanel(userId: string, panelId: string): Promise<boolean> {
  const rows = check(
    await db().from("panels").delete().eq("user_id", userId).eq("id", panelId).select("id"),
  ) as { id: string }[];
  return rows.length > 0;
}
