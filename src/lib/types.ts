// Types shared by the browser app and the API server.

/** A persona's reaction to one concept / question variant. */
export interface VariantResponse {
  sentimentScore: number;
  answerToQuestion: string;
  feedback: string;
  keywords: string[];
}

/**
 * The top-level response fields are the reaction to variant A
 * (questionOrProductInfo). In an A/B test, `alternatives[i]` holds the same
 * persona's reaction to alternativeVariants[i] (variant B, C…).
 */
export interface Persona extends VariantResponse {
  id: number;
  name: string;
  age: number;
  gender: string;
  habits: string;
  location: string;
  incomeLevel: string;
  background: string;
  alternatives?: VariantResponse[];
}

/** Who a persona is, without any answers — what a saved panel stores. */
export type PanelPersona = Omit<Persona, keyof VariantResponse | "alternatives">;

export interface CustomerData {
  ageRange?: string;
  gender?: string;
  habits?: string;
  location?: string;
  incomeLevel?: string;
  /** Variant A: the product concept / question every persona answers. */
  questionOrProductInfo?: string;
  /** Optional A/B test: further variants (B, C) shown to the same personas. */
  alternativeVariants?: string[];
}

/** At most 3 variants (A + 2 alternatives) per simulation. */
export const MAX_ALTERNATIVE_VARIANTS = 2;

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

/** A completed simulation, as stored in the database. */
export interface SavedRun {
  id: string;
  createdAt: string; // ISO timestamp
  customerData: CustomerData;
  personas: Persona[];
  report: string;
  /** Interview transcripts keyed by persona index. */
  chats: Record<number, ChatTurn[]>;
  /** The saved panel these personas came from, if any. */
  panelId: string | null;
  /** Public share link id; null when sharing is off. */
  shareId: string | null;
}

/** A read-only run as shown on a public share link (no interview transcripts). */
export type SharedRun = Omit<SavedRun, "chats" | "panelId" | "shareId">;

/** A saved persona cohort that can be re-used for new simulations. */
export interface Panel {
  id: string;
  name: string;
  createdAt: string;
  /** Demographic settings the panel was recruited with. */
  customerData: CustomerData;
  personas: PanelPersona[];
}

/** Body of POST /api/simulate. */
export interface SimulateRequest extends CustomerData {
  /** Re-use the people from this saved panel instead of recruiting new ones. */
  panelId?: string;
}

// One line of the newline-delimited JSON stream returned by POST /api/simulate
export type SimulateEvent =
  | { type: "personas"; personas: Persona[] }
  | { type: "report"; delta: string }
  | { type: "saved"; run: SavedRun }
  | { type: "error"; message: string }
  | { type: "done" };
