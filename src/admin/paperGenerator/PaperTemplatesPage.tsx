import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, FilePlus2, LayoutTemplate, Plus, Star, Trash2, X } from "lucide-react";
import {
  api,
  ApiError,
  type PaperTemplate,
  type PaperTemplateConfig,
  type PaperTemplateInput,
  type PaperTemplateKind,
  type PaperTemplateLayoutId,
} from "../../api/client";
import { useCan, PERMISSIONS } from "../../context/useAdminAuth";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TableSkeleton } from "../components/Skeleton";

const KIND_LABELS: Record<PaperTemplateKind, string> = {
  single: "Single language",
  bilingual: "Bilingual",
  custom: "Custom",
};

const PAPER_SIZES = ["A4", "A3", "Letter"] as const;
const LAYOUT_IDS: PaperTemplateLayoutId[] = ["single-column", "bilingual-two-column", "custom"];

interface TemplateDraft {
  name: string;
  description: string;
  kind: PaperTemplateKind;
  isDefault: boolean;
  pagePaperSize: "A4" | "A3" | "Letter";
  pageOrientation: "portrait" | "landscape";
  topMarginMm: number;
  rightMarginMm: number;
  bottomMarginMm: number;
  leftMarginMm: number;
  showPageNumbers: boolean;
  layoutId: PaperTemplateLayoutId;
  columnsGapMm: number;
  baseFontPt: number;
  lineHeight: number;
  gapPx: number;
  optionGapPx: number;
  sectionStyle: NonNullable<PaperTemplateConfig["sections"]>["style"];
  sectionUppercase: boolean;
  instituteName: string;
  examTitle: string;
  showLogo: boolean;
  logoDataUrl: string | null;
  logoWidthPx: number;
  showMeta: boolean;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  batch: string;
  academicYear: string;
  showInstructions: boolean;
}

function draftFromTemplate(template: PaperTemplate | null): TemplateDraft {
  const cfg: PaperTemplateConfig = template?.config ?? {};
  return {
    name: template?.name ?? "",
    description: template?.description ?? "",
    kind: template?.kind ?? "bilingual",
    isDefault: template?.is_default ?? false,
    pagePaperSize: cfg.page?.paperSize ?? "A4",
    pageOrientation: cfg.page?.orientation ?? "portrait",
    topMarginMm: cfg.page?.margins?.top ?? 15,
    rightMarginMm: cfg.page?.margins?.right ?? 15,
    bottomMarginMm: cfg.page?.margins?.bottom ?? 15,
    leftMarginMm: cfg.page?.margins?.left ?? 15,
    showPageNumbers: cfg.page?.showPageNumbers ?? true,
    layoutId: cfg.layout?.id ?? "single-column",
    columnsGapMm: cfg.layout?.columnsGapMm ?? 12,
    baseFontPt: cfg.typography?.baseFontPt ?? 14,
    lineHeight: cfg.typography?.lineHeight ?? 1.6,
    gapPx: cfg.questionSpacing?.gapPx ?? 14,
    optionGapPx: cfg.questionSpacing?.optionGapPx ?? 4,
    sectionStyle: cfg.sections?.style ?? "bordered",
    sectionUppercase: cfg.sections?.uppercase ?? true,
    instituteName: cfg.header?.instituteName ?? "",
    examTitle: cfg.header?.examTitle ?? "",
    showLogo: cfg.header?.showLogo ?? false,
    logoDataUrl: cfg.header?.logoDataUrl ?? null,
    logoWidthPx: cfg.header?.logoWidthPx ?? 90,
    showMeta: cfg.header?.showMeta ?? true,
    footerLeft: cfg.footer?.leftText ?? "",
    footerCenter: cfg.footer?.centerText ?? "",
    footerRight: cfg.footer?.rightText ?? "",
    batch: cfg.branding?.batch ?? "",
    academicYear: cfg.branding?.academicYear ?? "",
    showInstructions: cfg.instructions?.show ?? true,
  };
}

