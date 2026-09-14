import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Save } from "lucide-react";
import {
  api,
  ApiError,
  type PaperStatus,
  type Standard,
  type Subject,
  type ExamType,
} from "../../api/client";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { TableSkeleton } from "../components/Skeleton";
import { paperStatusOptions, paperStatusStyles } from "./paperStatus";

const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";

interface FormErrors {
  title?: string;
  duration_min?: string;
  total_marks?: string;
}

export default function PaperFormPage() {
  const { id } = useParams<{ id: string }>();
  const editId = id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // master data
  const [standards, setStandards] = useState<Standard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [standardId, setStandardId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examTypeId, setExamTypeId] = useState("");
  const [durationMin, setDurationMin] = useState(120);
  const [totalMarks, setTotalMarks] = useState(0);
  const [status, setStatus] = useState<PaperStatus>("draft");

  // Lifecycle (Phase 16): the form may only move a paper along transitions the
  // backend state machine allows. Archived is read-only — restore via the
  // paper detail page. Publishing from the form is only offered for papers
  // already validated; draft → published also passes the validation gate, so
  // it is surfaced there instead of as a blind form action.
  const PAPER_TRANSITIONS: Record<PaperStatus, PaperStatus[]> = {
    draft: ["validated", "published", "archived"],
    validated: ["published", "archived"],
    published: ["archived"],
    archived: [],
  };
  const transitionTargets = PAPER_TRANSITIONS[status] ?? [];
  // New papers always start as drafts (backend enforces this too); existing
  // papers may only move along lifecycle-allowed transitions.
  const statusChoices = editId
    ? [
        status,
        ...paperStatusOptions.map((o) => o.value).filter((v) => transitionTargets.includes(v)),
      ].filter((v, i, arr) => arr.indexOf(v) === i)
    : ["draft"];

  const errors = useMemo<FormErrors>(() => {
    const e: FormErrors = {};
    if (!title.trim()) e.title = "Title is required.";
    else if (title.trim().length > 120) e.title = "Title must be 120 characters or fewer.";
    if (durationMin < 1) e.duration_min = "Duration must be at least 1 minute.";
    if (totalMarks < 0) e.total_marks = "Total marks cannot be negative.";
    return e;
  }, [title, durationMin, totalMarks]);

  useEffect(() => {
    (async () => {
      try {
        const [s, sub, et] = await Promise.all([
          api.standards.list(),
          api.subjects.list(),
          api.examTypes.list(),
        ]);
        setStandards(s.standards);
        setSubjects(sub.subjects);
        setExamTypes(et.examTypes);
        if (editId) {
          const result = await api.papers.get(editId);
          setTitle(result.paper.title);
          setDescription(result.paper.description ?? "");
          setStandardId(result.paper.standard_id ?? "");
          setSubjectId(result.paper.subject_id ?? "");
          setExamTypeId(result.paper.exam_type_id ?? "");
          setDurationMin(result.paper.duration_min);
          setTotalMarks(Number(result.paper.total_marks) || 0);
          setStatus(result.paper.status);
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to load paper.");
        navigate("/admin/papers");
      } finally {
        setLoading(false);
      }
    })();
  }, [editId, navigate]);

  const save = async () => {
    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0]);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        standard_id: standardId || null,
        subject_id: subjectId || null,
        exam_type_id: examTypeId || null,
        duration_min: durationMin,
        total_marks: totalMarks,
        status,
      };
      if (editId) {
        await api.papers.update(editId, payload);
        toast.success("Paper updated.");
      } else {
        await api.papers.create(payload);
        toast.success("Paper created.");
      }
      navigate("/admin/papers");
    } catch (err) {
      if (err instanceof ApiError && err.code === "PUBLICATION_BLOCKED") {
        const body = err.body as { results?: { section: string | null; question: string | null; problem: string }[] } | undefined;
        const issues = body?.results ?? [];
        toast.error(
          `Publishing blocked — ${issues.length} critical issue(s). First: ${issues[0]?.problem ?? "see validation"}`,
          { description: "Run Validate on the paper detail page for the full report." }
        );
      } else {
        toast.error(err instanceof ApiError ? err.message : "Failed to save paper.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <TableSkeleton rows={8} cols={2} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={editId ? "Edit Paper" : "Create Paper"}
        subtitle="Basic paper metadata — questions are managed in the editor"
        actions={
          <Button variant="secondary" onClick={() => navigate("/admin/papers")}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Paper Details</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Title *</label>
              <input
                className={field}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Class 12 Physics — Final Examination"
                maxLength={120}
              />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
              <textarea
                className={`${field} min-h-[72px] resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                maxLength={2000}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Standard</label>
                <select
                  className={field}
                  value={standardId}
                  onChange={(e) => setStandardId(e.target.value)}
                >
                  <option value="">Any</option>
                  {standards.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
                <select
                  className={field}
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                >
                  <option value="">Any</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Exam Type</label>
              <select
                className={field}
                value={examTypeId}
                onChange={(e) => setExamTypeId(e.target.value)}
              >
                <option value="">None</option>
                {examTypes.map((et) => (
                  <option key={et.id} value={et.id}>{et.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Settings</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Duration (minutes)</label>
              <input
                type="number"
                min={1}
                className={field}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value) || 0)}
              />
              {errors.duration_min && (
                <p className="mt-1 text-xs text-red-600">{errors.duration_min}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Total Marks</label>
              <input
                type="number"
                min={0}
                className={field}
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value) || 0)}
              />
              {errors.total_marks && (
                <p className="mt-1 text-xs text-red-600">{errors.total_marks}</p>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            {editId && status === "archived" ? (
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${paperStatusStyles.archived.className}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {paperStatusStyles.archived.label}
                </span>
                <span className="text-xs text-slate-500">
                  Archived is read-only — restore it from the paper detail page to make changes.
                </span>
              </div>
            ) : (
              <select
                className={field}
                value={status}
                onChange={(e) => setStatus(e.target.value as PaperStatus)}
              >
                {statusChoices.map((value) => {
                  const opt = paperStatusOptions.find((o) => o.value === value);
                  return (
                    <option key={value} value={value}>
                      {opt?.label ?? value}
                      {editId && value === "published" && status !== "published" ? " (requires validation)" : ""}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <p>
              Status controls the paper lifecycle: Draft → Validated → Published → Archived. New papers always start as drafts — publishing requires successful validation. Archived papers are read-only until restored.
            </p>
          </div>
        </section>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-400">Papers reference question families — existing questions are never duplicated.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate("/admin/papers")}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            <Save className="h-4 w-4" aria-hidden /> {editId ? "Save Changes" : "Create Paper"}
          </Button>
        </div>
      </div>
    </div>
  );
}
