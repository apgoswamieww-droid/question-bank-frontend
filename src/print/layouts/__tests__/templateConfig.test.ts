import { describe, expect, it } from "vitest";
import type { PaperTemplate } from "../../../api/client";
import {
  pageDimensionsMm,
  resolveTemplate,
  templateCssVars,
  templatePrintPageRule,
  templatePrintSettings,
  templateSectionModifier,
} from "../templateConfig";

function template(config: PaperTemplate["config"], kind: PaperTemplate["kind"] = "single"): PaperTemplate {
  return {
    id: "t1",
    name: "Test",
    description: null,
    kind,
    config,
    is_default: false,
    created_by: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };
}

describe("resolveTemplate — safe defaults (paper WITHOUT a template)", () => {
  it("returns the classic built-in A4 behaviour when no template is supplied", () => {
    const resolved = resolveTemplate(undefined);
    expect(resolved.page.paperSize).toBe("A4");
    expect(resolved.page.orientation).toBe("portrait");
    expect(resolved.page.margins).toEqual({ top: 15, right: 15, bottom: 15, left: 15 });
    expect(resolved.page.showPageNumbers).toBe(true);
    expect(resolved.page.widthMm).toBe(210);
    expect(resolved.page.heightMm).toBe(297);
    expect(resolved.typography).toEqual({ baseFontPt: 14, lineHeight: 1.6 });
    expect(resolved.questionSpacing).toEqual({ gapPx: 14, optionGapPx: 4 });
    expect(resolved.sections).toEqual({ style: "bordered", uppercase: true });
    expect(resolved.instructions.show).toBe(true);
    expect(resolved.header.showMeta).toBe(true);
    expect(resolved.header.logoDataUrl).toBeNull();
    expect(resolved.footer).toEqual({ leftText: null, centerText: null, rightText: null });
  });

  it("merges only the fields a template actually sets", () => {
    const resolved = resolveTemplate(
      template({
        page: { paperSize: "A3", orientation: "landscape", margins: { top: 20, bottom: 18 } },
        typography: { baseFontPt: 12 },
        sections: { style: "minimal", uppercase: false },
        branding: { instituteName: "Saraswati Vidyalaya", batch: "2025-26", academicYear: "2026" },
      })
    );
    expect(resolved.page.paperSize).toBe("A3");
    expect(resolved.page.orientation).toBe("landscape");
    expect(resolved.page.margins).toEqual({ top: 20, right: 15, bottom: 18, left: 15 }); // unset sides stay default
    expect(resolved.page.widthMm).toBe(420); // A3 landscape: 297 x 420
    expect(resolved.page.heightMm).toBe(297);
    expect(resolved.typography.baseFontPt).toBe(12);
    expect(resolved.typography.lineHeight).toBe(1.6);
    expect(resolved.sections).toEqual({ style: "minimal", uppercase: false });
    expect(resolved.branding.batch).toBe("2025-26");
    expect(resolved.header.instituteName).toBeNull(); // branding and header names are separate
  });

  it("interprets a completely empty config as the defaults", () => {
    const resolved = resolveTemplate(template({}));
    expect(resolved.page.paperSize).toBe("A4");
    expect(resolved.typography.baseFontPt).toBe(14);
    expect(resolved.sections.style).toBe("bordered");
  });
});

describe("pageDimensionsMm", () => {
  it("swaps width/height for landscape", () => {
    expect(pageDimensionsMm("A4", "portrait")).toEqual({ width: 210, height: 297 });
    expect(pageDimensionsMm("A4", "landscape")).toEqual({ width: 297, height: 210 });
    expect(pageDimensionsMm("A3", "landscape")).toEqual({ width: 420, height: 297 });
    expect(pageDimensionsMm("Letter", "portrait")).toEqual({ width: 216, height: 279 });
  });

  it("falls back to A4 for unknown sizes", () => {
    expect(pageDimensionsMm("nope" as never, "portrait")).toEqual({ width: 210, height: 297 });
  });
});

describe("template → print settings mapping", () => {
  it("produces the PrintSettings used by the paginator", () => {
    const resolved = resolveTemplate(
      template({ page: { paperSize: "Letter", orientation: "portrait", margins: { top: 10, right: 8, bottom: 12, left: 8 }, showPageNumbers: false } })
    );
    expect(templatePrintSettings(resolved)).toEqual({
      paperSize: "Letter",
      orientation: "portrait",
      marginTop: 10,
      marginRight: 8,
      marginBottom: 12,
      marginLeft: 8,
      showPageNumbers: false,
    });
  });

  it("emits concrete @page rules only when a template is applied", () => {
    expect(templatePrintPageRule(null)).toBe("");
    const rule = templatePrintPageRule(resolveTemplate(template({ page: { paperSize: "A3", orientation: "landscape" } })));
    expect(rule).toContain("size: 420mm 297mm");
    expect(templatePrintPageRule(resolveTemplate(undefined))).toContain("size: 210mm 297mm");
  });

  it("emits the section style modifier classes", () => {
    expect(templateSectionModifier(resolveTemplate(undefined))).toBe("");
    expect(templateSectionModifier(resolveTemplate(template({ sections: { style: "minimal" } })))).toBe("section-style-minimal");
    expect(templateSectionModifier(resolveTemplate(template({ sections: { style: "text" } })))).toBe("section-style-text");
  });

  it("exposes the template as CSS custom properties for the container", () => {
    const resolved = resolveTemplate(
      template({
        page: { paperSize: "A3", orientation: "landscape" },
        typography: { baseFontPt: 12 },
        questionSpacing: { gapPx: 20, optionGapPx: 6 },
        sections: { uppercase: false },
      })
    );
    const vars = templateCssVars(resolved) as Record<string, string>;
    expect(vars["--paper-width"]).toBe("420mm");
    expect(vars["--paper-height"]).toBe("297mm");
    expect(vars["--paper-font-size"]).toBe("12pt");
    expect(vars["--paper-line-height"]).toBe("1.6");
    expect(vars["--column-gap"]).toBe("12mm");
    expect(vars["--pair-gap"]).toBe("20px");
    expect(vars["--option-gap"]).toBe("6px");
    expect(vars["--section-transform"]).toBe("none");
  });
});