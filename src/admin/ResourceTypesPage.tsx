import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, BookOpenCheck, X } from "lucide-react";
import { api, ApiError, type ResourceType } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TableSkeleton } from "./components/Skeleton";

export default function ResourceTypesPage() {
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline form state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceType | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<ResourceType | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.resourceTypes.list();
      setResourceTypes(res.resourceTypes);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load resource types.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const openCreateForm = () => {
    setEditing(null);
    setName("");
    setCode("");
    setDescription("");
    setSortOrder("");
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (rt: ResourceType) => {
    setEditing(rt);
    setName(rt.name);
    setCode(rt.code ?? "");
    setDescription(rt.description ?? "");
    setSortOrder(String(rt.sort_order));
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setFormError("Name is required."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        sort_order: Number(sortOrder) || 0,
      };
      if (editing) {
        await api.resourceTypes.update(editing.id, payload);
      } else {
        await api.resourceTypes.create(payload);
      }
      closeForm();
      await load();
      toast.success(editing ? "Resource type updated." : "Resource type created.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.resourceTypes.delete(deleting.id);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete.");
    } finally {
      setDeleting(null);
    }
  };

  const columns: DataTableColumn<ResourceType>[] = [
    {
      key: "name",
      header: "Resource Type",
      sortValue: (rt) => rt.name,
      render: (rt) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
            <BookOpenCheck className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <span className="font-medium text-slate-900">{rt.name}</span>
            {rt.code && <span className="ml-2 text-xs text-slate-400">{rt.code}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      sortValue: (rt) => rt.description ?? "",
      render: (rt) => (
        <span className="text-sm text-slate-500 line-clamp-1">{rt.description || "—"}</span>
      ),
    },
    {
      key: "sort_order",
      header: "Order",
      sortValue: (rt) => rt.sort_order,
      render: (rt) => <span className="text-sm text-slate-500">{rt.sort_order}</span>,
    },
    {
      key: "active",
      header: "Status",
      sortValue: (rt) => (rt.active ? "active" : "inactive"),
      render: (rt) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
          rt.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${rt.active ? "bg-emerald-500" : "bg-slate-400"}`} />
          {rt.active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      headerClassName: "w-px text-right",
      render: (rt) => (
        <div className="flex justify-end gap-0.5">
          <button
            type="button"
            onClick={() => openEditForm(rt)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-primary"
            title="Edit"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDeleting(rt)}
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
        title="Resource Types"
        subtitle="Manage curriculum types (NCERT, JEE, NEET, GUJCET)"
        actions={
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4" aria-hidden /> Add Resource Type
          </Button>
        }
      />

      {formOpen && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{editing ? "Edit Resource Type" : "Add Resource Type"}</h3>
            <button type="button" onClick={closeForm} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          {formError && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <label htmlFor="rt-name" className="mb-1 block text-xs font-medium text-slate-600">Name *</label>
              <input
                id="rt-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. NCERT"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="w-32">
              <label htmlFor="rt-code" className="mb-1 block text-xs font-medium text-slate-600">Code</label>
              <input
                id="rt-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="NCERT"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="w-32">
              <label htmlFor="rt-order" className="mb-1 block text-xs font-medium text-slate-600">Sort Order</label>
              <input
                id="rt-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Create"}
              </Button>
              <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
            </div>
          </div>
          <div className="mt-3">
            <label htmlFor="rt-desc" className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <input
              id="rt-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </form>
      )}

      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : (
        <DataTable
          columns={columns}
          data={resourceTypes}
          rowKey={(rt) => rt.id}
          searchPlaceholder="Search resource types…"
          emptyIcon={<BookOpenCheck className="h-6 w-6" aria-hidden />}
          emptyTitle="No resource types"
          emptyDescription="Add a resource type to get started."
          emptyAction={
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4" aria-hidden /> Add Resource Type
            </Button>
          }
          initialSortedColumn="sort_order"
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Resource Type"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
