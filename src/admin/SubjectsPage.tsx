import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, BookOpen, X } from "lucide-react";
import { api, ApiError, type Standard, type Subject } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TableSkeleton } from "./components/Skeleton";
import { IconPicker } from "./components/IconPicker";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const [filterStandard, setFilterStandard] = useState("");
  const [subjectStandards, setSubjectStandards] = useState<Map<string, string[]>>(new Map());

  // Inline form state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [standardIds, setStandardIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [subRes, stdRes, mapRes] = await Promise.all([
        api.subjects.list(),
        api.standards.list(),
        api.standardSubjects.list(),
      ]);
      setSubjects(subRes.subjects);
      setStandards(stdRes.standards);
      const map = new Map<string, string[]>();
      for (const m of mapRes.mappings) {
        const list = map.get(m.subject_id) ?? [];
        list.push(m.standard_id);
        map.set(m.subject_id, list);
      }
      setSubjectStandards(map);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load subjects.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const openCreateForm = () => {
    setEditing(null);
    setName("");
    setIcon(null);
    setColor("");
    setSortOrder("");
    setStandardIds(filterStandard ? [filterStandard] : []);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (s: Subject) => {
    setEditing(s);
    setName(s.name);
    setIcon(s.icon ?? null);
    setColor(s.color ?? "");
    setSortOrder(String(s.sort_order));
    setStandardIds(subjectStandards.get(s.id) ?? []);
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
        icon: icon || undefined,
        color: color || undefined,
        sort_order: Number(sortOrder) || 0,
        standard_ids: standardIds,
      };
      if (editing) {
        await api.subjects.update(editing.id, payload);
      } else {
        await api.subjects.create(payload);
      }
      closeForm();
      await load();
      toast.success(editing ? "Subject updated." : "Subject created.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
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

  const toggleStandard = (id: string) => {
    setStandardIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const filteredSubjects =
    !filterStandard
      ? subjects
      : subjects.filter((s) => subjectStandards.get(s.id)?.includes(filterStandard));

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
      key: "standards",
      header: "Standards",
      sortValue: (s) =>
        (subjectStandards.get(s.id) ?? [])
          .map((id) => standards.find((st) => st.id === id)?.name)
          .filter(Boolean)
          .join(", "),
      render: (s) => {
        const ids = subjectStandards.get(s.id) ?? [];
        const chips = ids
          .map((id) => standards.find((st) => st.id === id))
          .filter(Boolean) as Standard[];
        if (!chips.length) return <span className="text-sm text-slate-400">—</span>;
        const shown = chips.slice(0, 3);
        return (
          <div className="flex flex-wrap items-center gap-1">
            {shown.map((st) => (
              <span key={st.id} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                {st.name}
              </span>
            ))}
            {chips.length > shown.length && (
              <span className="text-xs text-slate-400">+{chips.length - shown.length}</span>
            )}
          </div>
        );
      },
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
            onClick={() => openEditForm(s)}
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
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4" aria-hidden /> Add Subject
          </Button>
        }
      />

      {formOpen && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{editing ? "Edit Subject" : "Add Subject"}</h3>
            <button type="button" onClick={closeForm} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          {formError && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="col-span-2">
              <label htmlFor="sub-name" className="mb-1 block text-xs font-medium text-slate-600">Subject Name *</label>
              <input
                id="sub-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mathematics"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {/* Icon */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Icon</label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>
            {/* Color */}
            <div>
              <label htmlFor="sub-color" className="mb-1 block text-xs font-medium text-slate-600">Color</label>
              <div className="flex items-center gap-2">
                <input
                  id="sub-color"
                  type="color"
                  className="h-10 w-10 cursor-pointer rounded-lg border border-slate-300"
                  value={color || "#3B82F6"}
                  onChange={(e) => setColor(e.target.value)}
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3B82F6"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            {/* Sort Order */}
            <div>
              <label htmlFor="sub-order" className="mb-1 block text-xs font-medium text-slate-600">Sort Order</label>
              <input
                id="sub-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {/* Standards multiselect */}
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Standards</label>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-300 p-2">
                {standards.length === 0 && (
                  <p className="px-1 py-1 text-xs text-slate-400">No standards available</p>
                )}
                {standards.map((st) => (
                  <label key={st.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--color-primary,theme(colors.blue.600))]"
                      checked={standardIds.includes(st.id)}
                      onChange={() => toggleStandard(st.id)}
                    />
                    <span className="truncate">{st.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create"}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
          </div>
        </form>
      )}

      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : (
        <DataTable
          columns={columns}
          data={filteredSubjects}
          rowKey={(s) => s.id}
          toolbar={
            <select
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
              value={filterStandard}
              onChange={(e) => setFilterStandard(e.target.value)}
              aria-label="Filter by standard"
            >
              <option value="">All Standards</option>
              {standards.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          }
          searchPlaceholder="Search subjects…"
          emptyIcon={<BookOpen className="h-6 w-6" aria-hidden />}
          emptyTitle="No subjects"
          emptyDescription="Add a subject to get started."
          emptyAction={
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4" aria-hidden /> Add Subject
            </Button>
          }
          initialSortedColumn="sort_order"
        />
      )}

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
