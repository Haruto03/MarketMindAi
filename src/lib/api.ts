// Browser-side client for the MarketMind API server (server/index.ts).
// All Gemini calls and database access happen on the server; requests carry
// the signed-in user's Supabase access token.
import { auth } from "./supabase";
import type { ChatTurn, Panel, Persona, SavedRun, SharedRun, SimulateEvent, SimulateRequest } from "./types";

async function errorFromResponse(res: Response): Promise<Error> {
  try {
    const body = await res.json();
    if (body?.error) return new Error(body.error);
  } catch {
    // fall through to the generic message
  }
  return new Error(`Request failed (HTTP ${res.status}). Please try again.`);
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** fetch() with the user's token; throws the server's error message on failure. */
async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(await authHeaders()), ...(init.headers as Record<string, string>) };
  if (init.body) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw await errorFromResponse(res);
  return res;
}

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  return (await res.json()) as T;
}

// ── Simulations ──────────────────────────────────────────────────────────────

/**
 * Runs a full simulation. Calls onPersonas once the cohort is ready, then
 * onReportChunk for each streamed piece of the report. Resolves with the run
 * as saved in the database.
 */
export async function runSimulation(
  request: SimulateRequest,
  handlers: {
    onPersonas: (personas: Persona[]) => void;
    onReportChunk: (delta: string) => void;
  },
): Promise<SavedRun> {
  const res = await apiFetch("/api/simulate", { method: "POST", body: JSON.stringify(request) });
  if (!res.body) throw new Error("The server returned an empty response. Please try again.");

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let saved: SavedRun | null = null;

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as SimulateEvent;
    switch (event.type) {
      case "personas":
        handlers.onPersonas(event.personas);
        break;
      case "report":
        handlers.onReportChunk(event.delta);
        break;
      case "saved":
        saved = event.run;
        break;
      case "error":
        throw new Error(event.message);
      case "done":
        break;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handleLine);
  }
  handleLine(buffer);

  if (!saved) {
    throw new Error("The connection to the server was interrupted. Please try again.");
  }
  return saved;
}

export async function listRuns(): Promise<SavedRun[]> {
  return (await apiJson<{ runs: SavedRun[] }>("/api/runs")).runs;
}

export async function deleteRun(id: string): Promise<void> {
  await apiFetch(`/api/runs/${id}`, { method: "DELETE" });
}

/** Turns the public share link on (true) or off (false). Returns the updated run. */
export async function setSharing(id: string, enabled: boolean): Promise<SavedRun> {
  return (await apiJson<{ run: SavedRun }>(`/api/runs/${id}/share`, { method: enabled ? "POST" : "DELETE" })).run;
}

/** Public, no sign-in required. */
export async function getSharedRun(shareId: string): Promise<SharedRun> {
  const res = await fetch(`/api/share/${encodeURIComponent(shareId)}`);
  if (!res.ok) throw await errorFromResponse(res);
  return ((await res.json()) as { run: SharedRun }).run;
}

// ── Interviews ───────────────────────────────────────────────────────────────

/** Sends one interview message. Resolves with the full updated transcript. */
export async function sendChatMessage(runId: string, personaIndex: number, message: string): Promise<ChatTurn[]> {
  return (
    await apiJson<{ messages: ChatTurn[] }>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ runId, personaIndex, message }),
    })
  ).messages;
}

// ── Panels ───────────────────────────────────────────────────────────────────

export async function listPanels(): Promise<Panel[]> {
  return (await apiJson<{ panels: Panel[] }>("/api/panels")).panels;
}

export async function createPanel(runId: string, name: string): Promise<Panel> {
  return (await apiJson<{ panel: Panel }>("/api/panels", { method: "POST", body: JSON.stringify({ runId, name }) })).panel;
}

export async function deletePanel(id: string): Promise<void> {
  await apiFetch(`/api/panels/${id}`, { method: "DELETE" });
}
