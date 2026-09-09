import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  Archive,
  BookOpenCheck,
  FileClock,
  Filter,
  Inbox,
  RefreshCcw,
  TrendingUp,
} from "lucide-react";
import {
  api,
  type AnalyticsOverview,
  type Question,
  type SchoolUsageRow,
  type TeacherUsageRow,
  type OverTimeData,
  type PerformanceData,
} from "../api/client";
import { Button } from "./components/Button";

interface AnalyticsState {
  overview: AnalyticsOverview | null;
  mostUsed: (Question & { usage_count: number })[];
  unused: Question[];
  schools: SchoolUsageRow[];
  teachers: TeacherUsageRow[];
  overTime: OverTimeData | null;
  performance: PerformanceData | null;
}

const emptyState = (): AnalyticsState => ({
  overview: null,
  mostUsed: [],
  unused: [],
  schools: [],
  teachers: [],
  overTime: null,
  performance: null,
});

export default function QuestionAnalyticsPage() {
  const [data, setData] = useState<AnalyticsState>(emptyState());
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.analytics.overview(),
      api.analytics.mostUsed(10),
      api.analytics.unused(25),
      api.analytics.bySchool(),
      api.analytics.byTeacher(),
      api.analytics.overTime(),
      api.analytics.performance(),
    ])
      .then(([overview, mostUsed, unused, bySchool, byTeacher, overTime, performance]) => {
        setData({
          overview,
          mostUsed: mostUsed.questions,
          unused: unused.questions,
          schools: bySchool.schools,
          teachers: byTeacher.teachers,
          overTime,
          performance,
        });
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load analytics."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageTitle title="Analytics" subtitle="Usage, performance and quality across your question bank." />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const ov = data.overview;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle title="Analytics" subtitle="Usage, performance and quality across your question bank." />
        <Button variant="secondary" onClick={load}>
          <RefreshCcw className="h-4 w-4" aria-hidden /> Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={<BookOpenCheck className="h-5 w-5" />} label="Total Questions" value={ov?.total ?? 0} tone="primary" />
        <StatCard icon={<FileClock className="h-5 w-5" />} label="Published" value={ov?.published ?? 0} tone="emerald" />
        <StatCard icon={<Archive className="h-5 w-5" />} label="Drafts" value={ov?.drafts ?? 0} tone="slate" />
        <StatCard icon={<Inbox className="h-5 w-5" />} label="Unused" value={ov?.unused_questions ?? 0} tone="amber" />
        <StatCard icon={<Activity className="h-5 w-5" />} label="Total Usage" value={ov?.total_usage ?? 0} tone="indigo" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Avg Success" value={`${Math.round(ov?.avg_success_rate ?? 0)}%`} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Usage over time */}
        <Card title="Usage Over Time">
          <OverTimeChart data={data.overTime} />
        </Card>

        {/* Performance by difficulty */}
        <Card title="Performance by Difficulty">
          <DifficultyBars data={data.performance} />
        </Card>

        {/* Most used */}
        <Card title="Most Used Questions">
          <MostUsedList items={data.mostUsed} />
        </Card>

        {/* Unused questions */}
        <Card title="Unused Questions (never used in a test)">
          <UnusedList items={data.unused} />
        </Card>

        {/* By school */}
        <Card title="Usage by School">
          <SchoolBars items={data.schools} />
        </Card>

        {/* By teacher */}
        <Card title="Usage by Teacher">
          <TeacherBars items={data.teachers} />
        </Card>

        {/* By subject */}
        <Card title="Performance by Subject">
          <SubjectBars data={data.performance} />
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-lg font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="text-sm text-slate-600">{subtitle}</p>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        {icon && <span className="text-primary">{icon}</span>}
        {title}
      </h3>
      {children}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: "primary" | "slate" | "emerald" | "amber" | "indigo" | "rose";
}) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary-50 ring-primary/20",
    slate: "text-slate-600 bg-slate-50 ring-slate-200",
    emerald: "text-emerald-600 bg-emerald-50 ring-emerald-200",
    amber: "text-amber-600 bg-amber-50 ring-amber-200",
    indigo: "text-indigo-600 bg-indigo-50 ring-indigo-200",
    rose: "text-rose-600 bg-rose-50 ring-rose-200",
  };
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ${tones[tone]}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white ring-1 ring-current/20">{icon}</span>
        <p className="text-2xl font-bold leading-none">{value}</p>
      </div>
      <p className="mt-2 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

