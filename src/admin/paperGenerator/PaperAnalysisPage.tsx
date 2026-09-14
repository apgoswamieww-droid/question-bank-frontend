import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  Hash,
  Languages,
  Layers,
  Library,
  List,
  RefreshCw,
  ShieldCheck,
  Tag,
  Tags,
  Target,
} from "lucide-react";
import {
  api,
  ApiError,
  type BlueprintRuleVariance,
  type BlueprintSectionVariance,
  type LanguageReadiness,
  type PaperAnalysis,
  type PaperAnalysisBucket,
  type PaperStatus,
  type ValidationReport,
} from "../../api/client";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { TableSkeleton } from "../components/Skeleton";
import { paperStatusStyles } from "./paperStatus";

export default function PaperAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [translation, setTranslation] = useState<{ languages: LanguageReadiness[]; totals: { languages: number; questions: number; fullyApprovedLanguages: number; invariantIssues: number } } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [a, v, t] = await Promise.all([
        api.papers.analysis(id),
        api.papers.validate(id).catch(() => null),
        api.papers.translations.report(id).catch(() => null),
      ]);
      setAnalysis(a);
      setValidation(v);
      setTranslation(t);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load paper analysis.");
      navigate("/admin/papers/all");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const refresh = async () => {
    setLoading(true);
    await load();
  };

  if (loading) {
    return <TableSkeleton rows={8} cols={2} />;
  }

  if (!analysis) {
    return (
      <div className="space-y-6">
        <PageHeader title="Paper Analysis" />
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-700">No analysis available</p>
        </div>
      </div>
    );
  }

  const meta = analysis.paper;
  const statusStyle =
    meta.status && meta.status in paperStatusStyles
      ? paperStatusStyles[meta.status as PaperStatus]
      : paperStatusStyles.draft;
  const validationSummary = validation?.summary ?? null;
  const duplicates = analysis.duplicates;
  const variance = analysis.blueprintVariance;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper Analysis & Quality Report"
        subtitle={meta.title ?? `Paper ${id?.slice(0, 8)}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(id ? `/admin/papers/${id}` : "/admin/papers/all")}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            <Button variant="secondary" onClick={refresh} loading={loading}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
            </Button>
          </div>
        }
      />

      {analysis.migrationRequired && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            Blueprint storage is not active yet — apply backend/migrations/008_paper_blueprints.sql in
            the Supabase SQL editor to unlock blueprint comparison.
          </span>
        </div>
      )}

      {/* Overview KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Hash className="h-4 w-4" aria-hidden />}
          label="Total questions"
          value={String(analysis.actual.totalQuestions)}
          note={
            variance?.summary.targetQuestions !== undefined
              ? `Blueprint target ${variance.summary.targetQuestions}`
              : "No blueprint target set"
          }
        />
        <KpiCard
          icon={<Target className="h-4 w-4" aria-hidden />}
          label="Total marks (computed)"
          value={String(analysis.actual.totalMarks)}
          delta={
            analysis.actual.declaredTotalMarks !== null && analysis.actual.declaredTotalMarks !== analysis.actual.totalMarks
              ? analysis.actual.totalMarks - (analysis.actual.declaredTotalMarks ?? 0)
              : 0
          }
          note={
            analysis.actual.declaredTotalMarks !== null
              ? `Declared ${analysis.actual.declaredTotalMarks}`
              : undefined
          }
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" aria-hidden />}
          label="Duration"
          value={analysis.actual.durationMin !== null ? `${analysis.actual.durationMin} min` : "—"}
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Paper status</p>
            <BookOpen className="h-4 w-4 text-slate-300" aria-hidden />
          </div>
          <p className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ${statusStyle.className}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {statusStyle.label}
          </p>
        </div>
      </div>

      {/* Quality: validation + duplicates + translation */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-slate-400" aria-hidden /> Validation status
          </h2>
          {validationSummary ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ring-1 ${
                    validationSummary.errors ? "bg-red-50 text-red-700 ring-red-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  }`}
                >
                  {validationSummary.errors} errors
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ring-1 ${
                    validationSummary.warnings ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-slate-50 text-slate-600 ring-slate-200"
                  }`}
                >
                  {validationSummary.warnings} warnings
                </span>
                <span className="rounded-full bg-sky-50 px-2.5 py-0.5 font-medium text-sky-700 ring-1 ring-sky-200">
                  {validationSummary.infos} info
                </span>
              </div>
              {validationSummary.canPublish ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Ready to publish
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Publishing blocked
                </p>
              )}
              <p className="text-xs text-slate-400">
                {validationSummary.questionCount} questions · computed marks {validationSummary.computedMarks}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">Validation not available.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Copy className="h-4 w-4 text-slate-400" aria-hidden /> Duplicate status
          </h2>
          <div className="mt-3 space-y-2 text-xs">
            <p className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="text-slate-600">Repeated family references</span>
              <strong className={duplicates.familyDuplicates.length ? "text-red-700" : "text-emerald-700"}>
                {duplicates.familyDuplicates.length}
              </strong>
            </p>
            <p className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="text-slate-600">Possible duplicate content</span>
              <strong className={duplicates.contentDuplicates.length ? "text-amber-700" : "text-emerald-700"}>
                {duplicates.contentDuplicates.length}
              </strong>
            </p>
            {duplicates.familyDuplicates.length === 0 && duplicates.contentDuplicates.length === 0 && (
              <p className="text-slate-400">No duplicates detected in the paper composition.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Languages className="h-4 w-4 text-slate-400" aria-hidden /> Translation completeness
          </h2>
          {translation ? (
            <div className="mt-3 space-y-2 text-xs">
              <p className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="text-slate-600">Fully approved languages</span>
                <strong className={translation.totals.fullyApprovedLanguages === translation.totals.languages ? "text-emerald-700" : "text-amber-700"}>
                  {translation.totals.fullyApprovedLanguages}/{translation.totals.languages}
                </strong>
              </p>
              <p className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="text-slate-600">Invariant (formula/number) issues</span>
                <strong className={translation.totals.invariantIssues ? "text-red-700" : "text-emerald-700"}>
                  {translation.totals.invariantIssues}
                </strong>
              </p>
              <p className="text-slate-400">{translation.totals.questions} questions in scope</p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">Translation data not available.</p>
          )}
        </section>
      </div>

      {/* Blueprint vs actual */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Target className="h-4 w-4 text-slate-400" aria-hidden /> Blueprint vs actual composition
        </h2>
        {variance ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-500">Questions</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {variance.summary.actualQuestions}
                  <span className="ml-2 text-sm font-medium text-slate-400">target {variance.summary.targetQuestions}</span>
                </p>
                <Delta value={variance.summary.questionsDelta} />
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-500">Marks</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {variance.summary.actualMarks}
                  <span className="ml-2 text-sm font-medium text-slate-400">target {variance.summary.targetMarks}</span>
                </p>
                <Delta value={variance.summary.marksDelta} />
              </div>
            </div>

            {variance.warnings.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {variance.warnings.map((w, i) => (
                  <p key={i} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden /> {w}
                  </p>
                ))}
              </div>
            )}

            {variance.sections.length > 0 && (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                    <th className="pb-2">Section</th>
                    <th className="pb-2 text-right">Target Q</th>
                    <th className="pb-2 text-right">Actual Q</th>
                    <th className="pb-2 text-right">Q variance</th>
                    <th className="pb-2 text-right">Target marks</th>
                    <th className="pb-2 text-right">Actual marks</th>
                    <th className="pb-2 text-right">Marks variance</th>
                  </tr>
                </thead>
                <tbody>
                  {variance.sections.map((s: BlueprintSectionVariance) => (
                    <tr key={s.key} className="border-b border-slate-50">
                      <td className="py-2 font-medium text-slate-800">{s.name}</td>
                      <td className="py-2 text-right text-slate-600">{s.targetCount}</td>
                      <td className="py-2 text-right text-slate-800">{s.actualCount}</td>
                      <td className="py-2 text-right"><Delta value={s.countDelta} /></td>
                      <td className="py-2 text-right text-slate-600">{s.targetMarks}</td>
                      <td className="py-2 text-right text-slate-800">{s.actualMarks}</td>
                      <td className="py-2 text-right"><Delta value={s.marksDelta} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {variance.rules.length > 0 && (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                    <th className="pb-2">Blueprint rule</th>
                    <th className="pb-2">Section</th>
                    <th className="pb-2 text-right">Target</th>
                    <th className="pb-2 text-right">Actual</th>
                    <th className="pb-2 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {variance.rules.map((r: BlueprintRuleVariance) => (
                    <tr key={r.ruleId} className="border-b border-slate-50">
                      <td className="py-2 font-medium text-slate-800">{r.label}</td>
                      <td className="py-2 text-xs text-slate-500">{r.sectionName}</td>
                      <td className="py-2 text-right text-slate-600">{r.target}</td>
                      <td className="py-2 text-right text-slate-800">{r.actual}</td>
                      <td className="py-2 text-right"><Delta value={r.delta} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-400">
            No blueprint configured for this paper yet. Open{" "}
            <button
              type="button"
              onClick={() => navigate(id ? `/admin/papers/${id}/blueprint` : "/admin/papers/all")}
              className="font-medium text-primary hover:text-primary-600"
            >
              the Blueprint page
            </button>{" "}
            to set targets, then compare them here.
          </p>
        )}
      </section>

      {/* Distributions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionCard
          title="Difficulty distribution"
          icon={<Layers className="h-4 w-4 text-slate-400" aria-hidden />}
          buckets={analysis.difficultyDistribution}
          max={analysis.actual.totalQuestions}
          showMarks
        />
        <DistributionCard
          title="Question-type distribution"
          icon={<List className="h-4 w-4 text-slate-400" aria-hidden />}
          buckets={analysis.typeDistribution}
          max={analysis.actual.totalQuestions}
          showMarks
        />
        <DistributionCard
          title="Chapter distribution"
          icon={<Library className="h-4 w-4 text-slate-400" aria-hidden />}
          buckets={analysis.chapterDistribution.map((c) => ({ key: c.id ?? "__unassigned__", label: c.name, count: c.count }))}
          max={analysis.actual.totalQuestions}
        />
        <DistributionCard
          title="Topic distribution"
          icon={<Tags className="h-4 w-4 text-slate-400" aria-hidden />}
          buckets={analysis.topicDistribution.map((t) => ({ key: t.id ?? "__unassigned__", label: t.name, count: t.count }))}
          max={analysis.actual.totalQuestions}
        />
      </div>

      {/* Section distribution */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Tag className="h-4 w-4 text-slate-400" aria-hidden /> Section distribution
        </h2>
        {analysis.sectionDistribution.length > 0 ? (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                <th className="pb-2">Section</th>
                <th className="pb-2 text-right">Questions</th>
                <th className="pb-2 text-right">Marks</th>
                <th className="pb-2 text-right">Negative marks</th>
              </tr>
            </thead>
            <tbody>
              {analysis.sectionDistribution.map((s) => (
                <tr key={s.key} className="border-b border-slate-50">
                  <td className="py-2 font-medium text-slate-800">{s.name}</td>
                  <td className="py-2 text-right text-slate-800">{s.count}</td>
                  <td className="py-2 text-right text-slate-800">{s.marks}</td>
                  <td className="py-2 text-right text-slate-500">{s.negativeMarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-xs text-slate-400">No sections assigned yet.</p>
        )}
      </section>

      {/* Language coverage */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Languages className="h-4 w-4 text-slate-400" aria-hidden /> Language coverage
        </h2>
        {analysis.languageCoverage.length > 0 ? (
          <ul className="mt-3 space-y-2.5">
            {analysis.languageCoverage.map((l) => (
              <li key={l.id}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    {l.name}
                    {l.code ? <span className="ml-1 text-slate-400">({l.code})</span> : null}
                  </span>
                  <span className="text-slate-500">
                    {l.covered}/{l.covered + l.missing} · {l.coverage}%
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${l.coverage === 100 ? "bg-emerald-500" : l.coverage > 0 ? "bg-amber-400" : "bg-slate-200"}`}
                    style={{ width: `${Math.max(l.coverage, 2)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-slate-400">No languages configured in the master data.</p>
        )}
      </section>

      {/* Translation completeness detail */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CheckCircle2 className="h-4 w-4 text-slate-400" aria-hidden /> Per-language translation readiness
        </h2>
        {translation && translation.languages.length > 0 ? (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                <th className="pb-2">Language</th>
                <th className="pb-2 text-right">Coverage</th>
                <th className="pb-2 text-right">Missing</th>
                <th className="pb-2 text-right">Approved</th>
                <th className="pb-2 text-right">Invariants</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {translation.languages.map((l) => (
                <tr key={l.language.id} className="border-b border-slate-50">
                  <td className="py-2 font-medium text-slate-800">
                    {l.language.name}
                    {l.language.code ? <span className="ml-1 text-xs text-slate-400">({l.language.code})</span> : null}
                  </td>
                  <td className="py-2 text-right text-slate-800">{l.coverage}%</td>
                  <td className="py-2 text-right text-slate-600">{l.counts.missing}</td>
                  <td className="py-2 text-right text-slate-600">{l.counts.approved}</td>
                  <td className="py-2 text-right text-slate-600">{l.invariantIssues}</td>
                  <td className="py-2 text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                        l.ready
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : l.paperState === "reviewed" || l.paperState === "translated"
                            ? "bg-amber-50 text-amber-700 ring-amber-200"
                            : "bg-slate-50 text-slate-600 ring-slate-200"
                      }`}
                    >
                      {l.ready ? "Ready" : l.paperState}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-xs text-slate-400">No translation readiness data available.</p>
        )}
      </section>

      {/* Duplicate details */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Copy className="h-4 w-4 text-slate-400" aria-hidden /> Duplicate details
        </h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-medium text-slate-500">Repeated family references</h3>
            {duplicates.familyDuplicates.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {duplicates.familyDuplicates.map((d) => (
                  <li key={d.familyId} className="rounded-xl border border-red-100 bg-red-50/60 p-3 text-xs">
                    <p className="font-medium text-red-800">
                      Family {String(d.familyId).slice(0, 8)}… appears {d.count} times
                    </p>
                    <p className="mt-0.5 text-red-600">{d.sections.join(", ")}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-400">None.</p>
            )}
          </div>
          <div>
            <h3 className="text-xs font-medium text-slate-500">Possible duplicate content</h3>
            {duplicates.contentDuplicates.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {duplicates.contentDuplicates.slice(0, 25).map((d, i) => (
                  <li key={i} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs">
                    <p className="font-medium text-amber-800">
                      {d.count} families with identical content
                    </p>
                    <p className="mt-0.5 break-all text-amber-600">
                      {d.familyIds.map((f) => String(f).slice(0, 8)).join("…, ")}…
                    </p>
                  </li>
                ))}
                {duplicates.contentDuplicates.length > 25 && (
                  <li className="text-xs text-slate-400">
                    …and {duplicates.contentDuplicates.length - 25} more group(s).
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-400">None.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  note,
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
  delta?: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {icon}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {(note || delta !== undefined) && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          {delta !== undefined && delta !== 0 && <Delta value={delta} />}
          {note && <span className="text-slate-400">{note}</span>}
        </div>
      )}
    </div>
  );
}

const BAR_COLORS = [
  "bg-sky-500",
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
];

function DistributionCard({
  title,
  icon,
  buckets,
  max,
  showMarks = false,
}: {
  title: string;
  icon: React.ReactNode;
  buckets: PaperAnalysisBucket[];
  max: number;
  showMarks?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon} {title}
      </h2>
      {buckets.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {buckets.map((b, i) => {
            const pct = max > 0 ? Math.round((b.count / max) * 100) : 0;
            return (
              <li key={b.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="min-w-0 flex-1 truncate pl-0.5 font-medium text-slate-700">{b.label}</span>
                  <span className="ml-3 shrink-0 text-slate-500">
                    {b.count}
                    {showMarks && b.marks !== undefined ? ` · ${b.marks} marks` : ""}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${BAR_COLORS[i % BAR_COLORS.length]}`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-400">No data.</p>
      )}
    </section>
  );
}

function Delta({ value }: { value: number }) {
  if (value === 0) {
    return <span className="text-xs font-medium text-slate-400">0</span>;
  }
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${
        positive
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-red-50 text-red-700 ring-red-200"
      }`}
    >
      {positive ? "+" : ""}
      {value}
    </span>
  );
}