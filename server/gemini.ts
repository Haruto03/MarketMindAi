import { GoogleGenAI, Type } from "@google/genai";
import { DIVERSE_RANDOM, type ChatTurn, type CustomerData, type PanelPersona, type Persona, type VariantResponse } from "../src/lib/types";
import { VARIANT_LETTERS, variantCount, variantStats, variantTexts } from "../src/lib/variants";

// Server-only module: the API key is read from the server's environment and
// never reaches the browser bundle.
let aiClient: GoogleGenAI | null = null;

export function getGemini() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// All field names that must be present on every AI-generated Persona object
const REQUIRED_PERSONA_KEYS: ReadonlyArray<keyof Persona> = [
  'id', 'name', 'age', 'gender', 'habits', 'location',
  'incomeLevel', 'sentimentScore', 'background',
  'answerToQuestion', 'feedback', 'keywords',
];

const REQUIRED_RESPONSE_KEYS: ReadonlyArray<keyof VariantResponse> = [
  'sentimentScore', 'answerToQuestion', 'feedback', 'keywords',
];

/**
 * Validates the response fields shared by a persona and each of its
 * A/B alternatives. The score is coerced and clamped to 0–100.
 */
function validateResponse(obj: Record<string, unknown>, where: string): VariantResponse {
  for (const key of REQUIRED_RESPONSE_KEYS) {
    if (obj[key] === null || obj[key] === undefined) {
      throw new Error(`${where} is missing required field: "${key}".`);
    }
  }

  const rawSentiment = Number(obj.sentimentScore);
  if (isNaN(rawSentiment)) {
    throw new Error(
      `${where}: "sentimentScore" must be numeric, received "${obj.sentimentScore}".`
    );
  }

  // Coerce keywords to string array; fall back to [] if the field is malformed
  const keywords: string[] = Array.isArray(obj.keywords)
    ? (obj.keywords as unknown[]).map(String)
    : [];

  return {
    sentimentScore: Math.min(100, Math.max(0, Math.round(rawSentiment))),
    answerToQuestion: String(obj.answerToQuestion),
    feedback: String(obj.feedback),
    keywords,
  };
}

/**
 * Validates a single raw AI-returned value as a complete, well-typed Persona
 * with exactly `alternativeCount` A/B alternatives.
 * Throws a descriptive error if any required field is absent, null, or carries
 * an incompatible type. Numeric fields are coerced and clamped to their
 * expected ranges so downstream rendering never receives NaN or out-of-range values.
 */