function OverTimeChart({ data }: { data: OverTimeData | null }) {
  const buckets = useMemo(() => data?.daily ?? [], [data]);
  if (!buckets.length) return <EmptyState />;
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="flex h-40 items-end gap-1">
      {buckets.map((b) => (
        <div key={b.key} className="flex flex-1 flex-col items-center gap-1" title={`${b.key}: ${b.count}`}>
          <span className="text-[10px] font-semibold text-slate-500">{b.count}</span>
          <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(4, (b.count / max) * 100)}%` }} />
          <span className="text-[9px] text-slate-400">{b.key.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function DifficultyBars({ data }: { data: PerformanceData | null }) {
  const rows = data?.by_difficulty ?? [];
  if (!rows.length) return <EmptyState />;
  const max = Math.max(...rows.map((r) => r.attempts), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <BarRow key={r.difficulty} label={capitalize(r.difficulty)} value={r.attempts} max={max} sub={`${r.success_rate}% correct`} color="primary" />
      ))}
      {data?.overall && (
        <p className="border-t border-slate-100 pt-3 text-sm text-slate-600">
          Overall: <strong>{data.overall.attempts}</strong> attempts · <strong>{data.overall.success_rate}%</strong> correct
        </p>
      )}
    </div>
  );
}

function SubjectBars({ data }: { data: PerformanceData | null }) {
  const rows = data?.by_subject ?? [];
  if (!rows.length) return <EmptyState />;
  const max = Math.max(...rows.map((r) => r.attempts), 1);
  return (
    <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
      {rows.map((r) => (
        <BarRow key={r.subject_id} label={r.subject_name} value={r.attempts} max={max} sub={`${r.success_rate}% correct`} color="indigo" />
      ))}
    </div>
  );
}

function SchoolBars({ items }: { items: SchoolUsageRow[] }) {
  if (!items.length) return <EmptyState />;
  const max = Math.max(...items.map((i) => i.usage_count), 1);
  return (
    <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
      {items.map((i) => (
        <BarRow
          key={i.school_id}
          label={i.school_name}
          value={i.usage_count}
          max={max}
          sub={i.class_names.length ? i.class_names.join(", ") : undefined}
          color="primary"
        />
      ))}
    </div>
  );
}

function TeacherBars({ items }: { items: TeacherUsageRow[] }) {
  if (!items.length) return <EmptyState />;
  const max = Math.max(...items.map((i) => i.usage_count), 1);
  return (
    <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
      {items.map((i) => (
        <BarRow key={i.teacher_id} label={i.teacher_name} value={i.usage_count} max={max} color="emerald" />
      ))}
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  sub,
  color,
}: {
  label: string;
  value: number;
  max: number;
  sub?: string;
  color: "primary" | "indigo" | "emerald";
}) {
  const colors: Record<string, string> = {
    primary: "bg-primary",
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
  };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="truncate font-medium text-slate-700">{label}</span>
        <span className="text-xs font-semibold text-slate-500">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${colors[color]}`} style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
      </div>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function MostUsedList({ items }: { items: (Question & { usage_count: number })[] }) {
  if (!items.length) return <EmptyState />;
  return (
    <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
      {items.map((q, i) => (
        <li key={q.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-white">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-slate-700">{strip(q.content)}</span>
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-primary ring-1 ring-primary/20">
            {q.usage_count}×
          </span>
        </li>
      ))}
    </ul>
  );
}

function UnusedList({ items }: { items: Question[] }) {
  if (!items.length) return <EmptyState />;
  return (
    <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
      {items.map((q) => (
        <li key={q.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
          <Filter className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-slate-700">{strip(q.content)}</span>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{q.type.replace("_", " ")}</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ label = "No data yet." }: { label?: string }) {
  return <p className="flex items-center gap-2 py-4 text-sm text-slate-400">{label}</p>;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function strip(content: unknown): string {
  const html = typeof content === "string" ? content : (content as { html?: string } | null)?.html ?? "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "Untitled question";
}
