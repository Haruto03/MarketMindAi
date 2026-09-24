// Browser-side client for the MarketMind API server (server/index.ts).
// All Gemini calls happen on the server; the API key never reaches the browser.
import type { ChatTurn, CustomerData, Persona, SimulateEvent } from "./types";

async function errorFromResponse(res: Response): Promise<Error> {
  try {
    const body = await res.json();
    if (body?.error) return new Error(body.error);
  } catch {
    // fall through to the generic message
  }
  return new Error(`Request failed (HTTP ${res.status}). Please try again.`);
}

/**
 * Runs a full simulation. Calls onPersonas once the cohort is ready, then
 * onReportChunk for each streamed piece of the report. Resolves with the full report.
 */
export async function runSimulation(
  data: CustomerData,
  handlers: {
    onPersonas: (personas: Persona[]) => void;
    onReportChunk: (delta: string) => void;
  },
): Promise<string> {
  const res = await fetch("/api/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok || !res.body) throw await errorFromResponse(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let report = "";
  let finished = false;

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as SimulateEvent;
    switch (event.type) {
      case "personas":
        handlers.onPersonas(event.personas);
        break;
      case "report":
        report += event.delta;
        handlers.onReportChunk(event.delta);
        break;
      case "error":
        throw new Error(event.message);
      case "done":
        finished = true;
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

  if (!finished) {
    throw new Error("The connection to the server was interrupted. Please try again.");
  }
  return report;
}

export async function sendChatMessage(
  history: ChatTurn[],
  message: string,
  persona: Persona,
  variants: string[],
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, message, persona, variants }),
  });
  if (!res.ok) throw await errorFromResponse(res);
  const body = (await res.json()) as { reply?: string };
  return body.reply ?? "";
}
