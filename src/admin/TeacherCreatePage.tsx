import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, UserRound } from "lucide-react";
import { api, ApiError } from "../api/client";
import { TeacherForm } from "./components/TeacherForm";

export default function TeacherCreatePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      const res = await api.admin.createUser({
        ...data,
        role: "teacher",
        active: true,
      });
      navigate(`/admin/teachers/${res.user.id}/edit`, {
        state: { created: true, emailStatus: res.email },
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to register teacher.");
      setSubmitting(false);
    }
  };

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

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
          <UserRound className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Register New Teacher</h1>
          <p className="text-sm text-slate-600">Create a teacher account. Login credentials are emailed automatically.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Teacher details</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Fill in the registration details below.
          </p>
        </div>
        <div className="p-6">
          <TeacherForm mode="create" submitting={submitting} onSubmit={handleSubmit} />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
        <p className="text-sm text-emerald-800">
          On registration, the teacher receives a welcome email with a secure link to set their own
          password. No password is sent — they choose it themselves via the email link.
        </p>
      </div>
    </div>
  );
}
