// Markdown and CSV exports of a simulation, plus a download helper.
// (PDF export uses the browser's print dialog — see PrintReport.tsx.)
import type { SavedRun, SharedRun } from "./types";
import { ADOPTER_THRESHOLD, REJECTER_THRESHOLD, VARIANT_LETTERS, responseFor, variantCount, variantStats, variantTexts } from "./variants";

type ExportableRun = SharedRun & Partial<Pick<SavedRun, "chats">>;

function variantsOf(run: ExportableRun): string[] {
  return variantTexts(run.customerData).slice(0, variantCount(run.personas));
}

/** e.g. "marketmind-2026-09-24-would-you-pay-15-month" */
export function exportFileName(run: ExportableRun, extension: string): string {
  const date = run.createdAt.slice(0, 10);
  const slug = (run.customerData.questionOrProductInfo ?? "simulation")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "") || "simulation";
  return `marketmind-${date}-${slug}.${extension}`;
}

const DEMOGRAPHIC_LABELS: [keyof ExportableRun["customerData"], string][] = [
  ["ageRange", "Age range"],
  ["gender", "Gender"],
  ["habits", "Habits & lifestyle"],
  ["location", "Location"],
  ["incomeLevel", "Income level"],
];

const showDemographic = (value?: string) =>
  !value || value === "DIVERSE_RANDOM" ? "Diverse / random" : value;

export function toMarkdown(run: ExportableRun): string {
  const variants = variantsOf(run);
  const isAbTest = variants.length > 1;
  const lines: string[] = [];

  lines.push("# MarketMind AI — Simulated Focus Group", "");
  lines.push(`_Generated ${new Date(run.createdAt).toLocaleString()} · ${run.personas.length} AI-simulated personas. Results are a simulation, not real consumer research._`, "");

  lines.push("## Setup", "");
  for (const [key, label] of DEMOGRAPHIC_LABELS) {
    lines.push(`- **${label}:** ${showDemographic(run.customerData[key] as string | undefined)}`);
  }
  lines.push("");
  variants.forEach((text, i) => {
    lines.push(isAbTest ? `**Variant ${VARIANT_LETTERS[i]}:** ${text}` : `**Question / concept:** ${text}`, "");
  });

  lines.push("## Results", "");
  lines.push("| Variant | Average | Median | Likely adopters | Rejecters |", "|---|---|---|---|---|");
  variants.forEach((_, i) => {
    const s = variantStats(run.personas, i);
    lines.push(`| ${isAbTest ? VARIANT_LETTERS[i] : "—"} | ${s.average}/100 | ${s.median} | ${s.adopters}/${s.total} | ${s.rejecters}/${s.total} |`);
  });
  lines.push("", `_Likely adopters score ${ADOPTER_THRESHOLD}+; rejecters score below ${REJECTER_THRESHOLD}._`, "");

  lines.push("## Personas", "");
  run.personas.forEach((p, idx) => {
    lines.push(`### ${p.name} — ${p.age}, ${p.gender}, ${p.location}`, "");
    lines.push(`- **Income / job:** ${p.incomeLevel}`, `- **Lifestyle:** ${p.habits}`, `- **Background:** ${p.background}`, "");
    variants.forEach((_, v) => {
      const r = responseFor(p, v);
      const prefix = isAbTest ? `Variant ${VARIANT_LETTERS[v]} — ` : "";
      lines.push(`**${prefix}Score ${r.sentimentScore}/100**`, "");
      lines.push(`> ${r.answerToQuestion}`, "");
      lines.push(`Feedback: ${r.feedback}  `, `Keywords: ${r.keywords.map((k) => `#${k}`).join(" ")}`, "");
    });

    const transcript = run.chats?.[idx];
    if (transcript?.some((t) => t.role === "user")) {
      lines.push("**Interview transcript**", "");
      transcript.forEach((t) => lines.push(`- **${t.role === "user" ? "Interviewer" : p.name}:** ${t.text.replace(/\n+/g, " ")}`));
      lines.push("");
    }
  });

  lines.push("## Strategic report", "", run.report.trim(), "");
  return lines.join("\n");
}

// Byte-order mark so Excel opens UTF-8 (including Japanese) correctly
const BOM = String.fromCharCode(0xfeff);

/** Quotes a CSV cell and neutralises spreadsheet formula injection. */
function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** One row per persona; score/answer/feedback/keywords columns per variant. */
export function toCsv(run: ExportableRun): string {
  const variants = variantsOf(run);
  const suffix = (v: number) => (variants.length > 1 ? ` (${VARIANT_LETTERS[v]})` : "");

  const header = ["Name", "Age", "Gender", "Location", "Income / job", "Lifestyle", "Background"];
  variants.forEach((_, v) => {
    header.push(`Score${suffix(v)}`, `Answer${suffix(v)}`, `Feedback${suffix(v)}`, `Keywords${suffix(v)}`);
  });

  const rows = run.personas.map((p) => {
    const row: unknown[] = [p.name, p.age, p.gender, p.location, p.incomeLevel, p.habits, p.background];
    variants.forEach((_, v) => {
      const r = responseFor(p, v);
      row.push(r.sentimentScore, r.answerToQuestion, r.feedback, r.keywords.join("; "));
    });
    return row;
  });

  return BOM + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function downloadFile(filename: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
