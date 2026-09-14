import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Archive,
  ArrowRight,
  Copy,
  Dices,
  Eye,
  FileDown,
  FileText,
  Layers,
  Pencil,
  Plus,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Wand2,
} from "lucide-react";
import { api, ApiError, type Paper, type PaperStatus } from "../../api/client";
import { useCan, PERMISSIONS } from "../../context/useAdminAuth";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TableSkeleton } from "../components/Skeleton";
import { paperStatusStyles, paperStatusOptions } from "./paperStatus";

export default function PapersPage() {
  const navigate = useNavigate();
  const can = useCan();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get("status") ?? "") as PaperStatus | "";
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Paper | null>(null);

  const setStatusFilter = (next: PaperStatus | "") => {
    if (next) setSearchParams({ status: next });
    else setSearchParams({});
  };

  const load = useCallback(async () => {
    try {
      const res = await api.papers.list({
        status: statusFilter || undefined,
        limit: 100,
      });
      setPapers(res.papers);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load papers.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.papers.delete(deleting.id);
      await load();
      toast.success("Paper deleted.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete paper.");
    } finally {
      setDeleting(null);
    }
  };

  type LifecycleAction = "validate" | "publish" | "archive" | "restore";
  const runLifecycle = async (action: LifecycleAction, paper: Paper) => {
    const confirmMessages: Partial<Record<LifecycleAction, string>> = {
      publish: "Publish this paper? Past versions stay available in History.",
      archive: "Archive this paper? Its history is preserved.",
      restore: "Restore this paper to draft? Re-validate before republishing.",
    };
    const message = confirmMessages[action];
    if (message && !window.confirm(message)) return;
    try {
      if (action === "validate") await api.papers.validateAndPromote(paper.id);
      else if (action === "publish") await api.papers.update(paper.id, { status: "published" });
      else if (action === "archive") await api.papers.archive(paper.id);
      else await api.papers.restore(paper.id);
      await load();
      toast.success("Paper updated.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.");
    }
  };

  const handleDuplicate = async (paper: Paper) => {
    if (!window.confirm("Duplicate this paper as a new draft?")) return;
    try {
      const created = await api.papers.duplicate(paper.id);
      toast.success("Paper duplicated as a new draft.");
      navigate(`/admin/papers/${created.paper.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Duplicate failed.");
    }
  };

  const handlePdf = async (paper: Paper) => {
    try {
      const blob = await api.papers.pdf(paper.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${String(paper.title || "paper")
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
  const handlePreview = async (paper: Paper) => {
    try {
      const blob = await api.papers.pdf(paper.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Preview failed.");
    }
  };

  const lifecycleToolbar = (p: Paper) => {
    // UI-level permission gating (Phase 17); the backend re-checks every
    // action server-side. Hide actions the user cannot perform.
    const buttons: { key: string; title: string; icon: React.ReactNode; onClick: () => void; tone?: "destructive" }[] = [];
    if (
      (p.status === "draft" || p.status === "validated") &&
      can(PERMISSIONS.PAPERS_PUBLISH)
    ) {
      buttons.push({
        key: "validate",
        title: "Validate",
        icon: <ShieldCheck className="h-4 w-4" aria-hidden />,
        onClick: () => runLifecycle("validate", p),
      });
      buttons.push({
        key: "publish",
        title: "Publish",
        icon: <Rocket className="h-4 w-4" aria-hidden />,
        onClick: () => runLifecycle("publish", p),
      });
    }
    if (p.status === "archived" && can(PERMISSIONS.PAPERS_MANAGE)) {
      buttons.push({
        key: "restore",
        title: "Restore",
        icon: <RotateCcw className="h-4 w-4" aria-hidden />,
        onClick: () => runLifecycle("restore", p),
      });
    }
    if (
      (p.status === "draft" || p.status === "validated" || p.status === "published") &&
      can(PERMISSIONS.PAPERS_DELETE)
    ) {
      buttons.push({
        key: "archive",
        title: "Archive",
        icon: <Archive className="h-4 w-4" aria-hidden />,
        onClick: () => runLifecycle("archive", p),
      });
    }
    if (can(PERMISSIONS.PAPERS_MANAGE)) {
      buttons.push({
        key: "duplicate",
        title: "Duplicate",
        icon: <Copy className="h-4 w-4" aria-hidden />,
        onClick: () => handleDuplicate(p),
      });
    }
    if (can(PERMISSIONS.PAPERS_EXPORT)) {
      buttons.push(
        {
          key: "preview",
          title: "Preview",
          icon: <Eye className="h-4 w-4" aria-hidden />,
          onClick: () => handlePreview(p),
        },
        {
          key: "pdf",
          title: "Export PDF",
          icon: <FileDown className="h-4 w-4" aria-hidden />,
          onClick: () => handlePdf(p),
        }
      );
    }
    return buttons;
  };

  const columns: DataTableColumn<Paper>[] = [
    {
      key: "title",
      header: "Paper",
      sortValue: (p) => p.title,
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <FileText className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <span className="font-medium text-slate-900">{p.title}</span>
            {p.description && (
              <p className="truncate text-xs text-slate-500">{p.description}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (p) => p.status,
      render: (p) => {
        const s = paperStatusStyles[p.status] ?? paperStatusStyles.draft;
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${s.className}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {s.label}
          </span>
        );
      },
    },
    {
      key: "questions",
      header: "Questions",
      sortValue: (p) => p.question_count ?? 0,
      render: (p) => <span className="text-sm text-slate-700">{p.question_count ?? 0}</span>,
    },
    {
      key: "duration",
      header: "Duration",
      sortValue: (p) => p.duration_min,
      render: (p) => <span className="text-sm text-slate-700">{p.duration_min} min</span>,
    },
    {
      key: "marks",
      header: "Marks",
      sortValue: (p) => p.total_marks,
      render: (p) => <span className="text-sm text-slate-700">{p.total_marks}</span>,
    },
    {
      key: "updated_at",
      header: "Updated",
      sortValue: (p) => p.updated_at,
      render: (p) => (
        <span className="text-sm text-slate-500">
          {new Date(p.updated_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      headerClassName: "w-px text-right",
      render: (p) => (
        <div className="flex justify-end gap-0.5">
          <button
            type="button"
            onClick={() => navigate(`/admin/papers/${p.id}/edit`)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-primary"
            title="Edit"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          {can(PERMISSIONS.PAPERS_MANAGE) && (
            <button
              type="button"
              onClick={() => navigate(`/admin/papers/${p.id}/blueprint`)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-primary"
              title="Blueprint"
            >
              <Layers className="h-4 w-4" aria-hidden />
            </button>
          )}
          {can(PERMISSIONS.PAPERS_MANAGE) && (
            <button
              type="button"
              onClick={() => navigate(`/admin/papers/${p.id}/questions`)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-primary"
              title="Questions"
            >
              <Wand2 className="h-4 w-4" aria-hidden />
            </button>
          )}
          {can(PERMISSIONS.PAPERS_GENERATE) && (
            <button
              type="button"
              onClick={() => navigate(`/admin/papers/${p.id}/sets`)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-primary"
              title="Sets"
            >
              <Dices className="h-4 w-4" aria-hidden />
            </button>
          )}
          {lifecycleToolbar(p).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition ${
                item.tone === "destructive"
                  ? "hover:bg-red-50 hover:text-red-600"
                  : "hover:bg-slate-100 hover:text-primary"
              }`}
              title={item.title}
            >
              {item.icon}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate(`/admin/papers/${p.id}`)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-primary"
            title="Open"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          {can(PERMISSIONS.PAPERS_DELETE) && (
            <button
              type="button"
              onClick={() => setDeleting(p)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Papers"
        subtitle="Create and manage question papers"
        actions={
          can(PERMISSIONS.PAPERS_MANAGE) && (
            <Button onClick={() => navigate("/admin/papers/new")}>
              <Plus className="h-4 w-4" aria-hidden /> New Paper
            </Button>
          )
        }
      />

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : (
        <DataTable
          columns={columns}
          data={papers}
          rowKey={(p) => p.id}
          searchPlaceholder="Search papers…"
          emptyIcon={<FileText className="h-6 w-6" aria-hidden />}
          emptyTitle={statusFilter ? "No papers with this status" : "No papers yet"}
          emptyDescription="Create a paper to get started."
          emptyAction={
            can(PERMISSIONS.PAPERS_MANAGE) ? (
              <Button onClick={() => navigate("/admin/papers/new")}>
                <Plus className="h-4 w-4" aria-hidden /> New Paper
              </Button>
            ) : null
          }
          initialSortedColumn="updated_at"
          initialSortDirection="desc"
          toolbar={
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setStatusFilter("")}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                  statusFilter === ""
                    ? "bg-primary text-white ring-primary"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                All
              </button>
              {paperStatusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                    statusFilter === opt.value
                      ? "bg-primary text-white ring-primary"
                      : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Paper"
        message={`Delete "${deleting?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