export function validatePersona(raw: unknown, index: number, alternativeCount = 0): Persona {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Persona at index ${index} is not a valid object.`);
  }

  const obj = raw as Record<string, unknown>;

  for (const key of REQUIRED_PERSONA_KEYS) {
    if (obj[key] === null || obj[key] === undefined) {
      throw new Error(
        `Persona at index ${index} is missing required field: "${key}".`
      );
    }
  }

  const rawAge = Number(obj.age);
  if (isNaN(rawAge)) {
    throw new Error(
      `Persona at index ${index}: "age" must be numeric, received "${obj.age}".`
    );
  }

  const persona: Persona = {
    id: Number(obj.id),
    name: String(obj.name),
    age: rawAge,
    gender: String(obj.gender),
    habits: String(obj.habits),
    location: String(obj.location),
    incomeLevel: String(obj.incomeLevel),
    background: String(obj.background),
    ...validateResponse(obj, `Persona at index ${index}`),
  };

  if (alternativeCount > 0) {
    const alternatives = obj.alternatives;
    if (!Array.isArray(alternatives) || alternatives.length !== alternativeCount) {
      throw new Error(
        `Persona at index ${index} must have exactly ${alternativeCount} variant response(s).`
      );
    }
    persona.alternatives = alternatives.map((alt, i) => {
      if (typeof alt !== 'object' || alt === null) {
        throw new Error(`Persona at index ${index}: variant ${VARIANT_LETTERS[i + 1]} is not a valid object.`);
      }
      return validateResponse(alt as Record<string, unknown>, `Persona at index ${index}, variant ${VARIANT_LETTERS[i + 1]}`);
    });
  }

  return persona;
}

const responseProperties = {
  sentimentScore:   { type: Type.INTEGER, description: "Adoption likelihood 0-100 based STRICTLY on the persona's realistic circumstances (age, income, values, lifestyle) — NOT on their tone of speech or writing style. 0=fundamental impossibility (e.g. child asked about adult luxury, wrong demographic, unaffordable, core value conflict). 100=enthusiastic high-probability adopter. The answerToQuestion and feedback texts MUST be emotionally consistent with this score." },
  answerToQuestion: { type: Type.STRING,  description: "Their direct, personalized answer responding to the developer's specific Question / Product Info." },
  feedback:         { type: Type.STRING,  description: "Unfiltered review or thought regarding the product and its pricing/value (MUST be approximately 20 words)." },
  keywords:         { type: Type.ARRAY,   description: "Exactly 3 thematic tags summarizing their thoughts.", items: { type: Type.STRING } },
};

function personaResponseSchema(alternativeCount: number) {
  const required = [
    "id", "name", "age", "gender", "habits", "location",
    "incomeLevel", "background", ...Object.keys(responseProperties),
  ];
  const properties: Record<string, unknown> = {
    id:               { type: Type.INTEGER, description: "Random 5-digit id." },
    name:             { type: Type.STRING,  description: "Realistic fictional first name and last initial." },
    age:              { type: Type.INTEGER, description: "Fictional age aligned with parameters." },
    gender:           { type: Type.STRING,  description: "Fictional gender identity." },
    habits:           { type: Type.STRING,  description: "Brief summary of lifestyle, routine, and habits." },
    location:         { type: Type.STRING,  description: "City or region." },
    incomeLevel:      { type: Type.STRING,  description: "Income bracket or job description." },
    background:       { type: Type.STRING,  description: "Individual background information and psychological persona profile." },
    ...responseProperties,
  };

  if (alternativeCount > 0) {
    required.push("alternatives");
    properties.alternatives = alternativesProperty(alternativeCount);
  }

  return {
    type: Type.ARRAY,
    description: "List of exactly 10 simulated focus group participant personas.",
    items: { type: Type.OBJECT, required, properties },
  };
}

function alternativesProperty(alternativeCount: number) {
  return {
    type: Type.ARRAY,
    description: `This same persona's independent reaction to each A/B variant after Variant A, in order (${VARIANT_LETTERS.slice(1, alternativeCount + 1).join(", ")}). The top-level score/answer/feedback/keywords are the reaction to Variant A.`,
    minItems: String(alternativeCount),
    maxItems: String(alternativeCount),
    items: {
      type: Type.OBJECT,
      required: Object.keys(responseProperties),
      properties: responseProperties,
    },
  };
}

/** Schema for a re-used panel: only the answers, keyed by each participant's id. */
function panelResponseSchema(alternativeCount: number, size: number) {
  const required = ["id", ...Object.keys(responseProperties)];
  const properties: Record<string, unknown> = {
    id: { type: Type.INTEGER, description: "The participant's id, copied exactly from the panel list." },
    ...responseProperties,
  };
  if (alternativeCount > 0) {
    required.push("alternatives");
    properties.alternatives = alternativesProperty(alternativeCount);
  }
  return {
    type: Type.ARRAY,
    description: `Exactly ${size} responses, one per panel participant, in the same order as the panel list.`,
    items: { type: Type.OBJECT, required, properties },
  };
}

/**
 * Resolves a single demographic field for the prompt.
 *
 * • User-supplied value  → use it verbatim (all 10 personas share the constraint).
 * • DIVERSE_RANDOM       → inject a per-field diversity directive so the LLM
 *                           scatters that attribute across the full spectrum.
 * • Empty / undefined    → same as DIVERSE_RANDOM (defensive fallback).
 */
function resolveField(
  value: string | undefined,
  diverseDirective: string,
  plainFallback: string,
): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === DIVERSE_RANDOM) return diverseDirective;
  return trimmed;
}

