import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  KeyRound,
  Languages,
  Shuffle,
} from "lucide-react";
import {
  api,
  ApiError,
  type Language,
  type PaperReport,
  type PaperReportEntry,
  type PaperSetsDoc,
} from "../../api/client";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { TableSkeleton } from "../components/Skeleton";
import { richTextToPlain } from "../components/richText";

const ANY_LANGUAGE = "__any__";

export default function PaperReportsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<PaperSetsDoc | null>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [languages, setLanguages] = useState<Language[]>([]);

  const [scope, setScope] = useState<"master" | string>("master");
  const [mode, setMode] = useState<"compact" | "solutions">("compact");
  const [langLeft, setLangLeft] = useState(ANY_LANGUAGE);
  const [langRight, setLangRight] = useState(ANY_LANGUAGE);

  const [reportLeft, setReportLeft] = useState<PaperReport | null>(null);
  const [reportRight, setReportRight] = useState<PaperReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [sets, langs] = await Promise.all([
        api.papers.sets.get(id),
        api.languages.list().catch(() => ({ languages: [] as Language[] })),
      ]);
      setDoc(sets.sets);
      setMigrationRequired(sets.migrationRequired === true);
      setLanguages(langs.languages);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load paper.");
      navigate("/admin/papers/all");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (id) {
      let active = true;
      const activeScope = scope !== "master" && !(doc?.sets ?? []).some((s) => s.key === scope)
        ? "master"
        : scope;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingReport(true);
      setReportLeft(null);
      setReportRight(null);
      setReportError(null);

      const source = mode === "solutions" ? api.papers.solutions : api.papers.answerKey;
      const options = (lang: string) => ({
        set: activeScope === "master" ? undefined : activeScope,
        language: lang === ANY_LANGUAGE ? undefined : lang,
      });
      const fail = (err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : "Failed to build the report.";
        setReportError(message);
        toast.error(message);
      };
      const finish = () => {
        if (active) setLoadingReport(false);
      };

      if (langLeft === langRight) {
        source(id, options(langLeft)).then(
          (report) => {
            if (active) {
              setReportLeft(report);
              setReportRight(null);
            }
          },
          fail
        ).finally(finish);
      } else {
        Promise.all([source(id, options(langLeft)), source(id, options(langRight))]).then(
          ([left, right]) => {
            if (active) {
              setReportLeft(left);
              setReportRight(right);
            }
          },
          fail
        ).finally(finish);
      }
      return () => {
        active = false;
      };
    }
  }, [id, doc, scope, mode, langLeft, langRight]);

  if (loading) {
    return <TableSkeleton rows={8} cols={2} />;
  }

  const setKeys = (doc?.sets ?? []).map((s) => s.key);
  const bilingual = langLeft !== langRight;
  const scopeLabel = scope === "master" ? "Master paper" : `Set ${scope}`;
  const languagesAvailable = languages.length > 0;
  const languageOptions = [
    { value: ANY_LANGUAGE, label: "Any (base language)" },
    ...languages.map((l) => ({ value: l.id, label: l.name })),
  ];

  const banner = reportError ?? null;
  const langLabel = (lang: string) =>
    lang === ANY_LANGUAGE ? "Any language" : languages.find((l) => l.id === lang)?.name ?? lang;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Answer Key & Solutions"
        subtitle={`Built from the paper's actual final structure — ${scopeLabel}${bilingual ? " · bilingual" : ""}`}
        actions={
          <Button variant="secondary" onClick={() => navigate(id ? `/admin/papers/${id}` : "/admin/papers/all")}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </Button>
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">Report</label>
            <div className="mt-1.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMode("compact")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition ${
                  mode === "compact"
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                <KeyRound className="h-4 w-4" aria-hidden /> Answer key
              </button>
              <button
                type="button"
                onClick={() => setMode("solutions")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition ${
                  mode === "solutions"
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                <BookOpenCheck className="h-4 w-4" aria-hidden /> Detailed solutions
              </button>
            </div>
          </div>

          <div className={selectWrap}>
            <label className="block text-xs font-medium text-slate-600">Scope</label>
            <select
              value={scope === "master" ? "" : scope}
              onChange={(e) => setScope(e.target.value || "master")}
              className={selectClass}
              aria-label="Report scope"
            >
              <option value="">Master paper</option>
              {setKeys.map((k) => (
                <option key={k} value={k}>
                  Set {k}
                </option>
              ))}
            </select>
          </div>

          <div className={selectWrap}>
            <label className="block text-xs font-medium text-slate-600">
              <Languages className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
              Bilingual column 1
            </label>
            <select
              value={langLeft}
              onChange={(e) => setLangLeft(e.target.value)}
              className={selectClass}
              aria-label="First language"
              disabled={!languagesAvailable}
            >
              {languageOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className={selectWrap}>
            <label className="block text-xs font-medium text-slate-600">
              <Languages className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
              Bilingual column 2
            </label>
            <select
              value={langRight}
              onChange={(e) => setLangRight(e.target.value)}
              className={selectClass}
              aria-label="Second language"
              disabled={!languagesAvailable}
            >
              {languageOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {bilingual
            ? "Two languages selected — the report is shown side by side so a bilingual paper can be checked column by column."
            : "Select two different languages to view a bilingual key side by side. Pick a second language above."}
          {" "}Answers and solutions always come from the Question Bank's own data; missing entries are
          flagged, never filled in.
        </p>
      </section>

      {banner && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>{banner}</span>
        </div>
      )}

      {loadingReport ? (
        <TableSkeleton rows={6} cols={3} />
      ) : reportLeft ? (
        <>
          <SummaryBar report={reportLeft} behavior={bilingual ? "Bilingual" : mode === "solutions" ? "Solutions" : "Answer key"} />
          {reportLeft.summary.warnings.length > 0 && (
            <div className="space-y-1.5">
              {reportLeft.summary.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
          <div className={`grid gap-6 ${bilingual ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
            <ReportColumn report={reportLeft} mode={mode} label={`${scopeLabel} · ${langLabel(langLeft)}`} />
            {bilingual && reportRight && (
              <ReportColumn report={reportRight} mode={mode} label={`${scopeLabel} · ${langLabel(langRight)}`} />
            )}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <BookOpenCheck className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-700">No report to show</p>
          <p className="mt-1 text-xs text-slate-500">
            {doc
              ? "Choose the scope and report type above."
              : "This paper has no questions yet — add questions before generating an answer key."}
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryBar({ report, behavior }: { report: PaperReport; behavior: string }) {
  const s = report.summary;
  const badges: { label: string; value: string; tone: string }[] = [
    { label: "Questions", value: String(s.questionCount), tone: "text-slate-700" },
    { label: "Marks", value: String(s.totalMarks), tone: "text-slate-700" },
    { label: "Answered", value: String(s.answered), tone: "text-emerald-700" },
    { label: "Missing answers", value: String(s.missingAnswer), tone: s.missingAnswer ? "text-red-700" : "text-slate-400" },
    { label: "Substituted", value: String(s.substituted), tone: s.substituted ? "text-amber-700" : "text-slate-400" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
          s.complete
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
            : "bg-amber-50 text-amber-700 ring-amber-200"
        }`}
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        {s.complete ? "Complete" : "Incomplete"}
      </span>
      <span className="hidden text-xs text-slate-400 sm:inline">{behavior}</span>
      {badges.map((b) => (
        <span key={b.label} className="text-xs text-slate-600">
          {b.label} <strong className={b.tone}>{b.value}</strong>
        </span>
      ))}
      {s.appliedOrder === "set" ? (
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <Shuffle className="h-3 w-3" aria-hidden /> Ordering follows the selected set (stored
          randomization honored)
        </span>
      ) : (
        <span className="text-xs text-slate-400">Ordering follows the master paper sequence</span>
      )}
    </div>
  );
}

function ReportColumn({ report, mode, label }: { report: PaperReport; mode: "compact" | "solutions"; label: string }) {
  return (
    <div className="min-w-0 space-y-5">
      {report.sections.map((section) => (
        <section key={section.key} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">{section.name}</h3>
            <span className="text-xs text-slate-400">
              {section.entries.length} questions
              {section.negativeMarks
                ? ` · ${section.negativeMarks} negative marks per wrong answer`
                : ""}
            </span>
            <span className="ml-auto text-[11px] text-slate-400">{label}</span>
          </div>
          <div className="p-5">
            {mode === "compact" ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {section.entries.map((e) => (
                  <CompactCell key={e.number} entry={e} />
                ))}
              </div>
            ) : (
              <SolutionList entries={section.entries} />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function CompactCell({ entry }: { entry: PaperReportEntry }) {
  const missing = entry.answerMissing || entry.questionMissing;
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">Q{entry.number}</p>
        <div className="flex items-center gap-1">
          {entry.substituted && (
            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
              substituted
            </span>
          )}
          {entry.permutationDrift && (
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-200">
              re-check
            </span>
          )}
        </div>
      </div>
      <p
        className={`mt-0.5 text-lg font-bold ${
          missing ? "text-amber-600" : entry.substituted ? "text-amber-700" : "text-emerald-700"
        }`}
      >
        {entry.answer ?? "—"}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">
        {entry.type ?? "unknown type"} · {entry.marks} marks
      </p>
      {entry.questionMissing && <p className="mt-0.5 text-[11px] italic text-red-600">no variant</p>}
    </div>
  );
}

function SolutionList({ entries }: { entries: PaperReportEntry[] }) {
  return (
    <ol className="space-y-3">
      {entries.map((e) => (
        <li key={e.number} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm text-slate-900">Q{e.number}</span>
            <span className="text-[11px] text-slate-400">
              {e.type ?? "unknown type"} · {e.marks} marks
            </span>
            {e.substituted && (
              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                substituted from base language
              </span>
            )}
            {e.permutationDrift && (
              <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-200">
                option order changed — shown in current order
              </span>
            )}
            {e.questionMissing && (
              <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-200">
                no variant
              </span>
            )}
          </div>
          {!e.questionMissing && (
            <>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                {richTextToPlain(e.question)}
              </p>
              {e.options && e.options.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {e.options.map((o) => (
                    <li key={o.label} className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">{o.label}.</span>{" "}
                      {richTextToPlain(o.content)}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-sm">
                <span className="font-semibold text-emerald-700">Answer:</span>{" "}
                <span className="font-semibold text-emerald-700">{e.answer ?? "—"}</span>
              </p>
              <p className="mt-1 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Solution:</span>{" "}
                {e.explanationMissing ? (
                  <span className="italic text-amber-700">No solution available for this question.</span>
                ) : (
                  <span className="whitespace-pre-wrap">{richTextToPlain(e.explanation)}</span>
                )}
              </p>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

const selectWrap = "w-44";
const selectClass =
  "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";