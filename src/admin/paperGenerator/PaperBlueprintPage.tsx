import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  Layers,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  type BlueprintPreview,
  type BlueprintValidation,
  type Chapter,
  type Paper,
  type PaperBlueprint,
  type Topic,
} from "../../api/client";
import { useCan, PERMISSIONS } from "../../context/useAdminAuth";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { TableSkeleton } from "../components/Skeleton";

const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";
const smallField =
  "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

const QUESTION_TYPE_OPTIONS = [
  { value: "", label: "Any type" },
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

const DIFFICULTY_OPTIONS = [
  { value: "", label: "Any difficulty" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "expert", label: "Expert" },
];

let uidCounter = 0;
const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`;

const emptyBlueprint = (): PaperBlueprint => ({
  version: 1,
  totalQuestions: 0,
  mode: "count",
  sections: [],
  rules: [],
});

export default function PaperBlueprintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = useCan();

  const [loading, setLoading] = useState(true);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [bp, setBp] = useState<PaperBlueprint>(emptyBlueprint());

  // Taxonomy (existing master data — reused, never duplicated)
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topicsByChapter, setTopicsByChapter] = useState<Record<string, Topic[]>>({});

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"validate" | "preview" | null>(null);
  const [validation, setValidation] = useState<(BlueprintValidation & { valid?: boolean }) | null>(null);
  const [preview, setPreview] = useState<BlueprintPreview | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const result = await api.papers.blueprint.get(id);
        setPaper(result.paper);
        setBp(result.blueprint ? (structuredClone(result.blueprint) as PaperBlueprint) : emptyBlueprint());
        if (result.paper.standard_id || result.paper.subject_id) {
          const ch = await api.chapters
            .list({
              standard_id: result.paper.standard_id ?? undefined,
              subject_id: result.paper.subject_id ?? undefined,
            })
            .catch(() => ({ chapters: [] as Chapter[] }));
          setChapters(ch.chapters);
          const topicMaps = await Promise.all(
            ch.chapters.map(async (c) => {
              const t = await api.topics.list({ chapter_id: c.id }).catch(() => ({ topics: [] as Topic[] }));
              return [c.id, t.topics] as const;
            })
          );
          setTopicsByChapter(Object.fromEntries(topicMaps));
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to load paper blueprint.");
        navigate("/admin/papers/all");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---- live per-section question counts (mirror of server-side logic) ----
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of bp.sections) {
      if (bp.mode === "count") {
        counts[s.id] = bp.rules
          .filter((r) => r.sectionId === s.id)
          .reduce((sum, r) => sum + (Number(r.count) || 0), 0);
      } else {
        const secPercent = bp.rules
          .filter((r) => r.sectionId === s.id)
          .reduce((sum, r) => sum + (Number(r.percent) || 0), 0);
        counts[s.id] = Math.round(((bp.totalQuestions || 0) * secPercent) / 100);
      }
    }
    return counts;
  }, [bp]);

  const sectionTotal = useMemo(
    () => Object.values(sectionCounts).reduce((a, b) => a + b, 0),
    [sectionCounts]
  );
  const totalMarksEstimate = useMemo(
    () =>
      bp.sections.reduce(
        (sum, s) => sum + (sectionCounts[s.id] || 0) * (Number(s.marksPerQuestion) || 0),
        0
      ),
    [bp.sections, sectionCounts]
  );

  // ---- mutators ----
  const addSection = () => {
    setBp((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          id: uid("sec"),
          name: `Section ${prev.sections.length + 1}`,
          instructions: "",
          marksPerQuestion: 1,
          negativeMarks: 0,
          ruleIds: [],
        },
      ],
    }));
  };

  const updateSection = (sectionId: string, patch: Partial<PaperBlueprint["sections"][number]>) => {
    setBp((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    }));
  };

  const removeSection = (sectionId: string) => {
    setBp((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
      rules: prev.rules.filter((r) => r.sectionId !== sectionId),
    }));
  };

  const addRule = (sectionId: string) => {
    setBp((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        {
          id: uid("r"),
          sectionId,
          scope: "paper",
          chapterId: null,
          topicId: null,
          type: null,
          difficulty: null,
          count: 0,
          percent: 0,
        },
      ],
    }));
  };

  const updateRule = (ruleId: string, patch: Partial<PaperBlueprint["rules"][number]>) => {
    setBp((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
    }));
  };

  const removeRule = (ruleId: string) => {
    setBp((prev) => ({ ...prev, rules: prev.rules.filter((r) => r.id !== ruleId) }));
  };

  // ---- server actions ----
  const handleSave = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      const result = await api.papers.blueprint.save(id, bp);
      setBp(structuredClone(result.blueprint) as PaperBlueprint);
      setValidation(result.validation);
      setPreview(null);
      if (result.normalizationErrors?.length) {
        toast.warning("Blueprint saved with adjustments.", {
          description: result.normalizationErrors[0],
        });
      } else {
        toast.success("Blueprint saved.");
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "BLUEPRINT_INVALID") {
        toast.error("Blueprint is not logically consistent — see validation details.");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Failed to save blueprint.");
      }
    } finally {
      setSaving(false);
    }
  }, [id, bp]);

  const handleValidate = async () => {
    if (!id) return;
    setBusy("validate");
    try {
      const result = await api.papers.blueprint.validate(id, bp);
      setValidation(result);
      setPreview(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Validation request failed.");
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async () => {
    if (!id) return;
    setBusy("preview");
    try {
      const result = await api.papers.blueprint.preview(id, bp, {
        standardId: paper?.standard_id ?? null,
        subjectId: paper?.subject_id ?? null,
      });
      setPreview(result);
      setValidation({
        errors: result.validation.errors,
        warnings: result.validation.warnings,
        summary: result.validation.summary,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Preview request failed.");
    } finally {
      setBusy(null);
    }
  };

  const ruleLabel = (rule: PaperBlueprint["rules"][number]) => {
    const parts: string[] = [];
    if (rule.scope === "chapter" && rule.chapterId) {
      parts.push(chapters.find((c) => c.id === rule.chapterId)?.name ?? "Chapter");
    } else if (rule.scope === "topic" && rule.topicId) {
      const topic = Object.values(topicsByChapter).flat().find((t) => t.id === rule.topicId);
      parts.push(topic?.name ?? "Topic");
    } else {
      parts.push("Whole paper");
    }
    if (rule.type) parts.push(QUESTION_TYPE_OPTIONS.find((t) => t.value === rule.type)?.label ?? rule.type);
    if (rule.difficulty) parts.push(rule.difficulty);
    return parts.join(" · ");
  };

  if (loading) {
    return <TableSkeleton rows={8} cols={2} />;
  }

  const percentSum =
    bp.mode === "percent"
      ? bp.rules.reduce((sum, r) => sum + (Number(r.percent) || 0), 0)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper Blueprint"
        subtitle={paper ? `Define structure & constraints for “${paper.title}”` : "Blueprint"}
        actions={
          <Button variant="secondary" onClick={() => navigate(paper ? `/admin/papers/${paper.id}` : "/admin/papers/all")}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </Button>
        }
      />

      {/* ---- summary strip ---- */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total questions</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{bp.totalQuestions || "—"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Sections total</p>
          <p className={`mt-1 text-2xl font-bold ${bp.totalQuestions && sectionTotal !== bp.totalQuestions ? "text-red-600" : "text-slate-900"}`}>
            {sectionTotal}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Marks estimate</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totalMarksEstimate}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">
            {bp.mode === "percent" ? "Percent sum" : "Rules"}
          </p>
          <p className={`mt-1 text-2xl font-bold ${bp.mode === "percent" && bp.rules.length > 0 && Math.abs(percentSum - 100) > 0.01 ? "text-red-600" : "text-slate-900"}`}>
            {bp.mode === "percent" ? `${percentSum}%` : bp.rules.length}
          </p>
        </div>
      </div>

      {/* ---- blueprint settings ---- */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Blueprint Settings</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Total questions (paper)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={bp.totalQuestions}
              onChange={(e) => setBp((prev) => ({ ...prev, totalQuestions: Number(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Distribution mode</label>
            <select
              className={field}
              value={bp.mode}
              onChange={(e) =>
                setBp((prev) => ({ ...prev, mode: e.target.value as PaperBlueprint["mode"] }))
              }
            >
              <option value="count">Count-based (questions per rule)</option>
              <option value="percent">Percentage-based (% of paper)</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          {bp.mode === "count"
            ? "Each rule demands an exact number of questions."
            : "Rule percentages are shares of the paper's total questions and must sum to 100%."}
        </p>
      </section>

      {/* ---- sections & rules ---- */}
      {bp.sections.map((section) => (
        <section key={section.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Section name</label>
              <input
                className={field}
                value={section.name}
                onChange={(e) => updateSection(section.id, { name: e.target.value })}
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-slate-600">Marks / Q</label>
              <input
                type="number"
                min={0}
                step={0.5}
                className={field}
                value={section.marksPerQuestion}
                onChange={(e) => updateSection(section.id, { marksPerQuestion: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-slate-600">Negative</label>
              <input
                type="number"
                min={0}
                step={0.25}
                className={field}
                value={section.negativeMarks}
                onChange={(e) => updateSection(section.id, { negativeMarks: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
                {sectionCounts[section.id] ?? 0} Q · {(sectionCounts[section.id] ?? 0) * (section.marksPerQuestion || 0)} marks
              </span>
              <button
                type="button"
                onClick={() => removeSection(section.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                title="Remove section"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Instructions (optional)</label>
            <textarea
              className={`${field} min-h-[48px] resize-y`}
              value={section.instructions}
              onChange={(e) => updateSection(section.id, { instructions: e.target.value })}
              placeholder="Shown above this section in the paper"
            />
          </div>

          {/* rules */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Distribution rules
              </h3>
              <button
                type="button"
                onClick={() => addRule(section.id)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:text-primary-600"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add rule
              </button>
            </div>
            {bp.rules.filter((r) => r.sectionId === section.id).length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">
                No rules yet — this section will stay empty.
              </p>
            )}
            {bp.rules
              .filter((r) => r.sectionId === section.id)
              .map((rule) => {
                const chapterTopics = rule.chapterId ? topicsByChapter[rule.chapterId] ?? [] : [];
                return (
                  <div key={rule.id} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="w-32">
                      <label className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Scope</label>
                      <select
                        className={`${smallField} w-full`}
                        value={rule.scope}
                        onChange={(e) =>
                          updateRule(rule.id, {
                            scope: e.target.value as PaperBlueprint["rules"][number]["scope"],
                            chapterId: e.target.value === "paper" ? null : rule.chapterId,
                            topicId: e.target.value === "topic" ? rule.topicId : null,
                          })
                        }
                      >
                        <option value="paper">Whole paper</option>
                        <option value="chapter">Chapter</option>
                        <option value="topic">Topic</option>
                      </select>
                    </div>
                    {rule.scope === "chapter" && (
                      <div className="w-44">
                        <label className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Chapter</label>
                        <select
                          className={`${smallField} w-full`}
                          value={rule.chapterId ?? ""}
                          onChange={(e) => updateRule(rule.id, { chapterId: e.target.value || null, topicId: null })}
                        >
                          <option value="">Select…</option>
                          {chapters.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {rule.scope === "topic" && (
                      <>
                        <div className="w-40">
                          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Chapter</label>
                          <select
                            className={`${smallField} w-full`}
                            value={rule.chapterId ?? ""}
                            onChange={(e) => updateRule(rule.id, { chapterId: e.target.value || null, topicId: null })}
                          >
                            <option value="">Select…</option>
                            {chapters.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-40">
                          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Topic</label>
                          <select
                            className={`${smallField} w-full`}
                            value={rule.topicId ?? ""}
                            onChange={(e) => updateRule(rule.id, { topicId: e.target.value || null })}
                          >
                            <option value="">Select…</option>
                            {chapterTopics.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    <div className="w-36">
                      <label className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Type</label>
                      <select
                        className={`${smallField} w-full`}
                        value={rule.type ?? ""}
                        onChange={(e) => updateRule(rule.id, { type: e.target.value || null })}
                      >
                        {QUESTION_TYPE_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-32">
                      <label className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Difficulty</label>
                      <select
                        className={`${smallField} w-full`}
                        value={rule.difficulty ?? ""}
                        onChange={(e) => updateRule(rule.id, { difficulty: e.target.value || null })}
                      >
                        {DIFFICULTY_OPTIONS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="mb-1 block text-[10px] font-medium uppercase text-slate-400">
                        {bp.mode === "percent" ? "Percent" : "Count"}
                      </label>
                      {bp.mode === "percent" ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          className={`${smallField} w-full`}
                          value={rule.percent}
                          onChange={(e) => updateRule(rule.id, { percent: Number(e.target.value) || 0 })}
                        />
                      ) : (
                        <input
                          type="number"
                          min={0}
                          className={`${smallField} w-full`}
                          value={rule.count}
                          onChange={(e) => updateRule(rule.id, { count: Number(e.target.value) || 0 })}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRule(rule.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Remove rule"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                );
              })}
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={addSection}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-4 text-sm font-medium text-slate-500 transition hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" aria-hidden /> Add section
      </button>

      {/* ---- actions ---- */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          {can(PERMISSIONS.PAPERS_MANAGE) && (
            <Button onClick={handleSave} loading={saving}>
              <Save className="h-4 w-4" aria-hidden /> Save Blueprint
            </Button>
          )}
          <Button variant="secondary" onClick={handleValidate} loading={busy === "validate"}>
            <ShieldCheck className="h-4 w-4" aria-hidden /> Validate
          </Button>
          <Button variant="secondary" onClick={handlePreview} loading={busy === "preview"}>
            <Eye className="h-4 w-4" aria-hidden /> Preview Composition
          </Button>
          <Layers className="ml-auto h-4 w-4 text-slate-300" aria-hidden />
        </div>

        {/* validation results */}
        {validation && (
          <div className="space-y-2">
            {validation.errors?.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Errors ({validation.errors.length})
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-red-700">
                  {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            {validation.warnings?.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Warnings ({validation.warnings.length})
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-amber-700">
                  {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            {validation.errors?.length === 0 && validation.warnings?.length === 0 && (
              <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Blueprint is consistent.
              </div>
            )}
          </div>
        )}

        {/* preview */}
        {preview && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Section</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Questions</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Marks</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Negative / Q</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.sections.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2 text-slate-800">{s.name}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{s.questionCount}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{s.marks}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{s.negativeMarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.availability.rules.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Rule (availability vs bank)</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Demanded</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Available</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Shortfall</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.availability.rules.map((row) => {
                      const rule = bp.rules.find((r) => r.id === row.ruleId);
                      return (
                        <tr key={row.ruleId} className={row.shortfall > 0 ? "bg-red-50/60" : undefined}>
                          <td className="px-4 py-2 text-slate-800">{rule ? ruleLabel(rule) : row.ruleId}</td>
                          <td className="px-4 py-2 text-right text-slate-700">{row.demanded ?? "—"}</td>
                          <td className="px-4 py-2 text-right text-slate-700">{row.available ?? "?"}</td>
                          <td className={`px-4 py-2 text-right font-semibold ${row.shortfall > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {row.shortfall > 0 ? `+${row.shortfall}` : 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-slate-400">
              Availability counts published questions in the bank matching each rule (chapter/topic/type/difficulty within the paper's standard &amp; subject).
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