// Shared by new-panel and re-used-panel prompts so scores stay comparable.
const SCORING_RULES = `═══════════════════════════════════════════════════════════════════
  SENTIMENTSCORE — MANDATORY CALIBRATION RULES
═══════════════════════════════════════════════════════════════════

⚠️  THE SINGLE MOST IMPORTANT RULE IN THIS ENTIRE PROMPT:
    "sentimentScore" measures REALISTIC ADOPTION LIKELIHOOD based on the
    persona's actual circumstances — NOT the energy, friendliness, or
    expressiveness of their language.

    TONE OF VOICE  ≠  ADOPTION LIKELIHOOD
    A persona who says "No way! That's insane!" with energy and humour
    is still rejecting the product. Their score must be near 0.
    Friendliness of speech is completely irrelevant to the score.

── SCORING RUBRIC ──────────────────────────────────────────────────

  0 – 15  │ FUNDAMENTAL IMPOSSIBILITY
           │ The persona has zero realistic path to adopting this product.
           │ Required triggers (any one is sufficient for this band):
           │   • Product is financially orders of magnitude beyond their means
           │   • Persona is a child/minor being asked about an adult product
           │   • Product directly conflicts with core identity or values
           │   • Product physically cannot apply to their life situation
           │ → Score here even if the persona's tone is cheerful or curious.

  16 – 30 │ STRONG REJECTION
           │ Major financial, lifestyle, or values-based barrier.
           │ Would not seriously consider the product under current circumstances.
           │ Conversion requires a complete change in their life situation.

  31 – 49 │ SKEPTICAL / CONDITIONAL
           │ Significant concerns exist. Might reconsider only if price dropped
           │ dramatically, features changed substantially, or their life changed.

  50 – 64 │ LUKEWARM / MIXED
           │ Genuine but hesitant interest. Real appeal alongside notable friction.
           │ Could be converted with strong marketing or pricing adjustments.

  65 – 79 │ INTERESTED / LOW BARRIER
           │ Genuinely open to this product. Minor concerns only.
           │ Leans toward adoption but not fully committed yet.

  80 – 100 │ ENTHUSIASTIC ADOPTER
            │ Strong resonance. High likelihood of purchase or recommendation.
            │ The product fits this persona's life almost perfectly.

── SCORE-FIRST DERIVATION WORKFLOW ────────────────────────────────
   Follow this order for EVERY persona before writing a single word of text:

   STEP 1 — CIRCUMSTANCE AUDIT
            Ask yourself honestly:
            "Can this specific persona — given their age, income level,
             lifestyle, and personal values — realistically adopt this product?"
            Consider financial feasibility, life-stage fit, and value alignment.

   STEP 2 — ASSIGN THE SCORE
            Select a sentimentScore using the rubric above, based solely
            on your Step 1 assessment.
            Do NOT adjust the score upward because you intend to write
            an energetic or friendly persona voice.

   STEP 3 — WRITE CONSISTENT TEXT
            Write "answerToQuestion" and "feedback" so the emotional
            register of the text MATCHES the score you already assigned:
            → Score  0–15  : language must convey impossibility or complete rejection
            → Score 16–30  : language must convey clear reluctance or refusal
            → Score 31–49  : language must convey skepticism and significant doubts
            → Score 50–64  : language must convey mixed interest with real reservations
            → Score 65–79  : language must convey genuine, cautious interest
            → Score 80–100 : language must convey clear enthusiasm and intent to adopt

── CONCRETE EXAMPLES (right vs. wrong) ────────────────────────────

  SCENARIO A: A 10-year-old child asked about a $1,000,000 luxury property.

  ❌ WRONG — score does not match reality:
     answerToQuestion : "Whoa, a million dollar house?! That's SO cool!
                         My bedroom would be huge! I'd put a slide in it!"
     sentimentScore   : 68
     WHY WRONG: The child's imaginative excitement is being confused with
     adoption likelihood. A 10-year-old cannot purchase property. Score
     must reflect the fundamental impossibility, not the tone of the voice.

  ✓  CORRECT — score reflects actual circumstances:
     answerToQuestion : "That house looks amazing! But there is no way I
                         could ever buy it — I only get $5 pocket money a
                         week. Maybe when I'm a grown-up? But a million
                         dollars... that's like winning the lottery."
     sentimentScore   : 5
     WHY CORRECT: The persona can be imaginative and warm in voice while
     the score reflects the cold reality of financial impossibility.

  SCENARIO B: A committed vegan asked about a premium meat subscription box.

  ❌ WRONG — score does not match values conflict:
     feedback       : "The farm-to-table story is interesting, but the
                       meat aspect is a dealbreaker for me personally."
     sentimentScore : 52
     WHY WRONG: A "dealbreaker" rooted in core identity cannot produce 52.
     The score must reflect the depth of the values conflict.

  ✓  CORRECT — score reflects the values conflict:
     feedback       : "Ethically impossible for me. No amount of premium
                       branding changes what this product fundamentally is."
     sentimentScore : 4
     WHY CORRECT: Core identity conflict = near-zero adoption likelihood.

`;