function draftToInput(draft: TemplateDraft): PaperTemplateInput {
  const config: PaperTemplateConfig = {
    page: {
      paperSize: draft.pagePaperSize,
      orientation: draft.pageOrientation,
      margins: {
        top: draft.topMarginMm,
        right: draft.rightMarginMm,
        bottom: draft.bottomMarginMm,
        left: draft.leftMarginMm,
      },
      showPageNumbers: draft.showPageNumbers,
    },
    layout: { id: draft.layoutId, columnsGapMm: draft.columnsGapMm },
    typography: { baseFontPt: draft.baseFontPt, lineHeight: draft.lineHeight },
    header: {
      showLogo: draft.showLogo,
      logoDataUrl: draft.logoDataUrl,
      logoWidthPx: draft.logoWidthPx,
      instituteName: draft.instituteName.trim() || null,
      examTitle: draft.examTitle.trim() || null,
      showMeta: draft.showMeta,
    },
    footer: {
      leftText: draft.footerLeft.trim() || null,
      centerText: draft.footerCenter.trim() || null,
      rightText: draft.footerRight.trim() || null,
    },
    branding: {
      instituteName: draft.instituteName.trim() || null,
      batch: draft.batch.trim() || null,
      academicYear: draft.academicYear.trim() || null,
    },
    instructions: { show: draft.showInstructions },
    questionSpacing: { gapPx: draft.gapPx, optionGapPx: draft.optionGapPx },
    sections: { style: draft.sectionStyle, uppercase: draft.sectionUppercase },
  };
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    kind: draft.kind,
    config,
    is_default: draft.isDefault,
  };
}

