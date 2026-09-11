import { useCallback, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

function validateEmail(v: string) {
  if (!v.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address.";
  if (v.trim().length > 254) return "Email is too long.";
  return undefined;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = useCallback((field: string) => setTouched((t) => ({ ...t, [field]: true })), []);

  const emailError = touched.email ? validateEmail(email) : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true });
    const eErr = validateEmail(email);
    if (eErr) return;
    setSubmitting(true);
    try {
      await api.forgotPassword(email.trim());
      // Always show success to prevent user enumeration
      toast.success("Reset link sent!", {
        description: `If an account exists for ${email.trim()}, we've sent a password reset link. Check your inbox and spam folder.`,
        duration: 8000,
      });
    } catch {
      // Even on error, show success to prevent user enumeration
      toast.success("Reset link sent!", {
        description: `If an account exists for ${email.trim()}, we've sent a password reset link. Check your inbox and spam folder.`,
        duration: 8000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (hasError?: boolean | string) =>
    `w-full rounded-xl border bg-white py-3 text-sm text-black placeholder:text-slate-400 outline-none transition disabled:bg-slate-100 disabled:cursor-not-allowed ${
      hasError
        ? "border-red-400 px-10 focus:border-red-500 focus:ring-4 focus:ring-red-100"
        : "border-slate-300 px-10 focus:border-primary focus:ring-4 focus:ring-primary/15"
    }`;

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-100 px-4 py-10 font-sans sm:px-6">
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-primary/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-40 h-[34rem] w-[34rem] rounded-full bg-primary/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30 ring-1 ring-primary/20">
            <ShieldCheck className="h-8 w-8 text-white" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
            Forgot Password?
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/80 sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-slate-800">
                Email address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" aria-hidden />
                </div>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  inputMode="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (touched.email) touch("email"); }}
                  onBlur={() => touch("email")}
                  placeholder="you@example.com"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "forgot-email-error" : undefined}
                  className={inputClass(emailError)}
                  disabled={submitting}
                />
              </div>
              {emailError && (
                <p id="forgot-email-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                  {emailError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-primary-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending reset link…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 transition-transform group-hover:scale-110" aria-hidden />
                  Send Reset Link
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-primary"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Sign In
                </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
          <Mail className="mr-1 inline h-3.5 w-3.5 align-text-top" aria-hidden />
          We'll send a reset link if the email is associated with an account.
        </p>
      </div>
    </div>
  );
}
