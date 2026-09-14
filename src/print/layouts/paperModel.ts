import type { LanguagePaperDetail, LanguagePaperQuestion } from "../../api/client";
import type { BilingualQuestionPair } from "./types";

/** Per-language labels used in the printed header meta row. */
export const META_LABELS: Record<string, { subject: string; cls: string; time: string; marks: string }> = {
  en: { subject: "Subject", cls: "Class", time: "Time Allowed", marks: "Total Marks" },
  gu: { subject: "વિષય", cls: "ધોરણ", time: "સમય મર્યાદા", marks: "કુલ ગુણ" },
  hi: { subject: "विषय", cls: "कक्षा", time: "समय सीमा", marks: "कुल अंक" },
};

/** Default per-language general instructions printed when none are supplied. */
export const DEFAULT_INSTRUCTIONS: Record<string, string[]> = {
  en: [
    "1. All questions are compulsory.",
    "2. Figures to the right indicate full marks.",
    "3. Attempt every question in the language in which it is set.",
  ],
  gu: [
    "1. બધા જ પ્રશ્નો ફરજિયાત છે.",
    "2. જમણી બાજુની સંખ્યા પૂર્ણ ગુણ દર્શાવે છે.",
    "3. દરેક પ્રશ્ન જે ભાષામાં છે તે જ ભાષામાં જવાબ આપો.",
  ],
  hi: [
    "1. सभी प्रश्न अनिवार्य हैं।",
    "2. दाईं ओर की संख्या पूर्ण अंक दर्शाती है।",
    "3. प्रत्येक प्रश्न का उत्तर उसी भाषा में दें जिस भाषा में प्रश्न है।",
  ],
};

/** Structurally safe language code for one column (falls back to "en"). */
export function languageCode(detail: LanguagePaperDetail | undefined): string {
  if (!detail) return "en";
  if (typeof detail.language === "object" && detail.language) {
    return detail.language.code ?? "en";
  }
  return detail.language || "en";
}

/** Display name for one column's language. */
export function languageName(detail: LanguagePaperDetail | undefined): string {
  if (!detail) return "Language";
  if (typeof detail.language === "object" && detail.language) {
    return detail.language.name || detail.language.code || "Language";
  }
  return detail.language || "Language";
}

/** Typical rendered section heading for a section key in one language. */
export function sectionNameOf(detail: LanguagePaperDetail | undefined, key: string | null): string {
  if (!key || key === "__default__") return "Questions";
  if (detail) {
    const found = (detail.sections ?? []).find((s) => s.key === key);
    if (found?.name) return found.name;
  }
  return key;
}

/**
 * Sits two resolved language papers side by side. Rows are driven by the union of
 * question numbers so that both columns always stay synchronized on the SAME
 * logical question — no independent selection per language.
 */
export function buildPairs(left: LanguagePaperDetail, right?: LanguagePaperDetail): BilingualQuestionPair[] {
  const leftMap = indexByNumber(left);
  const rightMap = right ? indexByNumber(right) : new Map<number, LanguagePaperQuestion>();

  const numbers = Array.from(new Set([...leftMap.keys(), ...rightMap.keys()])).sort((a, b) => a - b);

  return numbers.map((number) => {
    const l = leftMap.get(number) ?? null;
    const r = rightMap.get(number) ?? null;
    const representative = l ?? r;
    return {
      number,
      familyId: representative?.family_id ?? null,
      marks: representative?.marks ?? 0,
      negativeMarks: representative?.negative_marks ?? 0,
      sectionKey: representative?.section_key ?? null,
      left: l,
      right: r,
    };
  });
}

function indexByNumber(detail: LanguagePaperDetail): Map<number, LanguagePaperQuestion> {
  const map = new Map<number, LanguagePaperQuestion>();
  for (const q of [...(detail.questions ?? []), ...(detail.missing ?? [])]) {
    if (!map.has(q.number)) map.set(q.number, q);
  }
  return map;
}

/** One side's display options (resolved by the backend when a variant was resolved). */
export interface DisplayOption {
  label: string;
  content: unknown;
}

export function displayOptionsOf(q: LanguagePaperQuestion | null | undefined): DisplayOption[] {
  if (!q) return [];
  if (q.displayOptions && q.displayOptions.length > 0) {
    return q.displayOptions.map((o) => ({ label: o.label, content: o.content }));
  }
  const variant = q.question;
  if (variant && Array.isArray(variant.options) && variant.options.length > 0) {
    return variant.options.map((o) => ({ label: o.label, content: o.content }));
  }
  return [];
}