import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, BookOpenCheck, ChevronDown, Eye, History, Languages, ListFilter, Loader2, Plus, Save, SaveAll, Trash2, X } from "lucide-react";
import {
  api,
  ApiError,
  type Standard,
  type Subject,
  type Chapter,
  type Topic,
  type ExamType,
  type Language,
  type ResourceType,
  type Question,
  type QuestionOption,
} from "../api/client";
import { Button } from "./components/Button";
import { RichEditor } from "./components/RichEditor";
import { QuestionHistoryPanel } from "./components/QuestionHistoryPanel";
import { QuestionViewModal } from "./components/QuestionViewModal";
import { LinkVariantModal } from "./components/LinkVariantModal";
import { StoredRichText } from "./components/StoredRichText";
import { storedHtml } from "./components/storedRichHelper";
import { TagInput } from "./components/TagInput";

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
  { value: "mcq_single", label: "MCQ (Single)" },
  { value: "mcq_multi", label: "MCQ (Multiple)" },
  { value: "true_false", label: "True / False" },
  { value: "fill_blank", label: "Fill in the Blank" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long / Essay" },
  { value: "match", label: "Match" },
  { value: "ordering", label: "Ordering" },
  { value: "image_based", label: "Image Based" },
  { value: "numeric", label: "Numeric" },
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
  content: { html: string };
  explanation: { html: string };
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

function emptyDraft(): Draft {
  return {
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
  };
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const selectCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";
const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      {children}
    </div>
  );
}

