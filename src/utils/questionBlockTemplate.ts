import type { JSONContent } from "@tiptap/core";

export const QUESTION_BLOCK_TEMPLATE: JSONContent[] = [
  {
    type: "questionBlock",
    content: [
      {
        type: "questionText",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Question text here" }],
          },
        ],
      },
      {
        type: "questionOption",
        attrs: { label: "A" },
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Option A" }],
          },
        ],
      },
      {
        type: "questionOption",
        attrs: { label: "B" },
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Option B" }],
          },
        ],
      },
      {
        type: "questionOption",
        attrs: { label: "C" },
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Option C" }],
          },
        ],
      },
      {
        type: "questionOption",
        attrs: { label: "D" },
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Option D" }],
          },
        ],
      },
      {
        type: "questionFooter",
        content: [
          {
            type: "questionAnswer",
            content: [{ type: "paragraph" }],
          },
          {
            type: "questionMarks",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "1" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "paragraph",
  },
];

export const QUESTION_PLACEHOLDER = "Question text here";

interface BankQuestionInput {
  id: string;
  family_id: string | null;
  content: unknown;
  marks: number;
  options?: { label: string; content: unknown }[];
}

/**
 * Build a TipTap questionBlock node from a question bank question so it can be
 * inserted into the paper editor. Options are padded to the strict 4-option
 * questionBlock schema; answer is left blank for the teacher to fill.
 */
export function buildQuestionBlockFromBank(question: BankQuestionInput): JSONContent {
  const optionCount = question.options?.length ?? 0;
  const options: JSONContent[] = [];
  const totalSlots = Math.max(4, Math.min(optionCount, 4));
  for (let i = 0; i < totalSlots; i++) {
    const opt = question.options?.[i];
    options.push({
      type: "questionOption",
      attrs: { label: opt?.label ?? String.fromCharCode(65 + i) },
      content: [opt?.content ?? { type: "paragraph" }],
    });
  }

  return {
    type: "questionBlock",
    attrs: {
      family_id: question.family_id,
      question_id: question.id,
      source: "bank",
    },
    content: [
      {
        type: "questionText",
        content: Array.isArray(question.content)
          ? question.content
          : [{ type: "paragraph" }],
      },
      ...options,
      {
        type: "questionFooter",
        content: [
          {
            type: "questionAnswer",
            content: [{ type: "paragraph" }],
          },
          {
            type: "questionMarks",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: String(question.marks ?? 1) },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
