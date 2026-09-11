import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  EyeOff,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import {
  api,
  ApiError,
  type Question,
  type Standard,
  type Subject,
  type Chapter,
  type Topic,
  type ExamType,
  type Language,
  type TestStatus,
} from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { TableSkeleton } from "./components/Skeleton";
import { richTextToPlain } from "./components/richText";

const typeLabels: Record<string, string> = {
  mcq: "MCQ",
  multi: "Multiple Select",
  true_false: "True/False",
  match: "Match the Following",
  fill_blank: "Fill in the Blanks",
  short: "Short Answer",
  long: "Long Answer",
  essay: "Essay",
  number: "Numeric",
  sq: "True/False Statement",
  other: "Other",
};

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? "bg-primary" : "bg-slate-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}

interface PoolFilters {
  standard_id: string;
  subject_id: string;
  chapter_id: string;
  topic_id: string;
  qtype: string;
}

const EMPTY_FILTERS: PoolFilters = { standard_id: "", subject_id: "", chapter_id: "", topic_id: "", qtype: "" };

export default function TestCreatePage() {
  const { id } = useParams<{ id: string }>();
  const editId = id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  // master data
  const [standards, setStandards] = useState<Standard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);

  // test form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [standardId, setStandardId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examTypeId, setExamTypeId] = useState("");
  const [languageId, setLanguageId] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [passingMarks, setPassingMarks] = useState(0);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [showResults, setShowResults] = useState(true);
  const [showAnswers, setShowAnswers] = useState(false);
  const [status, setStatus] = useState<TestStatus>("draft");

  // question pool
  const [filters, setFilters] = useState<PoolFilters>(EMPTY_FILTERS);
  const [pool, setPool] = useState<Question[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);

  // selected questions (ordered) with per-question marks
  const [selected, setSelected] = useState<{ question: Question; marks: number; previewOpen: boolean }[]>([]);

  const [saving, setSaving] = useState<"draft" | "published" | null>(null);

  // ---- initial load ----
  useEffect(() => {
    (async () => {
      try {
        const [s, sub, et, lang] = await Promise.all([
          api.standards.list(),
          api.subjects.list(),
          api.examTypes.list(),
          api.languages.list(),
        ]);
        setStandards(s.standards);
        setSubjects(sub.subjects);
        setExamTypes(et.examTypes);
        setLanguages(lang.languages);
        if (editId) {
          const t = await api.tests.get(editId);
          setTitle(t.title);
          setDescription(t.description ?? "");
          setStandardId(t.standard_id ?? "");
          setSubjectId(t.subject_id ?? "");
          setExamTypeId(t.exam_type_id ?? "");
          setLanguageId(t.language_id ?? "");
          setDurationMin(t.duration_min);
          setPassingMarks(t.passing_marks);
          setShuffleQuestions(t.shuffle_questions);
          setShuffleOptions(t.shuffle_options);
          setShowResults(t.show_results);
          setShowAnswers(t.show_answers);
          setStatus(t.status);
          setSelected(
            t.questions.map((q) => ({ question: q.question, marks: q.marks || q.question.marks, previewOpen: false }))
          );
          setFilters((f) => ({
            ...f,
            standard_id: t.standard_id ?? "",
            subject_id: t.subject_id ?? "",
            exam_type_id: t.exam_type_id ?? "",
          }));
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to load test.");
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  // ---- load chapters when standard+subject ----
  useEffect(() => {
    if (!filters.standard_id || !filters.subject_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChapters([]);
      setTopics([]);
      return;
    }
    api.chapters
      .list({ standard_id: filters.standard_id, subject_id: filters.subject_id })
      .then((res) => setChapters(res.chapters))
      .catch(() => setChapters([]));
  }, [filters.standard_id, filters.subject_id]);

  useEffect(() => {
    if (!filters.chapter_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTopics([]);
      return;
    }
    api.topics
      .list({ chapter_id: filters.chapter_id })
      .then((res) => setTopics(res.topics))
      .catch(() => setTopics([]));
  }, [filters.chapter_id]);

  // ---- load question pool ----
  useEffect(() => {
    if (!filters.standard_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPool([]);
      return;
    }
    setPoolLoading(true);
    api.questions
      .list({
        standard_id: filters.standard_id || undefined,
        subject_id: filters.subject_id || undefined,
        chapter_id: filters.chapter_id || undefined,
        topic_id: filters.topic_id || undefined,
        type: filters.qtype || undefined,
        limit: 200,
      })
      .then((res) => setPool(res.questions))
      .catch(() => setPool([]))
      .finally(() => setPoolLoading(false));
  }, [filters]);

  const totalMarks = useMemo(
    () => selected.reduce((sum, s) => sum + (Number(s.marks) || 0), 0),
    [selected]
  );

  const addQuestion = (q: Question) => {
    setSelected((prev) => {
      if (prev.some((s) => s.question.id === q.id)) return prev;
      return [...prev, { question: q, marks: q.marks || 1, previewOpen: false }];
    });
  };

  const removeQuestion = (qid: string) => {
    setSelected((prev) => prev.filter((s) => s.question.id !== qid));
  };

  const move = (index: number, dir: -1 | 1) => {
    setSelected((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const setMarks = (qid: string, marks: number) => {
    setSelected((prev) => prev.map((s) => (s.question.id === qid ? { ...s, marks } : s)));
  };

  const togglePreview = (qid: string) => {
    setSelected((prev) =>
      prev.map((s) => (s.question.id === qid ? { ...s, previewOpen: !s.previewOpen } : s))
    );
  };

  const save = async (targetStatus: "draft" | "published") => {
    setSaving(targetStatus);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        standard_id: standardId || null,
        subject_id: subjectId || null,
        exam_type_id: examTypeId || null,
        language_id: languageId || null,
        duration_min: durationMin,
        total_marks: totalMarks,
        passing_marks: passingMarks,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        show_results: showResults,
        show_answers: showAnswers,
        status: targetStatus,
        questionIds: selected.map((s) => s.question.id),
      };
      if (editId) {
        await api.tests.update(editId, payload);
      } else {
        await api.tests.create(payload);
      }
      toast.success(editId ? "Test updated." : "Test created.");
      navigate("/admin/tests");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save test.");
    } finally {
      setSaving(null);
    }
  };

  const field = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";

  if (loading) {
    return <TableSkeleton rows={8} cols={2} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={editId ? "Edit Test" : "Create Test"}
        subtitle="Build a test by selecting questions from your bank"
        actions={
          <Button variant="secondary" onClick={() => navigate("/admin/tests")}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- Left: test metadata + settings ---- */}
        <div className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Test Details</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Title *</label>
                <input
                  className={field}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Class 10 Mathematics — Term 1"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                <textarea
                  className={`${field} min-h-[72px] resize-y`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Standard</label>
                  <select
                    className={field}
                    value={standardId}
                    onChange={(e) => {
                      setStandardId(e.target.value);
                      setFilters((f) => ({ ...f, standard_id: e.target.value }));
                    }}
                  >
                    <option value="">Any</option>
                    {standards.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
                  <select
                    className={field}
                    value={subjectId}
                    onChange={(e) => {
                      setSubjectId(e.target.value);
                      setFilters((f) => ({ ...f, subject_id: e.target.value }));
                    }}
                  >
                    <option value="">Any</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Exam Type</label>
                  <select
                    className={field}
                    value={examTypeId}
                    onChange={(e) => setExamTypeId(e.target.value)}
                  >
                    <option value="">None</option>
                    {examTypes.map((et) => (
                      <option key={et.id} value={et.id}>{et.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Language</label>
                  <select
                    className={field}
                    value={languageId}
                    onChange={(e) => setLanguageId(e.target.value)}
                  >
                    <option value="">None</option>
                    {languages.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Settings</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Duration (minutes)</label>
                <input
                  type="number"
                  className={field}
                  value={durationMin}
                  min={1}
                  onChange={(e) => setDurationMin(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Passing Marks</label>
                <input
                  type="number"
                  className={field}
                  value={passingMarks}
                  min={0}
                  onChange={(e) => setPassingMarks(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="text-sm text-slate-600">
              Total Marks: <span className="font-semibold text-slate-900">{totalMarks}</span>
            </div>
            <div className="space-y-2">
              <Toggle label="Shuffle Questions" checked={shuffleQuestions} onChange={setShuffleQuestions} />
              <Toggle label="Shuffle Options" checked={shuffleOptions} onChange={setShuffleOptions} />
              <Toggle label="Show Results" checked={showResults} onChange={setShowResults} />
              <Toggle label="Show Answers" checked={showAnswers} onChange={setShowAnswers} />
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Save</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => save("draft")} loading={saving === "draft"}>
                <Save className="h-4 w-4" aria-hidden /> Save Draft
              </Button>
              <Button onClick={() => save("published")} loading={saving === "published"}>
                <Send className="h-4 w-4" aria-hidden /> Publish
              </Button>
            </div>
            {status === "published" && !editId && (
              <p className="text-xs text-slate-500">Select questions below before publishing.</p>
            )}
          </section>
        </div>

        {/* ---- Right: question pool + selected ---- */}
        <div className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Add Questions</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Chapter</label>
                <select
                  className={field}
                  value={filters.chapter_id}
                  onChange={(e) => setFilters((f) => ({ ...f, chapter_id: e.target.value, topic_id: "" }))}
                >
                  <option value="">All</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Topic</label>
                <select
                  className={field}
                  value={filters.topic_id}
                  onChange={(e) => setFilters((f) => ({ ...f, topic_id: e.target.value }))}
                >
                  <option value="">All</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
              <select
                className={field}
                value={filters.qtype}
                onChange={(e) => setFilters((f) => ({ ...f, qtype: e.target.value }))}
              >
                <option value="">All types</option>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {poolLoading && <p className="text-sm text-slate-400">Loading questions…</p>}
              {!poolLoading && pool.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">
                  No questions match. Select a standard to load questions.
                </p>
              )}
              {!poolLoading &&
                pool.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm text-slate-800">{richTextToPlain(q.content)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {typeLabels[q.type] ?? q.type} · {q.subject_id ? "Subject Q" : "—"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addQuestion(q)}
                      disabled={selected.some((s) => s.question.id === q.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                      title="Add"
                    >
                      {selected.some((s) => s.question.id === q.id) ? (
                        <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                      ) : (
                        <Plus className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Selected Questions <span className="ml-1 text-slate-400">({selected.length})</span>
              </h2>
            </div>
            {selected.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-400">No questions selected yet.</p>
            )}
            <div className="space-y-1.5">
              {selected.map((s, idx) => (
                <div key={s.question.id} className="rounded-xl border border-slate-200 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm text-slate-800">
                        <span className="mr-1 font-semibold text-slate-400">{idx + 1}.</span>
                        {richTextToPlain(s.question.content)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                        title="Move up"
                      >
                        <ChevronUp className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(idx, 1)}
                        disabled={idx === selected.length - 1}
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                        title="Move down"
                      >
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePreview(s.question.id)}
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
                        title="Preview"
                      >
                        {s.previewOpen ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(s.question.id)}
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-slate-500">Marks</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={s.marks}
                      onChange={(e) => setMarks(s.question.id, Number(e.target.value) || 0)}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-slate-400">Question type: {typeLabels[s.question.type] ?? s.question.type}</span>
                  </div>
                  {s.previewOpen && (
                    <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="text-slate-800">{richTextToPlain(s.question.content)}</p>
                      {s.question.explanation ? (
                        <p className="mt-1 text-xs italic text-slate-500">Explanation: {richTextToPlain(s.question.explanation)}</p>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-4">
        <ClipboardList className="h-5 w-5 text-slate-400" aria-hidden />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => save("draft")} loading={saving === "draft"}>
            <Save className="h-4 w-4" aria-hidden /> Save Draft
          </Button>
          <Button onClick={() => save("published")} loading={saving === "published"}>
            <Send className="h-4 w-4" aria-hidden /> Publish
          </Button>
        </div>
      </div>
    </div>
  );
}
