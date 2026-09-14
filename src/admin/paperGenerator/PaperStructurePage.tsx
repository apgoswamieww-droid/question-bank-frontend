import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ListOrdered } from "lucide-react";
import {
  api,
  ApiError,
  type PaperStructure,
} from "../../api/client";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { TableSkeleton } from "../components/Skeleton";

export default function PaperStructurePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [structure, setStructure] = useState<PaperStructure | null>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const result = await api.papers.structure(id);
        setTitle(result.paper.title);
        setStructure({
          sections: result.sections,
          totals: result.totals,
          warnings: result.warnings,
        });
        setMigrationRequired(result.migrationRequired === true);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to load paper structure.");
        navigate("/admin/papers/all");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  if (loading) {
    return <TableSkeleton rows={8} cols={2} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper Structure"
        subtitle={`Sections, ordering and scoring for “${title}”`}
        actions={
          <Button variant="secondary" onClick={() => navigate(id ? `/admin/papers/${id}` : "/admin/papers/all")}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </Button>
        }
      />

      {/* totals strip */}
      {structure && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total questions</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{structure.totals.totalQuestions}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total marks</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{structure.totals.totalMarks}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Max score</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{structure.totals.maxScore}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Min score (negatives)</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{structure.totals.minScore}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Sections</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{structure.totals.sectionsCount}</p>
          </div>
        </div>
      )}

      {migrationRequired && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            Blueprint storage is not active yet — apply backend/migrations/008_paper_blueprints.sql
            in the Supabase SQL editor to enable sections.
          </span>
        </div>
      )}

      {structure?.warnings.map((w, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>{w}</span>
        </div>
      ))}

      {/* sections */}
      <div className="space-y-4">
        {structure?.sections.map((section) => (
          <section key={section.key} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">{section.name}</h2>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded-full bg-primary-50 px-2.5 py-0.5 font-semibold text-primary ring-1 ring-primary/20">
                  {section.questionCount} Q · {section.marksTotal} marks
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600 ring-1 ring-slate-200">
                  {section.marksPerQuestion}/question
                </span>
                {section.negativeMarks > 0 && (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-red-600 ring-1 ring-red-200">
                    −{section.negativeMarks} per wrong answer
                  </span>
                )}
                {section.types.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600 ring-1 ring-slate-200">
                    {section.types.join(", ")}
                  </span>
                )}
                {section.difficulties.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600 ring-1 ring-slate-200">
                    {section.difficulties.join(", ")}
                  </span>
                )}
              </div>
            </div>
            {section.instructions && (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {section.instructions}
              </p>
            )}
            {section.families.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">No questions in this section.</p>
            ) : (
              <ol className="space-y-1">
                {section.families.map((f) => (
                  <li
                    key={f.family_id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                      {f.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500">
                      {f.family_id.slice(0, 8)}…
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {f.effectiveMarks} {f.effectiveMarks === 1 ? "mark" : "marks"}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
        <ListOrdered className="h-4 w-4 text-slate-400" aria-hidden />
        <p className="text-xs text-slate-400">
          Numbering runs continuously across sections. Negative marking rules come from each
          section's blueprint settings.
        </p>
      </div>
    </div>
  );
}
