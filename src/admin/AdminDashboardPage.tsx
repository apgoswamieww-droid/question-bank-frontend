import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpenCheck, GraduationCap, Users, UserRound } from "lucide-react";
import { api, ApiError } from "../api/client";
import { useAdminAuth, useCan, PERMISSIONS } from "../context/useAdminAuth";
import { ROLE_META } from "./components/roleMeta";
import { DashboardSkeleton } from "./components/Skeleton";

interface Stats {
  teacher: number;
  student: number;
  super_admin: number;
}

export default function AdminDashboardPage() {
  const { user } = useAdminAuth();
  const can = useCan();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!can(PERMISSIONS.USERS_VIEW)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    api.admin
      .stats()
      .then((res) => setStats(res.stats))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load stats."))
      .finally(() => setLoading(false));
  }, [can]);

  const cardDefs = [
    {
      label: "Teachers",
      value: stats?.teacher ?? 0,
      icon: UserRound,
      accent: "text-sky-600 bg-sky-100 ring-sky-200",
      visible: can(PERMISSIONS.USERS_VIEW),
    },
    {
      label: "Students",
      value: stats?.student ?? 0,
      icon: GraduationCap,
      accent: "text-emerald-600 bg-emerald-100 ring-emerald-200",
      visible: can(PERMISSIONS.USERS_VIEW),
    },
    {
      label: "Question Banks",
      value: "—",
      icon: BookOpenCheck,
      accent: "text-primary bg-primary-50 ring-primary/20",
      visible: can(PERMISSIONS.QUESTION_BANKS_VIEW),
    },
  ].filter((c) => c.visible);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Welcome back, {user?.name?.split(" ")[0] ?? "Admin"}
        </h2>
        <p className="mt-1.5 max-w-xl text-sm text-slate-600">
          Manage teachers, students and question banks from one place.
        </p>
        <span className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${ROLE_META[user?.role ?? "super_admin"].color}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          {ROLE_META[user?.role ?? "super_admin"].label}
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {cardDefs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cardDefs.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/40">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">{card.label}</p>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${card.accent}`}>
                  <card.icon className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      <Link to="/admin/editor" className="inline-flex items-center gap-1 text-sm font-medium text-primary transition hover:text-primary-600">
        Open the question bank editor →
      </Link>
    </div>
  );
}
