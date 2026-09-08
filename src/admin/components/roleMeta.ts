import type { UserRole } from "../../api/client";

export const SYSTEM_ROLES: string[] = ["super_admin", "teacher", "student", "parent"];

export const ROLE_META: Record<string, { label: string; color: string; chip: string }> = {
  super_admin: {
    label: "Super Admin",
    color: "bg-primary/10 text-primary ring-primary/30",
    chip: "bg-primary text-white",
  },
  teacher: {
    label: "Teacher",
    color: "bg-sky-500/10 text-sky-700 ring-sky-500/30",
    chip: "bg-sky-600 text-white",
  },
  student: {
    label: "Student",
    color: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30",
    chip: "bg-emerald-600 text-white",
  },
  parent: {
    label: "Parent",
    color: "bg-amber-500/10 text-amber-700 ring-amber-500/30",
    chip: "bg-amber-600 text-white",
  },
};

export const ROLE_ORDER: UserRole[] = ["super_admin", "teacher", "student", "parent"];

const CUSTOM_COLOR_PALETTES = [
  { color: "bg-purple-500/10 text-purple-700 ring-purple-500/30", chip: "bg-purple-600 text-white" },
  { color: "bg-rose-500/10 text-rose-700 ring-rose-500/30", chip: "bg-rose-600 text-white" },
  { color: "bg-teal-500/10 text-teal-700 ring-teal-500/30", chip: "bg-teal-600 text-white" },
  { color: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/30", chip: "bg-indigo-600 text-white" },
  { color: "bg-orange-500/10 text-orange-700 ring-orange-500/30", chip: "bg-orange-600 text-white" },
];

export function getRoleMeta(code: string, fallbackName?: string): { label: string; color: string; chip: string } {
  if (ROLE_META[code]) {
    return ROLE_META[code];
  }
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash << 5) - hash + code.charCodeAt(i);
  const palette = CUSTOM_COLOR_PALETTES[Math.abs(hash) % CUSTOM_COLOR_PALETTES.length];
  const label = fallbackName || code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    label,
    ...palette,
  };
}