/** Extra prompt section for A/B tests; empty when only one variant is given. */
function buildAbTestBlock(data: CustomerData): string {
  const variants = variantTexts(data);
  if (variants.length < 2) return '';

  const list = variants
    .map((text, i) => `  VARIANT ${VARIANT_LETTERS[i]}: ${text}`)
    .join('\n');
  const altLetters = VARIANT_LETTERS.slice(1, variants.length).join(', ');

  return `
═══════════════════════════════════════════════════════════════════
  A/B TEST — ${variants.length} VARIANTS SHOWN TO THE SAME PERSONAS
═══════════════════════════════════════════════════════════════════
${list}

  • The QUESTION / PRODUCT INFO above is VARIANT A.
  • Every persona sees EVERY variant. The top-level sentimentScore,
    answerToQuestion, feedback and keywords are their reaction to VARIANT A.
  • "alternatives" must contain their reaction to variant ${altLetters}, in that order.
  • Score each variant INDEPENDENTLY with the same rubric below. The same
    persona may love one variant and reject another — differences in price,
    features, or messaging must move the score realistically. Do not copy
    the Variant A score by default.
  • Each variant's answerToQuestion should respond to THAT variant and may
    compare it to the others where natural.
`;
}

function buildPersonaPrompt(data: CustomerData): string {
  // ── Per-field diversity directives ─────────────────────────────────────
  // Each one tells the LLM exactly how to spread a single dimension across
  // the 10-persona cohort. Being explicit prevents the model from
  // defaulting to a narrow "safe" cluster.
  const ageDirective =
    '🔀 DIVERSE_RANDOM — You MUST spread ages across the full human lifespan: ' +
    'include at least one child/teen (8–17), young adults (18–29), ' +
    'middle-aged adults (30–54), and seniors (55+). ' +
    'No two personas should share the same age bracket.';

  const genderDirective =
    '🔀 DIVERSE_RANDOM — You MUST vary gender representation: ' +
    'include a realistic mix of male, female, and non-binary identities across the 10 personas.';

  const habitsDirective =
    '🔀 DIVERSE_RANDOM — You MUST assign sharply contrasting lifestyles: ' +
    'mix tech-savvy early adopters, outdoor enthusiasts, homebodies, ' +
    'fitness-focused individuals, budget-conscious shoppers, luxury seekers, ' +
    'creatives, remote workers, students, and retirees. ' +
    'No two personas should have similar lifestyle profiles.';

  const locationDirective =
    '🔀 DIVERSE_RANDOM — You MUST scatter geographic backgrounds: ' +
    'include major global cities, mid-size towns, suburban areas, and rural regions ' +
    'across different countries/continents. Ensure geographic and cultural diversity.';

  const incomeDirective =
    '🔀 DIVERSE_RANDOM — You MUST distribute income levels across the full economic spectrum: ' +
    'include poverty/student-level, lower-middle, middle, upper-middle, and high-income personas. ' +
    'At least one persona should face genuine financial constraints for the product.';

  const resolvedAge      = resolveField(data.ageRange,    ageDirective,      'No specific constraint (please simulate a broad age cohort)');
  const resolvedGender   = resolveField(data.gender,      genderDirective,   'No specific constraint (simulate diverse representation)');
  const resolvedHabits   = resolveField(data.habits,      habitsDirective,   'Complement dynamically with realistic consumer lifestyles');
  const resolvedLocation = resolveField(data.location,    locationDirective, 'Complement with standard suburban/urban locations');
  const resolvedIncome   = resolveField(data.incomeLevel, incomeDirective,   'Complement with standard household income metrics');

  // Count how many fields are in wildcard mode so we can inject a top-level reminder
  const wildcardFields = [data.ageRange, data.gender, data.habits, data.location, data.incomeLevel]
    .filter(v => !v?.trim() || v.trim() === DIVERSE_RANDOM);
  const wildcardBlock = wildcardFields.length > 0
    ? `
═══════════════════════════════════════════════════════════════════
  ⚡ TOTAL COHORT DIVERSITY MODE  (${wildcardFields.length} of 5 fields randomised)
═══════════════════════════════════════════════════════════════════
  Fields marked 🔀 DIVERSE_RANDOM below are in WILDCARD mode.
  For every such field you are STRICTLY PROHIBITED from clustering
  personas into a single category. You MUST maximise demographic
  variance: each persona should differ meaningfully from the others
  on EVERY wildcard dimension.

  The resulting 10-persona cohort must represent the WIDEST possible
  spectrum of humanity relevant to the product concept.
`
    : '';

  return `You are an advanced market research focus group simulator.
Based on the provided demographic parameters below, generate EXACTLY 10 distinct, highly realistic fictional consumer personas.
Simulate their unique lifestyle details, and their unfiltered reactions to the product concept and developer's specific question.
${wildcardBlock}
═══════════════════════════════════════════════════════════════════
  SIMULATION CONFIGURATION
═══════════════════════════════════════════════════════════════════
- TARGET AGE RANGE        : ${resolvedAge}
- TARGET GENDER           : ${resolvedGender}
- HABITS / LIFESTYLE      : ${resolvedHabits}
- LOCATION                : ${resolvedLocation}
- INCOME LEVEL            : ${resolvedIncome}
- QUESTION / PRODUCT INFO : ${data.questionOrProductInfo || 'General product concept evaluation'}
${buildAbTestBlock(data)}
${SCORING_RULES}═══════════════════════════════════════════════════════════════════
  PERSONA GENERATION INSTRUCTIONS
═══════════════════════════════════════════════════════════════════

Fill in realistic fictional names (e.g., "Sarah M.", "Liam K."), exact ages,
and robust background details that fit the simulation parameters above.

CRITICAL — "feedback" field:
  Must be the persona's honest, blunt, unfiltered reaction to the product
  (approximately 20 words). The emotional tone of this text must match the
  sentimentScore: low scores → dismissive, skeptical, or impossible tone;
  high scores → enthusiastic, positive tone. Never mismatch the two.

CRITICAL — "answerToQuestion" field:
  Must be the persona's direct, highly detailed response to the specific
  QUESTION / PRODUCT INFO provided above. This answer must be fully
  consistent with the assigned sentimentScore. A score below 30 requires
  clear language of reluctance, rejection, or inability — regardless of
  how warm or conversational the persona's voice is.
`;
}

