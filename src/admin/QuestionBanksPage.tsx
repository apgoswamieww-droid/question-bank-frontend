import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  BookOpenCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FilterX,
  Library,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
} from "lucide-react";
import {
  api,
  ApiError,
  type Chapter,
  type ExamType,
  type Language,
  type Question,
  type QuestionAggregateCounts,
  type QuestionFilters,
  type QuestionLevel,
  type ResourceType,
  type Standard,
  type Subject,
  type Topic,
} from "../api/client";
import { Button } from "./components/Button";
import { EmptyState } from "./components/EmptyState";
import { richTextToPlain } from "./components/richText";
import { storedHtml } from "./components/storedRichHelper";
import { StoredRichText } from "./components/StoredRichText";
import { QuestionViewModal } from "./components/QuestionViewModal";
import QuestionEntryForm from "./QuestionEntryForm";
import { useCan, PERMISSIONS } from "../context/useAdminAuth";

const TYPE_LABELS: Record<string, string> = {
  mcq_single: "MCQ (Single)",
  mcq_multi: "MCQ (Multiple)",
  true_false: "True / False",
  fill_blank: "Fill in the Blank",
  short_answer: "Short Answer",
  long_answer: "Long / Essay",
  match: "Match",
  ordering: "Ordering",
  numeric: "Numeric",
  image_based: "Image Based",
};

const DIFFICULTIES = ["easy", "medium", "hard", "expert"];
const STATUSES = ["draft", "published", "archived"];
const PAGE_SIZE = 10;

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

// ---------------------------------------------------------------------------
// Saved filter presets (localStorage)
// ---------------------------------------------------------------------------
const PRESETS_KEY = "qb.search.presets";

interface Preset {
  id: string;
  name: string;
  filters: QuestionFilters;
  savedAt: string;
}

function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? (JSON.parse(raw) as Preset[]) : [];
  } catch {
    return [];
  }
}

function persistPresets(presets: Preset[]) {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    /* storage unavailable */
  }
}

function stripEmpty(filters: QuestionFilters): QuestionFilters {
  const out: QuestionFilters = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k as keyof QuestionFilters] = v as never;
  }
  return out;
}

const EMPTY_FILTERS: QuestionFilters = {};
const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";

// ---------------------------------------------------------------------------
// Small labelled input wrapper
// ---------------------------------------------------------------------------
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function SelectWithCount({
  value,
  onChange,
  options,
  placeholder = "All",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string; count?: number }[];
  placeholder?: string;
}) {
  return (
    <select className={field} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
          {typeof o.count === "number" ? ` (${o.count})` : ""}
        </option>
      ))}
    </select>
  );
}

