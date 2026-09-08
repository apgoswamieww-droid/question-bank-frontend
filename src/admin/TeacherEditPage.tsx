import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Mail, Pencil, UserRound } from "lucide-react";
import { api, ApiError, type AdminUser } from "../api/client";
import { useAdminAuth } from "../context/useAdminAuth";
import { TeacherForm } from "./components/TeacherForm";
import { Button } from "./components/Button";
import { FormSkeleton } from "./components/Skeleton";

export default function TeacherEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAdminAuth();
  const [teacher, setTeacher] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const created = (location.state as { created?: boolean } | null)?.created;
  const emailStatus = (location.state as { emailStatus?: { ok: boolean; error?: string } | null } | null)?.emailStatus;

  useEffect(() => {
    let active = true;
    api.admin
      .listUsers()
      .then((res) => {
        const found = res.users.find((u) => u.id === id);
        if (active) {
          if (found && found.role === "teacher") {
            setTeacher(found);
          } else {
            setError(found ? "This user is not a teacher." : "Teacher not found.");
          }
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : "Failed to load teacher.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const handleSubmit = async (data: {
    email: string;
    name: string;
    password: string;
    phone: string;
    gender: string;
    dateOfBirth: string;
    address: string;
    hireDate: string;
    subject: string;
    qualification: string;
  }) => {
    if (!teacher) return;
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api.admin.updateUser(teacher.id, {
        name: data.name,
        email: data.email,
        password: data.password || undefined,
        phone: data.phone || undefined,
        gender: data.gender || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        address: data.address || undefined,
        hireDate: data.hireDate || undefined,
        subject: data.subject || undefined,
        qualification: data.qualification || undefined,
      });
      setTeacher(res.user);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save changes.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-9 w-36 rounded-xl bg-slate-100 animate-pulse" />
        </div>
        <FormSkeleton />
      </div>
    );
  }

  if (error && !teacher) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate("/admin/teachers")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Teachers
        </button>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/admin/teachers")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Teachers
        </button>
              </div>

      {(created || emailStatus) && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <div className="text-sm text-emerald-800">
            <p className="font-semibold">Teacher registered successfully.</p>
            {emailStatus && !emailStatus.ok && (
              <p className="mt-1 flex items-center gap-1.5 text-red-700">
                <Mail className="h-4 w-4" aria-hidden /> Email not sent: {emailStatus.error}
              </p>
            )}
            {emailStatus?.ok && (
              <p className="mt-1 flex items-center gap-1.5">
                <Mail className="h-4 w-4" aria-hidden /> Welcome email dispatched to {teacher?.email}
              </p>
            )}
          </div>
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Changes saved.
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
          <Pencil className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Edit Teacher</h1>
          <p className="text-sm text-slate-600">{teacher?.name} · {teacher?.email}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <UserRound className="h-4 w-4 text-primary" aria-hidden /> Teacher details
          </div>
        </div>
        <div className="p-6">
          {teacher ? (
            <TeacherForm mode="edit" initial={teacher} submitting={submitting} error={error} onSubmit={handleSubmit} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
