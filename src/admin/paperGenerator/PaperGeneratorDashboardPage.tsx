import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { Archive, FileText, PenLine, Plus, Send } from "lucide-react";
import { api, ApiError, type Paper } from "../../api/client";
import { useCan, PERMISSIONS } from "../../context/useAdminAuth";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { DashboardSkeleton } from "../components/Skeleton";
import { paperStatusStyles } from "./paperStatus";

export default function PaperGeneratorDashboardPage() {
  const navigate = useNavigate();
  const can = useCan();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.papers
      .list({ limit: 100 })
      .then((res) => setPapers(res.papers))
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to load papers.")
      )
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: papers.length,
    draft: papers.filter((p) => p.status === "draft").length,
    published: papers.filter((p) => p.status === "published").length,
    archived: papers.filter((p) => p.status === "archived").length,
  };

  const cardDefs = [
    { label: "Total Papers", value: stats.total, icon: FileText, accent: "text-primary bg-primary-50 ring-primary/20", to: "/admin/papers/all" },
    { label: "Draft", value: stats.draft, icon: PenLine, accent: "text-amber-600 bg-amber-100 ring-amber-200", to: "/admin/papers/all?status=draft" },
    { label: "Published", value: stats.published, icon: Send, accent: "text-emerald-600 bg-emerald-100 ring-emerald-200", to: "/admin/papers/all?status=published" },
    { label: "Archived", value: stats.archived, icon: Archive, accent: "text-slate-500 bg-slate-100 ring-slate-200", to: "/admin/papers/all?status=archived" },
  ];

  if (loading) {
    return <DashboardSkeleton />;
  }

  const recent = papers.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper Generator"
        subtitle="Compose question papers from the question bank"
        actions={
          can(PERMISSIONS.PAPERS_MANAGE) && (
            <Button onClick={() => navigate("/admin/papers/new")}>
              <Plus className="h-4 w-4" aria-hidden /> New Paper
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cardDefs.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/40"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">{card.label}</p>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${card.accent}`}>
                <card.icon className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{card.value}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent Papers</h2>
          <Link
            to="/admin/papers/all"
            className="text-sm font-medium text-primary transition hover:text-primary-600"
          >
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            No papers yet. Create your first paper to get started.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((p) => {
              const s = paperStatusStyles[p.status] ?? paperStatusStyles.draft;
              return (
                <li key={p.id}>
                  <Link
                    to={can(PERMISSIONS.PAPERS_MANAGE) ? `/admin/papers/${p.id}/edit` : `/admin/papers/${p.id}`}
                    className="flex items-center gap-3 px-1 py-3 transition hover:bg-slate-50/60"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
                      <FileText className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{p.title}</p>
                      <p className="text-xs text-slate-500">
                        {p.question_count ?? 0} questions · {p.duration_min} min · updated{" "}
                        {new Date(p.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${s.className}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {s.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
