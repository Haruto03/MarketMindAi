// Persona helpers shared by the browser app and the API server.
import type { ChatTurn, PanelPersona, Persona } from "./types";
import { VARIANT_LETTERS } from "./variants";

/** Strips a persona's answers, leaving who they are (for saved panels). */
export function toPanelPersona(p: Persona): PanelPersona {
  return {
    id: p.id,
    name: p.name,
    age: p.age,
    gender: p.gender,
    habits: p.habits,
    location: p.location,
    incomeLevel: p.incomeLevel,
    background: p.background,
  };
}

/** The persona's opening message in a 1-on-1 interview. */
export function greetingFor(persona: Persona, variants: string[]): ChatTurn {
  const question = variants[0] || "your product concept";
  const others = (persona.alternatives ?? [])
    .map((alt, i) => `Variant ${VARIANT_LETTERS[i + 1]}: ${alt.sentimentScore}/100`)
    .join(", ");
  return {
    role: "model",
    text: `Hi there! I'm ${persona.name} (${persona.age} y/o from ${persona.location}). I participated in your focus group. \n\nIn response to your query "${question}", I felt:\n*"${persona.answerToQuestion}"*\n\nI'm ready! Chat with me to learn more about my background, routine, motivations, or why I gave a sentiment score of ${persona.sentimentScore}/100${others ? ` (and ${others})` : ""}.`,
  };
}