/** Prompt for re-using a saved panel: the people are fixed, only their answers are new. */
function buildPanelPrompt(data: CustomerData, panel: PanelPersona[]): string {
  const participants = panel
    .map((p) => `- id ${p.id}: ${p.name}, ${p.age}, ${p.gender}, ${p.location}. Income/job: ${p.incomeLevel}. Lifestyle: ${p.habits}. Background: ${p.background}`)
    .join('\n');

  return `You are an advanced market research focus group simulator.
You are re-convening an EXISTING panel of ${panel.length} consumers who have taken part in earlier
sessions. Do NOT invent new people and do NOT change who they are — answer as each of
these exact participants, consistent with their age, income, lifestyle, values and background.

═══════════════════════════════════════════════════════════════════
  PANEL PARTICIPANTS (fixed)
═══════════════════════════════════════════════════════════════════
${participants}

═══════════════════════════════════════════════════════════════════
  TODAY'S QUESTION / PRODUCT INFO
═══════════════════════════════════════════════════════════════════
${data.questionOrProductInfo || 'General product concept evaluation'}
${buildAbTestBlock(data)}
${SCORING_RULES}═══════════════════════════════════════════════════════════════════
  RESPONSE INSTRUCTIONS
═══════════════════════════════════════════════════════════════════

Return exactly one response per participant, in the order listed, copying each
participant's id exactly.

CRITICAL — "feedback" field:
  The participant's honest, blunt, unfiltered reaction (approximately 20 words),
  emotionally consistent with their sentimentScore.

CRITICAL — "answerToQuestion" field:
  Their direct, detailed answer to TODAY'S QUESTION, grounded in their profile
  and consistent with their sentimentScore.
`;
}

