import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  Dices,
  EyeOff,
  KeyRound,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  api,
  ApiError,
  type PaperSetsDoc,
  type PaperSet,
  type SetAnswerKey,
} from "../../api/client";
import { useCan, PERMISSIONS } from "../../context/useAdminAuth";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { TableSkeleton } from "../components/Skeleton";

const PRESETS = [2, 3, 4, 5] as const;

export default function PaperSetsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = useCan();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [doc, setDoc] = useState<PaperSetsDoc | null>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  // generation form
  const [count, setCount] = useState(4);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [answerKey, setAnswerKey] = useState<SetAnswerKey | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const result = await api.papers.sets.get(id);
      setTitle(result.paperId === id ? result.paperId : id);
      setDoc(result.sets);
      setMigrationRequired(result.migrationRequired === true);
      if (result.sets) {
        setCount(result.sets.count);
        setShuffleQuestions(result.sets.shuffleQuestions);
        setShuffleOptions(result.sets.shuffleOptions);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load paper sets.");
      navigate("/admin/papers/all");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const generate = async (version?: number) => {
    if (!id) return;
    setRegenerating(true);
    try {
      const result = await api.papers.sets.generate(id, {
        count,
        shuffleQuestions,
        shuffleOptions,
        ...(version ? { version } : {}),
      });
      setDoc(result.sets);
      setWarnings(result.warnings ?? []);
      setExpandedKey(null);
      setAnswerKey(null);
      toast.success(
        version
          ? `Reproduced ${result.sets.count} set(s) from stored seed (version ${result.sets.version}).`
          : `Generated ${result.sets.count} set(s) with fresh randomization (version ${result.sets.version}).`
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate sets.");
    } finally {
      setRegenerating(false);
    }
  };

  const clearSets = async () => {
    if (!id) return;
    if (!window.confirm("Remove all generated sets from this paper? The master paper and its questions are not affected.")) return;
    try {
      await api.papers.sets.clear(id);
      setDoc(null);
      setExpandedKey(null);
      setAnswerKey(null);
      setWarnings([]);
      toast.success("Sets removed.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove sets.");
    }
  };

  const toggleSet = async (set: PaperSet) => {
    if (expandedKey === set.key) {
      setExpandedKey(null);
      setAnswerKey(null);
      return;
    }
    setExpandedKey(set.key);
    setAnswerKey(null);
    setKeyLoading(true);
    try {
      if (id) setAnswerKey(await api.papers.sets.answerKey(id, set.key));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load answer key.");
      setExpandedKey(null);
    } finally {
      setKeyLoading(false);
    }
  };

  if (loading) {
    return <TableSkeleton rows={8} cols={2} />;
  }

  const paperLabel = `Paper ${id?.slice(0, 8) ?? ""}…`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper Sets"
        subtitle={`Randomized sets (A, B, C, …) for ${title && title !== id ? `“${title}”` : paperLabel}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(id ? `/admin/papers/${id}` : "/admin/papers/all")}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            {doc && can(PERMISSIONS.PAPERS_GENERATE) && (
              <Button variant="danger" onClick={clearSets}>
                <Trash2 className="h-4 w-4" aria-hidden /> Remove all
              </Button>
            )}
          </div>
        }
      />

      {migrationRequired && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            Set storage is not active yet — apply backend/migrations/008_paper_blueprints.sql in the
            Supabase SQL editor to persist generated sets.
          </span>
        </div>
      )}

      {warnings.map((w, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>{w}</span>
        </div>
      ))}

      {/* generation controls */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Generate sets</h2>
        <p className="mt-1 text-xs text-slate-500">
          Every set reshuffles the same master questions — the Question Bank is never duplicated.
          Option order is permuted only for multiple-choice types; True/False, match and ordering
          stay fixed. Correct answers are never changed.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">Number of sets</label>
            <div className="mt-1.5 flex items-center gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCount(p)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition ${
                    count === p
                      ? "bg-slate-900 text-white ring-slate-900"
                      : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={26}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
                className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                aria-label="Custom number of sets"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Shuffle question order
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Shuffle options (MCQ)
            </label>
          </div>
          {can(PERMISSIONS.PAPERS_GENERATE) && (
            <div className="ml-auto flex items-center gap-2">
              {doc && (
                <Button variant="secondary" onClick={() => generate(doc.version)} loading={regenerating}>
                  <RefreshCw className="h-4 w-4" aria-hidden /> Reproduce v{doc.version}
                </Button>
              )}
              <Button onClick={() => generate()} loading={regenerating}>
                <Dices className="h-4 w-4" aria-hidden /> {doc ? "Re-randomize" : "Generate sets"}
              </Button>
            </div>
          )}
        </div>
        {doc && (
          <p className="mt-3 text-xs text-slate-500">
            Stored version <span className="font-semibold text-slate-700">v{doc.version}</span> ·
            base seed <code className="rounded bg-slate-100 px-1">{doc.baseSeed}</code> · generated{" "}
            {new Date(doc.generatedAt).toLocaleString()}
          </p>
        )}
      </section>

      {/* sets */}
      {doc ? (
        <div className="space-y-4">
          {doc.sets.map((set) => (
            <section key={set.key} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-3 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                  {set.key}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">{set.name}</h3>
                  <p className="text-xs text-slate-500">
                    {set.questionCount} questions · {set.totalMarks} marks · seed{" "}
                    <code className="rounded bg-slate-100 px-1">{set.seed}</code>
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {can(PERMISSIONS.PAPERS_REPORTS_VIEW) && (
                    <Button variant="secondary" onClick={() => toggleSet(set)} loading={keyLoading && expandedKey === set.key}>
                      {expandedKey === set.key ? (
                        <>
                          <EyeOff className="h-4 w-4" aria-hidden /> Hide key
                        </>
                      ) : (
                        <>
                          <KeyRound className="h-4 w-4" aria-hidden /> Answer key
                        </>
                      )}
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => setExpandedKey(set.key)}>
                    <BookOpenCheck className="h-4 w-4" aria-hidden /> Composition
                  </Button>
                </div>
              </div>

              {expandedKey === set.key && (
                <div className="border-t border-slate-100 p-5 pt-4">
                  {answerKey ? (
                    <>
                      {answerKey.warnings.length > 0 && (
                        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                          <span>{answerKey.warnings.join(" ")}</span>
                        </div>
                      )}
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {answerKey.answers.map((a) => (
                          <div key={a.number} className="rounded-xl border border-slate-200 p-3">
                            <p className="text-xs font-medium text-slate-500">Q{a.number}</p>
                            <p className="mt-0.5 text-lg font-bold text-emerald-700">{a.answer ?? "—"}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {a.type ?? "unknown type"} · {a.marks} marks
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-slate-400">
                        Key computed from the stored option permutation — always matches the printed
                        set, independent of when it is requested.
                      </p>
                    </>
                  ) : (
                    <TableSkeleton rows={2} cols={4} />
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Dices className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-700">No sets generated yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Choose the number of sets above and generate. Each set gets its own stored seed so any
            randomization can be reproduced exactly.
          </p>
        </div>
      )}
    </div>
  );
}