function HierarchyBar({
  standards,
  subjects,
  chapters,
  topics,
  resourceTypes,
  standardId,
  subjectId,
  resourceTypeId,
  chapterId,
  topicId,
  mappedSubjectIds,
  onStandard,
  onSubject,
  onResourceType,
  onChapter,
  onTopic,
}: {
  standards: Standard[];
  subjects: Subject[];
  chapters: Chapter[];
  topics: Topic[];
  resourceTypes: ResourceType[];
  standardId: string;
  subjectId: string;
  resourceTypeId: string;
  chapterId: string;
  topicId: string;
  mappedSubjectIds: Set<string> | null;
  onStandard: (id: string) => void;
  onSubject: (id: string) => void;
  onResourceType: (id: string) => void;
  onChapter: (id: string) => void;
  onTopic: (id: string) => void;
}) {
  const filteredSubjects = !standardId
    ? []
    : !mappedSubjectIds
      ? subjects
      : subjects.filter((s) => mappedSubjectIds.has(s.id));

  const item = (label: string, value: string, options: { id: string; name: string }[], onChange: (id: string) => void, disabled?: boolean) => {
    return (
      <div className="min-w-0 flex-1">
        <label className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</label>
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls} disabled={disabled}>
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {item("Standard", standardId, standards, onStandard)}
        {item("Subject", subjectId, filteredSubjects, onSubject, !standardId)}
        {item("Resource Type", resourceTypeId, resourceTypes, onResourceType, !standardId || !subjectId)}
        {item("Chapter", chapterId, chapters, onChapter, !standardId || !subjectId)}
        {item("Topic", topicId, topics, onTopic, !chapterId)}
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
          <TagInput tags={draft.tags} onChange={(tags) => setDraftField("tags", tags)} />
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

function stringifyContent(content: unknown): string {
  const html = typeof content === "string" ? content : (content as { html?: string } | null)?.html ?? "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "Untitled question";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface QuestionEntryFormProps {
  standards: Standard[];
  subjects: Subject[];
  chapters: Chapter[];
  topics: Topic[];
  resourceTypes: ResourceType[];
  examTypes: ExamType[];
  languages: Language[];
  editingQuestionId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function QuestionEntryForm({
  standards,
  subjects,
  chapters,
  topics,
  resourceTypes,
  examTypes,
  languages,
  editingQuestionId,
  onClose,
  onSaved,
}: QuestionEntryFormProps) {
  // Master data for internal hierarchy
  const [resourceTypesLocal] = useState<ResourceType[]>(resourceTypes);

  // Internal hierarchy state
  const [standardId, setStandardId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [resourceTypeId, setResourceTypeId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [mappedSubjectIds, setMappedSubjectIds] = useState<Set<string> | null>(null);
  const [internalChapters, setInternalChapters] = useState<Chapter[]>([]);
  const [internalTopics, setInternalTopics] = useState<Topic[]>([]);

  // Question list for this hierarchy
  const [questions, setQuestions] = useState<Question[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  // Draft editor
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [saving, setSaving] = useState<"draft" | "published" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewQuestionId, setViewQuestionId] = useState<string | null>(null);
  const [variantModalOpen, setVariantModalOpen] = useState(false);

  // Wizard tabs
  const [activeTab, setActiveTab] = useState<"question" | "metadata" | "review">("question");

  // ---- Load mapped subjects when standard changes ----
  useEffect(() => {
    let cancelled = false;
    if (!standardId) {
      setMappedSubjectIds(null);
      return;
    }
    api.standardSubjects
      .list({ standard_id: standardId })
      .then((res) => {
        if (cancelled) return;
        const ids = res.mappings.map((m) => m.subject_id);
        setMappedSubjectIds(ids.length ? new Set(ids) : null);
      })
      .catch(() => { if (!cancelled) setMappedSubjectIds(null); });
    return () => { cancelled = true; };
  }, [standardId]);

  // ---- Load chapters when standard + subject selected ----
  useEffect(() => {
    if (!standardId || !subjectId) {
      setInternalChapters([]);
      setChapterId("");
      setInternalTopics([]);
      setTopicId("");
      return;
    }
    api.chapters
      .list({
        standard_id: standardId,
        subject_id: subjectId,
        resource_type_ids: resourceTypeId ? [resourceTypeId] : undefined,
      })
      .then((res) => setInternalChapters(res.chapters))
      .catch(() => setInternalChapters([]));
  }, [standardId, subjectId, resourceTypeId]);

  // ---- Load topics when chapter selected ----
  useEffect(() => {
    if (!chapterId) {
      setInternalTopics([]);
      setTopicId("");
      return;
    }
    api.topics
      .list({ chapter_id: chapterId })
      .then((res) => setInternalTopics(res.topics))
      .catch(() => setInternalTopics([]));
  }, [chapterId]);

  // ---- Load question list filtered by selection ----
  useEffect(() => {
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

  // ---- Load question for editing ----
  useEffect(() => {
    if (!editingQuestionId) return;
    api.questions
      .get(editingQuestionId)
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
  }, [editingQuestionId]);

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
    setFamilyId(q.family_id);
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
    setFamilyId(null);
  };

  const createVariantFromCurrent = () => {
    setDraft((d) => ({ ...d, id: null }));
    setSelectedIdx(-1);
    setVariantModalOpen(false);
    setActiveTab("question");
  };

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
        : await api.questions.create({
            ...base,
            ...(familyId ? { family_id: familyId } : {}),
            options,
            payload,
          });

      if (res.question.family_id) setFamilyId(res.question.family_id);
      if (status === "published") {
        setSelectedIdx(questions.findIndex((q) => q.id === res.question.id));
      }
      toast.success("Saved.");
      setDraft((d) => ({ ...d, id: res.question.id }));
      // refresh list
      api.questions
        .list({ standard_id: standardId || undefined, subject_id: subjectId || undefined, chapter_id: chapterId || undefined, topic_id: topicId || undefined, limit: 200 })
        .then((r) => setQuestions(r.questions));
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save question.");
    } finally {
      setSaving(null);
    }
  };

  const selectionReady =
    Boolean(standardId) && Boolean(subjectId) && Boolean(chapterId) && Boolean(topicId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-treat text-slate-900">
              {editingQuestionId ? "Edit Question" : "New Question"}
            </h1>
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
          chapters={internalChapters}
          topics={internalTopics}
          resourceTypes={resourceTypesLocal}
          standardId={standardId}
          subjectId={subjectId}
          resourceTypeId={resourceTypeId}
          chapterId={chapterId}
          topicId={topicId}
          mappedSubjectIds={mappedSubjectIds}
          onStandard={setStandardId}
          onSubject={setSubjectId}
          onResourceType={setResourceTypeId}
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
              <>
                <Button size="sm" variant="secondary" onClick={() => setHistoryOpen(true)}>
                  <History className="h-4 w-4" aria-hidden /> History
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setVariantModalOpen(true)}>
                  <Languages className="h-4 w-4" aria-hidden /> Add Variant
                </Button>
              </>
            )}
            <Button size="sm" variant="secondary" onClick={prevQuestion} disabled={selectedIdx <= 0}>
              ← Prev
            </Button>
            <Button size="sm" variant="secondary" onClick={nextQuestion}>
              Next →
            </Button>
          </div>
        </div>

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
                chapterName={internalChapters.find((c) => c.id === chapterId)?.name ?? "—"}
                topicName={internalTopics.find((t) => t.id === topicId)?.name ?? "—"}
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

      <QuestionViewModal questionId={viewQuestionId} open={Boolean(viewQuestionId)} onClose={() => setViewQuestionId(null)} />

      <LinkVariantModal
        open={variantModalOpen}
        questionId={draft.id}
        languages={languages}
        onClose={() => setVariantModalOpen(false)}
        onLinked={(fid) => {
          if (fid) setFamilyId(fid);
        }}
        onCreateVariant={createVariantFromCurrent}
      />

      <QuestionHistoryPanel
        questionId={draft.id}
        questionLabel={stringifyContent(draft.content)}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
