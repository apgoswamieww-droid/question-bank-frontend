import { useCallback, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import type { AdminUser, UserRole } from "../../api/client";
import { ROLE_ORDER } from "./roleMeta";
import { Button } from "./Button";

function validateName(v: string) {
  if (!v.trim()) return "Name is required.";
  if (v.trim().length < 2) return "Name must be at least 2 characters.";
  if (v.trim().length > 120) return "Name is too long.";
  return undefined;
}

function validateEmail(v: string) {
  if (!v.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address.";
  if (v.trim().length > 254) return "Email is too long.";
  return undefined;
}

function validatePassword(v: string, mode: "create" | "edit") {
  if (mode === "edit" && !v) return undefined;
  if (!v) return "Password is required.";
  if (v.length < 8) return "Password must be at least 8 characters.";
  if (v.length > 256) return "Password is too long.";
  return undefined;
}

interface UserFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: AdminUser | null;
  roleDefault?: UserRole;
  onClose: () => void;
  onSubmit: (data: {
    email: string;
    name: string;
    password: string;
    role: UserRole;
    active: boolean;
    phone: string;
    gender: string;
    dateOfBirth: string;
    address: string;
    hireDate: string;
    subject: string;
    qualification: string;
  }) => Promise<void>;
}

export function UserFormModal({ open, mode, initial, roleDefault = "teacher", onClose, onSubmit }: UserFormModalProps) {
  if (!open) return null;
  const id = initial?.id ?? "new";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <Form
        key={`${id}-${mode}`}
        mode={mode}
        initial={initial}
        roleDefault={roleDefault}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </div>
  );
}

interface FormProps {
  mode: "create" | "edit";
  initial?: AdminUser | null;
  roleDefault: UserRole;
  onClose: () => void;
  onSubmit: UserFormModalProps["onSubmit"];
}

function Form({ mode, initial, roleDefault, onClose, onSubmit }: FormProps) {
  const [email, setEmail] = useState(initial?.email ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(initial?.role ?? roleDefault);
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [gender, setGender] = useState(initial?.gender ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(initial?.dateOfBirth ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [hireDate, setHireDate] = useState(initial?.hireDate ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [qualification, setQualification] = useState(initial?.qualification ?? "");
  const [submitting, setSubmitting] = useState(false);

  // Live validation with touched tracking
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = useCallback((field: string) => setTouched((t) => ({ ...t, [field]: true })), []);

  const nameError = touched.name ? validateName(name) : undefined;
  const emailError = touched.email ? validateEmail(email) : undefined;
  const passwordError = touched.password ? validatePassword(password, mode) : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true });
    const nErr = validateName(name);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password, mode);
    if (nErr || eErr || pErr) return;
    setSubmitting(true);
    try {
      await onSubmit({
        email: email.trim(),
        name: name.trim(),
        password,
        role,
        active: true,
        phone: phone.trim(),
        gender: gender.trim(),
        dateOfBirth: dateOfBirth,
        address: address.trim(),
        hireDate: hireDate,
        subject: subject.trim(),
        qualification: qualification.trim(),
      });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (hasError?: boolean | string) =>
    `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-black placeholder:text-slate-400 outline-none transition disabled:bg-slate-100 ${
      hasError
        ? "border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
        : "border-slate-300 focus:border-primary focus:ring-4 focus:ring-primary/15"
    }`;
  const label = "mb-1 block text-sm font-medium text-slate-700";
  const errorText = "mt-1 text-xs font-medium text-red-600";

  return (
    <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          {mode === "create" ? "Add User" : `Edit ${initial?.name ?? "user"}`}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={label}>Full name *</label>
            <input
              className={inputClass(nameError)}
              value={name}
              onChange={(e) => { setName(e.target.value); if (touched.name) touch("name"); }}
              onBlur={() => touch("name")}
              placeholder="e.g. Rajesh Shah"
            />
            {nameError && <p className={errorText}>{nameError}</p>}
          </div>
          <div className="col-span-2">
            <label className={label}>Email *</label>
            <input
              type="email"
              className={inputClass(emailError)}
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (touched.email) touch("email"); }}
              onBlur={() => touch("email")}
              placeholder="user@school.edu"
            />
            {emailError && <p className={errorText}>{emailError}</p>}
          </div>
        </div>

        <div>
          <label className={label}>
            {mode === "create" ? "Password *" : "New password (leave blank to keep)"}
          </label>
          <input
            type="password"
            className={inputClass(passwordError)}
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (touched.password) touch("password"); }}
            onBlur={() => touch("password")}
            placeholder={mode === "create" ? "8+ characters" : "••••••••"}
          />
          {passwordError && <p className={errorText}>{passwordError}</p>}
        </div>

        <div>
          <label className={label}>Role</label>
          <select
            className={inputClass()}
            value={role}
            disabled={mode === "edit"}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {ROLE_ORDER.filter((r) => r !== "super_admin").map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {mode === "edit"
              ? "To change a user's role, use the role dropdown in the user's row."
              : "Super admins are created separately and always have full access."}
          </p>
        </div>

        {role === "teacher" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Registration details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Phone</label>
                <input className={inputClass()} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
              </div>
              <div>
                <label className={label}>Gender</label>
                <select className={inputClass()} value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={label}>Date of birth</label>
                <input type="date" className={inputClass()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <div>
                <label className={label}>Hire date</label>
                <input type="date" className={inputClass()} value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
              </div>
              <div>
                <label className={label}>Subject</label>
                <input className={inputClass()} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" />
              </div>
              <div>
                <label className={label}>Qualification</label>
                <input className={inputClass()} value={qualification} onChange={(e) => setQualification(e.target.value)} placeholder="e.g. M.Sc. Maths" />
              </div>
              <div className="col-span-2">
                <label className={label}>Address</label>
                <input className={inputClass()} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House, street, city" />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {mode === "create" ? "Create user" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
