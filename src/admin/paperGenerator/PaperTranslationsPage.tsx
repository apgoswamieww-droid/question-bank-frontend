import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Globe,
  Lock,
  ShieldCheck,
} from "lucide-react";
import {
  api,
  ApiError,
  type LanguageReadiness,
  type PaperTranslationsDoc,
  type TranslationReport,
  type TranslationState,
} from "../../api/client";
import { useCan, PERMISSIONS } from "../../context/useAdminAuth";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { TableSkeleton } from "../components/Skeleton";

const STATE_STYLES: Record<TranslationState, string> = {
  missing: "bg-red-50 text-red-700 ring-red-200",
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
  translated: "bg-blue-50 text-blue-700 ring-blue-200",
  reviewed: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const PAPER_STATES: Exclude<TranslationState, "missing">[] = [
  "draft",
  "translated",
  "reviewed",
  "approved",
];

export default function PaperTranslationsPage() {
  const can = useCan();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paperTitle, setPaperTitle] = useState("");
  const [report, setReport] = useState<TranslationReport | null>(null);
  const [doc, setDoc] = useState<PaperTranslationsDoc | null>(null);
  const [expandedLang, setExpandedLang] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const reportResult = await api.papers.translations.report(id);
      setPaperTitle(reportResult.paperId === id ? reportResult.paperId : id);
      setReport(reportResult);
      setDoc(reportResult.translations ?? null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load translation report.");
      navigate("/admin/papers/all");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const perLanguage = useMemo(() => report?.languages ?? [], [report]);

  const saveLanguage = async (lang: LanguageReadiness, state: Exclude<TranslationState, "missing">) => {
    if (!id) return;
    setSaving(true);
    try {
      const next: PaperTranslationsDoc = {
        languages: {
          ...(doc?.languages ?? {}),
          [lang.language.id]: {
            ...(doc?.languages?.[lang.language.id] ?? {}),
            state,
            note: doc?.languages?.[lang.language.id]?.note ?? null,
            sections: doc?.languages?.[lang.language.id]?.sections ?? {},
            updatedAt: new Date().toISOString(),
          },
        },
      };
      await api.papers.translations.save(id, next);
      setDoc(next);
      toast.success(`${lang.language.name} paper marked ${state}.`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "TRANSLATION_STORAGE_UNAVAILABLE") {
        setMigrationRequired(true);
      }
      toast.error(err instanceof ApiError ? err.message : "Failed to save translation state.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <TableSkeleton rows={8} cols={2} />;
  }

  const totals = report?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper Translations"
        subtitle={`Language readiness for ${paperTitle && paperTitle !== id ? `“${paperTitle}”` : `paper ${id?.slice(0, 8)}…`}`}
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
            Translation storage is not active yet — apply backend/migrations/009_translation_states.sql
            in the Supabase SQL editor.
          </span>
        </div>
      )}

      {totals && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Languages</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{totals.languages}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Master questions</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{totals.questions}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Print-ready languages</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{totals.fullyApprovedLanguages}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Invariant issues</p>
            <p className={`mt-1 text-2xl font-bold ${totals.invariantIssues > 0 ? "text-red-600" : "text-slate-900"}`}>
              {totals.invariantIssues}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {perLanguage.map((lang) => (
          <section key={lang.language.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <Globe className="h-5 w-5 text-slate-600" aria-hidden />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">{lang.language.name}</h3>
                <p className="text-xs text-slate-500">
                  coverage {lang.coverage}% · worst state {lang.worstState}
                  {lang.invariantIssues > 0 && (
                    <span className="ml-1 font-medium text-red-600">· {lang.invariantIssues} invariant issue(s)</span>
                  )}
                </p>
              </div>
              <span className={`ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATE_STYLES[lang.ready ? "approved" : lang.worstState]}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {lang.ready ? "Print-ready" : lang.worstState}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                {can(PERMISSIONS.PAPERS_TRANSLATIONS_MANAGE) && PAPER_STATES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={saving}
                    onClick={() => saveLanguage(lang, s)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ring-1 transition disabled:opacity-50 ${
                      lang.paperState === s
                        ? "bg-slate-900 text-white ring-slate-900"
                        : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setExpandedLang(expandedLang === lang.language.id ? null : lang.language.id)}
                >
                  {expandedLang === lang.language.id ? "Hide" : "Per question"}
                </Button>
              </div>
            </div>

            {expandedLang === lang.language.id && (
              <div className="border-t border-slate-100 p-5 pt-4">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {lang.questions.map((q) => (
                    <div key={q.familyId} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-500">Q{q.number}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${STATE_STYLES[q.state]}`}>
                          {q.state}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-400">{q.familyId.slice(0, 8)}…</p>
                      {q.invariantIssues.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {q.invariantIssues.map((issue, i) => (
                            <p key={i} className="flex items-start gap-1 text-[11px] text-red-600">
                              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> {issue.problem}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  Variants are managed in the Question Bank (Link Variant). Numbers, formulas, units and
                  diagrams are integrity-checked automatically — flagged items need translator attention.
                </p>
              </div>
            )}
          </section>
        ))}

        {perLanguage.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Globe className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-slate-700">No languages configured</p>
            <p className="mt-1 text-xs text-slate-500">Add languages under master data to track translations.</p>
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Language generation never invents questions: only same-family variants are used, and missing
        translations are reported — never silently substituted.
      </p>
    </div>
  );
}
