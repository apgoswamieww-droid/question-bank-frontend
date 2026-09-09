import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Layers } from "lucide-react";
import { api, ApiError, type Topic, type Chapter, type Standard, type Subject } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { MasterDataModal, type MasterField } from "./components/MasterDataModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TableSkeleton } from "./components/Skeleton";

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [deleting, setDeleting] = useState<Topic | null>(null);
  const [filterStandard, setFilterStandard] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterChapter, setFilterChapter] = useState("");

  const loadMasters = useCallback(async () => {
    try {
      const [stdRes, subRes] = await Promise.all([api.standards.list(), api.subjects.list()]);
      setStandards(stdRes.standards);
      setSubjects(subRes.subjects);
    } catch { /* ignore */ }
  }, []);

  const loadChapters = useCallback(async () => {
    if (!filterStandard || !filterSubject) { setChapters([]); return; }
    try {
      const res = await api.chapters.list({ subject_id: filterSubject, standard_id: filterStandard });
      setChapters(res.chapters);
    } catch { setChapters([]); }
  }, [filterStandard, filterSubject]);

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

  const fields: MasterField[] = [
    { key: "name", label: "Topic Name", placeholder: "e.g. 1.1 Euclid's Division Lemma", required: true, colSpan: 2 },
    { key: "number", label: "Topic Number", placeholder: "1.1" },
    { key: "sort_order", label: "Sort Order", type: "number", placeholder: "0" },
    { key: "description", label: "Description", type: "textarea", placeholder: "Optional description", colSpan: 2 },
  ];

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (editing) {
      await api.topics.update(editing.id, data as Partial<Topic>);
    } else {
      if (!filterChapter) {
        toast.error("Please select a chapter first.");
        return;
      }
      await api.topics.create({
        chapter_id: filterChapter,
        name: data.name as string,
        number: data.number as string | undefined,
        description: data.description as string | undefined,
        sort_order: data.sort_order as number | undefined,
      });
    }
    await loadTopics();
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
            onClick={() => { setEditing(t); setModalOpen(true); }}
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Topics"
        subtitle="Manage topics within chapters"
        actions={
          <Button onClick={() => { setEditing(null); setModalOpen(true); }} disabled={!filterChapter}>
            <Plus className="h-4 w-4" aria-hidden /> Add Topic
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
          <option value="">Standard</option>
          {standards.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
          value={filterSubject}
          onChange={(e) => { setFilterSubject(e.target.value); setLoading(true); }}
          disabled={!filterStandard}
        >
          <option value="">Subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
        </select>
        <select
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
          value={filterChapter}
          onChange={(e) => { setFilterChapter(e.target.value); setLoading(true); }}
          disabled={!filterStandard || !filterSubject}
        >
          <option value="">Chapter</option>
          {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!filterChapter ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
          <Layers className="mb-4 h-10 w-10 text-slate-300" aria-hidden />
          <p className="text-sm text-slate-500">Select a Standard, Subject, and Chapter to view topics.</p>
        </div>
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
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" aria-hidden /> Add Topic
            </Button>
          }
          initialSortedColumn="sort_order"
        />
      )}

      <MasterDataModal
        open={modalOpen}
        title={editing ? "Edit Topic" : "Add Topic"}
        fields={fields}
        initial={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
      />

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
