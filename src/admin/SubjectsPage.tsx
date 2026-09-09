import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, BookOpen } from "lucide-react";
import { api, ApiError, type Subject } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { MasterDataModal, type MasterField } from "./components/MasterDataModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TableSkeleton } from "./components/Skeleton";

const fields: MasterField[] = [
  { key: "name", label: "Subject Name", placeholder: "e.g. Mathematics", required: true, colSpan: 2 },
  { key: "icon", label: "Icon (emoji)", placeholder: "📐", colSpan: 1 },
  { key: "color", label: "Color", type: "color", colSpan: 1 },
  { key: "sort_order", label: "Sort Order", type: "number", placeholder: "0" },
];

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.subjects.list();
      setSubjects(res.subjects);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load subjects.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (editing) {
      await api.subjects.update(editing.id, data as Partial<Subject>);
    } else {
      await api.subjects.create(data as { name: string; icon?: string; color?: string; sort_order?: number });
    }
    await load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.subjects.delete(deleting.id);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete.");
    } finally {
      setDeleting(null);
    }
  };

  const columns: DataTableColumn<Subject>[] = [
    {
      key: "name",
      header: "Subject",
      sortValue: (s) => s.name,
      render: (s) => (
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: s.color ? `${s.color}20` : undefined }}
          >
            {s.icon ?? "📚"}
          </div>
          <div>
            <span className="font-medium text-slate-900">{s.name}</span>
            {s.color && (
              <span className="ml-2 inline-block h-3 w-3 rounded-full align-middle" style={{ backgroundColor: s.color }} />
            )}
          </div>
        </div>
      ),
    },
    {
      key: "sort_order",
      header: "Order",
      sortValue: (s) => s.sort_order,
      render: (s) => <span className="text-sm text-slate-500">{s.sort_order}</span>,
    },
    {
      key: "active",
      header: "Status",
      sortValue: (s) => (s.active ? "active" : "inactive"),
      render: (s) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
          s.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${s.active ? "bg-emerald-500" : "bg-slate-400"}`} />
          {s.active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      headerClassName: "w-px text-right",
      render: (s) => (
        <div className="flex justify-end gap-0.5">
          <button
            type="button"
            onClick={() => { setEditing(s); setModalOpen(true); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-primary"
            title="Edit"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDeleting(s)}
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
        title="Subjects"
        subtitle="Manage academic subjects"
        actions={
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden /> Add Subject
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : (
        <DataTable
          columns={columns}
          data={subjects}
          rowKey={(s) => s.id}
          searchPlaceholder="Search subjects…"
          emptyIcon={<BookOpen className="h-6 w-6" aria-hidden />}
          emptyTitle="No subjects"
          emptyDescription="Add a subject to get started."
          emptyAction={
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" aria-hidden /> Add Subject
            </Button>
          }
          initialSortedColumn="sort_order"
        />
      )}

      <MasterDataModal
        open={modalOpen}
        title={editing ? "Edit Subject" : "Add Subject"}
        fields={fields}
        initial={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Subject"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
