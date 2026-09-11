import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, BookOpen } from "lucide-react";
import { api, ApiError, type Standard, type Subject } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { MasterDataModal, type MasterField } from "./components/MasterDataModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TableSkeleton } from "./components/Skeleton";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const [filterStandard, setFilterStandard] = useState("");

  // subject_id -> standard ids the subject is mapped to (standard_subjects)
  const [subjectStandards, setSubjectStandards] = useState<Map<string, string[]>>(new Map());

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

  const handleSubmit = async (data: Record<string, unknown>) => {
    const standardIds = (data.standard_ids as string[] | undefined) ?? [];
    const payload = { ...data };
    delete payload.standard_ids;
    if (editing) {
      await api.subjects.update(editing.id, {
        ...(payload as Partial<Subject>),
        standard_ids: standardIds,
      });
    } else {
      await api.subjects.create({
        ...(payload as { name: string; icon?: string; color?: string; sort_order?: number }),
        standard_ids: standardIds,
      });
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

  const filteredSubjects =
    !filterStandard
      ? subjects
      : subjects.filter((s) => subjectStandards.get(s.id)?.includes(filterStandard));

  const getStandardOptions = () =>
    standards.map((st) => ({ value: st.id, label: st.name }));

  const getFields = (): MasterField[] => [
    { key: "name", label: "Subject Name", placeholder: "e.g. Mathematics", required: true, colSpan: 2 },
    { key: "icon", label: "Icon (emoji)", placeholder: "📐", colSpan: 1 },
    { key: "color", label: "Color", type: "color", colSpan: 1 },
    { key: "sort_order", label: "Sort Order", type: "number", placeholder: "0" },
    {
      key: "standard_ids",
      label: "Standards",
      type: "multiselect",
      options: getStandardOptions(),
      colSpan: 2,
      // When creating while a standard is selected in the filter, pre-check it.
      defaultValue: filterStandard ? [filterStandard] : [],
    },
  ];

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
        if (!chips.length) {
          return <span className="text-sm text-slate-400">—</span>;
        }
        const shown = chips.slice(0, 3);
        return (
          <div className="flex flex-wrap items-center gap-1">
            {shown.map((st) => (
              <span
                key={st.id}
                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
              >
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
        fields={getFields()}
        initial={
          editing
            ? {
                ...editing,
                // Prefill the multiselect with the subject's mapped standards.
                standard_ids: subjectStandards.get(editing.id) ?? [],
              }
            : null
        }
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
