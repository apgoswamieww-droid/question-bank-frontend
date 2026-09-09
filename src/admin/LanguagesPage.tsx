import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Globe, Pencil, Trash2 } from "lucide-react";
import { api, ApiError, type Language } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { MasterDataModal, type MasterField } from "./components/MasterDataModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TableSkeleton } from "./components/Skeleton";

const fields: MasterField[] = [
  { key: "code", label: "Language Code", placeholder: "e.g. en, gu, hi", required: true },
  { key: "name", label: "Language Name", placeholder: "e.g. English", required: true },
  { key: "native_name", label: "Native Name", placeholder: "e.g. ગુજરાતી" },
];

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Language | null>(null);
  const [deleting, setDeleting] = useState<Language | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.languages.list();
      setLanguages(res.languages);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load languages.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Deliberate initial-load pattern (repeated on user actions via `load`).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (editing) {
      await api.languages.update(editing.id, data as Partial<Language>);
    } else {
      await api.languages.create(data as { code: string; name: string; native_name?: string });
    }
    await load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.languages.delete(deleting.id);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete.");
    } finally {
      setDeleting(null);
    }
  };

  const columns: DataTableColumn<Language>[] = [
    {
      key: "name",
      header: "Language",
      sortValue: (l) => l.name,
      render: (l) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600">
            <Globe className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <span className="font-medium text-slate-900">{l.name}</span>
            {l.native_name && <span className="ml-2 text-xs text-slate-400">{l.native_name}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "code",
      header: "Code",
      sortValue: (l) => l.code,
      render: (l) => (
        <code className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">{l.code}</code>
      ),
    },
    {
      key: "active",
      header: "Status",
      sortValue: (l) => (l.active ? "active" : "inactive"),
      render: (l) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
          l.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${l.active ? "bg-emerald-500" : "bg-slate-400"}`} />
          {l.active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      headerClassName: "w-px text-right",
      render: (l) => (
        <div className="flex justify-end gap-0.5">
          <button
            type="button"
            onClick={() => { setEditing(l); setModalOpen(true); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-primary"
            title="Edit"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDeleting(l)}
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
        title="Languages"
        subtitle="Manage question languages"
        actions={
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden /> Add Language
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : (
        <DataTable
          columns={columns}
          data={languages}
          rowKey={(l) => l.id}
          searchPlaceholder="Search languages…"
          emptyIcon={<Globe className="h-6 w-6" aria-hidden />}
          emptyTitle="No languages"
          emptyDescription="Add a language to get started."
          emptyAction={
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" aria-hidden /> Add Language
            </Button>
          }
          initialSortedColumn="name"
        />
      )}

      <MasterDataModal
        open={modalOpen}
        title={editing ? "Edit Language" : "Add Language"}
        fields={fields}
        initial={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Language"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