/** Parses the model's JSON array output, tolerating stray markdown fences. */
function parseJsonArray(rawText: string): unknown[] {
  const cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

  // Parse JSON in a dedicated try/catch so we can give a clear error message
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanText);
  } catch (parseError) {
    console.error("JSON Parse Failure in Pipeline:", parseError, rawText);
    throw new Error(
      "Failed to parse data from AI. This is likely a temporary generation error from Gemini, please try again."
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("AI returned an empty or non-array response.");
  }
  return parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 – Non-streaming (used internally to get full persona JSON first)
// thinkingBudget: 0  — JSON schema generation needs no deep reasoning
// ─────────────────────────────────────────────────────────────────────────────
// When `panel` is given, the same people answer again (persona re-use) and
// only their responses are generated.
export async function generatePersonaBatch(data: CustomerData, panel?: PanelPersona[]): Promise<Persona[]> {
  const ai = getGemini();
  const alternativeCount = data.alternativeVariants?.length ?? 0;
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: panel ? buildPanelPrompt(data, panel) : buildPersonaPrompt(data),
    config: {
      temperature: 0.82,
      responseMimeType: "application/json",
      responseSchema: panel
        ? panelResponseSchema(alternativeCount, panel.length)
        : personaResponseSchema(alternativeCount),
      thinkingConfig: { thinkingBudget: 1024 }, // ✅ Light thinking ON — reasoning budget needed for score-to-circumstance alignment
    },
  });

  const parsed = parseJsonArray(response.text ?? "");

  if (!panel) {
    // Validate every persona — throws immediately on the first structural problem
    return parsed.map((item, index) => validatePersona(item, index, alternativeCount));
  }

  // Attach each answer to its panel participant: match by id first, then give
  // any unmatched answers to the unmatched participants in order, so no answer
  // is used twice. The stored profile always wins, so the model cannot alter
  // who a participant is.
  const answers = parsed.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null);
  const used = new Set<Record<string, unknown>>();
  const assigned = panel.map((person) => {
    const match = answers.find((r) => !used.has(r) && r.id === person.id);
    if (match) used.add(match);
    return match;
  });
  const leftovers = answers.filter((r) => !used.has(r));

  return panel.map((person, index) => {
    const answer = assigned[index] ?? leftovers.shift();
    if (!answer) {
      throw new Error(`AI returned no response for panel participant ${person.name}.`);
    }
    return validatePersona({ ...answer, ...person }, index, alternativeCount);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 – Streaming report generation
// thinkingBudget: 1024 — Keep light reasoning for macro synthesis quality
// Calls onChunk(delta) for every streamed token, resolves with full text.
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzePersonaDataStream(
  personas: Persona[],
  data: CustomerData,
  onChunk: (delta: string) => void
): Promise<string> {
  const ai = getGemini();
  const question = data.questionOrProductInfo ?? "";
  const variants = variantTexts(data).slice(0, variantCount(personas));
  const isAbTest = variants.length > 1;

  // Pre-computed so the model reports the real numbers instead of estimating them
  const abTestSection = isAbTest
    ? `
## 5. A/B Variant Comparison & Recommendation
The same personas evaluated ${variants.length} variants:
${variants.map((text, i) => {
  const s = variantStats(personas, i);
  return `- VARIANT ${VARIANT_LETTERS[i]}: "${text}" — average score ${s.average}/100, median ${s.median}, likely adopters (score ≥ 65) ${s.adopters}/${s.total}, rejecters (score < 31) ${s.rejecters}/${s.total}`;
}).join("\n")}
Use exactly these figures. Name the winning variant (or state clearly if the result is too close to call), explain WHICH personas switched their reaction between variants and WHY, and recommend what to test next. In sections 2 and 3, the per-persona answers refer to Variant A; each persona's "alternatives" array holds their reactions to Variant ${VARIANT_LETTERS.slice(1, variants.length).join(", ")}.
`
    : "";

  const prompt = `You are MarketMind, a preeminent AI marketing strategist and consumer psychologist.
We have successfully simulated empirical focus group interviews with a cohort of ${personas.length} unique consumer personas.

Based on the empirical simulation data below, compile a comprehensive and rigorous strategic report structured EXACTLY into these ${isAbTest ? 5 : 4} sections:

## 1. Fictional Focus Group Profiles & Backgrounds
Describe the background/lifestyle of each of the 10 personas based on the simulation metadata. Offer distinct profiles for readers to understand their lives.

## 2. Dynamic Focus Group Responses to the Specific Question
Provide a breakdown of what each of the 10 personas answered to our custom question/product info: "${question || 'General product concept feedback'}". Ensure answers reflect their backgrounds.

## 3. Product Concept Resonance & Feedback
Deliver a breakdown of each persona's direct response/enthusiasm towards the overarching product concept, detailing sentiment and barriers.

## 4. Aggregate Macro-Level Synthesis & Recommendations
Provide an in-depth, expert strategic evaluation synthesizing all 10 responses. Highlight patterns, segment motivations, and outline actionable pivots for positioning, pricing, and adoption.
${abTestSection}
Here is the raw dataset from the simulated focus group:
${JSON.stringify(personas)}
`;

  const stream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 1024 }, // ✅ Light thinking ON — better macro synthesis
    },
  });

  let fullText = "";
  for await (const chunk of stream) {
    const delta = chunk.text ?? "";
    if (delta) {
      fullText += delta;
      onChunk(delta);
    }
  }
  return fullText;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 – Chat (1-on-1 interview)
