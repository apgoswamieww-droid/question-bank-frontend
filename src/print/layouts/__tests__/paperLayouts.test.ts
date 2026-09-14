import { describe, expect, it } from "vitest";
import { buildPairs, displayOptionsOf, languageCode, sectionNameOf } from "../paperModel";
import { getPaperLayout } from "../registry";
import { coerceTiptap } from "../contentModel";
import type { LanguagePaperDetail, LanguagePaperQuestion } from "../../../api/client";

function question(number: number, familyId: string, marks = 2, section_key: string | null = null): LanguagePaperQuestion {
  return {
    family_id: familyId,
    number,
    sort_order: number,
    marks,
    negative_marks: 0,
    section_key,
    resolved_language_id: "en",
    substituted: false,
    translation_status: "approved",
    invariant_issues: [],
    content_hash: "abc",
    question: null,
    answer: null,
    displayOptions: null,
  };
}

function detail(
  rows: LanguagePaperQuestion[],
  language = "en",
  sections: { key: string; name: string; negativeMarks?: number; questionCount?: number }[] = []
): LanguagePaperDetail {
  return {
    paper: { id: "p1", title: "Maths Test", description: null, duration_min: 60, total_marks: 40, status: "published" },
    language: language === "en" ? { id: "l-en", code: "en", name: "English" } : { id: "l-gu", code: "gu", name: "Gujarati" },
    version: 1,
    status: "generated",
    generated_at: "2026-01-01",
    set_key: null,
    complete: true,
    missing_count: 0,
    substituted_count: 0,
    sections: sections.map((s) => ({ key: s.key, name: s.name, negativeMarks: s.negativeMarks ?? 0, questionCount: s.questionCount ?? 0 })),
    sectionInstructions: {},
    questions: rows,
    missing: [],
  };
}

describe("buildPairs — bilingual question synchronization", () => {
  it("pairs questions by number so both columns show the SAME logical question", () => {
    const left = detail([
      question(1, "f1", 2, "A"),
      question(2, "f2", 3, "A"),
      question(3, "f3", 1, "B"),
    ]);
    const right = detail([
      question(2, "f2", 3, "A"),
      question(3, "f3", 1, "B"),
      question(4, "f4", 2, "B"),
    ]);

    const pairs = buildPairs(left, right);

    expect(pairs.map((p) => p.number)).toEqual([1, 2, 3, 4]);
    // Same logical question on both sides.
    expect(pairs[1].left?.family_id).toBe("f2");
    expect(pairs[1].right?.family_id).toBe("f2");
    // One-sided numbers fall back to the present side and stay visible.
    expect(pairs[0].left?.family_id).toBe("f1");
    expect(pairs[0].right).toBeNull();
    expect(pairs[3].left).toBeNull();
    expect(pairs[3].right?.family_id).toBe("f4");
    // Marks come from the logical question, not the column.
    expect(pairs[1].marks).toBe(3);
    // Section carried through.
    expect(pairs[2].sectionKey).toBe("B");
  });

  it("keeps master order and never re-selects questions independently", () => {
    const left = detail([question(1, "f1"), question(2, "f2"), question(3, "f3")]);
    const right = detail([question(1, "transl-1"), question(2, "transl-2"), question(3, "transl-3")]);
    const pairs = buildPairs(left, right);
    expect(pairs.map((p) => p.number)).toEqual([1, 2, 3]);
    pairs.forEach((p) => expect(p.left?.family_id).not.toBe(p.right?.family_id)); // translations differ
  });

  it("synchronizes even when one language has missing/unresolved rows", () => {
    const left = detail([question(1, "f1"), question(2, "f2")]);
    const leftMissing: LanguagePaperQuestion = { ...question(3, "f3"), question: null, translation_status: "missing" };
    const leftWithMissing = detail([...left.questions, leftMissing]);
    const right = detail([question(1, "f1-t"), question(2, "f2-t")]);
    const pairs = buildPairs(leftWithMissing, right);
    expect(pairs.map((p) => p.number)).toEqual([1, 2, 3]);
    expect(pairs[2].left).toBe(leftWithMissing.questions[2]);
    expect(pairs[2].left?.question).toBeNull();
    expect(pairs[2].right).toBeNull();
  });
});

describe("layout engine registry", () => {
  it("exposes the two shipped layouts and a custom hook", () => {
    const single = getPaperLayout("single-column");
    const bilingual = getPaperLayout("bilingual-two-column");
    const custom = getPaperLayout("custom");
    expect(single?.columns).toBe(1);
    expect(bilingual?.columns).toBe(2);
    expect(bilingual?.kind).toBe("bilingual");
    expect(custom).toBeDefined();
    expect(getPaperLayout("something-else" as never)).toBeUndefined();
  });
});

describe("rich text coercion", () => {
  it("accepts Tiptap doc JSON", () => {
    const node = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] };
    expect(coerceTiptap(node)?.type).toBe("doc");
  });

  it("accepts a bare array as a document", () => {
    const nodes = [{ type: "paragraph" }];
    expect(coerceTiptap(nodes)?.type).toBe("doc");
  });

  it("rejects opaque values so the HTML fallback is used", () => {
    expect(coerceTiptap({ html: "<p>hi</p>" })).toBeNull();
    expect(coerceTiptap("plain string")).toBeNull();
    expect(coerceTiptap(null)).toBeNull();
  });
});

describe("displayOptionsOf", () => {
  it("prefers resolved per-language options", () => {
    const q = question(1, "f1");
    const q2 = { ...q, displayOptions: [{ label: "A", content: "option a", originalLabel: "A" }] };
    expect(displayOptionsOf(q2)).toEqual([{ label: "A", content: "option a" }]);
  });

  it("falls back to variant.options when no resolved options exist", () => {
    const q = {
      ...question(1, "f1"),
      question: { id: "v1", options: [{ label: "B", content: "opt", is_correct: true, sort_order: 0 }] },
      displayOptions: null,
    } as unknown as LanguagePaperQuestion;
    expect(displayOptionsOf(q)[0].label).toBe("B");
  });

  it("returns nothing for unresolvable questions", () => {
    expect(displayOptionsOf(null)).toEqual([]);
  });
});

describe("language helpers", () => {
  it("derives a usable language code", () => {
    expect(languageCode(undefined)).toBe("en");
    expect(languageCode(detail([], "gu"))).toBe("gu");
    const fallback = detail([], "gu");
    fallback.language = "gu";
    expect(languageCode(fallback)).toBe("gu");
  });

  it("resolves section headings with a fallback", () => {
    const d = detail([], "en", [{ key: "A", name: "Section A – MCQ" }]);
    expect(sectionNameOf(d, "A")).toBe("Section A – MCQ");
    expect(sectionNameOf(d, "unknown-key")).toBe("unknown-key");
    expect(sectionNameOf(d, null)).toBe("Questions");
  });
});