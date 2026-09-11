import { useCallback, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";

function validatePassword(v: string) {
  if (!v) return "Password is required.";
  if (v.length < 8) return "Password must be at least 8 characters.";
  if (v.length > 256) return "Password is too long.";
  return undefined;
}

function validateConfirm(v: string, password: string) {
  if (!v) return "Please confirm your password.";
  if (v !== password) return "Passwords do not match.";
  return undefined;
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = useCallback((field: string) => setTouched((t) => ({ ...t, [field]: true })), []);

  const passwordError = touched.password ? validatePassword(password) : undefined;
  const confirmError = touched.confirm ? validateConfirm(confirmPassword, password) : undefined;

  if (!token) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-100 px-4 py-10 font-sans">
        <div className="relative w-full max-w-md text-center">
          <div className="mb-4 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-red-100">
            <TriangleAlert className="h-8 w-8 text-red-500" aria-hidden />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Invalid Link</h1>
          <p className="mt-2 text-sm text-slate-600">
            This password reset link is invalid or missing a token. Please request a new one.
          </p>
          <Link
            to="/admin"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-primary-600"
          >
            <KeyRound className="h-4 w-4" aria-hidden /> Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ password: true, confirm: true });
    const pErr = validatePassword(password);
    const cErr = validateConfirm(confirmPassword, password);
    if (pErr || cErr) return;
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      toast.success("Password reset successfully!");
      // Redirect to login with success message
      navigate("/admin?reset=success", { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to reset password. The link may have expired.");
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
            Reset Your Password
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter a new password for your Question Bank account
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/80 sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="reset-password" className="mb-1.5 block text-sm font-medium text-slate-800">
                New Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <KeyRound className="h-4 w-4" aria-hidden />
                </div>
                <input
                  id="reset-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (touched.password) touch("password"); }}
                  onBlur={() => touch("password")}
                  placeholder="8+ characters"
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={passwordError ? "reset-password-error" : undefined}
                  className={`${inputClass(passwordError)} pr-11`}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                </button>
              </div>
              {passwordError && (
                <p id="reset-password-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                  {passwordError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="reset-confirm" className="mb-1.5 block text-sm font-medium text-slate-800">
                Confirm Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <KeyRound className="h-4 w-4" aria-hidden />
                </div>
                <input
                  id="reset-confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); if (touched.confirm) touch("confirm"); }}
                  onBlur={() => touch("confirm")}
                  placeholder="Repeat your new password"
                  aria-invalid={Boolean(confirmError)}
                  aria-describedby={confirmError ? "reset-confirm-error" : undefined}
                  className={inputClass(confirmError)}
                  disabled={submitting}
                />
              </div>
              {confirmError && (
                <p id="reset-confirm-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                  {confirmError}
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
                  Resetting…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4 transition-transform group-hover:scale-110" aria-hidden />
                  Reset Password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
