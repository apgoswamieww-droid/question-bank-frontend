import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Dices,
  FileDigit,
  Globe,
  Languages,
  LayoutTemplate,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
  Unlink,
} from "lucide-react";
import {
  api,
  ApiError,
  type LanguagePaperDetail,
  type LanguagePaperStatus,
  type LanguagePaperSummary,
  type PaperSetsDoc,
  type PaperTemplate,
} from "../../api/client";
import { useCan, PERMISSIONS } from "../../context/useAdminAuth";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { TableSkeleton } from "../components/Skeleton";
import { StoredRichText } from "../components/StoredRichText";
import {
  BilingualPrintPreviewModal,
  getAllPaperLayouts,
  type PaperLayoutId,
} from "../../print/layouts";

const STATUS_STYLES: Record<LanguagePaperStatus, string> = {
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
  generated: "bg-blue-50 text-blue-700 ring-blue-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  archived: "bg-slate-100 text-slate-500 ring-slate-200",
};

const STATUS_LABELS: Record<LanguagePaperStatus, string> = {
  draft: "Draft",
  generated: "Generated",
  approved: "Approved",
  archived: "Archived",
};

const STATUS_OPTIONS: LanguagePaperStatus[] = ["draft", "generated", "approved", "archived"];

export default function LanguagePapersPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = useCan();

  const [loading, setLoading] = useState(true);
  const [masterTitle, setMasterTitle] = useState("");
  const [versions, setVersions] = useState<LanguagePaperSummary[]>([]);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [setsDoc, setSetsDoc] = useState<PaperSetsDoc | null>(null);

  const [languages, setLanguages] = useState<{ id: string; code: string | null; name: string }[]>([]);
  const [languageId, setLanguageId] = useState("");
  const [setKey, setSetKey] = useState("");
  const [strictMode, setStrictMode] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, LanguagePaperDetail>>({});
  const [detailLoading, setDetailLoading] = useState<number | null>(null);

  const [templates, setTemplates] = useState<PaperTemplate[]>([]);
  const [templatesMigrationRequired, setTemplatesMigrationRequired] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [listResult, setsResult] = await Promise.all([
        api.papers.languagePapers.list(id),
        api.papers.sets.get(id).catch(() => null),
      ]);
      setMasterTitle(listResult.masterTitle === id ? id : listResult.masterTitle);
      setVersions(listResult.papers ?? []);
      setLanguages(listResult.languages ?? []);
      setMigrationRequired(listResult.migrationRequired === true);
      setSetsDoc(setsResult?.sets ?? null);
      try {
        const templatesResult = await api.templates.list();
        setTemplates(templatesResult.templates ?? []);
        setTemplatesMigrationRequired(false);
      } catch (tErr) {
        setTemplates([]);
        if (tErr instanceof ApiError && tErr.code === "PAPER_TEMPLATE_STORAGE_UNAVAILABLE") {
          setTemplatesMigrationRequired(true);
        }
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load language papers.");
      navigate("/admin/papers/all");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const usableLanguages = useMemo(() => {
    const used = new Set(versions.map((v) => v.language_id));
    return languages.filter((l) => !used.has(l.id));
  }, [languages, versions]);

  // The form's effective selection: keep the user's choice, but fall back to the
  // first still-available language after a version is generated/removed.
  const effectiveLanguageId = useMemo(
    () => (languageId && usableLanguages.some((l) => l.id === languageId) ? languageId : usableLanguages[0]?.id ?? ""),
    [languageId, usableLanguages]
  );

  const generate = async () => {
    if (!id || !effectiveLanguageId) return;
    setGenerating(true);
    try {
      const result = await api.papers.languagePapers.generate(id, {
        languageId: effectiveLanguageId,
        setKey: setKey || null,
        mode: strictMode ? "strict" : "substitute",
      });
      await load();
      setExpanded(result.version);
      toast.success(
        `${result.language.name} paper v${result.version} generated from the master paper.`
      );
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "LANGUAGE_PAPER_STORAGE_UNAVAILABLE") setMigrationRequired(true);
        toast.error(err.message);
      } else {
        toast.error("Failed to generate language paper.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const toggleDetail = async (v: number) => {
    if (expanded === v) {
      setExpanded(null);
      return;
    }
    setExpanded(v);
    setDetailLoading(v);
    try {
      if (id) {
        const detail = await api.papers.languagePapers.get(id, v);
        setDetails((prev) => ({ ...prev, [v]: detail }));
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load language paper.");
    } finally {
      setDetailLoading(null);
    }
  };

  const setStatus = async (v: number, status: LanguagePaperStatus) => {
    if (!id) return;
    try {
      await api.papers.languagePapers.setStatus(id, v, status);
      setVersions((prev) => prev.map((p) => (p.version === v ? { ...p, status } : p)));
      toast.success(`Language paper v${v} marked ${STATUS_LABELS[status].toLowerCase()}.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update status.");
    }
  };

  const remove = async (v: number) => {
    if (!id) return;
    if (!window.confirm(`Remove generated language paper v${v}? The master paper and its translations are not affected.`)) return;
    try {
      await api.papers.languagePapers.remove(id, v);
      setVersions((prev) => prev.filter((p) => p.version !== v));
      setDetails((prev) => {
        const next = { ...prev };
        delete next[v];
        return next;
      });
      if (expanded === v) setExpanded(null);
      toast.success(`Language paper v${v} removed.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove language paper.");
    }
  };

  const [printLayout, setPrintLayout] = useState<PaperLayoutId>("bilingual-two-column");
  const [printTemplateId, setPrintTemplateId] = useState<string>("");
  const [printLeftVersion, setPrintLeftVersion] = useState<string>("");
  const [printRightVersion, setPrintRightVersion] = useState<string>("");
  const [printLoading, setPrintLoading] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printLeft, setPrintLeft] = useState<LanguagePaperDetail | null>(null);
  const [printRight, setPrintRight] = useState<LanguagePaperDetail | null>(null);

  const printLayouts = useMemo(() => getAllPaperLayouts().filter((l) => l.id !== "custom"), []);

  const printTemplates = useMemo(() => {
    const isBilingual = printLayout === "bilingual-two-column";
    return templates.filter((t) => t.kind === "custom" || (isBilingual ? t.kind === "bilingual" : t.kind === "single"));
  }, [templates, printLayout]);

  const effectivePrintTemplate = useMemo<PaperTemplate | undefined>(() => {
    if (printTemplateId === "none") return undefined;
    if (printTemplateId === "") return printTemplates.find((t) => t.is_default) ?? undefined;
    return printTemplates.find((t) => t.id === printTemplateId) ?? undefined;
  }, [printTemplateId, printTemplates]);

  const effectivePrintLeftVersion =
    printLeftVersion !== "" && versions.some((v) => v.version === Number(printLeftVersion))
      ? printLeftVersion
      : (String(versions[0]?.version ?? ""));
  const printLeftMeta = versions.find((v) => v.version === Number(effectivePrintLeftVersion));
  const otherLanguageVersion = versions.find((v) => v.language_id !== printLeftMeta?.language_id)?.version;
  const effectivePrintRightVersion =
    printRightVersion !== "" && versions.some((v) => v.version === Number(printRightVersion))
      ? printRightVersion
      : (printLayout === "bilingual-two-column" && otherLanguageVersion !== undefined ? String(otherLanguageVersion) : "");

  const openPrintPreview = async () => {
    if (!id) return;
    if (printLayout === "bilingual-two-column" && (effectivePrintLeftVersion === "" || effectivePrintRightVersion === "")) {
      toast.error("Bilingual two-column needs a version selected for both columns.");
      return;
    }
    setPrintLoading(true);
    try {
      const [leftDetail, rightDetail] = await Promise.all([
        api.papers.languagePapers.get(id, Number(effectivePrintLeftVersion)),
        effectivePrintRightVersion !== "" ? api.papers.languagePapers.get(id, Number(effectivePrintRightVersion)) : Promise.resolve(null),
      ]);
      setPrintLeft(leftDetail);
      setPrintRight(rightDetail);
      setPrintModalOpen(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load paper for printing.");
    } finally {
      setPrintLoading(false);
    }
  };

  if (loading) {
    return <TableSkeleton rows={8} cols={2} />;
  }

  const paperLabel = `Paper ${id?.slice(0, 8) ?? ""}…`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Language Papers"
        subtitle={`Generated language versions of ${masterTitle && masterTitle !== id ? `“${masterTitle}”` : paperLabel} — every version is a traceable derivation of the master paper.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(id ? `/admin/papers/${id}` : "/admin/papers/all")}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
          </div>
        }
      />

      {migrationRequired && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            Language paper storage is not active yet — apply backend/migrations/010_language_papers.sql in
            the Supabase SQL editor.
          </span>
        </div>
      )}

      {/* generation form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Generate a language paper</h2>
        <p className="mt-1 text-xs text-slate-500">
          Renders the same logical questions, order, sections, marks, negative marking, answer mapping,
          images and mathematical content from the master paper — only the language-specific text changes.
          Question selection is never repeated per language.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">Language</label>
            <select
              value={effectiveLanguageId}
              onChange={(e) => setLanguageId(e.target.value)}
              className="mt-1.5 min-w-44 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
            >
              <option value="">Select a language…</option>
              {usableLanguages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Order by randomization set</label>
            <select
              value={setKey}
              onChange={(e) => setSetKey(e.target.value)}
              className="mt-1.5 min-w-44 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
            >
              <option value="">Master order (unchanged)</option>
              {(setsDoc?.sets ?? []).map((s) => (
                <option key={s.key} value={s.key}>
                  Set {s.key} (stored order)
                </option>
              ))}
            </select>
            {!setsDoc && <p className="mt-1 text-[11px] text-slate-400">No randomization sets exist yet.</p>}
          </div>

          <label className="flex items-center gap-2 pb-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={strictMode}
              onChange={(e) => setStrictMode(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Strict — refuse if any translation is missing
          </label>

          {can(PERMISSIONS.PAPERS_TRANSLATIONS_MANAGE) && (
            <div className="ml-auto">
              <Button onClick={generate} loading={generating} disabled={!effectiveLanguageId || usableLanguages.length === 0}>
                <Plus className="h-4 w-4" aria-hidden /> Generate language paper
              </Button>
            </div>
          )}
        </div>
        {usableLanguages.length === 0 && (
          <p className="mt-3 text-xs text-slate-400">
            Every configured language already has a generated paper. Archive or remove one to generate a new version.
          </p>
        )}
      </section>

      {/* list */}
      {versions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Languages className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-700">No language papers generated yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Choose a language above to generate the paper for English, Gujarati, Hindi or any future language.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {versions.map((p) => {
            const detail = details[p.version];
            const snap = p.snapshot;
            return (
              <section key={p.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-3 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
                    <Globe className="h-5 w-5 text-white" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">{p.language.name}</h3>
                    <p className="text-xs text-slate-500">
                      version <span className="font-semibold text-slate-700">v{p.version}</span>
                      {p.set_key ? ` · ordered by set ${p.set_key}` : " · master order"}
                      {snap && (
                        <>
                          {" "}
                          · {snap.question_count} questions · {snap.total_marks} marks
                        </>
                      )}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_STYLES[p.status]}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {STATUS_LABELS[p.status]}
                  </span>
                  {snap && snap.complete && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                      <CheckCircle2 className="h-3 w-3" aria-hidden /> Complete
                    </span>
                  )}
                  {snap && snap.missing_count > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                      <Unlink className="h-3 w-3" aria-hidden /> {snap.missing_count} missing
                    </span>
                  )}
                  {snap && snap.substituted_count > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                      <AlertTriangle className="h-3 w-3" aria-hidden /> {snap.substituted_count} substituted
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{new Date(p.generated_at).toLocaleString()}</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(p.version, s)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium ring-1 transition ${
                          p.status === s
                            ? "bg-slate-900 text-white ring-slate-900"
                            : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                    <Button variant="secondary" size="sm" onClick={() => toggleDetail(p.version)}>
                      {expanded === p.version ? "Hide" : "View"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(p.version)}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>

                {expanded === p.version && (
                  <div className="border-t border-slate-100 p-5 pt-4">
                    {detailLoading === p.version && !detail ? (
                      <TableSkeleton rows={3} cols={2} />
                    ) : detail ? (
                      <LanguagePaperView detail={detail} />
                    ) : (
                      <TableSkeleton rows={3} cols={2} />
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* layout & print */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-slate-400" aria-hidden />
          <h2 className="text-sm font-semibold text-slate-900">Layout &amp; Print</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Preview any layout as a printable PDF — the two-column bilingual layout keeps the same logical
          question synchronized across both languages. Add new layouts to the engine registry to extend this.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">Layout</label>
            <select
              value={printLayout}
              onChange={(e) => setPrintLayout(e.target.value as PaperLayoutId)}
              className="mt-1.5 min-w-44 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
            >
              {printLayouts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              {printLayouts.find((l) => l.id === printLayout)?.description}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Template</label>
            <div className="mt-1.5 flex items-center gap-2">
              <select
                value={printTemplateId}
                onChange={(e) => setPrintTemplateId(e.target.value)}
                className="min-w-44 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
              >
                <option value="">Auto (default template)</option>
                <option value="none">None — built-in defaults</option>
                {printTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => navigate("/admin/templates")}
                className="whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Manage templates
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {effectivePrintTemplate
                ? `Applying “${effectivePrintTemplate.name}” — its page size, margins, branding, typography and spacing are used for print.`
                : "No template applied — the built-in A4 defaults are used."}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Left column language</label>
            <select
              value={effectivePrintLeftVersion}
              onChange={(e) => setPrintLeftVersion(e.target.value)}
              className="mt-1.5 min-w-44 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
            >
              {versions.map((v) => (
                <option key={v.id} value={String(v.version)}>
                  {v.language.name} v{v.version}
                </option>
              ))}
            </select>
          </div>

          {printLayout === "bilingual-two-column" && (
            <div>
              <label className="block text-xs font-medium text-slate-600">Right column language</label>
              <select
                value={effectivePrintRightVersion}
                onChange={(e) => setPrintRightVersion(e.target.value)}
                className="mt-1.5 min-w-44 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
              >
                {versions.map((v) => (
                  <option key={v.id} value={String(v.version)}>
                    {v.language.name} v{v.version}
                  </option>
                ))}
              </select>
            </div>
          )}

          {printLayout === "bilingual-two-column" && !otherLanguageVersion && (
            <p className="pb-2 text-xs text-amber-600">
              Only one language generated so far — generate another language to print a bilingual paper.
            </p>
          )}

          <div className="ml-auto">
            <Button
              onClick={openPrintPreview}
              loading={printLoading}
              disabled={
                effectivePrintLeftVersion === "" ||
                (printLayout === "bilingual-two-column" && effectivePrintRightVersion === "")
              }
            >
              <Printer className="h-4 w-4" aria-hidden /> Preview &amp; Print
            </Button>
          </div>
        </div>
        {templatesMigrationRequired && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Paper template storage is not active yet — apply backend/migrations/011_paper_templates.sql in the Supabase
            SQL editor to save reusable templates with branding.
          </p>
        )}
      </section>

      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Every language paper is versioned and traceable to the master paper. Numbers, formulas, units,
        diagrams and answer mappings are integrity-checked — flagged content needs translator attention.
      </p>

      {printModalOpen && printLeft && (
        <BilingualPrintPreviewModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          left={printLeft}
          right={printRight ?? undefined}
          layout={printLayout}
          title={masterTitle && masterTitle !== id ? masterTitle : undefined}
          template={effectivePrintTemplate}
        />
      )}
    </div>
  );
}

function LanguagePaperView({ detail }: { detail: LanguagePaperDetail }) {
  const langName = typeof detail.language === "string" ? detail.language : detail.language.name;
  const sections = detail.sections ?? [];
  const sectionName = (key: string | null) =>
    sections.find((s) => s.key === key)?.name ?? (key ? key : "Questions");

  const bySection = new Map<string | null, typeof detail.questions>(
    sections.map((s) => [s.key, detail.questions.filter((q) => q.section_key === s.key)] as [string | null, typeof detail.questions]).filter(([, qs]) => qs.length > 0)
  );
  const unassigned = detail.questions.filter((q) => !q.section_key);
  if (unassigned.length > 0) bySection.set(null, unassigned);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>
          {langName} paper · v{detail.version} · {detail.status}
        </span>
        <span className="flex items-center gap-1">
          <Dices className="h-3 w-3" aria-hidden />
          {detail.set_key ? `ordered by set ${detail.set_key}` : "master order preserved"}
        </span>
        <span>
          {detail.questions.length} questions · {detail.paper.total_marks} marks · {detail.paper.duration_min} min
        </span>
      </div>

      {detail.paper.description && (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{detail.paper.description}</p>
      )}

      {Object.keys(detail.sectionInstructions).length > 0 && (
        <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-3">
          {Object.entries(detail.sectionInstructions).map(([key, text]) => (
            <p key={key} className="text-xs text-slate-600">
              <span className="font-semibold text-slate-500">{sectionName(key)}:</span> {text}
            </p>
          ))}
        </div>
      )}

      {[...bySection.entries()].map(([key, qs]) => {
        const sec = sections.find((s) => s.key === key);
        return (
          <section key={key ?? "__default__"} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {sectionName(key)}
              </h3>
              <span className="text-xs text-slate-400">
                {qs.length} Q · {sec && sec.negativeMarks > 0 ? `${sec.negativeMarks} negative marks each` : "no negative marking"}
              </span>
            </div>
            <div className="space-y-2">
              {qs.map((q) => (
                <QuestionRow key={q.number} q={q} />
              ))}
            </div>
          </section>
        );
      })}

      {detail.missing.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {detail.missing.length} question family(ies) could not be resolved in {langName} — the paper is
          incomplete and must not be printed as-is.
        </div>
      )}
    </div>
  );
}

function QuestionRow({ q }: { q: LanguagePaperDetail["questions"][number] }) {
  const displayOptions = q.displayOptions ?? null;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
          {q.number}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full bg-white px-2 py-0.5 font-medium text-slate-500 ring-1 ring-slate-200">
              {q.marks} marks{q.negative_marks > 0 ? ` / -${q.negative_marks}` : ""}
            </span>
            {q.substituted && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 ring-1 ring-amber-200">
                substituted from another language
              </span>
            )}
            {q.translation_status === "missing" && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 ring-1 ring-red-200">
                missing
              </span>
            )}
            {q.invariant_issues.length > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 ring-1 ring-red-200">
                {q.invariant_issues.length} invariant issue(s)
              </span>
            )}
            <span className="ml-auto font-mono text-[10px] text-slate-300">
              {q.content_hash ? `#${q.content_hash.slice(0, 8)}` : "no hash"}
            </span>
          </div>

          {q.question ? (
            <>
              <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-100">
                <StoredRichText value={q.question.content} />
              </div>
              {displayOptions && displayOptions.length > 0 && (
                <ul className="space-y-1">
                  {displayOptions.map((opt) => (
                    <li key={opt.label} className="flex items-start gap-2 rounded-lg bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-100">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                        {opt.label}
                      </span>
                      {opt.content ? <StoredRichText value={opt.content} /> : null}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-slate-400">
                Answer: <span className="font-semibold text-emerald-700">{q.answer ?? "—"}</span>
                {q.resolved_language_id ? " · answer mapping preserved" : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400">No variant resolved in this language.</p>
          )}

          {q.invariant_issues.map((issue, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[11px] text-red-600">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>
                <code className="rounded bg-white px-1">{issue.field}</code> {issue.problem}
              </span>
            </p>
          ))}

          <p className="flex items-center gap-1 text-[11px] text-slate-400">
            <FileDigit className="h-3 w-3" aria-hidden />
            master family {q.family_id.slice(0, 8)}…
          </p>
        </div>
      </div>
    </div>
  );
}