export default function QuestionBanksPage() {
  const can = useCan();
  const navigate = useNavigate();

  // ---- master data ----
  const [standards, setStandards] = useState<Standard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [levels, setLevels] = useState<QuestionLevel[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [mappedSubjectIds, setMappedSubjectIds] = useState<Set<string> | null>(null);
  // ---- filter state (draft vs applied) ----
  const [draft, setDraft] = useState<QuestionFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<QuestionFilters>(EMPTY_FILTERS);

  // ---- aggregate counts for hierarchy dropdowns ----
  const [aggregate, setAggregate] = useState<QuestionAggregateCounts>({
    by_standard: [],
    by_subject: [],
    by_chapter: [],
    by_topic: [],
  });

  // ---- results ----
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewQuestionId, setViewQuestionId] = useState<string | null>(null);

  // ---- presets ----
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const presetInputRef = useRef<HTMLInputElement>(null);

  // ---- ui ----
  const [filtersOpen, setFiltersOpen] = useState(true);
  // ---- entry mode ----
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Master data loading
  // ------------------------------------------------------------------
  useEffect(() => {
    Promise.all([
      api.standards.list(),
      api.subjects.list(),
      api.examTypes.list(),
      api.languages.list(),
      api.questionLevels.list(),
      api.resourceTypes.list(),
    ])
      .then(([s, sub, et, lang, lvl, rt]) => {
        setStandards(s.standards);
        setSubjects(sub.subjects);
        setExamTypes(et.examTypes);
        setLanguages(lang.languages);
        setLevels(lvl.levels);
        setResourceTypes(rt.resourceTypes);
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Failed to load filter options."));
  }, []);

  // ---- Load mapped subjects when standard changes ----
  useEffect(() => {
    let cancelled = false;
    if (!draft.standard_id) {
      setMappedSubjectIds(null);
      return;
    }
    api.standardSubjects
      .list({ standard_id: draft.standard_id })
      .then((res) => {
        if (cancelled) return;
        const ids = res.mappings.map((m) => m.subject_id);
        setMappedSubjectIds(ids.length ? new Set(ids) : null);
      })
      .catch(() => { if (!cancelled) setMappedSubjectIds(null); });
    return () => { cancelled = true; };
  }, [draft.standard_id]);

  // Cascading chapters / topics
  useEffect(() => {
    if (!draft.standard_id || !draft.subject_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChapters([]);
      return;
    }
    api.chapters
      .list({
        standard_id: draft.standard_id,
        subject_id: draft.subject_id,
        resource_type_ids: draft.resource_type_id ? [draft.resource_type_id] : undefined,
      })
      .then((res) => setChapters(res.chapters))
      .catch(() => setChapters([]));
  }, [draft.standard_id, draft.subject_id, draft.resource_type_id]);

  useEffect(() => {
    if (!draft.chapter_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTopics([]);
      return;
    }
    api.topics
      .list({ chapter_id: draft.chapter_id })
      .then((res) => setTopics(res.topics))
      .catch(() => setTopics([]));
  }, [draft.chapter_id]);

  // ------------------------------------------------------------------
  // Aggregate counts (for dropdown "N" totals), fed from applied filters
  // ------------------------------------------------------------------
  useEffect(() => {
    api.questions
      .aggregate({ ...applied })
      .then(setAggregate)
      .catch(() =>
        setAggregate({ by_standard: [], by_subject: [], by_chapter: [], by_topic: [] })
      );
  }, [applied]);

  // ------------------------------------------------------------------
  // Fetch results from applied filters
  // ------------------------------------------------------------------
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api.questions
      .list({
        ...applied,
        with_usage: true,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      .then((res) => {
        setQuestions(res.questions);
        setTotal(res.total);
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Failed to load questions."))
      .finally(() => setLoading(false));
  }, [applied, page]);

  // ------------------------------------------------------------------
  // Derived dropdown options with counts
  // ------------------------------------------------------------------
  const countOf = (arr: { id: string; count: number }[], id: string | undefined) => {
    if (!id) return undefined;
    return arr.find((a) => a.id === id)?.count;
  };

  const filteredSubjects = !draft.standard_id
    ? []
    : !mappedSubjectIds
      ? subjects
      : subjects.filter((s) => mappedSubjectIds.has(s.id));

  const standardOptions = standards.map((s) => ({
    id: s.id,
    label: s.name,
    count: countOf(aggregate.by_standard, s.id),
  }));
  const subjectOptions = filteredSubjects.map((s) => ({
    id: s.id,
    label: s.name,
    count: countOf(aggregate.by_subject, s.id),
  }));
  const chapterOptions = chapters.map((c) => ({
    id: c.id,
    label: c.name,
    count: countOf(aggregate.by_chapter, c.id),
  }));
  const topicOptions = topics.map((t) => ({
    id: t.id,
    label: t.name,
    count: countOf(aggregate.by_topic, t.id),
  }));

  const standardName = (id: string | null | undefined) =>
    standards.find((s) => s.id === id)?.name ?? "—";
  const subjectName = (id: string | null | undefined) =>
    subjects.find((s) => s.id === id)?.name ?? "—";

  const activeFilterCount = useMemo(
    () => Object.keys(stripEmpty(applied)).length,
    [applied]
  );

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------
  const applyFilters = () => {
    setPage(0);
    setApplied(stripEmpty({ ...draft }));
  };

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  // preset management
  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const preset: Preset = {
      id: `${Date.now()}`,
      name,
      filters: stripEmpty({ ...applied }),
      savedAt: new Date().toISOString(),
    };
    const next = [...presets, preset];
    setPresets(next);
    persistPresets(next);
    setPresetName("");
    setPresetOpen(false);
  };

  const loadPreset = (p: Preset) => {
    setDraft({ ...p.filters });
    setApplied({ ...p.filters });
    setPage(0);
    setPresetOpen(false);
  };

  const deletePreset = (id: string) => {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    persistPresets(next);
  };

  const refreshResults = () => {
    api.questions
      .list({ ...applied, with_usage: true, limit: PAGE_SIZE, offset: safePage * PAGE_SIZE })
      .then((res) => {
        setQuestions(res.questions);
        setTotal(res.total);
      })
      .catch(() => undefined);
  };

  const duplicateQuestion = async (q: Question) => {
    try {
      await api.questions.duplicate(q.id);
      toast.success("Question duplicated.");
      refreshResults();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to duplicate question.");
    }
  };

  if (!can(PERMISSIONS.QUESTION_BANKS_VIEW)) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
        You do not have permission to view question banks.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary">
            <Library className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Question Banks</h1>
            <p className="text-sm text-slate-600">
              Search and browse all questions across the platform.
            </p>
          </div>
        </div>

        {/* Presets */}
        <div className="flex items-center gap-2">
          {can(PERMISSIONS.QUESTION_BANKS_MANAGE) && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => { setEditingQuestionId(null); setEntryOpen(true); }}
            >
              <Plus className="h-4 w-4" aria-hidden /> Add Questions
            </Button>
          )}
          <div className="relative">
          <Button variant="secondary" size="sm" onClick={() => setPresetOpen((o) => !o)}>
            <Save className="h-4 w-4" aria-hidden /> Saved Searches
            {presets.length > 0 && (
              <span className="ml-0.5 rounded-full bg-primary-50 px-1.5 text-xs font-semibold text-primary">
                {presets.length}
              </span>
            )}
          </Button>

          {presetOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Save current filters</p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    ref={presetInputRef}
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") savePreset();
                    }}
                    placeholder="Preset name…"
                    className={`${field} py-1.5`}
                  />
                  <Button size="sm" onClick={savePreset} disabled={!presetName.trim()}>
                    Save
                  </Button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {presets.length === 0 && (
                  <p className="px-4 py-4 text-center text-sm text-slate-400">No saved searches yet.</p>
                )}
                {presets.map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-center gap-2 px-3 py-2 hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => loadPreset(p)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      <span className="truncate text-sm text-slate-700">{p.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePreset(p.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete preset"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {entryOpen ? (
        <QuestionEntryForm
          standards={standards}
          subjects={subjects}
          chapters={chapters}
          topics={topics}
          resourceTypes={resourceTypes}
          examTypes={examTypes}
          languages={languages}
          editingQuestionId={editingQuestionId}
          onClose={() => setEntryOpen(false)}
          onSaved={() => { setEntryOpen(false); refreshResults(); }}
        />
      ) : (
      <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {filtersOpen && (
          <div className="space-y-4 border-t border-slate-100 px-5 py-4">
            {/* Keyword search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                value={draft.search ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
                placeholder="Search question content (keyword)…"
                className={`${field} pl-9`}
              />
            </div>

            {/* Hierarchy */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <FilterField label="Standard">
                <SelectWithCount
                  value={draft.standard_id ?? ""}
                  onChange={(v) =>
                    setDraft((d) => ({ ...d, standard_id: v, subject_id: "", resource_type_id: "", chapter_id: "", topic_id: "" }))
                  }
                  options={standardOptions}
                  placeholder="All standards"
                />
              </FilterField>
              <FilterField label="Subject">
                <SelectWithCount
                  value={draft.subject_id ?? ""}
                  onChange={(v) =>
                    setDraft((d) => ({ ...d, subject_id: v, resource_type_id: "", chapter_id: "", topic_id: "" }))
                  }
                  options={subjectOptions}
                  placeholder={draft.standard_id ? (mappedSubjectIds === null ? "Loading..." : "All subjects") : "Select standard first"}
                />
              </FilterField>
              <FilterField label="Resource Type">
                <SelectWithCount
                  value={draft.resource_type_id ?? ""}
                  onChange={(v) =>
                    setDraft((d) => ({ ...d, resource_type_id: v, chapter_id: "", topic_id: "" }))
                  }
                  options={resourceTypes.map((rt) => ({ id: rt.id, label: rt.name }))}
                  placeholder="All types"
                />
              </FilterField>
              <FilterField label="Chapter">
                <SelectWithCount
                  value={draft.chapter_id ?? ""}
                  onChange={(v) => setDraft((d) => ({ ...d, chapter_id: v, topic_id: "" }))}
                  options={chapterOptions}
                  placeholder={chapters.length ? "All chapters" : "Select subject first"}
                />
              </FilterField>
              <FilterField label="Topic">
                <SelectWithCount
                  value={draft.topic_id ?? ""}
                  onChange={(v) => setDraft((d) => ({ ...d, topic_id: v }))}
                  options={topicOptions}
                  placeholder={topics.length ? "All topics" : "Select chapter first"}
                />
              </FilterField>
            </div>

            {/* Classification */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <FilterField label="Question Type">
                <select className={field} value={draft.type ?? ""} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}>
                  <option value="">All types</option>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Difficulty">
                <select className={field} value={draft.difficulty ?? ""} onChange={(e) => setDraft((d) => ({ ...d, difficulty: e.target.value }))}>
                  <option value="">All difficulties</option>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Level">
                <select className={field} value={draft.level_id ?? ""} onChange={(e) => setDraft((d) => ({ ...d, level_id: e.target.value }))}>
                  <option value="">All levels</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Exam Type">
                <select className={field} value={draft.exam_type_id ?? ""} onChange={(e) => setDraft((d) => ({ ...d, exam_type_id: e.target.value }))}>
                  <option value="">All exam types</option>
                  {examTypes.map((et) => (
                    <option key={et.id} value={et.id}>{et.name}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Language">
                <select className={field} value={draft.language_id ?? ""} onChange={(e) => setDraft((d) => ({ ...d, language_id: e.target.value }))}>
                  <option value="">All languages</option>
                  {languages.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Status">
                <select className={field} value={draft.status ?? ""} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                  <option value="">All statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Exam Year">
                <input
                  type="number"
                  className={field}
                  value={draft.exam_year ?? ""}
                  placeholder="e.g. 2024"
                  onChange={(e) => setDraft((d) => ({ ...d, exam_year: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </FilterField>
              <FilterField label="Min Marks">
                <input
                  type="number"
                  className={field}
                  value={draft.min_marks ?? ""}
                  placeholder="Min"
                  onChange={(e) => setDraft((d) => ({ ...d, min_marks: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </FilterField>
              <FilterField label="Max Marks">
                <input
                  type="number"
                  className={field}
                  value={draft.max_marks ?? ""}
                  placeholder="Max"
                  onChange={(e) => setDraft((d) => ({ ...d, max_marks: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </FilterField>
              <FilterField label="Min Negative Marks">
                <input
                  type="number"
                  className={field}
                  value={draft.min_negative_marks ?? ""}
                  placeholder="Min"
                  onChange={(e) => setDraft((d) => ({ ...d, min_negative_marks: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </FilterField>
              <FilterField label="Max Negative Marks">
                <input
                  type="number"
                  className={field}
                  value={draft.max_negative_marks ?? ""}
                  placeholder="Max"
                  onChange={(e) => setDraft((d) => ({ ...d, max_negative_marks: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </FilterField>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FilterField label="Created From">
                <input type="date" className={field} value={draft.created_from ?? ""} onChange={(e) => setDraft((d) => ({ ...d, created_from: e.target.value }))} />
              </FilterField>
              <FilterField label="Created To">
                <input type="date" className={field} value={draft.created_to ?? ""} onChange={(e) => setDraft((d) => ({ ...d, created_to: e.target.value }))} />
              </FilterField>
              <FilterField label="Updated From">
                <input type="date" className={field} value={draft.updated_from ?? ""} onChange={(e) => setDraft((d) => ({ ...d, updated_from: e.target.value }))} />
              </FilterField>
              <FilterField label="Updated To">
                <input type="date" className={field} value={draft.updated_to ?? ""} onChange={(e) => setDraft((d) => ({ ...d, updated_to: e.target.value }))} />
              </FilterField>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-500">
                {total.toLocaleString()} question{total === 1 ? "" : "s"} match
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  <FilterX className="h-4 w-4" aria-hidden /> Clear all
                </Button>
                <Button size="sm" onClick={applyFilters}>
                  <Search className="h-4 w-4" aria-hidden /> Apply filters
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <BookOpenCheck className="h-4 w-4 text-primary" aria-hidden /> Results
            <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {total.toLocaleString()}
            </span>
          </h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden />}
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Search className="h-6 w-6" aria-hidden />}
              title="No questions found"
              description={
                activeFilterCount > 0
                  ? "Try adjusting or clearing your filters."
                  : "Questions you add will appear here. Start by applying a filter or creating questions from the Question Entry page."
              }
              action={
                can(PERMISSIONS.QUESTION_BANKS_MANAGE) ? (
                  <Button size="sm" onClick={() => { setEditingQuestionId(null); setEntryOpen(true); }}>
                    Add Questions
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Question</th>
                  <th className="px-3 py-3">Standard</th>
                  <th className="px-3 py-3">Subject</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Marks</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {questions.map((q) => {
                  const fullText = richTextToPlain(q.content) || "Untitled question";
                  return (
                    <tr key={q.id} className="align-middle">
                      <td className="min-w-0 px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500"
                            title={q.id}
                          >
                            #{shortId(q.id)}
                          </span>
                          <span
                            className="min-w-0 max-w-[420px] flex-1 truncate text-sm text-slate-800 [&_.katex]:text-[13px] [&_.katex]:whitespace-nowrap"
                            title={fullText}
                          >
                            {storedHtml(q.content) ? <StoredRichText value={q.content} /> : fullText}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 font-medium text-slate-700">
                        {standardName(q.standard_id)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-slate-600">
                        {subjectName(q.subject_id)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5">
                        <span className="rounded-md bg-primary-50 px-1.5 py-0.5 font-medium text-primary">
                          {TYPE_LABELS[q.type] ?? q.type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-slate-600">
                        {q.marks}
                        {q.negative_marks > 0 && (
                          <span className="ml-1 text-xs text-red-500">(−{q.negative_marks})</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewQuestionId(q.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:border-primary hover:text-primary"
                            title="View question"
                            aria-label={`View question ${shortId(q.id)}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden />
                          </button>
                          {can(PERMISSIONS.QUESTION_BANKS_MANAGE) && (
                            <>
                              <button
                                type="button"
                                onClick={() => { setEditingQuestionId(q.id); setEntryOpen(true); }}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:border-primary hover:text-primary"
                                title="Edit question"
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => duplicateQuestion(q)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:border-primary hover:text-primary"
                                title="Duplicate"
                              >
                                <Copy className="h-4 w-4" aria-hidden />
                              </button>
                            </>
                          )}
                          <span
                            className="hidden items-center gap-1 rounded-md bg-slate-100 px-1.5 py-1 text-xs text-slate-500 sm:inline-flex"
                            title={`Quality score: ${q.quality_score}/100`}
                          >
                            <Star className="h-3.5 w-3.5 text-amber-400" aria-hidden /> {q.quality_score}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
            <p className="text-xs text-slate-500">
              Page <span className="font-medium text-slate-700">{safePage + 1}</span> of{" "}
              <span className="font-medium text-slate-700">{totalPages}</span> ·{" "}
              {total.toLocaleString()} results
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage(safePage + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </section>
      </>
      )}

      <QuestionViewModal
        questionId={viewQuestionId}
        open={viewQuestionId !== null}
        onClose={() => setViewQuestionId(null)}
      />
    </div>
  );
}