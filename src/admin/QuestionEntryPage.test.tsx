import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const { apiMock, ApiErrorMock } = vi.hoisted(() => {
  class ApiErrorMock extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ApiError";
    }
  }

  const masterQuestion = {
    id: "q1",
    bank_id: null,
    created_by: "u1",
    standard_id: "std1",
    subject_id: "sub1",
    chapter_id: "ch1",
    topic_id: "tp1",
    type: "mcq_single",
    exam_type_id: "",
    language_id: "",
    difficulty: "easy",
    level_id: null,
    exam_year: null,
    content: { html: "<p>OLD STEM</p>" },
    explanation: { html: "<p>OLD EXPLAIN</p>" },
    image_url: null,
    marks: 1,
    negative_marks: 0,
    time_limit_sec: null,
    quality_score: 50,
    tags: ["old"],
    status: "published",
    sort_order: 0,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };

  const masterOptions = [
    { id: "o1", question_id: "q1", label: "A", content: { html: "<p>OPT A</p>" }, is_correct: true, sort_order: 0 },
    { id: "o2", question_id: "q1", label: "B", content: { html: "<p>OPT B</p>" }, is_correct: false, sort_order: 1 },
  ];

  const apiMock = {
    standards: { list: vi.fn().mockResolvedValue({ standards: [{ id: "std1", name: "Std 1", sort_order: 0, active: true }] }) },
    subjects: { list: vi.fn().mockResolvedValue({ subjects: [{ id: "sub1", name: "Sub 1", sort_order: 0, active: true }] }) },
    examTypes: { list: vi.fn().mockResolvedValue({ examTypes: [{ id: "et1", name: "Board Exam", category: "exam", sort_order: 0, active: true }] }) },
    languages: { list: vi.fn().mockResolvedValue({ languages: [{ id: "lang1", code: "gu", name: "Gujarati", active: true }] }) },
    chapters: { list: vi.fn().mockResolvedValue({ chapters: [{ id: "ch1", name: "Ch 1", sort_order: 0, active: true }] }) },
    topics: { list: vi.fn().mockResolvedValue({ topics: [{ id: "tp1", name: "Tp 1", sort_order: 0, active: true }] }) },
    questions: {
      list: vi.fn().mockResolvedValue({ questions: [masterQuestion], total: 1 }),
      get: vi.fn().mockResolvedValue({ question: masterQuestion, options: masterOptions, payload: { correctIndexes: [0] } }),
      create: vi.fn().mockResolvedValue({ question: masterQuestion, options: masterOptions, payload: null }),
      update: vi.fn().mockResolvedValue({ question: masterQuestion, options: masterOptions, payload: null }),
    },
  };

  return { apiMock, ApiErrorMock };
});

vi.mock("../api/client", () => ({
  api: apiMock,
  ApiError: ApiErrorMock,
}));

vi.mock("./components/RichEditor", () => ({
  RichEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: unknown;
    onChange: (html: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid={`rich-editor-${placeholder ?? "generic"}`}
      placeholder={placeholder}
      defaultValue={
        typeof value === "string" ? value : ((value as { html?: string })?.html ?? "")
      }
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import QuestionEntryPage from "./QuestionEntryPage";

function fieldSelect(label: string): HTMLSelectElement {
  const lbl = screen.getByText(label);
  const sel = (lbl.parentElement as HTMLElement).querySelector("select");
  if (!sel) throw new Error(`no <select> inside field labeled "${label}"`);
  return sel as HTMLSelectElement;
}

async function renderPage() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/admin/question-entry?id=q1"]}>
      <Routes>
        <Route path="/admin/question-entry" element={<QuestionEntryPage />} />
      </Routes>
    </MemoryRouter>
  );
  // Wait for the edit-load to populate the question draft.
  await waitFor(() => {
    const stem = screen.getByTestId("rich-editor-Enter the question stem…") as HTMLTextAreaElement;
    expect(stem.value).toContain("OLD STEM");
  });
  return user;
}

describe("QuestionEntryPage edit-from-bank flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the question, lets you edit content/options/metadata and saves everything via update", async () => {
    const user = await renderPage();

    // Change the question stem.
    const stem = screen.getByTestId("rich-editor-Enter the question stem…") as HTMLTextAreaElement;
    fireEvent.change(stem, { target: { value: "NEW STEM" } });

    // Configure options: change first option text, mark only B correct via the WYSIWYG path is complex,
    // so just change option A content (index A editor placeholder is "Option A").
    const optA = screen.getByTestId("rich-editor-Option A") as HTMLTextAreaElement;
    fireEvent.change(optA, { target: { value: "NEW OPT A" } });

    // Go to Metadata tab and change difficulty + exam type.
    await user.click(screen.getByRole("button", { name: "metadata" }));
    await user.selectOptions(fieldSelect("Difficulty"), "hard");
    await user.selectOptions(fieldSelect("Exam Type"), "et1");

    // Go to Review tab and click Save & Publish.
    await user.click(screen.getByRole("button", { name: "review" }));
    await user.click(screen.getByRole("button", { name: /Save & Publish/ }));

    await waitFor(() => {
      expect(apiMock.questions.update).toHaveBeenCalledTimes(1);
    });

    const [id, body] = apiMock.questions.update.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe("q1");

    expect((body.content as { html: string }).html).toContain("NEW STEM");
    expect((body.content as { html: string }).html).not.toContain("OLD STEM");
    expect(body.difficulty).toBe("hard");
    expect(body.exam_type_id).toBe("et1");
    expect(body.status).toBe("published");
    expect(body.explanation).toEqual({ html: "<p>OLD EXPLAIN</p>" });

    const opts = body.options as { label: string; content: { html: string }; is_correct: boolean }[];
    expect(opts).toHaveLength(2);
    expect(opts[0].content.html).toContain("NEW OPT A");
    expect(opts[0].is_correct).toBe(true);
    expect(opts[1].content.html).toContain("OPT B");
    expect((body.payload as { correctIndexes: number[] }).correctIndexes).toEqual([0]);
  });
});