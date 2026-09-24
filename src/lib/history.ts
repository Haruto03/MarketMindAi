// Saved simulation runs, kept in the browser's localStorage.
// Every read and write is wrapped so a full, blocked or unavailable storage
// never breaks the app — history just stops persisting.
import type { ChatTurn, CustomerData, Persona } from "./types";

export interface SavedRun {
  id: string;
  createdAt: string; // ISO timestamp
  customerData: CustomerData;
  personas: Persona[];
  report: string;
  /** Interview transcripts keyed by persona index. */
  chats: Record<number, ChatTurn[]>;
}

const RUNS_KEY = "marketmind.runs.v1";
const ACTIVE_KEY = "marketmind.activeRun.v1";
const MAX_RUNS = 30;

export function listRuns(): SavedRun[] {
  try {
    const raw = localStorage.getItem(RUNS_KEY);
    const runs = raw ? (JSON.parse(raw) as SavedRun[]) : [];
    return Array.isArray(runs) ? runs : [];
  } catch {
    return [];
  }
}

/** Writes the list, dropping the oldest runs if storage is full. */
function writeRuns(runs: SavedRun[]): SavedRun[] {
  let kept = runs.slice(0, MAX_RUNS);
  while (kept.length > 0) {
    try {
      localStorage.setItem(RUNS_KEY, JSON.stringify(kept));
      return kept;
    } catch {
      kept = kept.slice(0, -1);
    }
  }
  try {
    localStorage.removeItem(RUNS_KEY);
  } catch {
    // storage unavailable
  }
  return [];
}

/** Inserts or replaces a run (newest first). Returns the updated list. */
export function saveRun(run: SavedRun): SavedRun[] {
  const others = listRuns().filter((r) => r.id !== run.id);
  return writeRuns([run, ...others].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function deleteRun(id: string): SavedRun[] {
  return writeRuns(listRuns().filter((r) => r.id !== id));
}

export function getActiveRunId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveRunId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // storage unavailable
  }
}

export function newRunId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
