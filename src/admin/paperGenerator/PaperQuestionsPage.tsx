import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Unlock,
  Wand2,
} from "lucide-react";
import {
  api,
  ApiError,
  type Chapter,
  type GenerateResult,
  type GenerationShortage,
  type Paper,
  type PaperFamily,
  type PaperPayload,
  type Question,
  type ReplaceDryRun,
  type ReplaceResult,
} from "../../api/client";
import { useCan, PERMISSIONS } from "../../context/useAdminAuth";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { TableSkeleton } from "../components/Skeleton";
import { richTextToPlain } from "../components/richText";

const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";
const smallField =
  "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function PaperQuestionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = useCan();
  const canManage = can(PERMISSIONS.PAPERS_MANAGE);
  const canGenerate = can(PERMISSIONS.PAPERS_GENERATE);

  const [loading, setLoading] = useState(true);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [families, setFamilies] = useState<PaperFamily[]>([]);
  const [hasBlueprint, setHasBlueprint] = useState(false);
  const [bpSections, setBpSections] = useState<{ id: string; name: string }[]>([]);

  // manual picker state
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState("");
  const [pool, setPool] = useState<Question[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);

  // generation state
  const [seed, setSeed] = useState("");
  const [strategy, setStrategy] = useState<"seeded" | "random">("seeded");
  const [generating, setGenerating] = useState(false);
  const [shortages, setShortages] = useState<GenerationShortage[] | null>(null);
  const [lastResult, setLastResult] = useState<GenerateResult | null>(null);

  // editor safety state
  const [dirty, setDirty] = useState(false);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [pendingReplace, setPendingReplace] = useState<{
    familyId: string;
    preview: ReplaceDryRun;
  } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const loadPaper = useCallback(async () => {
    if (!id) return;
    try {
      const result: PaperPayload = await api.papers.get(id);
      setPaper(result.paper);
      setFamilies(result.families);
      setDirty(false);
      const bp = await api.papers.blueprint.get(id).catch(() => null);
      setHasBlueprint(Boolean(bp?.blueprint));
      setBpSections((bp?.blueprint?.sections ?? []).map((s) => ({ id: s.id, name: s.name })));
      if (result.paper.standard_id || result.paper.subject_id) {
        const ch = await api.chapters
          .list({
            standard_id: result.paper.standard_id ?? undefined,
            subject_id: result.paper.subject_id ?? undefined,
          })
          .catch(() => ({ chapters: [] as Chapter[] }));
        setChapters(ch.chapters);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load paper.");
      navigate("/admin/papers/all");
    }
  }, [id, navigate]);

  useEffect(() => {
    (async () => {
      await loadPaper();
      setLoading(false);
    })();
  }, [loadPaper]);

  // Warn before closing/reloading the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  // ---- question pool for manual picking (existing listQuestions filters) ----
  useEffect(() => {
    if (!chapterId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPool([]);
      return;
    }
    setPoolLoading(true);
    api.questions
      .list({ chapter_id: chapterId, status: "published", limit: 100 })
      .then((res) => setPool(res.questions))
      .catch(() => setPool([]))
      .finally(() => setPoolLoading(false));
  }, [chapterId]);

  const familiesInPaper = useMemo(
    () => new Set(families.map((f) => f.family_id)),
    [families]
  );

  const totalMarks = useMemo(
    () => families.reduce((sum, f) => sum + (Number(f.marks) || 0), 0),
    [families]
  );

  const leaveTo = paper ? `/admin/papers/${paper.id}` : "/admin/papers/all";

  // ---- manual add: insert the family (primary variant = the bank question) ----
  const addFamily = (q: Question) => {
    if (!q.family_id || familiesInPaper.has(q.family_id)) return;
    setFamilies((prev) => [
      ...prev,
      {
        id: `local-${q.family_id}`,
        family_id: q.family_id!,
        sort_order: prev.length,
        marks: Number(q.marks) || 0,
        primary: { ...q, options: [], payload: null },
        variants: [],
      },
    ]);
    setDirty(true);
  };

  const removeFamily = (familyId: string) => {
    setFamilies((prev) => prev.filter((f) => f.family_id !== familyId));
    setDirty(true);
  };

  const moveFamily = (index: number, dir: -1 | 1) => {
    setFamilies((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  };

  const setFamilyMarks = (familyId: string, marks: number) => {
    setFamilies((prev) =>
      prev.map((f) => (f.family_id === familyId ? { ...f, marks } : f))
    );
    setDirty(true);
  };

  const setFamilySection = (familyId: string, sectionKey: string) => {
    setFamilies((prev) =>
      prev.map((f) =>
        f.family_id === familyId ? { ...f, section_key: sectionKey || null } : f
      )
    );
    setDirty(true);
  };

  const toggleLock = (familyId: string) => {
    setFamilies((prev) =>
      prev.map((f) =>
        f.family_id === familyId ? { ...f, locked: !f.locked } : f
      )
    );
    setDirty(true);
  };

  // ---- persist manual order/marks ----
  const saveFamilies = async () => {
    if (!id) return;
    try {
      await api.papers.update(id, {
        familyIds: families.map((f) => ({
          familyId: f.family_id,
          marks: Number(f.marks) || 0,
          sectionKey: f.section_key || undefined,
          locked: Boolean(f.locked),
        })),
      });
      toast.success("Paper questions saved.");
      await loadPaper();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save paper questions.");
    }
  };

  // ---- generate from blueprint (automatic / hybrid) ----
  const generate = async () => {
    if (!id) return;
    if (dirty) {
      toast.error("You have unsaved changes — save them before generating.");
      return;
    }
    setGenerating(true);
    setShortages(null);
    try {
      const result = await api.papers.generate(id, {
        lockFamilyIds: families.filter((f) => f.locked).map((f) => f.family_id),
        seed: seed.trim() || undefined,
        strategy,
      });
      setLastResult(result);
      setFamilies(result.families);
      setDirty(false);
      toast.success(
        `Generated ${result.generated.total} questions (${result.generated.totalMarks} marks).`
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === "BLUEPRINT_SHORTAGE") {
        const body = err.body as { shortages?: GenerationShortage[] } | undefined;
        setShortages(body?.shortages ?? []);
        toast.error("Blueprint cannot be satisfied — see the shortage report.");
      } else if (err instanceof ApiError && err.code === "BLUEPRINT_MISSING") {
        toast.error("Save a blueprint first (Blueprint page).");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Generation failed.");
      }
    } finally {
      setGenerating(false);
    }
  };

  // ---- replace question (dry-run preview → explicit confirm) ----
  const startReplace = async (familyId: string) => {
    if (!id) return;
    if (dirty) {
      toast.error("Save your changes before replacing a question.");
      return;
    }
    setReplacing(familyId);
    try {
      const preview = (await api.papers.replaceFamily(id, familyId, {
        dryRun: true,
      })) as ReplaceDryRun;
      setPendingReplace({ familyId, preview });
    } catch (err) {
      if (err instanceof ApiError && err.code === "REPLACEMENT_UNAVAILABLE") {
        const reason = (err.body as { reason?: string } | undefined)?.reason;
        toast.error(reason ?? "No suitable replacement exists in the Question Bank.");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Replacement lookup failed.");
      }
    } finally {
      setReplacing(null);
    }
  };

  const confirmReplace = async () => {
    if (!id || !pendingReplace) return;
    setReplacing(pendingReplace.familyId);
    try {
      const result = (await api.papers.replaceFamily(id, pendingReplace.familyId, {})) as ReplaceResult;
      setPaper(result.paper);
      setFamilies(result.families);
      setPendingReplace(null);
      toast.success(
        result.exact
          ? "Replaced with an exact match."
          : `Replaced — closest match (${result.match}).`
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === "REPLACEMENT_UNAVAILABLE") {
        const reason = (err.body as { reason?: string } | undefined)?.reason;
        toast.error(reason ?? "No suitable replacement exists in the Question Bank.");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Replacement failed.");
      }
    } finally {
      setReplacing(null);
    }
  };

  if (loading) {
    return <TableSkeleton rows={8} cols={2} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper Questions"
        subtitle={paper ? `Select and generate questions for “${paper.title}”` : "Questions"}
        actions={
          <Button
            variant="secondary"
            onClick={() => (dirty ? setConfirmLeave(true) : navigate(leaveTo))}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </Button>
        }
      />

      {!hasBlueprint && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            No blueprint saved yet — automatic generation needs one.{" "}
            <button
              type="button"
              onClick={() => navigate(paper ? `/admin/papers/${paper.id}/blueprint` : "/admin/papers/all")}
              className="font-semibold underline"
            >
              Create the blueprint
            </button>{" "}
            or add questions manually below.
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- left: manual picker ---- */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Add from Question Bank</h2>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Chapter</label>
            <select className={field} value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
              <option value="">Select a chapter…</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {poolLoading && <p className="text-sm text-slate-400">Loading questions…</p>}
            {!poolLoading && chapterId && pool.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">
                No published questions in this chapter.
              </p>
            )}
            {!poolLoading &&
              pool.map((q) => {
                const added = q.family_id ? familiesInPaper.has(q.family_id) : false;
                return (
                  <div
                    key={q.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm text-slate-800">{richTextToPlain(q.content)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {q.type} · {q.difficulty ?? "—"} · {q.marks} marks
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addFamily(q)}
                      disabled={added || !q.family_id || !canManage}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                      title={added ? "Already in paper" : canManage ? "Add" : "You cannot edit this paper"}
                    >
                      {added ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                );
              })}
          </div>
          <p className="text-xs text-slate-400">
            Questions are referenced by their family — the bank is never duplicated.
          </p>
        </section>

        {/* ---- right: generation ---- */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Generate from Blueprint</h2>
          <p className="text-xs text-slate-500">
            Locked questions survive regeneration (hybrid mode); unlocked slots are re-selected
            from the bank to fill the blueprint. The system never duplicates a question.
            Save your changes first — generation works on the saved paper.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Strategy</label>
              <select
                className={field}
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as "seeded" | "random")}
              >
                <option value="seeded">Seeded (reproducible)</option>
                <option value="random">Random (fresh shuffle)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Seed (optional)</label>
              <input
                className={field}
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="paper default"
              />
            </div>
          </div>
          {canGenerate && (
            <Button onClick={generate} loading={generating} disabled={!hasBlueprint}>
              <Wand2 className="h-4 w-4" aria-hidden /> Generate Questions
            </Button>
          )}

          {lastResult && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Generated {lastResult.generated.total} questions ·{" "}
              {lastResult.generated.totalMarks} marks · seed{" "}
              <code className="rounded bg-white/70 px-1">{lastResult.generated.seed}</code>
            </div>
          )}

          {shortages && shortages.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Shortage report — nothing was saved
              </p>
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-red-700">
                {shortages.map((s, i) => (
                  <li key={i}>
                    {s.ruleId ? `Rule ${s.ruleId}` : "Section"} ({s.scope}
                    {s.difficulty ? `, ${s.difficulty}` : ""}
                    {s.type ? `, ${s.type}` : ""}): need {s.demanded}, found {s.filled}, missing{" "}
                    <strong>{s.missing}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* ---- selected families ---- */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Questions in Paper{" "}
            <span className="ml-1 text-slate-400">({families.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Total: {totalMarks} marks</span>
            {canManage && (
              <Button size="sm" variant="secondary" onClick={saveFamilies}>
                Save Questions
              </Button>
            )}
          </div>
        </div>
        {families.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            No questions yet — add from the bank or generate from the blueprint.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {families.map((f, idx) => (
              <li key={f.family_id} className="rounded-xl border border-slate-200 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-slate-800">
                      {f.primary ? richTextToPlain(f.primary.content) : "(unresolved family)"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                      <button
                        type="button"
                        onClick={() => toggleLock(f.family_id)}
                        disabled={!canManage}
                        className={`flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-slate-100 disabled:opacity-50 ${
                          f.locked ? "font-medium text-amber-600" : "text-slate-400"
                        }`}
                        title={
                          f.locked
                            ? "Locked — survives regeneration (click to unlock)"
                            : "Lock to keep this question across regenerations"
                        }
                      >
                        {f.locked ? <Lock className="h-3 w-3" aria-hidden /> : <Unlock className="h-3 w-3" aria-hidden />}
                        {f.locked ? "Locked" : "Unlocked"}
                      </button>
                      · family {f.family_id.slice(0, 8)}…
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveFamily(idx, -1)}
                      disabled={!canManage || idx === 0}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                      title="Move up"
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveFamily(idx, 1)}
                      disabled={!canManage || idx === families.length - 1}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                      title="Move down"
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden />
                    </button>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={f.marks}
                      onChange={(e) => setFamilyMarks(f.family_id, Number(e.target.value) || 0)}
                      disabled={!canManage}
                      className={`${smallField} w-16 disabled:opacity-50`}
                      title="Marks"
                    />
                    {bpSections.length > 0 && (
                      <select
                        value={f.section_key ?? ""}
                        onChange={(e) => setFamilySection(f.family_id, e.target.value)}
                        disabled={!canManage}
                        className={`${smallField} w-28 disabled:opacity-50`}
                        title="Section"
                      >
                        <option value="">Unassigned</option>
                        {bpSections.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => startReplace(f.family_id)}
                      disabled={!canManage || !f.primary || replacing === f.family_id}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-primary-50 hover:text-primary disabled:opacity-30"
                      title="Replace with a matching question"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${replacing === f.family_id ? "animate-spin" : ""}`}
                        aria-hidden
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFamily(f.family_id)}
                      disabled={!canManage}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <ConfirmDialog
        open={confirmLeave}
        title="Unsaved changes"
        message="You have unsaved changes to this paper's questions. Leave without saving?"
        confirmLabel="Discard changes"
        danger
        onConfirm={() => {
          setConfirmLeave(false);
          navigate(leaveTo);
        }}
        onCancel={() => setConfirmLeave(false)}
      />

      {pendingReplace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setPendingReplace(null)}
            aria-hidden
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-slate-900">Replace question</h2>
            <p className="mt-1 text-sm text-slate-600">
              Proposed replacement — the original bank question is never modified.
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Current</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                  {(() => {
                    const fam = families.find((x) => x.family_id === pendingReplace.familyId);
                    return fam?.primary ? richTextToPlain(fam.primary.content) : "(unresolved family)";
                  })()}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Replacement
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      pendingReplace.preview.exact
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {pendingReplace.preview.exact
                      ? "Exact match"
                      : `Relaxed: ${pendingReplace.preview.match}`}
                  </span>
                </div>
                <p className="mt-1 line-clamp-3 text-sm text-slate-700">
                  {richTextToPlain(pendingReplace.preview.replacement.content)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {pendingReplace.preview.replacement.type} ·{" "}
                  {pendingReplace.preview.replacement.difficulty ?? "—"} ·{" "}
                  {pendingReplace.preview.replacement.marks} marks
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPendingReplace(null)}>
                Cancel
              </Button>
              <Button onClick={confirmReplace} loading={replacing === pendingReplace.familyId}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Replace
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
