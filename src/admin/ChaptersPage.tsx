import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, BookMarked } from "lucide-react";
import { api, ApiError, type Chapter, type Standard, type Subject } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { MasterDataModal, type MasterField } from "./components/MasterDataModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TableSkeleton } from "./components/Skeleton";

export default function ChaptersPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Chapter | null>(null);
  const [deleting, setDeleting] = useState<Chapter | null>(null);
  const [filterStandard, setFilterStandard] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [mappedSubjectIds, setMappedSubjectIds] = useState<Set<string> | null>(null);

  const loadMasters = useCallback(async () => {
    try {
      const [stdRes, subRes] = await Promise.all([api.standards.list(), api.subjects.list()]);
      setStandards(stdRes.standards);
      setSubjects(subRes.subjects);
    } catch { /* ignore */ }
  }, []);

  const loadChapters = useCallback(async () => {
    try {
      const res = await api.chapters.list({
        subject_id: filterSubject || undefined,
        standard_id: filterStandard || undefined,
      });
      setChapters(res.chapters);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load chapters.");
    } finally {
      setLoading(false);
    }
  }, [filterStandard, filterSubject]);

  // Load which subjects are mapped to the selected standard; fall back to all
  // subjects when no standard is picked, the mapping fails, or nothing is mapped.
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

  const getFields = (): MasterField[] => [
    { key: "name", label: "Chapter Name", placeholder: "e.g. Ch 1 - Real Numbers", required: true, colSpan: 2 },
    { key: "number", label: "Chapter Number", type: "number", placeholder: "1" },
    { key: "sort_order", label: "Sort Order", type: "number", placeholder: "0" },
    { key: "description", label: "Description", type: "textarea", placeholder: "Optional description", colSpan: 2 },
  ];

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (editing) {
      await api.chapters.update(editing.id, data as Partial<Chapter>);
    } else {
      // For create, we need subject_id and standard_id from filters
      if (!filterSubject || !filterStandard) {
        toast.error("Please select a Subject and Standard first.");
        return;
      }
      await api.chapters.create({
        subject_id: filterSubject,
        standard_id: filterStandard,
        name: data.name as string,
        number: data.number as number | undefined,
        description: data.description as string | undefined,
        sort_order: data.sort_order as number | undefined,
      });
    }
    await loadChapters();
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
      key: "actions",
      header: "",
      className: "text-right",
      headerClassName: "w-px text-right",
      render: (c) => (
        <div className="flex justify-end gap-0.5">
          <button
            type="button"
            onClick={() => { setEditing(c); setModalOpen(true); }}
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
          <Button onClick={() => { setEditing(null); setModalOpen(true); }} disabled={!filterSubject || !filterStandard}>
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
        {(filterStandard || filterSubject) && (
          <button
            type="button"
            onClick={() => { setFilterStandard(""); setFilterSubject(""); setLoading(true); }}
            className="text-sm text-slate-500 hover:text-primary"
          >
            Clear filters
          </button>
        )}
      </div>

      {!filterStandard || !filterSubject ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
          <BookMarked className="mb-4 h-10 w-10 text-slate-300" aria-hidden />
          <p className="text-sm text-slate-500">Select a Standard and Subject to view chapters.</p>
        </div>
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
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" aria-hidden /> Add Chapter
            </Button>
          }
          initialSortedColumn="sort_order"
        />
      )}

      <MasterDataModal
        open={modalOpen}
        title={editing ? "Edit Chapter" : "Add Chapter"}
        fields={getFields()}
        initial={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
      />

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
