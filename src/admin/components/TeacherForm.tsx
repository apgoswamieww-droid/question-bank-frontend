import { useState, useCallback, type FormEvent } from "react";
import type { AdminUser } from "../../api/client";
import { Button } from "./Button";

interface TeacherFormProps {
  mode: "create" | "edit";
  initial?: AdminUser | null;
  submitting?: boolean;
  onSubmit: (data: {
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
  }) => void;
}

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
};

function validateName(v: string) {
  if (!v.trim()) return "Full name is required.";
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
  if (mode === "edit" && !v) return undefined; // blank = keep current
  if (!v) return "Password is required.";
  if (v.length < 8) return "Password must be at least 8 characters.";
  if (v.length > 256) return "Password is too long.";
  return undefined;
}

function validatePhone(v: string) {
  if (!v.trim()) return undefined; // optional
  if (v.trim().length > 30) return "Phone number is too long.";
  if (!/^[+\d\s()-]+$/.test(v.trim())) return "Enter a valid phone number.";
  return undefined;
}

export function TeacherForm({ mode, initial, submitting, onSubmit }: TeacherFormProps) {
  const [email, setEmail] = useState(initial?.email ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [gender, setGender] = useState(initial?.gender ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(initial?.dateOfBirth ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [hireDate, setHireDate] = useState(initial?.hireDate ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [qualification, setQualification] = useState(initial?.qualification ?? "");

  // Track which fields the user has interacted with
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = useCallback((field: string) => setTouched((t) => ({ ...t, [field]: true })), []);

  // Live errors — only show for touched fields
  const fieldErrors: FieldErrors = {
    ...(touched.name ? { name: validateName(name) } : {}),
    ...(touched.email ? { email: validateEmail(email) } : {}),
    ...(touched.password ? { password: validatePassword(password, mode) } : {}),
    ...(touched.phone ? { phone: validatePhone(phone) } : {}),
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Mark all required fields as touched to show errors
    setTouched({ name: true, email: true, password: true, phone: true });
    // Re-validate after marking touched
    const nameErr = validateName(name);
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password, mode);
    if (nameErr || emailErr || passErr) return;
    onSubmit({
      email: email.trim(),
      name: name.trim(),
      password,
      phone: phone.trim(),
      gender: gender.trim(),
      dateOfBirth,
      address: address.trim(),
      hireDate,
      subject: subject.trim(),
      qualification: qualification.trim(),
    });
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Full name *</label>
          <input
            className={inputClass(fieldErrors.name)}
            value={name}
            onChange={(e) => { setName(e.target.value); if (touched.name) touch("name"); }}
            onBlur={() => touch("name")}
            placeholder="e.g. Rajesh Shah"
            autoFocus
          />
          {fieldErrors.name && <p className={errorText}>{fieldErrors.name}</p>}
        </div>
        <div>
          <label className={label}>Email *</label>
          <input
            type="email"
            className={inputClass(fieldErrors.email)}
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (touched.email) touch("email"); }}
            onBlur={() => touch("email")}
            placeholder="teacher@school.edu"
          />
          {fieldErrors.email && <p className={errorText}>{fieldErrors.email}</p>}
        </div>
        <div>
          <label className={label}>{mode === "create" ? "Password *" : "New password (leave blank to keep)"}</label>
          <input
            type="password"
            className={inputClass(fieldErrors.password)}
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (touched.password) touch("password"); }}
            onBlur={() => touch("password")}
            placeholder={mode === "create" ? "8+ characters" : "••••••••"}
          />
          {fieldErrors.password && <p className={errorText}>{fieldErrors.password}</p>}
        </div>
        <div>
          <label className={label}>Phone</label>
          <input
            className={inputClass(fieldErrors.phone)}
            value={phone}
            onChange={(e) => { setPhone(e.target.value); if (touched.phone) touch("phone"); }}
            onBlur={() => touch("phone")}
            placeholder="98765 43210"
          />
          {fieldErrors.phone && <p className={errorText}>{fieldErrors.phone}</p>}
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
        <div className="sm:col-span-2">
          <label className={label}>Address</label>
          <input className={inputClass()} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House, street, city" />
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === "create" ? "Register teacher" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
