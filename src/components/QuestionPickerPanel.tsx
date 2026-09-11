import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Search, X } from "lucide-react";
import {
  api,
  type Question,
  type QuestionFilters,
  type QuestionVariant,
} from "../api/client";
import { richTextToPlain } from "../admin/components/richText";

export interface PickerQuestion {
  family_id: string | null;
  question_id: string;
  question: Question;
  variants: QuestionVariant[] | null;
}

interface QuestionPickerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (questions: PickerQuestion[]) => void;
}

interface FilterState {
  standard_id: string;
  subject_id: string;
  chapter_id: string;
  topic_id: string;
  language_id: string;
  type: string;
  search: string;
}

const EMPTY_FILTERS: FilterState = {
  standard_id: "",
  subject_id: "",
  chapter_id: "",
  topic_id: "",
  language_id: "",
  type: "",
  search: "",
};

const QUESTION_TYPE_OPTIONS = [
  { value: "mcq_single", label: "MCQ (Single)" },
  { value: "mcq_multi", label: "MCQ (Multiple)" },
  { value: "true_false", label: "True / False" },
  { value: "fill_blank", label: "Fill in the Blank" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
  { value: "match", label: "Match the Following" },
  { value: "ordering", label: "Ordering" },
  { value: "numeric", label: "Numeric" },
  { value: "image_based", label: "Image Based" },
];

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">{placeholder}</option>
        {(options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function QuestionPickerPanel({
  isOpen,
  onClose,
  onInsert,
}: QuestionPickerPanelProps) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [standards, setStandards] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([]);
  const [topics, setTopics] = useState<{ id: string; name: string }[]>([]);
  const [languages, setLanguages] = useState<{ id: string; name: string; code?: string }[]>([]);

  const setFilter = useCallback((key: keyof FilterState, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Reset cascade when parent changes
      if (key === "standard_id") {
        next.subject_id = "";
        next.chapter_id = "";
        next.topic_id = "";
        setChapters([]);
        setTopics([]);
      } else if (key === "subject_id") {
        next.chapter_id = "";
        next.topic_id = "";
        setTopics([]);
      } else if (key === "chapter_id") {
        next.topic_id = "";
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      try {
        const f: QuestionFilters = {};
        if (filters.standard_id) f.standard_id = filters.standard_id;
        if (filters.subject_id) f.subject_id = filters.subject_id;
        if (filters.chapter_id) f.chapter_id = filters.chapter_id;
        if (filters.topic_id) f.topic_id = filters.topic_id;
        if (filters.language_id) f.language_id = filters.language_id;
        if (filters.type) f.type = filters.type;
        if (filters.search.trim()) f.search = filters.search.trim();
        f.status = "published";
        f.limit = 100;
        const res = await api.questions.list(f);
        if (cancelled) return;
        setQuestions(res.questions || []);
        setTotal(res.total || 0);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load questions";
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, filters, reloadTick]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      try {
        const [stRes, sbRes, lgRes] = await Promise.all([
          api.standards.list(),
          api.subjects.list(),
          api.languages.list(),
        ]);
        if (cancelled) return;
        setStandards(stRes.standards || []);
        setSubjects(sbRes.subjects || []);
        setLanguages(lgRes.languages || []);
      } catch {
        // non-fatal: dropdowns stay empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !filters.subject_id) return;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      try {
        const res = await api.chapters.list({ subject_id: filters.subject_id });
        if (!cancelled) setChapters(res.chapters || []);
      } catch {
        if (!cancelled) setChapters([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, filters.subject_id]);

  useEffect(() => {
    if (!isOpen || !filters.chapter_id) return;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      try {
        const res = await api.topics.list({ chapter_id: filters.chapter_id });
        if (!cancelled) setTopics(res.topics || []);
      } catch {
        if (!cancelled) setTopics([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, filters.chapter_id]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleInsert = useCallback(async () => {
    if (selected.size === 0) {
      toast.info("Select at least one question to insert.");
      return;
    }
    setResolving(true);
    try {
      const selectedQuestions = questions.filter((q) => selected.has(q.id));
      const picked: PickerQuestion[] = [];
      for (const q of selectedQuestions) {
        let variants: QuestionVariant[] | null = null;
        if (q.family_id) {
          try {
            const res = await api.questions.variants(q.id);
            variants = res.variants;
          } catch {
            variants = null;
          }
        }
        picked.push({
          family_id: q.family_id,
          question_id: q.id,
          question: q,
          variants,
        });
      }
      onInsert(picked);
      toast.success(`${picked.length} question(s) added to the paper.`);
      setSelected(new Set());
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve questions.");
    } finally {
      setResolving(false);
    }
  }, [selected, questions, onInsert, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              Question Bank
            </h2>
            <p className="text-xs text-slate-500">
              Select questions to insert into the paper
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 md:grid-cols-3">
          <Select
            label="Standard"
            value={filters.standard_id}
            onChange={(v) => setFilter("standard_id", v)}
            placeholder="All standards"
            options={standards.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            label="Subject"
            value={filters.subject_id}
            onChange={(v) => setFilter("subject_id", v)}
            placeholder="All subjects"
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            label="Chapter"
            value={filters.chapter_id}
            onChange={(v) => setFilter("chapter_id", v)}
            placeholder="All chapters"
            options={chapters.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            label="Topic"
            value={filters.topic_id}
            onChange={(v) => setFilter("topic_id", v)}
            placeholder="All topics"
            options={topics.map((t) => ({ value: t.id, label: t.name }))}
          />
          <Select
            label="Language"
            value={filters.language_id}
            onChange={(v) => setFilter("language_id", v)}
            placeholder="All languages"
            options={languages.map((l) => ({ value: l.id, label: l.name }))}
          />
          <Select
            label="Question Type"
            value={filters.type}
            onChange={(v) => setFilter("type", v)}
            placeholder="All types"
            options={QUESTION_TYPE_OPTIONS}
          />
          <div className="col-span-2 flex items-end gap-2 md:col-span-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
                placeholder="Search questions..."
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              type="button"
              onClick={() => setReloadTick((t) => t + 1)}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-600"
            >
              Search
            </button>
          </div>
        </div>

        {/* Question list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Loading questions...
            </div>
          ) : questions.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No published questions match your filters.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {questions.map((q) => {
                const checked = selected.has(q.id);
                const plain = richTextToPlain(q.content);
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => toggleSelect(q.id)}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        checked
                          ? "bg-primary/5 ring-1 ring-primary/30"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                          checked
                            ? "border-primary bg-primary text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm text-slate-800">
                          {plain || "(empty question)"}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                            {QUESTION_TYPE_OPTIONS.find((o) => o.value === q.type)
                              ?.label ?? q.type}
                          </span>
                          <span>{q.marks} mark(s)</span>
                          {q.difficulty && (
                            <span className="capitalize">{q.difficulty}</span>
                          )}
                          {q.family_id && (
                            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 font-medium text-blue-600">
                              multilingual
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!loading && total > questions.length && (
            <p className="pt-3 text-center text-xs text-slate-400">
              Showing {questions.length} of {total}. Refine filters for more specific results.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <span className="text-sm text-slate-600">
            <strong className="text-slate-800">{selected.size}</strong> selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInsert}
              disabled={selected.size === 0 || resolving}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resolving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Adding...
                </span>
              ) : (
                "Insert into Paper"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}