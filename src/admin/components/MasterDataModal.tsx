import { useState, useEffect, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

export interface MasterField {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "color" | "multiselect";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  colSpan?: number;
  /** For multiselect: default selected values when creating a new record. */
  defaultValue?: string[];
}

interface MasterDataModalProps {
  open: boolean;
  title: string;
  fields: MasterField[];
  initial?: object | null;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}

export function MasterDataModal({
  open,
  title,
  fields,
  initial,
  onClose,
  onSubmit,
}: MasterDataModalProps) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const init = initial as Record<string, unknown> | null;
      const defaults: Record<string, unknown> = {};
      for (const f of fields) {
        defaults[f.key] =
          init?.[f.key] ??
          (f.type === "multiselect" ? (f.defaultValue ?? []) : f.type === "number" ? 0 : "");
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(defaults);
      setErrors({});
      setServerError(null);
    }
  }, [open, initial, fields]);

  if (!open) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    for (const f of fields) {
      if (f.required) {
        const val = form[f.key];
        const empty =
          f.type === "multiselect"
            ? !Array.isArray(val) || val.length === 0
            : val === undefined || val === null || val === "";
        if (empty) {
          errs[f.key] = `${f.label} is required.`;
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong.");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
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
          {serverError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className={f.colSpan === 2 ? "col-span-2" : ""}>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                {f.type === "multiselect" ? (
                  <div
                    className={`max-h-44 overflow-y-auto rounded-xl border bg-white p-2 ${
                      errors[f.key]
                        ? "border-red-400"
                        : "border-slate-300 focus-within:border-primary"
                    }`}
                  >
                    {(f.options ?? []).length === 0 && (
                      <p className="px-1 py-1 text-xs text-slate-400">No options available</p>
                    )}
                    {(f.options ?? []).map((o) => {
                      const selected = Array.isArray(form[f.key])
                        ? (form[f.key] as string[]).includes(o.value)
                        : false;
                      return (
                        <label
                          key={o.value}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--color-primary,theme(colors.blue.600))]"
                            checked={selected}
                            onChange={(e) =>
                              setForm((p) => {
                                const cur = Array.isArray(p[f.key]) ? (p[f.key] as string[]) : [];
                                return {
                                  ...p,
                                  [f.key]: e.target.checked
                                    ? [...cur, o.value]
                                    : cur.filter((v) => v !== o.value),
                                };
                              })
                            }
                          />
                          <span className="truncate">{o.label}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : f.type === "select" ? (
                  <select
                    className={inputClass(Boolean(errors[f.key]))}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    className={inputClass(Boolean(errors[f.key]))}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    rows={3}
                  />
                ) : f.type === "color" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-10 w-10 rounded-lg border border-slate-300 cursor-pointer"
                      value={String(form[f.key] ?? "#3B82F6")}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                    <input
                      type="text"
                      className={inputClass(Boolean(errors[f.key]))}
                      value={String(form[f.key] ?? "")}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder="#3B82F6"
                    />
                  </div>
                ) : (
                  <input
                    type={f.type ?? "text"}
                    className={inputClass(Boolean(errors[f.key]))}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                    placeholder={f.placeholder}
                  />
                )}
                {errors[f.key] && (
                  <p className="mt-1 text-xs font-medium text-red-600">{errors[f.key]}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {initial ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
