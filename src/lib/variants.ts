// Helpers for working with per-variant responses (A/B testing) and sentiment
// statistics. Shared by the browser app and the API server.
import type { CustomerData, Persona, VariantResponse } from "./types";

export const VARIANT_LETTERS = ["A", "B", "C"] as const;

// Chart/swatch colours for variants A/B/C, validated as a categorical set
// against the app's dark surface (#0B0F19): all pairs clear the
// colour-blind separation floor.
export const VARIANT_COLORS = ["#3987e5", "#d95926", "#199e70"] as const;

/** Adoption likelihood at or above this counts as a likely adopter (rubric band "Interested"). */
export const ADOPTER_THRESHOLD = 65;
/** Below this counts as a rejecter (rubric bands "Impossible" and "Strong rejection"). */
export const REJECTER_THRESHOLD = 31;

/** The sentimentScore rubric bands used in the persona prompt. */
export const SENTIMENT_BANDS = [
  { label: "0–15", name: "Impossible", min: 0, max: 15 },
  { label: "16–30", name: "Strong rejection", min: 16, max: 30 },
  { label: "31–49", name: "Skeptical", min: 31, max: 49 },
  { label: "50–64", name: "Lukewarm", min: 50, max: 64 },
  { label: "65–79", name: "Interested", min: 65, max: 79 },
  { label: "80–100", name: "Enthusiastic", min: 80, max: 100 },
] as const;

/** All variant texts in order: [A, B, C…]. */
export function variantTexts(data: CustomerData): string[] {
  return [data.questionOrProductInfo ?? "", ...(data.alternativeVariants ?? [])];
}

/** Number of variants the personas answered (1 when not an A/B test). */
export function variantCount(personas: Persona[]): number {
  return 1 + (personas[0]?.alternatives?.length ?? 0);
}

/** The persona's response to variant `index` (0 = A). */
export function responseFor(persona: Persona, index: number): VariantResponse {
  if (index === 0) return persona;
  return persona.alternatives?.[index - 1] ?? persona;
}

export interface VariantStats {
  average: number;
  median: number;
  adopters: number;
  rejecters: number;
  total: number;
}

export function variantStats(personas: Persona[], index: number): VariantStats {
  const scores = personas.map((p) => responseFor(p, index).sentimentScore).sort((a, b) => a - b);
  const total = scores.length;
  if (total === 0) return { average: 0, median: 0, adopters: 0, rejecters: 0, total: 0 };
  const mid = Math.floor(total / 2);
  return {
    average: Math.round(scores.reduce((sum, s) => sum + s, 0) / total),
    median: total % 2 ? scores[mid] : Math.round((scores[mid - 1] + scores[mid]) / 2),
    adopters: scores.filter((s) => s >= ADOPTER_THRESHOLD).length,
    rejecters: scores.filter((s) => s < REJECTER_THRESHOLD).length,
    total,
  };
}
