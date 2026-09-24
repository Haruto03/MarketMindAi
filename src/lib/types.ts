// Types shared by the browser app and the API server.

export interface Persona {
  id: number;
  name: string;
  age: number;
  gender: string;
  habits: string;
  location: string;
  incomeLevel: string;
  sentimentScore: number;
  background: string;
  answerToQuestion: string;
  feedback: string;
  keywords: string[];
}

export interface CustomerData {
  ageRange?: string;
  gender?: string;
  habits?: string;
  location?: string;
  incomeLevel?: string;
  questionOrProductInfo?: string;
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sentinel value used by CustomerForm when a demographic field is left blank.
// When buildPersonaPrompt detects this value it tells Gemini to maximise
// diversity for that dimension across all 10 personas.
// ─────────────────────────────────────────────────────────────────────────────
export const DIVERSE_RANDOM = "DIVERSE_RANDOM" as const;

// One line of the newline-delimited JSON stream returned by POST /api/simulate
export type SimulateEvent =
  | { type: "personas"; personas: Persona[] }
  | { type: "report"; delta: string }
  | { type: "error"; message: string }
  | { type: "done" };
