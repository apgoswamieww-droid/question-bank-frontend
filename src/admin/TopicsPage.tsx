import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Layers, X } from "lucide-react";
import { api, ApiError, type Topic, type Chapter, type Standard, type Subject, type ResourceType } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TableSkeleton } from "./components/Skeleton";

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Topic | null>(null);

  // Filters (cascading: standard → subject → resource type → chapter)
  const [filterStandard, setFilterStandard] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterResourceType, setFilterResourceType] = useState("");
  const [filterChapter, setFilterChapter] = useState("");

  // Subjects mapped to the selected standard
  const [mappedSubjectIds, setMappedSubjectIds] = useState<Set<string> | null>(null);

  // Inline form state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load master data once
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

  // When standard changes → load mapped subjects, reset downstream
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

  // Load chapters when standard + subject (+ optional resource type) change
  const loadChapters = useCallback(async () => {
    if (!filterStandard || !filterSubject) { setChapters([]); return; }
    try {
      const res = await api.chapters.list({
        subject_id: filterSubject,
        standard_id: filterStandard,
        resource_type_ids: filterResourceType ? [filterResourceType] : undefined,
      });
      setChapters(res.chapters);
    } catch { setChapters([]); }
  }, [filterStandard, filterSubject, filterResourceType]);

  // Load topics when chapter changes
  const loadTopics = useCallback(async () => {
    if (!filterChapter) { setTopics([]); setLoading(false); return; }
    try {
      const res = await api.topics.list({ chapter_id: filterChapter });
      setTopics(res.topics);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load topics.");
    } finally {
      setLoading(false);
    }
  }, [filterChapter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadMasters(); }, [loadMasters]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadChapters(); setFilterChapter(""); }, [loadChapters]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadTopics(); }, [loadTopics]);

  const getChapterName = (id: string) => chapters.find((c) => c.id === id)?.name ?? "—";

  // Filtered subjects for the dropdown (only those mapped to selected standard)
  const filteredSubjects = !mappedSubjectIds
    ? subjects
    : subjects.filter((s) => mappedSubjectIds.has(s.id));

  // Inline form handlers
  const resetForm = () => {
    setName("");
    setNumber("");
    setSortOrder("");
    setDescription("");
    setFormError(null);
  };

  const openCreateForm = () => {
    setEditing(null);
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (t: Topic) => {
    setEditing(t);
    setName(t.name);
    setNumber(t.number ?? "");
    setSortOrder(String(t.sort_order));
    setDescription(t.description ?? "");
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const validate = (): boolean => {
    if (!name.trim()) { setFormError("Topic name is required."); return false; }
    if (!editing && !filterChapter) { setFormError("Please select a Chapter first."); return false; }
    return true;
  };

  const doSubmit = async (): Promise<boolean> => {
    if (!validate()) return false;
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await api.topics.update(editing.id, {
          name: name.trim(),
          number: number.trim() || undefined,
          sort_order: sortOrder ? Number(sortOrder) : 0,
          description: description.trim() || undefined,
        });
      } else {
        await api.topics.create({
          chapter_id: filterChapter,
          name: name.trim(),
          number: number.trim() || undefined,
          sort_order: sortOrder ? Number(sortOrder) : undefined,
          description: description.trim() || undefined,
        });
      }
      await loadTopics();
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
      toast.success(editing ? "Topic updated." : "Topic created.");
    }
  };

  const handleSaveAndAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await doSubmit();
    if (ok) {
      toast.success(editing ? "Topic updated." : "Topic created.");
      setEditing(null);
      resetForm();
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.topics.delete(deleting.id);
      await loadTopics();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete.");
    } finally {
      setDeleting(null);
    }
  };

  const columns: DataTableColumn<Topic>[] = [
    {
      key: "name",
      header: "Topic",
      sortValue: (t) => t.name,
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
            <Layers className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <span className="font-medium text-slate-900">{t.name}</span>
            {t.number && <span className="ml-2 text-xs text-slate-400">{t.number}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "chapter_id",
      header: "Chapter",
      sortValue: (t) => getChapterName(t.chapter_id),
      render: (t) => <span className="text-sm text-slate-600">{getChapterName(t.chapter_id)}</span>,
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
            onClick={() => openEditForm(t)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-primary"
            title="Edit"
          >
            <Pencil className="h-4 w-4" aria-hidden />
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

  const allFiltersSelected = filterStandard && filterSubject && filterChapter;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Topics"
        subtitle="Manage topics within chapters"
        actions={
          <Button onClick={openCreateForm} disabled={!allFiltersSelected}>
            <Plus className="h-4 w-4" aria-hidden /> Add Topic
          </Button>
        }
      />

      {/* Cascading Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 1. Standard */}
        <select
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
          value={filterStandard}
          onChange={(e) => {
            setFilterStandard(e.target.value);
            setFilterSubject("");
            setFilterResourceType("");
            setFilterChapter("");
            setLoading(true);
          }}
        >
          <option value="">Standard</option>
          {standards.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {/* 2. Subject (filtered by standard_subjects mapping) */}
        <select
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
          value={filterSubject}
          onChange={(e) => {
            setFilterSubject(e.target.value);
            setFilterResourceType("");
            setFilterChapter("");
            setLoading(true);
          }}
          disabled={!filterStandard}
        >
          <option value="">Subject</option>
          {filteredSubjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
        </select>

        {/* 3. Resource Type */}
        <select
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
          value={filterResourceType}
          onChange={(e) => {
            setFilterResourceType(e.target.value);
            setFilterChapter("");
            setLoading(true);
          }}
          disabled={!filterStandard || !filterSubject}
        >
          <option value="">All Resource Types</option>
          {resourceTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
        </select>

        {/* 4. Chapter (filtered by standard + subject + resource type) */}
        <select
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
          value={filterChapter}
          onChange={(e) => { setFilterChapter(e.target.value); setLoading(true); }}
          disabled={!filterStandard || !filterSubject}
        >
          <option value="">Chapter</option>
          {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {(filterStandard || filterSubject || filterResourceType || filterChapter) && (
          <button
            type="button"
            onClick={() => {
              setFilterStandard("");
              setFilterSubject("");
              setFilterResourceType("");
              setFilterChapter("");
              setLoading(true);
            }}
            className="text-sm text-slate-500 hover:text-primary"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Inline Form */}
      {formOpen && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{editing ? "Edit Topic" : "Add Topic"}</h3>
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
              <label htmlFor="topic-name" className="mb-1 block text-xs font-medium text-slate-600">Topic Name *</label>
              <input
                id="topic-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 1.1 Euclid's Division Lemma"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {/* Topic Number */}
            <div>
              <label htmlFor="topic-number" className="mb-1 block text-xs font-medium text-slate-600">Topic Number</label>
              <input
                id="topic-number"
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="1.1"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {/* Sort Order */}
            <div>
              <label htmlFor="topic-order" className="mb-1 block text-xs font-medium text-slate-600">Sort Order</label>
              <input
                id="topic-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {/* Description */}
            <div className="col-span-2">
              <label htmlFor="topic-desc" className="mb-1 block text-xs font-medium text-slate-600">Description</label>
              <textarea
                id="topic-desc"
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

      {/* Empty state or table */}
      {!allFiltersSelected ? (
        !formOpen && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
            <Layers className="mb-4 h-10 w-10 text-slate-300" aria-hidden />
            <p className="text-sm text-slate-500">Select a Standard, Subject, and Chapter to view topics.</p>
          </div>
        )
      ) : loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : (
        <DataTable
          columns={columns}
          data={topics}
          rowKey={(t) => t.id}
          searchPlaceholder="Search topics…"
          emptyIcon={<Layers className="h-6 w-6" aria-hidden />}
          emptyTitle="No topics"
          emptyDescription="Add a topic to get started."
          emptyAction={
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4" aria-hidden /> Add Topic
            </Button>
          }
          initialSortedColumn="sort_order"
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Topic"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
