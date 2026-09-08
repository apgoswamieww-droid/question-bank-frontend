import { useEffect, useState } from "react";
import { AlertCircle, BookOpenCheck, CheckCircle2, Eye, FileText, X } from "lucide-react";
import { api, ApiError, type Question, type QuestionOption } from "../../api/client";
import { Button } from "./Button";
import { storedHtml } from "./storedRichHelper";
import { StoredRichText } from "./StoredRichText";

interface Detail {
  question: Question;
  options: QuestionOption[];
  payload: Record<string, unknown> | null;
}

interface QuestionViewModalProps {
  questionId: string | null;
  open: boolean;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  mcq_single: "MCQ (Single Answer)",
  mcq_multi: "MCQ (Multiple Answers)",
  true_false: "True / False",
  fill_blank: "Fill in the Blank",
  short_answer: "Short Answer",
  long_answer: "Long Answer / Essay",
  match: "Match the Following",
  ordering: "Ordering / Sequence",
  numeric: "Numeric",
  image_based: "Image Based",
};

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function AnswerPanel({ question, options, payload }: Detail) {
  const hasOptions = options && options.length > 0;

  if (hasOptions) {
    return (
      <div className="space-y-1.5">
        {options.map((o) => (
          <div
            key={o.id}
            className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
              o.is_correct
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="mr-1.5 font-semibold">{o.label}</span>
              <StoredRichText value={o.content} />
            </span>
            {o.is_correct && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Correct
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  const p = payload ?? {};
  const rows: { label: string; value: unknown }[] = [];

  if (question.type === "true_false") {
    rows.push({ label: "Answer", value: p.correctAnswer === true ? "True" : p.correctAnswer === false ? "False" : "" });
  } else if (question.type === "fill_blank") {
    rows.push({ label: "Accepted answers", value: Array.isArray(p.answers) ? p.answers.join("  /  ") : "" });
    if (p.caseSensitive !== undefined) rows.push({ label: "Case sensitive", value: p.caseSensitive === true ? "Yes" : "No" });
  } else if (question.type === "numeric") {
    rows.push({ label: "Value", value: p.value });
    if (p.tolerance !== undefined) rows.push({ label: "Tolerance", value: p.tolerance });
    if (p.unit !== undefined) rows.push({ label: "Unit", value: p.unit });
  } else if (question.type === "short_answer" || question.type === "long_answer") {
    rows.push({ label: "Answer", value: p.modelAnswer });
  } else if (question.type === "match" && Array.isArray(p.pairs)) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Column A</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Column B</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(p.pairs as { left?: unknown; right?: unknown }[]).map((pair, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-slate-700">{fmt(pair.left)}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{fmt(pair.right)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else if (question.type === "ordering" && Array.isArray(p.correctOrder)) {
    rows.push({ label: "Correct order", value: (p.correctOrder as unknown[]).map((x, i) => `${i + 1}. ${fmt(x)}`).join("  →  ") });
  } else {
    const keys = Object.keys(p);
    for (const k of keys) {
      if (k === "correctIndexes" || k === "correctIndex") continue;
      rows.push({ label: k.replace(/([a-z])([A-Z])/g, "$1 $2"), value: p[k] });
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No answer payload stored for this question.</p>;
  }

  return (
    <div className="space-y-1.5">
      {rows
        .filter((r) => r.value !== undefined && r.value !== null && r.value !== "")
        .map((r) => (
          <div key={r.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="mr-2 text-xs font-semibold uppercase text-slate-400">{r.label}</span>
            <span className="text-slate-800">
              <StoredRichText value={r.value} />
            </span>
          </div>
        ))}
    </div>
  );
}

export function QuestionViewModal({ questionId, open, onClose }: QuestionViewModalProps) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !questionId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setData(null);
    setError(null);
    api.questions
      .get(questionId)
      .then((res) => setData({
        question: res.question,
        options: Array.isArray(res.options) ? res.options : [],
        payload: (res.payload as Record<string, unknown>) ?? null,
      }))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load question."))
      .finally(() => setLoading(false));
  }, [open, questionId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="View question">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Question Details</h2>
              {data && (
                <p className="text-xs text-slate-500" title={data.question.id}>
                  ID: {shortId(data.question.id)}
                </p>
              )}
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <AlertCircle className="h-8 w-8 text-red-400" aria-hidden />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-5">
              {/* Meta badges */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded-md bg-primary-50 px-2 py-1 font-medium text-primary">
                  {TYPE_LABELS[data.question.type] ?? data.question.type}
                </span>
                {data.question.difficulty && (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                    {data.question.difficulty[0].toUpperCase() + data.question.difficulty.slice(1)}
                  </span>
                )}
                <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                  {data.question.marks} mark{data.question.marks === 1 ? "" : "s"}
                </span>
                {data.question.negative_marks > 0 && (
                  <span className="rounded-md bg-red-50 px-2 py-1 text-red-600">
                    −{data.question.negative_marks} negative
                  </span>
                )}
                <span
                  className={`rounded-md px-2 py-1 font-medium ${
                    data.question.status === "published"
                      ? "bg-emerald-50 text-emerald-700"
                      : data.question.status === "draft"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {data.question.status}
                </span>
                {data.question.exam_year && (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{data.question.exam_year}</span>
                )}
              </div>

              {/* Question content */}
              <Section icon={<FileText className="h-3.5 w-3.5" aria-hidden />} title="Question">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800">
                  <StoredRichText value={data.question.content} />
                </div>
              </Section>

              {/* Answer */}
              <Section icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />} title="Answer">
                <AnswerPanel
                  question={data.question}
                  options={data.options}
                  payload={data.payload}
                />
              </Section>

              {/* Solution / explanation */}
              <Section icon={<BookOpenCheck className="h-3.5 w-3.5" aria-hidden />} title="Solution / Explanation">
                {storedHtml(data.question.explanation) ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                    <StoredRichText value={data.question.explanation} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No solution provided.</p>
                )}
              </Section>

              {/* Tags */}
              {data.question.tags.length > 0 && (
                <Section icon={<span className="text-xs">#</span>} title="Tags">
                  <div className="flex flex-wrap gap-1.5">
                    {data.question.tags.map((t) => (
                      <span key={t} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                        {t}
                      </span>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}