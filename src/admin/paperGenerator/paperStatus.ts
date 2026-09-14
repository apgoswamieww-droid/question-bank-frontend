import type { PaperStatus } from "../../api/client";

export const paperStatusStyles: Record<
  PaperStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  validated: {
    label: "Validated",
    className: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  },
  published: {
    label: "Published",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  archived: {
    label: "Archived",
    className: "bg-slate-100 text-slate-500 ring-slate-200",
  },
};

export const paperStatusOptions: { value: PaperStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "validated", label: "Validated" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];
