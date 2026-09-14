import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Hash,
  History,
  Languages,
  Layers,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  type PaperVersion,
  type PaperVersionChanges,
  type PaperVersionDetail,
  type PaperVersionReason,
} from "../../api/client";
import { useCan, PERMISSIONS } from "../../context/useAdminAuth";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { TableSkeleton } from "../components/Skeleton";

const shortId = (s: string | null | undefined) => (s ? String(s).slice(0, 8) : "—");

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const REASON_LABEL: Record<PaperVersionReason, string> = {
  created: "Created",
  baseline: "Baseline",
  manual: "Manual",
  published: "Published",
  restore: "Restored",
};

const REASON_STYLE: Record<PaperVersionReason, string> = {
  created: "bg-slate-100 text-slate-600 ring-slate-200",
  baseline: "bg-slate-100 text-slate-600 ring-slate-200",
  manual: "bg-violet-50 text-violet-700 ring-violet-200",
  published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  restore: "bg-amber-50 text-amber-700 ring-amber-200",
};

export default function PaperVersionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = useCan();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.papers.versions.list>> | null>(null);
  const [selected, setSelected] = useState<PaperVersionDetail | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const result = await api.papers.versions.list(id);
      setData(result);
      setSelected(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load version history.");
      navigate("/admin/papers/all");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const versions = useMemo(() => (data ? [...data.versions].sort((a, b) => b.version - a.version) : []), [data]);

  const saveVersion = async () => {
    if (!id) return;
    if (!window.confirm("Save the current state as a new version?\n\nHistorical published versions are never changed.")) return;
    setActing(true);
    try {
      const result = await api.papers.versions.create(id, { reason: "manual" });
      if (result.created) {
        toast.success(`Saved as version ${result.version}.`);
      } else {
        toast.info(result.message ?? "No changes since the last version.");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save version.");
    } finally {
      setActing(false);
    }
  };

  const viewVersion = async (version: number) => {
    if (!id) return;
    setViewing(version);
    try {
      const detail = await api.papers.versions.get(id, version);
      setSelected(detail);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load version.");
    } finally {
      setViewing(null);
    }
  };

  const restoreVersion = async (version: number) => {
    if (!id) return;
    if (!window.confirm(
      `Restore version ${version}?\n\nThe paper will be reverted to this composition as a DRAFT and saved as a new version — the historical timeline is preserved. Review it, then publish again.`,
    )) return;
    setActing(true);
    try {
      const result = await api.papers.versions.restore(id, version);
      if (result.version) {
        toast.success(`Restored version ${version} — now draft version ${result.version}.`);
      } else {
        toast.warning(result.note ?? "Paper restored, but versioning storage is unavailable.");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Restore failed.");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <TableSkeleton rows={8} cols={2} />;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Paper Versions & History" />
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <History className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-700">No version history available</p>
        </div>
      </div>
    );
  }

  const migrationRequired = data.migrationRequired;
  const currentVersion = data.currentVersion;
  const createdVersion = data.createdVersion;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper Versions & History"
        subtitle={data.paper.title ?? `Paper ${id?.slice(0, 8)}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(id ? `/admin/papers/${id}` : "/admin/papers/all")}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            <Button variant="secondary" onClick={() => { setLoading(true); load(); }} loading={loading}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
            </Button>
            {can(PERMISSIONS.PAPERS_MANAGE) && (
              <Button onClick={saveVersion} disabled={migrationRequired || !data.dirty} loading={acting}>
                <Save className="h-4 w-4" aria-hidden /> Save version now
              </Button>
            )}
          </div>
        }
      />

      {migrationRequired ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            Paper versioning is not active yet — apply backend/migrations/012_paper_versioning.sql in the
            Supabase SQL editor to start snapshotting versions.
          </span>
        </div>
      ) : (
        <>
          {/* Overview */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={<Layers className="h-4 w-4" aria-hidden />} label="Versions" value={versions.length ? String(versions.length) : "—"} />
            <Kpi icon={<Hash className="h-4 w-4" aria-hidden />} label="Current version" value={currentVersion ? `v${currentVersion}` : "—"} />
            <Kpi icon={<Clock className="h-4 w-4" aria-hidden />} label="Created version" value={createdVersion ? `v${createdVersion}` : "—"} />
            <Kpi icon={<Pencil className="h-4 w-4" aria-hidden />} label="Draft state" value={data.dirty ? "Changed" : "Up to date"} note={data.dirty ? "differs from last version" : "matches last version"} />
          </div>

          {data.dirty && currentVersion > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-700">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                The paper has unpublished changes since v{currentVersion}. Save a version now to snapshot it, or publish to capture it automatically.
              </span>
            </div>
          )}

          {/* Timeline */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <History className="h-4 w-4" aria-hidden /> Version history
            </h2>
            {versions.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {versions.map((v) => (
                  <VersionRow
                    key={v.id}
                    version={v}
                    isCurrent={v.version === currentVersion}
                    canManage={can(PERMISSIONS.PAPERS_MANAGE)}
                    onView={viewVersion}
                    onRestore={restoreVersion}
                    viewing={viewing === v.version}
                    acting={acting}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-400">No versions yet.</p>
            )}
          </section>

          {/* Snapshot detail */}
          {selected && <SnapshotPanel detail={selected} onClose={() => setSelected(null)} />}
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {icon}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
    </div>
  );
}

function ReasonBadge({ reason }: { reason: PaperVersionReason }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${REASON_STYLE[reason] ?? REASON_STYLE.created}`}>
      {REASON_LABEL[reason] ?? reason}
    </span>
  );
}

function ChangeChips({ changes }: { changes: PaperVersionChanges }) {
  const chips = useMemo(() => {
    const list: { key: string; label: string; tone: "add" | "remove" | "info" }[] = [];
    if (changes.additions.length) list.push({ key: "add", label: `+${changes.additions.length} added`, tone: "add" });
    if (changes.removals.length) list.push({ key: "rem", label: `−${changes.removals.length} removed`, tone: "remove" });
    if (changes.replacements.length) {
      list.push({
        key: "rep",
        label: changes.replacements.map((r) => `${shortId(r.from)}→${shortId(r.to)}`).join(", "),
        tone: "info",
      });
    }
    if (changes.reordered) list.push({ key: "reorder", label: `reordered ${changes.reorderCount}`, tone: "info" });
    if (changes.marksChanged.length) list.push({ key: "marks", label: `marks ×${changes.marksChanged.length}`, tone: "info" });
    if (changes.sectionsChanged.length) list.push({ key: "sec", label: "sections changed", tone: "info" });
    if (changes.blueprintChanged) list.push({ key: "bp", label: "blueprint", tone: "info" });
    if (changes.setsChanged) list.push({ key: "sets", label: "sets", tone: "info" });
    if (changes.translationsChanged) list.push({ key: "trans", label: "translations", tone: "info" });
    if (changes.languagesChanged.added.length || changes.languagesChanged.removed.length) {
      list.push({
        key: "lang",
        label: `${changes.languagesChanged.added.length ? `+${changes.languagesChanged.added.length} lang` : ""}${changes.languagesChanged.removed.length ? ` −${changes.languagesChanged.removed.length} lang` : ""}`.trim(),
        tone: "info",
      });
    }
    if (changes.languagePapersChanged.added.length || changes.languagePapersChanged.removed.length) {
      list.push({ key: "lp", label: "language papers", tone: "info" });
    }
    if (changes.templateChanged) {
      list.push({ key: "tpl", label: `template → ${changes.templateChanged.to?.name ?? "none"}`, tone: "info" });
    }
    if (changes.fieldChanges.length) list.push({ key: "fields", label: `fields: ${changes.fieldChanges.join(", ")}`, tone: "info" });
    if (!changes.changed) list.push({ key: "none", label: "no changes", tone: "info" });
    return list;
  }, [changes]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span
          key={c.key}
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
            c.tone === "add"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : c.tone === "remove"
                ? "bg-red-50 text-red-700 ring-red-200"
                : "bg-slate-50 text-slate-600 ring-slate-200"
          }`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

function VersionRow({
  version,
  isCurrent,
  canManage,
  onView,
  onRestore,
  viewing,
  acting,
}: {
  version: PaperVersion;
  isCurrent: boolean;
  canManage: boolean;
  onView: (v: number) => void;
  onRestore: (v: number) => void;
  viewing: boolean;
  acting: boolean;
}) {
  const changes = version.changes;
  return (
    <li className={`rounded-xl border p-4 ${isCurrent ? "border-slate-300 bg-slate-50/60" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-slate-900 px-2 py-1 text-sm font-bold text-white">v{version.version}</span>
        <ReasonBadge reason={version.reason} />
        {isCurrent && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200">
            <CheckCircle2 className="h-3 w-3" aria-hidden /> Current
          </span>
        )}
        {version.parent_version !== null && (
          <span className="text-[11px] font-medium text-amber-600">restored from v{version.parent_version}</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5" aria-hidden /> {fmtDate(version.created_at)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>{changes.questionCount.to} questions</span>
        <span>{changes.totalMarks.to} marks</span>
        {version.summary && <span className="text-slate-400">{version.summary}</span>}
      </div>

      {version.note && <p className="mt-1.5 text-xs italic text-slate-500">{version.note}</p>}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ChangeChips changes={changes} />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onView(version.version)} loading={viewing}>
            <Eye className="h-4 w-4" aria-hidden /> View
          </Button>
          {canManage && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onRestore(version.version)}
              disabled={acting}
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> Restore
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function SnapshotPanel({ detail, onClose }: { detail: PaperVersionDetail; onClose: () => void }) {
  const snap = detail.snapshot;
  const blueprintSections = Array.isArray(snap.blueprint?.sections) ? (snap.blueprint.sections as { id: string; name?: string }[]).length : 0;
  const setKeys = snap.sets && typeof snap.sets === "object" ? Object.keys(snap.sets as Record<string, unknown>) : [];
  const translationLanguages = snap.translations && typeof snap.translations === "object"
    ? (snap.translations as { languages?: Record<string, unknown> }).languages
    : null;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FileText className="h-4 w-4" aria-hidden /> Version v{detail.version} snapshot
        </h2>
        <ReasonBadge reason={detail.reason} />
        <span className="text-xs text-slate-400">{fmtDate(detail.created_at)}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden /> Close
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <InfoCard icon={<Hash className="h-4 w-4" aria-hidden />} label="Questions" value={String(snap.totals.questionCount)} />
        <InfoCard icon={<Layers className="h-4 w-4" aria-hidden />} label="Marks" value={String(snap.totals.totalMarks)} />
        <InfoCard icon={<ShieldCheck className="h-4 w-4" aria-hidden />} label="Blueprint" value={blueprintSections ? `${blueprintSections} section${blueprintSections === 1 ? "" : "s"}` : "None"} />
        <InfoCard icon={<Layers className="h-4 w-4" aria-hidden />} label="Sets" value={setKeys.length ? setKeys.join(", ") : "None"} />
        <InfoCard icon={<Languages className="h-4 w-4" aria-hidden />} label="Template" value={snap.template?.name ?? "Built-in"} />
      </div>

      {snap.families.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Family</th>
                <th className="px-3 py-2 font-medium">Section</th>
                <th className="px-3 py-2 font-medium">Marks</th>
                <th className="px-3 py-2 font-medium">Locked</th>
                <th className="px-3 py-2 font-medium">Languages</th>
                <th className="px-3 py-2 font-medium">Stored digest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snap.families.map((f) => (
                <tr key={f.family_id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2 text-slate-400">{f.sort_order + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{shortId(f.family_id)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{f.section_key ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{f.marks}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{f.locked ? "Yes" : "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {f.languages.length > 0 ? f.languages.map(shortId).join(", ") : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{shortId(f.question_digest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-400">This version contains no questions.</p>
      )}

      {translationLanguages !== null && translationLanguages !== undefined && Object.keys(translationLanguages).length > 0 && (
        <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Translation readiness:</span>{" "}
          {Object.keys(translationLanguages).map(shortId).join(", ")}
        </div>
      )}

      {snap.languagePapers.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Generated language papers:</span>{" "}
          {snap.languagePapers.map((lp) => `${shortId(lp.language_id)} v${lp.version} (${lp.status})`).join(", ")}
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        This snapshot pins the published composition (ordering, marks, sections, blueprint, sets, translations).
        Rendered question content reflects the current Question Bank, same as generated language papers.
      </p>
    </section>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
        {icon} {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={value}>{value}</p>
    </div>
  );
}