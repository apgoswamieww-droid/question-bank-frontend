import type { CSSProperties } from "react";
import type { PaperTemplate, PaperTemplateConfig, PaperTemplateLayoutId } from "../../api/client";
import type { PrintSettings } from "../types";

/**
 * Single interpretation layer for Paper Template (Phase 11) config blobs.
 *
 * A template config is free-form JSON; this module is the ONLY place that turns
 * it into concrete page/layout/typography/branding values used by the print
 * engine. Every field has a safe default, so a paper printed WITHOUT a template
 * renders exactly like the classic built-in A4 output — no branding is ever
 * hard-coded further down in the PDF generator.
 */

export type PaperSize = Exclude<NonNullable<PaperTemplateConfig["page"]>["paperSize"], undefined>;

export const PAPER_SIZES_MM: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  Letter: { width: 216, height: 279 },
};

export function pageDimensionsMm(paperSize: PaperSize | undefined, orientation?: string): { width: number; height: number } {
  const dim = PAPER_SIZES_MM[paperSize ?? "A4"] ?? PAPER_SIZES_MM.A4;
  const landscape = orientation === "landscape";
  return landscape ? { width: dim.height, height: dim.width } : { width: dim.width, height: dim.height };
}

export interface ResolvedPaperTemplate {
  page: {
    paperSize: "A4" | "A3" | "Letter";
    orientation: "portrait" | "landscape";
    margins: { top: number; right: number; bottom: number; left: number };
    showPageNumbers: boolean;
    widthMm: number;
    heightMm: number;
  };
  layout: { id: PaperTemplateLayoutId; columnsGapMm: number };
  typography: { baseFontPt: number; lineHeight: number };
  header: {
    showLogo: boolean;
    logoDataUrl: string | null;
    logoWidthPx: number;
    instituteName: string | null;
    examTitle: string | null;
    showMeta: boolean;
  };
  footer: { leftText: string | null; centerText: string | null; rightText: string | null };
  branding: { instituteName: string | null; batch: string | null; academicYear: string | null };
  instructions: { show: boolean; left: string[] | null; right: string[] | null };
  questionSpacing: { gapPx: number; optionGapPx: number };
  sections: { style: "bordered" | "minimal" | "text"; uppercase: boolean };
}

export function resolveTemplate(template: PaperTemplate | null | undefined): ResolvedPaperTemplate {
  const cfg: PaperTemplateConfig = template?.config ?? {};
  const paperSize = cfg.page?.paperSize ?? "A4";
  const orientation = cfg.page?.orientation ?? "portrait";
  const dims = pageDimensionsMm(paperSize, orientation);
  return {
    page: {
      paperSize,
      orientation,
      margins: {
        top: cfg.page?.margins?.top ?? 15,
        right: cfg.page?.margins?.right ?? 15,
        bottom: cfg.page?.margins?.bottom ?? 15,
        left: cfg.page?.margins?.left ?? 15,
      },
      showPageNumbers: cfg.page?.showPageNumbers ?? true,
      widthMm: dims.width,
      heightMm: dims.height,
    },
    layout: { id: cfg.layout?.id ?? "single-column", columnsGapMm: cfg.layout?.columnsGapMm ?? 12 },
    typography: { baseFontPt: cfg.typography?.baseFontPt ?? 14, lineHeight: cfg.typography?.lineHeight ?? 1.6 },
    header: {
      showLogo: cfg.header?.showLogo ?? false,
      logoDataUrl: cfg.header?.logoDataUrl ?? null,
      logoWidthPx: cfg.header?.logoWidthPx ?? 90,
      instituteName: cfg.header?.instituteName ?? null,
      examTitle: cfg.header?.examTitle ?? null,
      showMeta: cfg.header?.showMeta ?? true,
    },
    footer: { leftText: cfg.footer?.leftText ?? null, centerText: cfg.footer?.centerText ?? null, rightText: cfg.footer?.rightText ?? null },
    branding: {
      instituteName: cfg.branding?.instituteName ?? null,
      batch: cfg.branding?.batch ?? null,
      academicYear: cfg.branding?.academicYear ?? null,
    },
    instructions: { show: cfg.instructions?.show ?? true, left: cfg.instructions?.left ?? null, right: cfg.instructions?.right ?? null },
    questionSpacing: { gapPx: cfg.questionSpacing?.gapPx ?? 14, optionGapPx: cfg.questionSpacing?.optionGapPx ?? 4 },
    sections: { style: cfg.sections?.style ?? "bordered", uppercase: cfg.sections?.uppercase ?? true },
  };
}

/** CSS custom properties applied on the printable container (inherited by every page block). */
export function templateCssVars(resolved: ResolvedPaperTemplate): CSSProperties {
  return {
    "--paper-width": `${resolved.page.widthMm}mm`,
    "--paper-height": `${resolved.page.heightMm}mm`,
    "--paper-font-size": `${resolved.typography.baseFontPt}pt`,
    "--paper-line-height": String(resolved.typography.lineHeight),
    "--column-gap": `${resolved.layout.columnsGapMm}mm`,
    "--pair-gap": `${resolved.questionSpacing.gapPx}px`,
    "--option-gap": `${resolved.questionSpacing.optionGapPx}px`,
    "--section-transform": resolved.sections.uppercase ? "uppercase" : "none",
  } as CSSProperties;
}

/** Tailwind-style modifier class applied to the container for section styling. */
export function templateSectionModifier(resolved: ResolvedPaperTemplate): string {
  return resolved.sections.style === "bordered" ? "" : `section-style-${resolved.sections.style}`;
}

/** Map a resolved template into the pagination/print settings used by the engine. */
export function templatePrintSettings(resolved: ResolvedPaperTemplate): PrintSettings {
  return {
    paperSize: resolved.page.paperSize,
    orientation: resolved.page.orientation,
    marginTop: resolved.page.margins.top,
    marginRight: resolved.page.margins.right,
    marginBottom: resolved.page.margins.bottom,
    marginLeft: resolved.page.margins.left,
    showPageNumbers: resolved.page.showPageNumbers,
  };
}

/** Injected after layoutCss so the print @page rule reflects template page size. */
export function templatePrintPageRule(resolved: ResolvedPaperTemplate | null | undefined): string {
  if (!resolved) return "";
  return `
    <style>
      @media print {
        @page { size: ${resolved.page.widthMm}mm ${resolved.page.heightMm}mm; margin: 0; }
      }
    </style>
  `;
}