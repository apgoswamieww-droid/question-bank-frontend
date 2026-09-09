import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError, type Test, type TestStatus } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TableSkeleton } from "./components/Skeleton";

const statusStyles: Record<TestStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  published: {
    label: "Published",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  archived: {
    label: "Archived",
    className: "bg-slate-100 text-slate-500 ring-slate-200",
  },
};

export default function TestsListPage() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Test | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.tests.list({ limit: 100 });
      setTests(res.tests);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load tests.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.tests.delete(deleting.id);
      await load();
      toast.success("Test deleted.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete test.");
    } finally {
      setDeleting(null);
    }
  };

  const columns: DataTableColumn<Test>[] = [
    {
      key: "title",
      header: "Test",
      sortValue: (t) => t.title,
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <ClipboardList className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <span className="font-medium text-slate-900">{t.title}</span>
            {t.description && (
              <p className="truncate text-xs text-slate-500">{t.description}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (t) => t.status,
      render: (t) => {
        const s = statusStyles[t.status] ?? statusStyles.draft;
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
      sortValue: (t) => t.question_count ?? 0,
      render: (t) => <span className="text-sm text-slate-700">{t.question_count ?? 0}</span>,
    },
    {
      key: "duration",
      header: "Duration",
      sortValue: (t) => t.duration_min,
      render: (t) => <span className="text-sm text-slate-700">{t.duration_min} min</span>,
    },
    {
      key: "marks",
      header: "Marks",
      sortValue: (t) => t.total_marks,
      render: (t) => <span className="text-sm text-slate-700">{t.total_marks}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      headerClassName: "w-px text-right",
      render: (t) => (
        <div className="flex justify-end gap-0.5">
          <button
            type="button"
            onClick={() => navigate(`/admin/tests/${t.id}/edit`)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-primary"
            title="Edit"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => navigate(`/admin/tests/${t.id}`)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-primary"
            title="Open"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDeleting(t)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tests"
        subtitle="Create and manage question tests"
        actions={
          <Button onClick={() => navigate("/admin/tests/new")}>
            <Plus className="h-4 w-4" aria-hidden /> New Test
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : (
        <DataTable
          columns={columns}
          data={tests}
          rowKey={(t) => t.id}
          searchPlaceholder="Search tests…"
          emptyIcon={<ClipboardList className="h-6 w-6" aria-hidden />}
          emptyTitle="No tests yet"
          emptyDescription="Create a test to get started."
          emptyAction={
            <Button onClick={() => navigate("/admin/tests/new")}>
              <Plus className="h-4 w-4" aria-hidden /> New Test
            </Button>
          }
          initialSortedColumn="created_at"
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Test"
        message={`Delete "${deleting?.title}" and all of its questions? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
