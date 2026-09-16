import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, BookMarked, X } from "lucide-react";
import { api, ApiError, type Chapter, type Standard, type Subject, type ResourceType } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TableSkeleton } from "./components/Skeleton";

export default function ChaptersPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Chapter | null>(null);
  const [filterStandard, setFilterStandard] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterResourceType, setFilterResourceType] = useState("");
  const [mappedSubjectIds, setMappedSubjectIds] = useState<Set<string> | null>(null);

  // Inline form state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Chapter | null>(null);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [description, setDescription] = useState("");
  const [resourceTypeIds, setResourceTypeIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadMasters = useCallback(async () => {
    try {
      const [stdRes, subRes, rtRes] = await Promise.all([
        api.standards.list(),
        api.subjects.list(),
        api.resourceTypes.list(),
      ]);
      setStandards(stdRes.standards);
      setSubjects(subRes.subjects);
      setResourceTypes(rtRes.resourceTypes);
    } catch { /* ignore */ }
  }, []);

  const loadChapters = useCallback(async () => {
    try {
      const res = await api.chapters.list({
        subject_id: filterSubject || undefined,
        standard_id: filterStandard || undefined,
        resource_type_ids: filterResourceType ? [filterResourceType] : undefined,
      });
      setChapters(res.chapters);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load chapters.");
    } finally {
      setLoading(false);
    }
  }, [filterStandard, filterSubject, filterResourceType]);

  useEffect(() => {
    let cancelled = false;
    if (!filterStandard) {
      setMappedSubjectIds(null);
      return;
    }
    api.standardSubjects
      .list({ standard_id: filterStandard })
      .then((res) => {
        if (cancelled) return;
        const ids = res.mappings.map((m) => m.subject_id);
        setMappedSubjectIds(ids.length ? new Set(ids) : null);
      })
      .catch(() => { if (!cancelled) setMappedSubjectIds(null); });
    return () => { cancelled = true; };
  }, [filterStandard]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadMasters(); }, [loadMasters]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadChapters(); }, [loadChapters]);

  const getStandardName = (id: string) => standards.find((s) => s.id === id)?.name ?? "—";
  const getSubjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "—";
  const getResourceTypeName = (id: string) => resourceTypes.find((rt) => rt.id === id)?.name ?? null;

  const resetForm = () => {
    setName("");
    setNumber("");
    setSortOrder("");
    setDescription("");
    setResourceTypeIds([]);
    setFormError(null);
  };

  const openCreateForm = () => {
    setEditing(null);
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (c: Chapter) => {
    setEditing(c);
    setName(c.name);
    setNumber(c.number != null ? String(c.number) : "");
    setSortOrder(String(c.sort_order));
    setDescription(c.description ?? "");
    setResourceTypeIds(c.resource_type_ids ?? []);
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const toggleResourceType = (id: string) => {
    setResourceTypeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const validate = (): boolean => {
    if (!name.trim()) { setFormError("Chapter name is required."); return false; }
    if (!editing && !filterStandard) { setFormError("Please select a Standard in the filters first."); return false; }
    if (!editing && !filterSubject) { setFormError("Please select a Subject in the filters first."); return false; }
    return true;
  };

  const doSubmit = async (): Promise<boolean> => {
    if (!validate()) return false;
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await api.chapters.update(editing.id, {
          name: name.trim(),
          number: number ? Number(number) : undefined,
          sort_order: sortOrder ? Number(sortOrder) : 0,
          description: description.trim() || undefined,
          resource_type_ids: resourceTypeIds,
        });
      } else {
        await api.chapters.create({
          subject_id: filterSubject,
          standard_id: filterStandard,
          resource_type_ids: resourceTypeIds.length ? resourceTypeIds : undefined,
          name: name.trim(),
          number: number ? Number(number) : undefined,
          sort_order: sortOrder ? Number(sortOrder) : undefined,
          description: description.trim() || undefined,
        });
      }
      await loadChapters();
      return true;
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await doSubmit();
    if (ok) {
      closeForm();
      toast.success(editing ? "Chapter updated." : "Chapter created.");
    }
  };

  const handleSaveAndAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await doSubmit();
    if (ok) {
      toast.success(editing ? "Chapter updated." : "Chapter created.");
      setEditing(null);
      resetForm();
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.chapters.delete(deleting.id);
      await loadChapters();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete.");
    } finally {
      setDeleting(null);
    }
  };

  const columns: DataTableColumn<Chapter>[] = [
    {
      key: "name",
      header: "Chapter",
      sortValue: (c) => c.name,
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <BookMarked className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <span className="font-medium text-slate-900">{c.name}</span>
            {c.number && <span className="ml-2 text-xs text-slate-400">#{c.number}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "standard_id",
      header: "Standard",
      sortValue: (c) => getStandardName(c.standard_id),
      render: (c) => <span className="text-sm text-slate-600">{getStandardName(c.standard_id)}</span>,
    },
    {
      key: "subject_id",
      header: "Subject",
      sortValue: (c) => getSubjectName(c.subject_id),
      render: (c) => <span className="text-sm text-slate-600">{getSubjectName(c.subject_id)}</span>,
    },
    {
      key: "resource_type_ids",
      header: "Resource Types",
      sortValue: (c) => (c.resource_type_ids ?? []).map((id) => getResourceTypeName(id) ?? "").join(", "),
      render: (c) => {
        const ids = c.resource_type_ids ?? [];
        if (!ids.length) return <span className="text-sm text-slate-400">—</span>;
        const chips = ids.map((id) => ({ id, name: getResourceTypeName(id) })).filter((x) => x.name);
        const shown = chips.slice(0, 2);
        return (
          <div className="flex flex-wrap items-center gap-1">
            {shown.map((rt) => (
              <span key={rt.id} className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
                {rt.name}
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
      key: "actions",
      header: "",
      className: "text-right",
      headerClassName: "w-px text-right",
      render: (c) => (
        <div className="flex justify-end gap-0.5">
          <button
            type="button"
            onClick={() => openEditForm(c)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-primary"
            title="Edit"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDeleting(c)}
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
        title="Chapters"
        subtitle="Manage chapters within subjects"
        actions={
          <Button onClick={openCreateForm} disabled={!filterSubject || !filterStandard}>
            <Plus className="h-4 w-4" aria-hidden /> Add Chapter
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
          value={filterStandard}
          onChange={(e) => { setFilterStandard(e.target.value); setLoading(true); }}
        >
          <option value="">All Standards</option>
          {standards.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
          value={filterSubject}
          onChange={(e) => { setFilterSubject(e.target.value); setLoading(true); }}
        >
          <option value="">All Subjects</option>
          {subjects
            .filter((s) => !mappedSubjectIds || mappedSubjectIds.has(s.id))
            .map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
        </select>
        <select
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
          value={filterResourceType}
          onChange={(e) => { setFilterResourceType(e.target.value); setLoading(true); }}
        >
          <option value="">All Resource Types</option>
          {resourceTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
        </select>
        {(filterStandard || filterSubject || filterResourceType) && (
          <button
            type="button"
            onClick={() => { setFilterStandard(""); setFilterSubject(""); setFilterResourceType(""); setLoading(true); }}
            className="text-sm text-slate-500 hover:text-primary"
          >
            Clear filters
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{editing ? "Edit Chapter" : "Add Chapter"}</h3>
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
              <label htmlFor="chap-name" className="mb-1 block text-xs font-medium text-slate-600">Chapter Name *</label>
              <input
                id="chap-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ch 1 - Real Numbers"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {/* Chapter Number */}
            <div>
              <label htmlFor="chap-number" className="mb-1 block text-xs font-medium text-slate-600">Chapter Number</label>
              <input
                id="chap-number"
                type="number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="1"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {/* Sort Order */}
            <div>
              <label htmlFor="chap-order" className="mb-1 block text-xs font-medium text-slate-600">Sort Order</label>
              <input
                id="chap-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {/* Resource Types (multi-select checkboxes) */}
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Resource Types</label>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-300 p-2">
                {resourceTypes.length === 0 && (
                  <p className="px-1 py-1 text-xs text-slate-400">No resource types available</p>
                )}
                {resourceTypes.map((rt) => (
                  <label key={rt.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--color-primary,theme(colors.blue.600))]"
                      checked={resourceTypeIds.includes(rt.id)}
                      onChange={() => toggleResourceType(rt.id)}
                    />
                    <span className="truncate">{rt.name}</span>
                    {rt.code && <span className="text-xs text-slate-400">{rt.code}</span>}
                  </label>
                ))}
              </div>
            </div>
            {/* Description */}
            <div className="col-span-2">
              <label htmlFor="chap-desc" className="mb-1 block text-xs font-medium text-slate-600">Description</label>
              <textarea
                id="chap-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create"}
            </Button>
            {!editing && (
              <Button type="button" variant="secondary" disabled={saving} onClick={handleSaveAndAddNew}>
                {saving ? "Saving…" : "Save & Add New"}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
          </div>
        </form>
      )}

      {!filterStandard || !filterSubject ? (
        !formOpen && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
            <BookMarked className="mb-4 h-10 w-10 text-slate-300" aria-hidden />
            <p className="text-sm text-slate-500">Select a Standard and Subject to view chapters.</p>
          </div>
        )
      ) : loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : (
        <DataTable
          columns={columns}
          data={chapters}
          rowKey={(c) => c.id}
          searchPlaceholder="Search chapters…"
          emptyIcon={<BookMarked className="h-6 w-6" aria-hidden />}
          emptyTitle="No chapters"
          emptyDescription="Add a chapter to get started."
          emptyAction={
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4" aria-hidden /> Add Chapter
            </Button>
          }
          initialSortedColumn="sort_order"
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Chapter"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
