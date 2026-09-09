import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Building2 } from "lucide-react";
import { api, ApiError, type School } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { MasterDataModal, type MasterField } from "./components/MasterDataModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TableSkeleton } from "./components/Skeleton";

const fields: MasterField[] = [
  { key: "name", label: "School Name", placeholder: "e.g. ABC International School", required: true, colSpan: 2 },
  { key: "code", label: "School Code", placeholder: "e.g. ABC001" },
  { key: "board", label: "Board", type: "select", options: [
    { value: "GSEB", label: "GSEB" },
    { value: "CBSE", label: "CBSE" },
    { value: "ICSE", label: "ICSE" },
    { value: "Other", label: "Other" },
  ]},
  { key: "type", label: "School Type", type: "select", options: [
    { value: "government", label: "Government" },
    { value: "private", label: "Private" },
    { value: "semi_govt", label: "Semi-Government" },
    { value: "aided", label: "Aided" },
  ]},
  { key: "district", label: "District", placeholder: "e.g. Ahmedabad" },
  { key: "city", label: "City", placeholder: "e.g. Ahmedabad" },
  { key: "state", label: "State", placeholder: "e.g. Gujarat" },
  { key: "contact_email", label: "Contact Email", placeholder: "school@example.com" },
  { key: "contact_phone", label: "Contact Phone", placeholder: "98765 43210" },
  { key: "address", label: "Address", type: "textarea", placeholder: "Full address", colSpan: 2 },
];

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [deleting, setDeleting] = useState<School | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.schools.list();
      setSchools(res.schools);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load schools.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (editing) {
      await api.schools.update(editing.id, data as Partial<School>);
    } else {
      await api.schools.create(data as Parameters<typeof api.schools.create>[0]);
    }
    await load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.schools.delete(deleting.id);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete.");
    } finally {
      setDeleting(null);
    }
  };

  const columns: DataTableColumn<School>[] = [
    {
      key: "name",
      header: "School",
      sortValue: (s) => s.name,
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
            <Building2 className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <span className="font-medium text-slate-900">{s.name}</span>
            {s.code && <span className="ml-2 text-xs text-slate-400">{s.code}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "board",
      header: "Board",
      sortValue: (s) => s.board ?? "",
      render: (s) => <span className="text-sm text-slate-600">{s.board || "—"}</span>,
    },
    {
      key: "district",
      header: "District",
      sortValue: (s) => s.district ?? "",
      render: (s) => <span className="text-sm text-slate-600">{s.district || "—"}</span>,
    },
    {
      key: "city",
      header: "City",
      sortValue: (s) => s.city ?? "",
      render: (s) => <span className="text-sm text-slate-600">{s.city || "—"}</span>,
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
        title="Schools"
        subtitle="Manage schools and institutions"
        actions={
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden /> Add School
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : (
        <DataTable
          columns={columns}
          data={schools}
          rowKey={(s) => s.id}
          searchPlaceholder="Search schools…"
          emptyIcon={<Building2 className="h-6 w-6" aria-hidden />}
          emptyTitle="No schools"
          emptyDescription="Add a school to get started."
          emptyAction={
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" aria-hidden /> Add School
            </Button>
          }
          initialSortedColumn="name"
        />
      )}

      <MasterDataModal
        open={modalOpen}
        title={editing ? "Edit School" : "Add School"}
        fields={fields}
        initial={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete School"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
