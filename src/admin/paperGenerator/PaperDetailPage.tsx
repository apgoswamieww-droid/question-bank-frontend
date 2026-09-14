import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BarChart3,
  BookCopy,
  CheckCircle2,
  Copy,
  Dices,
  Eye,
  FileDown,
  FileText,
  Globe,
  History,
  Info,
  KeyRound,
  Layers,
  Languages,
  ListOrdered,
  Pencil,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import {
  api,
  ApiError,
  type PaperFamily,
  type PaperLanguages,
  type PaperPayload,
  type ValidationIssueWithLevel,
  type ValidationReport,
} from "../../api/client";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { TableSkeleton } from "../components/Skeleton";
import { richTextToPlain } from "../components/richText";
import { paperStatusStyles } from "./paperStatus";
import { useCan, PERMISSIONS } from "../../context/useAdminAuth";

export default function PaperDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = useCan();
  const [paper, setPaper] = useState<PaperPayload | null>(null);
  const [languages, setLanguages] = useState<PaperLanguages | null>(null);
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [validating, setValidating] = useState(false);

  const loadPaper = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [result, langs] = await Promise.all([
        api.papers.get(id),
        api.papers.languages(id).catch(() => null),
      ]);
      setPaper(result);
      setLanguages(langs);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load paper.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadPaper(); }, [loadPaper]);

  /** Lifecycle: read-only report + promote to "validated" when it passes. */
  const handleValidateAndPromote = async () => {
    if (!id) return;
    setValidating(true);
    try {
      const report = await api.papers.validate(id);
      setValidation(report);
      if (!report.summary.canPublish) {
        toast.error(
          `Critical issues block validation — ${report.summary.errors} error(s). See the report.`
        );
        return;
      }
      await api.papers.validateAndPromote(id);
      toast.success("Paper validated. It can now be published.");
      await loadPaper();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Validation failed.");
    } finally {
      setValidating(false);
    }
  };

  /** Lifecycle: publish a draft/validated paper (backed by the publish gate). */
  const handlePublish = async () => {
    if (!id) return;
    if (!window.confirm("Publish this paper? Past versions stay available in History.")) return;
    try {
      await api.papers.update(id, { status: "published" });
      toast.success("Paper published.");
      await loadPaper();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Publish failed.");
    }
  };

  const handleArchive = async () => {
    if (!id) return;
    if (!window.confirm("Archive this paper? It stays in the list and its history is preserved.")) return;
    try {
      await api.papers.archive(id);
      toast.success("Paper archived.");
      await loadPaper();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Archive failed.");
    }
  };

  const handleRestore = async () => {
    if (!id) return;
    if (!window.confirm("Restore this paper? It returns to draft — re-validate before republishing.")) return;
    try {
      await api.papers.restore(id);
      toast.success("Paper restored to draft.");
      await loadPaper();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Restore failed.");
    }
  };

  const handleDuplicate = async () => {
    if (!id) return;
    if (!window.confirm("Duplicate this paper as a new draft?")) return;
    try {
      const created = await api.papers.duplicate(id);
      toast.success("Paper duplicated as a new draft.");
      navigate(`/admin/papers/${created.paper.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Duplicate failed.");
    }
  };

  const handleExportPdf = async () => {
    if (!id) return;
    try {
      const blob = await api.papers.pdf(id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${String(paper?.paper.title ?? "paper")
        .replace(/[^\w\s-]+/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "paper"}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("PDF exported.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "PDF export failed.");
    }
  };

  /** Lifecycle: preview the rendered paper (PDF opened in a new tab). */
  const handlePreview = async () => {
    if (!id) return;
    try {
      const blob = await api.papers.pdf(id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Preview failed.");
    }
  };

  const status = paper?.paper.status;

  if (loading) {
    return <TableSkeleton rows={8} cols={2} />;
  }

  if (!paper) {
    return (
      <div className="space-y-6">
        <PageHeader title="Paper not found" />
        <p className="text-sm text-slate-600">
          This paper may have been deleted.{" "}
          <Link to="/admin/papers" className="font-medium text-primary hover:text-primary-600">
            Back to all papers
          </Link>
        </p>
      </div>
    );
  }

  const meta = paper.paper;
  const statusStyle = paperStatusStyles[meta.status] ?? paperStatusStyles.draft;
  const coveredLanguages = languages?.languages ?? [];
  const missingFamilies = (languages?.coverage ?? []).filter(
    (c) => c.languages.length === 0
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.title}
        subtitle={meta.description ?? "Question paper details"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => navigate("/admin/papers/all")}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            {can(PERMISSIONS.PAPERS_MANAGE) && (
              <Button onClick={() => navigate(`/admin/papers/${meta.id}/edit`)}>
                <Pencil className="h-4 w-4" aria-hidden /> Edit
              </Button>
            )}
            {can(PERMISSIONS.PAPERS_MANAGE) && (
              <Button variant="secondary" onClick={() => navigate(`/admin/papers/${meta.id}/blueprint`)}>
                <Layers className="h-4 w-4" aria-hidden /> Blueprint
              </Button>
            )}
            {can(PERMISSIONS.PAPERS_MANAGE) && (
              <Button variant="secondary" onClick={() => navigate(`/admin/papers/${meta.id}/questions`)}>
                <Wand2 className="h-4 w-4" aria-hidden /> Questions
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate(`/admin/papers/${meta.id}/structure`)}>
              <ListOrdered className="h-4 w-4" aria-hidden /> Structure
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/admin/papers/${meta.id}/sets`)}>
              <Dices className="h-4 w-4" aria-hidden /> Sets
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/admin/papers/${meta.id}/translations`)}>
              <Globe className="h-4 w-4" aria-hidden /> Translations
            </Button>
            {can(PERMISSIONS.PAPERS_TRANSLATIONS_MANAGE) && (
              <Button variant="secondary" onClick={() => navigate(`/admin/papers/${meta.id}/language-papers`)}>
                <BookCopy className="h-4 w-4" aria-hidden /> Language Papers
              </Button>
            )}
            {can(PERMISSIONS.PAPERS_REPORTS_VIEW) && (
              <Button variant="secondary" onClick={() => navigate(`/admin/papers/${meta.id}/reports`)}>
                <KeyRound className="h-4 w-4" aria-hidden /> Answer Key &amp; Solutions
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate(`/admin/papers/${meta.id}/analysis`)}>
              <BarChart3 className="h-4 w-4" aria-hidden /> Analysis
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/admin/papers/${meta.id}/versions`)}>
              <History className="h-4 w-4" aria-hidden /> Versions
            </Button>
            {(status === "draft" || status === "validated" || status === "published") &&
              can(PERMISSIONS.PAPERS_PUBLISH) && (
              <Button onClick={handleValidateAndPromote} loading={validating}>
                <ShieldCheck className="h-4 w-4" aria-hidden /> Validate
              </Button>
            )}
            {(status === "draft" || status === "validated") && can(PERMISSIONS.PAPERS_PUBLISH) && (
              <Button variant="secondary" onClick={handlePublish}>
                <Rocket className="h-4 w-4" aria-hidden /> Publish
              </Button>
            )}
            {status === "archived" && can(PERMISSIONS.PAPERS_MANAGE) && (
              <Button onClick={handleRestore}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Restore
              </Button>
            )}
            {(status === "draft" || status === "validated" || status === "published") &&
              can(PERMISSIONS.PAPERS_DELETE) && (
              <Button variant="secondary" onClick={handleArchive}>
                <Archive className="h-4 w-4" aria-hidden /> Archive
              </Button>
            )}
            {can(PERMISSIONS.PAPERS_MANAGE) && (
              <Button variant="secondary" onClick={handleDuplicate}>
                <Copy className="h-4 w-4" aria-hidden /> Duplicate
              </Button>
            )}
            {can(PERMISSIONS.PAPERS_EXPORT) && (
              <Button variant="secondary" onClick={handlePreview}>
                <Eye className="h-4 w-4" aria-hidden /> Preview
              </Button>
            )}
            {can(PERMISSIONS.PAPERS_EXPORT) && (
              <Button variant="secondary" onClick={handleExportPdf}>
                <FileDown className="h-4 w-4" aria-hidden /> Export PDF
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Details</h2>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Status</dt>
              <dd>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statusStyle.className}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {statusStyle.label}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Questions</dt>
              <dd className="font-medium text-slate-900">{paper.families.length}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Duration</dt>
              <dd className="font-medium text-slate-900">{meta.duration_min} min</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Total marks</dt>
              <dd className="font-medium text-slate-900">{meta.total_marks}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Created</dt>
              <dd className="text-slate-700">
                {new Date(meta.created_at).toLocaleDateString()}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Updated</dt>
              <dd className="text-slate-700">
                {new Date(meta.updated_at).toLocaleDateString()}
              </dd>
            </div>
            {meta.validated_at && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Validated</dt>
                <dd className="text-slate-700">
                  {new Date(meta.validated_at).toLocaleDateString()}
                </dd>
              </div>
            )}
            {meta.published_at && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Published</dt>
                <dd className="text-slate-700">
                  {new Date(meta.published_at).toLocaleDateString()}
                </dd>
              </div>
            )}
            {meta.archived_at && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Archived</dt>
                <dd className="text-slate-700">
                  {new Date(meta.archived_at).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Questions <span className="ml-1 text-slate-400">({paper.families.length})</span>
            </h2>
            <span className="text-xs text-slate-400">Ordered by paper sequence</span>
          </div>
          {paper.families.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No questions yet. Insert questions from the bank in the paper editor.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {paper.families.map((family: PaperFamily, idx) => {
                const text = family.primary?.content
                  ? richTextToPlain(family.primary.content)
                  : "(no variant resolved)";
                const variantLangs = family.variants
                  .map((v) => v.language_id)
                  .filter(Boolean).length;
                return (
                  <li
                    key={family.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm text-slate-800">{text}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Languages className="h-3 w-3" aria-hidden />
                        {variantLangs} language {variantLangs === 1 ? "variant" : "variants"}
                        {family.marks > 0 ? ` · ${family.marks} marks` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {coveredLanguages.length > 0 && (
            <p className="text-xs text-slate-500">
              Languages covered: {coveredLanguages.length}
              {missingFamilies > 0 && ` · ${missingFamilies} families missing translations`}
            </p>
          )}
        </section>
      </div>

      {validation && <ValidationPanel report={validation} />}

      <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
        <FileText className="h-4 w-4 text-slate-400" aria-hidden />
        <p className="text-xs text-slate-400">
          Questions shown here are resolved from the paper's question families.
        </p>
      </div>
    </div>
  );
}

const levelStyles: Record<
  string,
  { dot: string; badge: string; icon: React.ReactNode }
> = {
  ERROR: {
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 ring-1 ring-red-200",
    icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
  },
  WARNING: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
  },
  INFO: {
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    icon: <Info className="h-3.5 w-3.5" aria-hidden />,
  },
};

function ValidationPanel({ report }: { report: ValidationReport }) {
  const ordered: ValidationIssueWithLevel[] = [
    ...report.results.filter((r) => r.level === "ERROR"),
    ...report.results.filter((r) => r.level === "WARNING"),
    ...report.results.filter((r) => r.level === "INFO"),
  ];
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShieldCheck className="h-4 w-4" aria-hidden /> Validation Report
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {report.summary.canPublish ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Ready to publish
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 font-medium text-red-700 ring-1 ring-red-200">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Publishing blocked
            </span>
          )}
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 font-medium text-red-700 ring-1 ring-red-200">
            {report.summary.errors} errors
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-700 ring-1 ring-amber-200">
            {report.summary.warnings} warnings
          </span>
          <span className="rounded-full bg-sky-50 px-2.5 py-0.5 font-medium text-sky-700 ring-1 ring-sky-200">
            {report.summary.infos} info
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        {report.summary.questionCount} questions · computed marks{" "}
        <strong>{report.summary.computedMarks}</strong>
        {report.summary.migrationNote && ` · ${report.summary.migrationNote}`}
      </p>
      {ordered.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">No findings.</p>
      ) : (
        <ul className="space-y-1.5">
          {ordered.map((r, i) => {
            const style = levelStyles[r.level] ?? levelStyles.INFO;
            return (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${style.badge}`}>
                      {style.icon}
                      {r.level}
                    </span>
                    <span className="font-medium text-slate-700">{r.section}</span>
                    {r.question && <span className="text-slate-400">· {r.question}</span>}
                    {r.field && <code className="rounded bg-white px-1 text-slate-500">{r.field}</code>}
                  </div>
                  <p className="mt-1 text-sm text-slate-800">{r.problem}</p>
                  <p className="mt-0.5 text-xs italic text-slate-500">→ {r.action}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
