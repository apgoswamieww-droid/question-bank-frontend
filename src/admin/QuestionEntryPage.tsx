import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpen, BookOpenCheck, ChevronDown, Eye, History, ListFilter, Loader2, Plus, Save, SaveAll, Trash2, X } from "lucide-react";
import {
  api,
  ApiError,
  type Standard,
  type Subject,
  type Chapter,
  type Topic,
  type ExamType,
  type Language,
  type Question,
  type QuestionOption,
} from "../api/client";
import { Button } from "./components/Button";
import { RichEditor } from "./components/RichEditor";
import { QuestionHistoryPanel } from "./components/QuestionHistoryPanel";
import { QuestionViewModal } from "./components/QuestionViewModal";
import { StoredRichText } from "./components/StoredRichText";
import { storedHtml } from "./components/storedRichHelper";

type QType =
  | "mcq_single"
  | "mcq_multi"
  | "true_false"
  | "fill_blank"
  | "short_answer"
  | "long_answer"
  | "match"
  | "ordering"
  | "image_based"
  | "numeric";

const TYPES: { value: QType; label: string }[] = [
  { value: "mcq_single", label: "MCQ (Single Answer)" },
  { value: "mcq_multi", label: "MCQ (Multiple Answers)" },
  { value: "true_false", label: "True / False" },
  { value: "fill_blank", label: "Fill in the Blank" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer / Essay" },
  { value: "match", label: "Match the Following" },
  { value: "ordering", label: "Ordering / Sequence" },
  { value: "numeric", label: "Numeric" },
  { value: "image_based", label: "Image Based" },
];

const DIFFICULTIES = ["easy", "medium", "hard", "expert"];

interface DraftOption {
  label: string;
  content: string;
  is_correct: boolean;
}

interface Draft {
  id: string | null;
  type: QType;
  content: unknown;
  explanation: unknown;
  exam_type_id: string;
  language_id: string;
  level_id: string;
  difficulty: string;
  marks: number;
  negative_marks: number;
  time_limit_sec: string;
  exam_year: string;
  tags: string[];
  options: DraftOption[];
  payload: Record<string, unknown>;
}

const emptyDraft = (): Draft => ({
  id: null,
  type: "mcq_single",
  content: { html: "" },
  explanation: { html: "" },
  exam_type_id: "",
  language_id: "",
  level_id: "",
  difficulty: "easy",
  marks: 1,
  negative_marks: 0,
  time_limit_sec: "",
  exam_year: "",
  tags: [],
  options: [
    { label: "A", content: "", is_correct: false },
    { label: "B", content: "", is_correct: false },
    { label: "C", content: "", is_correct: false },
    { label: "D", content: "", is_correct: false },
  ],
  payload: {},
});

export default function QuestionEntryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");

  // Master data
  const [standards, setStandards] = useState<Standard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(true);
  // Selection
  const [standardId, setStandardId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");

  // Question list
  const [questions, setQuestions] = useState<Question[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  // Draft editor
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState<"draft" | "published" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewQuestionId, setViewQuestionId] = useState<string | null>(null);

  // Wizard tabs
  const [activeTab, setActiveTab] = useState<"question" | "metadata" | "review">("question");
  const [listOpen, setListOpen] = useState(false);

  // ---- Initial master data load (promise-based to satisfy lint rule) ----
  useEffect(() => {
    Promise.all([
      api.standards.list(),
      api.subjects.list(),
      api.examTypes.list(),
      api.languages.list(),
    ])
      .then(([s, sub, et, lang]) => {
        setStandards(s.standards);
        setSubjects(sub.subjects);
        setExamTypes(et.examTypes);
        setLanguages(lang.languages);
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Failed to load master data."))
      .finally(() => setLoadingMaster(false));
  }, []);

  // ---- Load chapters when standard + subject selected ----
  useEffect(() => {
    if (!standardId || !subjectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChapters([]);
      setChapterId("");
      setTopics([]);
      setTopicId("");
      return;
    }
    api.chapters
      .list({ standard_id: standardId, subject_id: subjectId })
      .then((res) => setChapters(res.chapters))
      .catch(() => setChapters([]));
  }, [standardId, subjectId]);

  // ---- Load topics when chapter selected ----
  useEffect(() => {
    if (!chapterId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTopics([]);
      setTopicId("");
      return;
    }
    api.topics
      .list({ chapter_id: chapterId })
      .then((res) => setTopics(res.topics))
      .catch(() => setTopics([]));
  }, [chapterId]);

  // ---- Load question list filtered by selection ----
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setListLoading(true);
    api.questions
      .list({
        standard_id: standardId || undefined,
        subject_id: subjectId || undefined,
        chapter_id: chapterId || undefined,
        topic_id: topicId || undefined,
        limit: 200,
      })
      .then((res) => {
        setQuestions(res.questions);
        setSelectedIdx(-1);
      })
      .catch(() => setQuestions([]))
      .finally(() => setListLoading(false));
  }, [standardId, subjectId, chapterId, topicId]);

  // ---- Helpers ----
  const setDraftField = (field: keyof Draft, value: unknown) =>
    setDraft((d) => ({ ...d, [field]: value }));

  const selectQuestion = (q: Question) => {
    setDraft({
      ...emptyDraft(),
      id: q.id,
      type: (q.type as QType) ?? "mcq_single",
      content: (q.content as { html?: string }) ?? { html: "" },
      explanation: (q.explanation as { html?: string }) ?? { html: "" },
      exam_type_id: q.exam_type_id ?? "",
      language_id: q.language_id ?? "",
      level_id: q.level_id ?? "",
      difficulty: q.difficulty ?? "easy",
      marks: q.marks ?? 1,
      negative_marks: q.negative_marks ?? 0,
      time_limit_sec: q.time_limit_sec != null ? String(q.time_limit_sec) : "",
      exam_year: q.exam_year != null ? String(q.exam_year) : "",
      tags: q.tags ?? [],
      options: [],
      payload: {},
    });
    // Load options if it's an MCQ type
    if (q.type === "mcq_single" || q.type === "mcq_multi") {
      api.questions.get(q.id).then((res) => {
        setDraft((d) => ({
          ...d,
          options: res.options.map((o: QuestionOption) => ({
            label: o.label,
            content: (o.content as { html?: string })?.html ?? "",
            is_correct: o.is_correct,
          })),
        }));
      });
    }
  };

  const newQuestion = () => {
    setDraft(emptyDraft());
    setSelectedIdx(-1);
  };

  // ---- Load question for editing when navigated with ?id= ----
  useEffect(() => {
    if (!editId) return;
    api.questions
      .get(editId)
      .then((res) => {
        const q = res.question;
        setStandardId(q.standard_id ?? "");
        setSubjectId(q.subject_id ?? "");
        setChapterId(q.chapter_id ?? "");
        setTopicId(q.topic_id ?? "");
        selectQuestion(q);
        setDraft((d) => ({ ...d, payload: (res.payload as Record<string, unknown>) ?? {} }));
      })
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to load question for editing.")
      );
  }, [editId]);

  const nextQuestion = () => {
    if (selectedIdx < questions.length - 1) selectQuestion(questions[selectedIdx + 1]);
    else newQuestion();
  };
  const prevQuestion = () => {
    if (selectedIdx > 0) selectQuestion(questions[selectedIdx - 1]);
  };

  // ---- Options helpers ----
  const updateOption = (index: number, patch: Partial<DraftOption>) =>
    setDraft((d) => ({
      ...d,
      options: d.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  const addOption = () =>
    setDraft((d) => ({
      ...d,
      options: [...d.options, { label: String.fromCharCode(65 + d.options.length), content: "", is_correct: false }],
    }));
  const removeOption = (index: number) =>
    setDraft((d) => ({
      ...d,
      options: d.options.filter((_, i) => i !== index),
    }));

  const setPayload = (patch: Record<string, unknown>) =>
    setDraft((d) => ({ ...d, payload: { ...d.payload, ...patch } }));

  // ---- Save ----
  const handleSave = async (status: "draft" | "published") => {
    const contentHtml = (draft.content as { html?: string })?.html ?? "";
    if (!contentHtml.trim()) {
      toast.error("Question content is required.");
      return;
    }
    setSaving(status);
    const base = {
      standard_id: standardId || null,
      subject_id: subjectId || null,
      chapter_id: chapterId || null,
      topic_id: topicId || null,
      type: draft.type,
      difficulty: draft.difficulty,
      level_id: draft.level_id || null,
      exam_type_id: draft.exam_type_id || null,
      language_id: draft.language_id || null,
      exam_year: draft.exam_year ? Number(draft.exam_year) : null,
      content: draft.content,
      explanation: draft.explanation,
      marks: draft.marks,
      negative_marks: draft.negative_marks,
      time_limit_sec: draft.time_limit_sec ? Number(draft.time_limit_sec) : null,
      tags: draft.tags,
      status,
    };
    try {
      const isMcq = draft.type === "mcq_single" || draft.type === "mcq_multi";
      const options = isMcq
        ? draft.options.filter((o) => (o.content ?? "").trim()).map((o, i) => ({
            label: o.label || String.fromCharCode(65 + i),
            content: { html: o.content },
            is_correct: o.is_correct,
          }))
        : undefined;
      const payload = isMcq
        ? { correctIndexes: draft.options.map((o, i) => (o.is_correct ? i : -1)).filter((i) => i >= 0) }
        : { ...draft.payload };

      const res = draft.id
        ? await api.questions.update(draft.id, { ...base, options, payload })
        : await api.questions.create({ ...base, options, payload });

      if (status === "published") {
        setSelectedIdx(questions.findIndex((q) => q.id === res.question.id));
      }
      toast.success("Saved.");
      setDraft((d) => ({ ...d, id: res.question.id }));
      // refresh list
      api.questions
        .list({ standard_id: standardId || undefined, subject_id: subjectId || undefined, chapter_id: chapterId || undefined, topic_id: topicId || undefined, limit: 200 })
        .then((r) => setQuestions(r.questions));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save question.");
    } finally {
      setSaving(null);
    }
  };

  const selectionReady =
    Boolean(standardId) && Boolean(subjectId) && Boolean(chapterId) && Boolean(topicId);

  if (loadingMaster) {
    return <div className="flex items-center justify-center py-24 text-sm text-slate-500">Loading hierarchy…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/dashboard")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Question Entry</h1>
            <p className="text-sm text-slate-600">Std → Subject → Chapter → Topic → Type → Content → Answer</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={newQuestion}>
            <Plus className="h-4 w-4" aria-hidden /> New
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <HierarchyBar
          standards={standards}
          subjects={subjects}
          chapters={chapters}
          topics={topics}
          standardId={standardId}
          subjectId={subjectId}
          chapterId={chapterId}
          topicId={topicId}
          onStandard={setStandardId}
          onSubject={setSubjectId}
          onChapter={setChapterId}
          onTopic={setTopicId}
        />

        {/* Toolbar row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <BookOpen className="h-4 w-4 text-primary" aria-hidden />
            {selectedIdx >= 0 ? `Question #${selectedIdx + 1} of ${questions.length}` : "New question"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {draft.id && (
              <Button size="sm" variant="secondary" onClick={() => setHistoryOpen(true)}>
                <History className="h-4 w-4" aria-hidden /> History
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setListOpen((o) => !o)}>
              <ListFilter className="h-4 w-4" aria-hidden /> {listOpen ? "Hide List" : "Browse"}
            </Button>
            <Button size="sm" variant="secondary" onClick={prevQuestion} disabled={selectedIdx <= 0}>
              ← Prev
            </Button>
            <Button size="sm" variant="secondary" onClick={nextQuestion}>
              Next →
            </Button>
          </div>
        </div>

        {/* Question list (collapsible) */}
        {listOpen && (
          <BottomStrip
            loading={listLoading}
            questions={questions}
            selectedIdx={selectedIdx}
            onSelect={(idx) => {
              setSelectedIdx(idx);
              selectQuestion(questions[idx]);
            }}
            onView={(q) => setViewQuestionId(q.id)}
            onDelete={async (q) => {
              await api.questions.delete(q.id);
              setQuestions((prev) => prev.filter((x) => x.id !== q.id));
            }}
          />
        )}

        {!selectionReady ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            <ListFilter className="mx-auto mb-3 h-8 w-8 text-slate-400" aria-hidden />
            Select Standard, Subject, Chapter and Topic to start entering questions.
          </div>
        ) : (
          <>
            {/* Wizard tabs */}
            <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              {(["question", "metadata", "review"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold capitalize transition ${
                    activeTab === tab ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "question" && (
              <div className="space-y-4">
                {/* Question type */}
                <Panel title="Question Type *">
                  <select
                    value={draft.type}
                    onChange={(e) => setDraftField("type", e.target.value as QType)}
                    className={selectCls}
                  >
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Panel>

                {/* Content */}
                <Panel title="Question Content *">
                  <RichEditor
                    value={draft.content}
                    onChange={(html) => setDraftField("content", { html })}
                    placeholder="Enter the question stem…"
                    minHeight="7rem"
                  />
                </Panel>

                {/* Options (MCQ types) */}
                {(draft.type === "mcq_single" || draft.type === "mcq_multi") && (
                  <Panel
                    title={
                      draft.type === "mcq_single" ? "Options — select correct answer (single)" : "Options — select correct answer(s) (multi)"
                    }
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {draft.options.map((o, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <button
                            type="button"
                            title="Mark as correct"
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                options: d.options.map((x, k) =>
                                  k === i
                                    ? { ...x, is_correct: true }
                                    : draft.type === "mcq_single"
                                      ? { ...x, is_correct: false }
                                      : x
                                ),
                              }))
                            }
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition ${
                              o.is_correct ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            {o.is_correct ? "✓" : String.fromCharCode(65 + i)}
                          </button>
                          <div className="min-w-0 flex-1">
                            <RichEditor
                              value={{ html: o.content }}
                              onChange={(html) => updateOption(i, { content: html })}
                              minHeight="2rem"
                              compact
                              placeholder={`Option ${String.fromCharCode(65 + i)}`}
                            />
                          </div>
                          {draft.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(i)}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <X className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addOption}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      <Plus className="h-4 w-4" aria-hidden /> Add option
                    </button>
                  </Panel>
                )}

                {/* Non-MCQ answer editors */}
                {draft.type !== "mcq_single" && draft.type !== "mcq_multi" && (
                  <Panel title="Answer / Solution *">
                    <TypeAnswer
                      type={draft.type}
                      payload={draft.payload}
                      onPayload={setPayload}
                      onChooseCorrect={(content) => setDraftField("payload", { ...draft.payload, modelAnswer: content })}
                    />
                  </Panel>
                )}

                {/* Explanation / Solution (all types) */}
                <Panel title="Solution / Explanation (optional)">
                  <RichEditor
                    value={draft.explanation}
                    onChange={(html) => setDraftField("explanation", { html })}
                    placeholder="Enter the step-by-step solution…"
                    minHeight="6rem"
                  />
                </Panel>

                {/* Save actions */}
                <div className="flex flex-wrap justify-end gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <Button variant="secondary" onClick={() => { setActiveTab("review"); }} size="sm">
                    Review
                  </Button>
                  <Button variant="secondary" onClick={() => handleSave("draft")} loading={saving === "draft"}>
                    <Save className="h-4 w-4" aria-hidden /> Save as Draft
                  </Button>
                  <Button onClick={() => handleSave("published")} loading={saving === "published"}>
                    <SaveAll className="h-4 w-4" aria-hidden /> Save & Publish
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "metadata" && (
              <MetadataPanel
                draft={draft}
                setDraftField={setDraftField}
                examTypes={examTypes}
                languages={languages}
                standardName={standards.find((s) => s.id === standardId)?.name ?? "—"}
                subjectName={subjects.find((s) => s.id === subjectId)?.name ?? "—"}
                chapterName={chapters.find((c) => c.id === chapterId)?.name ?? "—"}
                topicName={topics.find((t) => t.id === topicId)?.name ?? "—"}
              />
            )}

            {activeTab === "review" && (
              <div className="space-y-4">
                <Panel title="Review — Question preview">
                  <div className="space-y-4">
                    <ReviewRow label="Type" value={TYPES.find((t) => t.value === draft.type)?.label ?? draft.type} />
                    <div>
                      <p className="text-xs font-medium text-slate-500">Question</p>
                      <div className="mt-0.5 text-sm text-slate-800 [&_.katex]:whitespace-nowrap">
                        {storedHtml(draft.content) ? <StoredRichText value={draft.content} /> : "—"}
                      </div>
                    </div>

                    {draft.type === "mcq_single" || draft.type === "mcq_multi" ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-slate-500">Options</p>
                        {draft.options.map((o, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${o.is_correct ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className="min-w-0 flex-1 text-sm text-slate-700 [&_.katex]:whitespace-nowrap">
                              {storedHtml({ html: o.content }) ? <StoredRichText value={{ html: o.content }} /> : "——"}
                            </span>
                            {o.is_correct && <span className="ml-auto text-xs font-semibold text-emerald-600">Correct</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ReviewRow
                        label="Answer"
                        value={
                          stringifyContent({ html: String(draft.payload?.modelAnswer ?? "") }) ||
                          stringifyContent({ html: Array.isArray(draft.payload?.acceptedAnswers) ? (draft.payload?.acceptedAnswers as string[]).join(", ") : "" }) ||
                          "Entered in Question tab"
                        }
                      />
                    )}

                    <div>
                      <p className="text-xs font-medium text-slate-500">Explanation</p>
                      <div className="mt-0.5 text-sm text-slate-800 [&_.katex]:whitespace-nowrap">
                        {storedHtml(draft.explanation) ? <StoredRichText value={draft.explanation} /> : "—"}
                      </div>
                    </div>
                    <ReviewRow label="Exam type" value={examTypes.find((e) => e.id === draft.exam_type_id)?.name ?? "—"} />
                    <ReviewRow label="Language" value={languages.find((l) => l.id === draft.language_id)?.name ?? "—"} />
                    <div className="grid grid-cols-3 gap-2">
                      <ReviewRow label="Difficulty" value={draft.difficulty} />
                      <ReviewRow label="Marks" value={String(draft.marks)} />
                      <ReviewRow label="Negative" value={String(draft.negative_marks)} />
                    </div>
                    {draft.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {draft.tags.map((t) => (
                          <span key={t} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Panel>

                <div className="flex flex-wrap justify-end gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <Button variant="secondary" onClick={() => setActiveTab("question")} size="sm">← Back</Button>
                  <Button variant="secondary" onClick={() => handleSave("draft")} loading={saving === "draft"}>
                    <Save className="h-4 w-4" aria-hidden /> Save as Draft
                  </Button>
                  <Button onClick={() => handleSave("published")} loading={saving === "published"}>
                    <SaveAll className="h-4 w-4" aria-hidden /> Save & Publish
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* BOTTOM STRIP — question list */}
      <BottomStrip
        loading={listLoading}
        questions={questions}
        selectedIdx={selectedIdx}
        onSelect={(idx) => {
          setSelectedIdx(idx);
          selectQuestion(questions[idx]);
        }}
        onView={(q) => setViewQuestionId(q.id)}
        onDelete={async (q) => {
          await api.questions.delete(q.id);
          setQuestions((prev) => prev.filter((x) => x.id !== q.id));
        }}
      />

      <QuestionViewModal questionId={viewQuestionId} open={Boolean(viewQuestionId)} onClose={() => setViewQuestionId(null)} />

      <QuestionHistoryPanel
        questionId={draft.id}
        questionLabel={stringifyContent(draft.content)}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const selectCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";
const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black placeholder:text-slate-400 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function HierarchyBar({
  standards,
  subjects,
  chapters,
  topics,
  standardId,
  subjectId,
  chapterId,
  topicId,
  onStandard,
  onSubject,
  onChapter,
  onTopic,
}: {
  standards: Standard[];
  subjects: Subject[];
  chapters: Chapter[];
  topics: Topic[];
  standardId: string;
  subjectId: string;
  chapterId: string;
  topicId: string;
  onStandard: (id: string) => void;
  onSubject: (id: string) => void;
  onChapter: (id: string) => void;
  onTopic: (id: string) => void;
}) {
  const item = (label: string, value: string, options: { id: string; name: string }[], onChange: (id: string) => void) => {
    return (
      <div className="min-w-0 flex-1">
        <label className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</label>
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
          <option value="">All</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
    );
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
        <ListFilter className="h-4 w-4 text-primary" aria-hidden /> Hierarchy
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {item("Standard", standardId, standards, onStandard)}
        {item("Subject", subjectId, subjects, onSubject)}
        {item("Chapter", chapterId, chapters, onChapter)}
        {item("Topic", topicId, topics, onTopic)}
      </div>
    </div>
  );
}

function MetadataPanel({
  draft,
  setDraftField,
  examTypes,
  languages,
  standardName,
  subjectName,
  chapterName,
  topicName,
}: {
  draft: Draft;
  setDraftField: (f: keyof Draft, v: unknown) => void;
  examTypes: ExamType[];
  languages: Language[];
  standardName: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
}) {
  const [tagInput, setTagInput] = useState("");
  const addTag = () => {
    const v = tagInput.trim();
    if (v && !draft.tags.includes(v)) setDraftField("tags", [...draft.tags, v]);
    setTagInput("");
  };
  return (
    <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-slate-800">Metadata</h2>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ReadonlyRow label="Standard" value={standardName} />
          <ReadonlyRow label="Subject" value={subjectName} />
          <ReadonlyRow label="Chapter" value={chapterName} />
          <ReadonlyRow label="Topic" value={topicName} />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Exam Type">
            <select value={draft.exam_type_id} onChange={(e) => setDraftField("exam_type_id", e.target.value)} className={selectCls}>
              <option value="">—</option>
              {examTypes.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Language">
            <select value={draft.language_id} onChange={(e) => setDraftField("language_id", e.target.value)} className={selectCls}>
              <option value="">—</option>
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Difficulty">
            <select value={draft.difficulty} onChange={(e) => setDraftField("difficulty", e.target.value)} className={selectCls}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d[0].toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Marks">
            <input type="number" min={0} value={draft.marks} onChange={(e) => setDraftField("marks", Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Negative">
            <input type="number" min={0} value={draft.negative_marks} onChange={(e) => setDraftField("negative_marks", Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Exam year">
            <input type="number" value={draft.exam_year} onChange={(e) => setDraftField("exam_year", e.target.value)} className={inputCls} placeholder="e.g. 2026" />
          </Field>
        </div>

        <Field label="Tags">
          <div className="flex gap-1.5">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              className={inputCls}
              placeholder="Add tag…"
            />
            <Button size="sm" variant="secondary" onClick={addTag}>
              + Add
            </Button>
          </div>
          {draft.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {draft.tags.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setDraftField("tags", draft.tags.filter((x) => x !== t))}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-red-50 hover:text-red-600"
                >
                  {t} <X className="h-3 w-3" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </Field>
      </div>
    </aside>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="truncate text-xs font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value || "—"}</p>
    </div>
  );
}

function TypeAnswer({
  type,
  payload,
  onPayload,
  onChooseCorrect,
}: {
  type: QType;
  payload: Record<string, unknown>;
  onPayload: (patch: Record<string, unknown>) => void;
  onChooseCorrect: (content: string) => void;
}) {
  if (type === "true_false") {
    return (
      <div className="flex gap-2">
        {[true, false].map((val) => (
          <button
            type="button"
            key={String(val)}
            onClick={() => onPayload({ correctAnswer: val })}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
              payload.correctAnswer === val ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {val ? "True" : "False"}
          </button>
        ))}
      </div>
    );
  }
  if (type === "fill_blank") {
    return (
      <div className="space-y-2">
        <TextareaSimple
          label="Accepted answers (one per line)"
          value={Array.isArray(payload.acceptedAnswers) ? (payload.acceptedAnswers as string[]).join("\n") : ""}
          onChange={(v) => onPayload({ acceptedAnswers: v.split("\n").filter((x) => x.trim()) })}
        />
      </div>
    );
  }
  if (type === "numeric") {
    return (
      <div className="grid grid-cols-3 gap-2">
        <NumberInput label="Value" value={String(payload.value ?? "")} onChange={(v) => onPayload({ value: Number(v) })} />
        <NumberInput label="Tolerance" value={String(payload.tolerance ?? "")} onChange={(v) => onPayload({ tolerance: Number(v) })} />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Unit</label>
          <input className={inputCls} value={String(payload.unit ?? "")} onChange={(e) => onPayload({ unit: e.target.value })} placeholder="cm, kg…" />
        </div>
      </div>
    );
  }
  if (type === "match") {
    const pairs = (payload.pairs as { left: string; right: string }[]) ?? [];
    const setPair = (i: number, p: { left: string; right: string }) => {
      const next = [...pairs];
      next[i] = p;
      onPayload({ pairs: next });
    };
    return (
      <div className="space-y-2">
        {pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className={inputCls} value={p.left} onChange={(e) => setPair(i, { ...p, left: e.target.value })} placeholder="Left" />
            <input className={inputCls} value={p.right} onChange={(e) => setPair(i, { ...p, right: e.target.value })} placeholder="Right" />
            <button type="button" onClick={() => onPayload({ pairs: pairs.filter((_, x) => x !== i) })} className="text-slate-400 hover:text-red-600">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onPayload({ pairs: [...pairs, { left: "", right: "" }] })} className="text-sm font-medium text-primary hover:underline">
          + Add pair
        </button>
      </div>
    );
  }
  if (type === "ordering") {
    const items = (payload.items as string[]) ?? [];
    return (
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">{i + 1}.</span>
            <input className={inputCls} value={it} onChange={(e) => onPayload({ items: items.map((x, k) => (k === i ? e.target.value : x)) })} placeholder="Item in correct order" />
            <button type="button" onClick={() => onPayload({ items: items.filter((_, k) => k !== i) })} className="text-slate-400 hover:text-red-600">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onPayload({ items: [...items, ""] })} className="text-sm font-medium text-primary hover:underline">
          + Add item
        </button>
      </div>
    );
  }
  // short_answer / long_answer / image_based
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">Model answer</label>
      <textarea
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
        rows={type === "long_answer" ? 5 : 3}
        value={String(payload.modelAnswer ?? "")}
        onChange={(e) => onPayload({ modelAnswer: e.target.value })}
        placeholder="Enter the model answer…"
        onBlur={() => onChooseCorrect(String(payload.modelAnswer ?? ""))}
      />
    </div>
  );
}

function TextareaSimple({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <textarea rows={4} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <input type="number" className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function BottomStrip({
  loading,
  questions,
  selectedIdx,
  onSelect,
  onView,
  onDelete,
}: {
  loading: boolean;
  questions: Question[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  onView: (q: Question) => void;
  onDelete: (q: Question) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700"
      >
        <span className="flex items-center gap-2">
          <BookOpenCheck className="h-4 w-4 text-primary" aria-hidden /> Question List ({questions.length})
        </span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="max-h-56 overflow-y-auto border-t border-slate-100">
          {loading && (
            <div className="flex items-center gap-2 p-4 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
            </div>
          )}
          {!loading && questions.length === 0 && (
            <p className="p-4 text-sm text-slate-400">No questions in the current selection yet.</p>
          )}
          {questions.map((q, i) => {
            const fullText = stringifyContent(q.content);
            return (
              <div
                key={q.id}
                className={`group flex items-center gap-3 border-b border-slate-50 px-4 py-2.5 text-sm transition ${
                  selectedIdx === i ? "bg-primary-50" : "hover:bg-slate-50"
                }`}
              >
                <button type="button" onClick={() => onSelect(i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="w-6 text-xs font-bold text-slate-400">#{i + 1}</span>
                  <span
                    className="max-w-[340px] truncate text-slate-700 [&_.katex]:text-[12px] [&_.katex]:whitespace-nowrap"
                    title={fullText}
                  >
                    {storedHtml(q.content) ? <StoredRichText value={q.content} /> : fullText}
                  </span>
                  <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {q.type.replace("_", " ")}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onView(q)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:border-primary hover:text-primary"
                  aria-label="View question"
                  title="View question"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(q)}
                  className="shrink-0 text-slate-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                  aria-label="Delete question"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function stringifyContent(content: unknown): string {
  const html = typeof content === "string" ? content : (content as { html?: string } | null)?.html ?? "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "Untitled question";
}
