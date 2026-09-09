import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2, Mail, Lock, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../context/useAdminAuth";
import { ApiError } from "../api/client";

interface LocationState {
  from?: string;
}

function validateEmail(v: string) {
  if (!v.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address.";
  if (v.trim().length > 254) return "Email is too long.";
  return undefined;
}

function validatePassword(v: string) {
  if (!v) return "Password is required.";
  if (v.length > 256) return "Password is too long.";
  return undefined;
}

export default function AdminLoginPage() {
  const { user, isBootstrapping, login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const from = (location.state as LocationState | null)?.from ?? "/admin/dashboard";
  const resetSuccess = searchParams.get("reset") === "success";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Live validation with touched tracking
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = useCallback((field: string) => setTouched((t) => ({ ...t, [field]: true })), []);

  const emailError = touched.email ? validateEmail(email) : undefined;
  const passwordError = touched.password ? validatePassword(password) : undefined;

  // Clear the reset=success param after showing the toast
  useEffect(() => {
    if (resetSuccess) {
      toast.success("Password reset successfully!", {
        description: "You can now sign in with your new password.",
        duration: 5000,
      });
      const timer = window.setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 5000);
      return () => window.clearTimeout(timer);
    }
  }, [resetSuccess, setSearchParams]);

  useEffect(() => {
    if (isBootstrapping) return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, [isBootstrapping]);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    // Mark all as touched
    setTouched({ email: true, password: true });
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    if (eErr || pErr) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password, remember);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (hasError?: boolean) =>
    `w-full rounded-xl border bg-white py-3 text-sm text-black placeholder:text-slate-400 outline-none transition disabled:bg-slate-100 disabled:cursor-not-allowed autofill:shadow-[inset_0_0_0_1000px_#fff] ${
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
            Question Bank Admin
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to the admin panel
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/80 sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            <div>
              <label htmlFor="admin-email" className="mb-1.5 block text-sm font-medium text-slate-800">
                Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" aria-hidden />
                </div>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  inputMode="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (touched.email) touch("email"); }}
                  onBlur={() => touch("email")}
                  placeholder="admin@example.com"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "email-error" : undefined}
                  className={inputClass(emailError)}
                  disabled={submitting}
                />
              </div>
              {emailError && (
                <p id="email-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="admin-password" className="block text-sm font-medium text-slate-800">
                  Password
                </label>
                <Link
                  to="/admin/forgot-password"
                  className="text-xs font-medium text-primary transition hover:text-primary-600"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" aria-hidden />
                </div>
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (touched.password) touch("password"); }}
                  onBlur={() => touch("password")}
                  placeholder="••••••••"
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={passwordError ? "password-error" : undefined}
                  className={`${inputClass(passwordError)} pr-11`}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-slate-700 focus:outline-none focus-visible:text-primary"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                </button>
              </div>
              {passwordError && (
                <p id="password-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                  {passwordError}
                </p>
              )}
            </div>

            <label className="flex cursor-pointer select-none items-center gap-2.5">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 bg-white text-primary accent-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-700">Keep me signed in on this device</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-primary-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4 transition-transform group-hover:scale-110" aria-hidden />
                  Sign in
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
          <Mail className="mr-1 inline h-3.5 w-3.5 align-text-top" aria-hidden />
          Authorized personnel only. All sign-in attempts are monitored.
        </p>
      </div>
    </div>
  );
}