export default function PaperTemplatesPage() {
  const can = useCan();
  const [templates, setTemplates] = useState<PaperTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [editing, setEditing] = useState<PaperTemplate | null | "new">(null);
  const [deleting, setDeleting] = useState<PaperTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.templates.list();
      setTemplates(result.templates ?? []);
      setMigrationRequired(false);
    } catch (err) {
      setMigrationRequired(err instanceof ApiError && err.code === "PAPER_TEMPLATE_STORAGE_UNAVAILABLE");
      if (!(err instanceof ApiError && err.code === "PAPER_TEMPLATE_STORAGE_UNAVAILABLE")) {
        toast.error(err instanceof ApiError ? err.message : "Failed to load paper templates.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const setDefault = async (template: PaperTemplate) => {
    try {
      const result = await api.templates.update(template.id, { is_default: true });
      setTemplates((prev) =>
        prev.map((t) => ({ ...t, is_default: t.kind === result.template.kind && t.id !== result.template.id ? false : t.id === result.template.id ? true : t.is_default }))
      );
      toast.success(`“${result.template.name}” is now the default ${KIND_LABELS[result.template.kind].toLowerCase()} template.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to set default template.");
    }
  };

  const duplicate = async (template: PaperTemplate) => {
    try {
      const result = await api.templates.create({
        name: `${template.name} (copy)`,
        description: template.description,
        kind: template.kind,
        config: template.config,
        is_default: false,
      });
      setTemplates((prev) => [result.template, ...prev]);
      toast.success(`Duplicated as “${result.template.name}”.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to duplicate template.");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      await api.templates.delete(target.id);
      setTemplates((prev) => prev.filter((t) => t.id !== target.id));
      toast.success(`Deleted “${target.name}”.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete template.");
    }
  };

  const templatesByKind = useMemo(() => {
    const groups: Record<PaperTemplateKind, PaperTemplate[]> = { single: [], bilingual: [], custom: [] };
    for (const t of templates) {
      if (groups[t.kind]) groups[t.kind].push(t);
      else groups.custom.push(t);
    }
    return groups;
  }, [templates]);

  if (loading) return <TableSkeleton rows={6} cols={3} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper Templates"
        subtitle="Reusable, admin-saved templates that brand and size your printed papers. Templates are optional — papers printed without one always use the built-in safe defaults."
        actions={
          can(PERMISSIONS.PAPERS_TEMPLATES_MANAGE) && (
            <Button onClick={() => setEditing("new")} disabled={migrationRequired}>
              <Plus className="h-4 w-4" aria-hidden /> New template
            </Button>
          )
        }
      />

      {migrationRequired && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Paper template storage is not active yet — apply backend/migrations/011_paper_templates.sql in the Supabase
          SQL editor.
        </div>
      )}

      {templates.length === 0 && !migrationRequired ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <LayoutTemplate className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-700">No paper templates saved yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Create one to reuse page size, margins, branding (logo, institute, batch, academic year), typography,
            question spacing and section styling across your language papers.
          </p>
          <div className="mt-4 flex justify-center">
            {can(PERMISSIONS.PAPERS_TEMPLATES_MANAGE) && (
              <Button onClick={() => setEditing("new")}>
                <FilePlus2 className="h-4 w-4" aria-hidden /> Create the first template
              </Button>
            )}
          </div>
        </div>
      ) : (
        (["single", "bilingual", "custom"] as PaperTemplateKind[]).map((kind) => {
          const items = templatesByKind[kind];
          if (items.length === 0) return null;
          return (
            <section key={kind} className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">{KIND_LABELS[kind]} templates</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    canManage={can(PERMISSIONS.PAPERS_TEMPLATES_MANAGE)}
                    onEdit={() => setEditing(t)}
                    onDelete={() => setDeleting(t)}
                    onSetDefault={() => setDefault(t)}
                    onDuplicate={() => duplicate(t)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {editing && (
        <PaperTemplateFormModal
          template={editing === "new" ? null : editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            setSaving(true);
            try {
              if (editing === "new") {
                const result = await api.templates.create(input);
                setTemplates((prev) => [result.template, ...prev]);
                toast.success(`Template “${result.template.name}” created.`);
              } else {
                const result = await api.templates.update(editing.id, input);
                setTemplates((prev) => prev.map((t) => (t.id === result.template.id ? result.template : t)));
                toast.success(`Template “${result.template.name}” updated.`);
              }
              setEditing(null);
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : "Failed to save template.");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete template?"
        message={`“${deleting?.name ?? ""}” will be removed. Papers already printed are not affected and future prints simply fall back to built-in defaults.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function TemplateCard({
  template,
  canManage,
  onEdit,
  onDelete,
  onSetDefault,
  onDuplicate,
}: {
  template: PaperTemplate;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onDuplicate: () => void;
}) {
  const cfg = template.config ?? {};
  const pageLabel = [cfg.page?.paperSize ?? "A4", cfg.page?.orientation ?? "portrait"].join(" · ");
  const layoutLabel = cfg.layout?.id ?? "single-column";
  const institute = cfg.header?.instituteName ?? cfg.branding?.instituteName ?? null;

  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900">
          <LayoutTemplate className="h-5 w-5 text-white" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">{template.name}</h3>
            {template.is_default && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                <Star className="h-3 w-3" aria-hidden /> Default
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{template.description || "No description."}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{pageLabel}</span>
        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{layoutLabel}</span>
        {institute && <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{institute}</span>}
        {cfg.header?.showLogo && (
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">logo</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
        {canManage && (
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Edit
          </Button>
        )}
        {canManage && (
          <Button variant="ghost" size="sm" onClick={onDuplicate} aria-label="Duplicate template">
            <Copy className="h-3.5 w-3.5" aria-hidden />
          </Button>
        )}
        {canManage && (
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete template">
            <Trash2 className="h-3.5 w-3.5 text-red-600" aria-hidden />
          </Button>
        )}
        {canManage && !template.is_default && (
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={onSetDefault} aria-label="Set as the default template for this kind">
              <Star className="h-3.5 w-3.5" aria-hidden /> Set default
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PaperTemplateFormModal({
  template,
  saving,
  onClose,
  onSave,
}: {
  template: PaperTemplate | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: PaperTemplateInput) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<TemplateDraft>(() => draftFromTemplate(template));
  const set = <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const onLogoFile = (file: File | null) => {
    if (!file) {
      setDraft((d) => ({ ...d, logoDataUrl: null, showLogo: false }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      setDraft((d) => ({ ...d, logoDataUrl: dataUrl, showLogo: Boolean(dataUrl) }));
    };
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Template name is required.");
      return;
    }
    void onSave(draftToInput(draft));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{template ? `Edit “${template.name}”` : "New template"}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Everything is optional and safe — unset fields use the built-in defaults at print time.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Basics">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label="Name *" value={draft.name} onChange={(v) => set("name", v)} placeholder="e.g. GSEB Bilingual Standard Paper" />
              <SelectInput
                label="Kind"
                value={draft.kind}
                options={(["single", "bilingual", "custom"] as PaperTemplateKind[]).map((k) => ({ value: k, label: KIND_LABELS[k] }))}
                onChange={(v) => set("kind", v as PaperTemplateKind)}
              />
              <TextInput label="Description" value={draft.description} onChange={(v) => set("description", v)} placeholder="Optional note for other admins" />
              <CheckboxRow label="Set as the default template for its kind" checked={draft.isDefault} onChange={(v) => set("isDefault", v)} />
            </div>
          </Field>

          <Field label="Page">
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectInput
                label="Paper size"
                value={draft.pagePaperSize}
                options={PAPER_SIZES.map((s) => ({ value: s, label: s }))}
                onChange={(v) => set("pagePaperSize", v as TemplateDraft["pagePaperSize"])}
              />
              <SelectInput
                label="Orientation"
                value={draft.pageOrientation}
                options={[
                  { value: "portrait", label: "Portrait" },
                  { value: "landscape", label: "Landscape" },
                ]}
                onChange={(v) => set("pageOrientation", v as TemplateDraft["pageOrientation"])}
              />
              <NumberInput label="Column gap (mm)" value={draft.columnsGapMm} onChange={(v) => set("columnsGapMm", v)} min={0} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <NumberInput label="Top margin (mm)" value={draft.topMarginMm} onChange={(v) => set("topMarginMm", v)} min={0} />
              <NumberInput label="Right margin (mm)" value={draft.rightMarginMm} onChange={(v) => set("rightMarginMm", v)} min={0} />
              <NumberInput label="Bottom margin (mm)" value={draft.bottomMarginMm} onChange={(v) => set("bottomMarginMm", v)} min={0} />
              <NumberInput label="Left margin (mm)" value={draft.leftMarginMm} onChange={(v) => set("leftMarginMm", v)} min={0} />
            </div>
            <CheckboxRow label="Show page numbers in the footer" checked={draft.showPageNumbers} onChange={(v) => set("showPageNumbers", v)} wrapClass="mt-3" />
          </Field>

          <Field label="Layout">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectInput
                label="Print layout"
                value={draft.layoutId}
                options={LAYOUT_IDS.map((id) => ({ value: id, label: id }))}
                onChange={(v) => set("layoutId", v as TemplateDraft["layoutId"])}
              />
            </div>
          </Field>

          <Field label="Typography & spacing">
            <div className="grid gap-3 sm:grid-cols-4">
              <NumberInput label="Base font (pt)" value={draft.baseFontPt} onChange={(v) => set("baseFontPt", v)} min={8} max={24} />
              <NumberInput label="Line height" value={draft.lineHeight} onChange={(v) => set("lineHeight", v)} min={1} max={3} step={0.1} />
              <NumberInput label="Question gap (px)" value={draft.gapPx} onChange={(v) => set("gapPx", v)} min={0} />
              <NumberInput label="Option gap (px)" value={draft.optionGapPx} onChange={(v) => set("optionGapPx", v)} min={0} />
            </div>
          </Field>

          <Field label="Section styling">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectInput
                label="Style"
                value={draft.sectionStyle}
                options={(["bordered", "minimal", "text"] as const).map((s) => ({ value: s, label: s }))}
                onChange={(v) => set("sectionStyle", v as TemplateDraft["sectionStyle"])}
              />
              <CheckboxRow label="Uppercase section headings" checked={draft.sectionUppercase} onChange={(v) => set("sectionUppercase", v)} wrapClass="sm:pt-6" />
            </div>
          </Field>

          <Field label="Branding & header">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label="Institute name" value={draft.instituteName} onChange={(v) => set("instituteName", v)} placeholder="e.g. Saraswati Vidyalaya, Ahmedabad" />
              <TextInput label="Exam title" value={draft.examTitle} onChange={(v) => set("examTitle", v)} placeholder="Overrides the paper title when set" />
              <TextInput label="Batch" value={draft.batch} onChange={(v) => set("batch", v)} placeholder="e.g. 2025-26" />
              <TextInput label="Academic year" value={draft.academicYear} onChange={(v) => set("academicYear", v)} placeholder="e.g. 2026" />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600">Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
                  className="mt-1.5 block w-64 text-xs text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>
              {draft.logoDataUrl && (
                <div className="flex items-center gap-3">
                  <img src={draft.logoDataUrl} alt="Logo preview" className="h-14 w-auto rounded-lg border border-slate-200 object-contain" />
                  <NumberInput label="Logo width (px)" value={draft.logoWidthPx} onChange={(v) => set("logoWidthPx", v)} min={20} max={400} />
                  <Button variant="ghost" size="sm" onClick={() => onLogoFile(null)}>
                    Remove
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-3 space-y-2">
              <CheckboxRow label="Show subject / time / marks meta row in the header" checked={draft.showMeta} onChange={(v) => set("showMeta", v)} />
              <CheckboxRow label="Show the general instructions box" checked={draft.showInstructions} onChange={(v) => set("showInstructions", v)} />
            </div>
          </Field>

          <Field label="Footer">
            <div className="grid gap-3 sm:grid-cols-3">
              <TextInput label="Left text" value={draft.footerLeft} onChange={(v) => set("footerLeft", v)} placeholder="Defaults to the paper title" />
              <TextInput label="Center text" value={draft.footerCenter} onChange={(v) => set("footerCenter", v)} placeholder="Optional" />
              <TextInput label="Right text" value={draft.footerRight} onChange={(v) => set("footerRight", v)} placeholder="Defaults to page numbers" />
            </div>
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {template ? "Save changes" : "Create template"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
  wrapClass,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  wrapClass?: string;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 text-sm text-slate-700 ${wrapClass ?? ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300"
      />
      {label}
    </label>
  );
}