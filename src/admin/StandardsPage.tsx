import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Hash } from "lucide-react";
import { api, ApiError, type Standard } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { MasterDataModal, type MasterField } from "./components/MasterDataModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TableSkeleton } from "./components/Skeleton";

const fields: MasterField[] = [
  { key: "name", label: "Standard Name", placeholder: "e.g. Std 10", required: true, colSpan: 2 },
  { key: "sort_order", label: "Sort Order", type: "number", placeholder: "0" },
];

export default function StandardsPage() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Standard | null>(null);
  const [deleting, setDeleting] = useState<Standard | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.standards.list();
      setStandards(res.standards);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load standards.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Deliberate initial-load pattern (repeated on user actions via `load`).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (editing) {
      await api.standards.update(editing.id, data as Partial<Standard>);
    } else {
      await api.standards.create(data as { name: string; sort_order?: number });
    }
    await load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.standards.delete(deleting.id);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete.");
    } finally {
      setDeleting(null);
    }
  };

  const columns: DataTableColumn<Standard>[] = [
    {
      key: "name",
      header: "Standard",
      sortValue: (s) => s.name,
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Hash className="h-4 w-4" aria-hidden />
          </div>
          <span className="font-medium text-slate-900">{s.name}</span>
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
        title="Standards"
        subtitle="Manage educational standards (Std 1–12)"
        actions={
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden /> Add Standard
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : (
        <DataTable
          columns={columns}
          data={standards}
          rowKey={(s) => s.id}
          searchPlaceholder="Search standards…"
          emptyIcon={<Hash className="h-6 w-6" aria-hidden />}
          emptyTitle="No standards"
          emptyDescription="Add a standard to get started."
          emptyAction={
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" aria-hidden /> Add Standard
            </Button>
          }
          initialSortedColumn="sort_order"
        />
      )}

      <MasterDataModal
        open={modalOpen}
        title={editing ? "Edit Standard" : "Add Standard"}
        fields={fields}
        initial={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Standard"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