// thinkingBudget: 0 — Conversational roleplay; speed >> deep reasoning
// Return type is explicitly Promise<string>; callers never need a null-guard.
// ─────────────────────────────────────────────────────────────────────────────
export async function chatWithPersona(
  history: ChatTurn[],
  newMessage: string,
  persona: Persona,
  variants: string[]
): Promise<string> {
  const ai = getGemini();

  const contents = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }],
  }));
  contents.push({ role: "user", parts: [{ text: newMessage }] });

  const question = variants[0] ?? "";
  const alternativesContext = (persona.alternatives ?? [])
    .map((alt, i) => {
      const letter = VARIANT_LETTERS[i + 1];
      return `You were also shown VARIANT ${letter} ("${variants[i + 1] ?? ""}"). Your adoption likelihood for it was ${alt.sentimentScore}/100. Your answer: ${alt.answerToQuestion} Your feedback: ${alt.feedback}`;
    })
    .join("\n");

  const systemInstruction = `You are roleplaying as simulated retail consumer "${persona.name}" (Age: ${persona.age}, Gender: ${persona.gender}, Location: ${persona.location}).
Your Habits/Lifestyle: ${persona.habits}
Your Income Level/Job: ${persona.incomeLevel}
Your Profile Background: ${persona.background}
Your Feedback on the Overarching Product: ${persona.feedback}
Your initial answer to the developer's question/product proposal${alternativesContext ? " (VARIANT A)" : ""} ("${question}"): ${persona.answerToQuestion}
${alternativesContext}

CRITICAL RULES:
1. Speak in the first person ("I", "my") and communicate as this realistic everyday person.
2. Be completely authentic, conversational, and direct. Do NOT speak like a robotic assistant or an AI. Avoid overly technical jargon unless it fits your profile.
3. Express your real, unfiltered consumer perspective. If you are skeptical about pricing or subscription models, say so.
4. Keep answers brief, natural, and friendly (1 to 3 sentences usually) like in a text-based interview or message chat context.
5. Ground your answers in your assigned lifestyle background and opinions.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction,
      temperature: 0.8,
      thinkingConfig: { thinkingBudget: 0 }, // ✅ Thinking OFF — roleplay chat needs speed
    },
  });

  // Nullish coalescing guarantees a string is always returned to callers
  return response.text ?? "";
}
