import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestionViewModal } from "./QuestionViewModal";
import { api } from "../../api/client";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    api: {
      questions: {
        get: vi.fn(),
      },
    },
  };
});

const viApi = api as unknown as { questions: { get: ReturnType<typeof vi.fn> } };

const question = {
  id: "87ee205a-8eea-48bb-8004-ef1fcef8d87f",
  type: "mcq_single",
  difficulty: "medium",
  marks: 1,
  negative_marks: 0.25,
  status: "published",
  exam_year: 2024,
  content: { html: "<p>What is the smallest unit of classification?</p>" },
  explanation: { html: "<p>Species is the smallest unit.</p>" },
  tags: ["biology"],
} as never;

const options = [
  { id: "o1", label: "A", content: { html: "<p>Kingdom</p>" }, is_correct: false, sort_order: 0 },
  { id: "o2", label: "B", content: { html: "<p>Species</p>" }, is_correct: true, sort_order: 1 },
  { id: "o3", label: "C", content: { html: "<p>Genus</p>" }, is_correct: false, sort_order: 2 },
];

const payload = { correctIndexes: [1] };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("QuestionViewModal", () => {
  it("renders question, options and solution after loading", async () => {
    viApi.questions.get.mockResolvedValue({ question, options, payload });

    render(<QuestionViewModal questionId={question.id} open={true} onClose={() => {}} />);

    expect(await screen.findByText(/What is the smallest unit/)).toBeInTheDocument();
    expect(await screen.findByText("Kingdom")).toBeInTheDocument();
    expect(await screen.findByText("Species")).toBeInTheDocument();
    expect(await screen.findByText("Genus")).toBeInTheDocument();
    expect(await screen.findByText(/Species is the smallest unit/)).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    viApi.questions.get.mockResolvedValue({ question, options, payload });
    const { container } = render(<QuestionViewModal questionId="some-id" open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows error message when fetch fails", async () => {
    viApi.questions.get.mockRejectedValue(new Error("boom"));
    render(<QuestionViewModal questionId="some-id" open={true} onClose={() => {}} />);
    expect(await screen.findByText("Failed to load question.")).toBeInTheDocument();
  });
});