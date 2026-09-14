import katexCss from "katex/dist/katex.min.css?raw";
import layoutCss from "./bilingualLayout.css?raw";
import type { PrintSettings } from "../types";
import { templatePrintPageRule } from "./templateConfig";
import type { ResolvedPaperTemplate } from "./templateConfig";

/** Google Fonts needed for Latin, Gujarati and Devanagari typography on paper. */
export const BILINGUAL_FONTS_LINK =
  "https://fonts.googleapis.com/css2?family=Rasa:wght@400;500;600;700&family=Noto+Serif+Gujarati:wght@400;600;700&family=Noto+Sans+Gujarati:wght@400;600;700&family=Noto+Serif+Devanagari:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;600;700&display=swap";

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

/** Assembles a standalone HTML document for the print popup (self-contained). */
export function buildPrintHtml(
  contentHtml: string,
  title: string,
  settings: PrintSettings,
  template: ResolvedPaperTemplate | null | undefined = null
): string {
  const padding = {
    top: settings.marginTop,
    right: settings.marginRight,
    bottom: settings.marginBottom,
    left: settings.marginLeft,
  };
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link rel="stylesheet" href="${BILINGUAL_FONTS_LINK}" />
        <style>
          ${katexCss}
        </style>
        <style>
          .print-paper-container { background: #fff; box-sizing: border-box; }
          .print-paper-page {
            width: var(--paper-width, 210mm);
            min-height: var(--paper-height, 297mm);
            padding: ${padding.top}mm ${padding.right}mm ${padding.bottom}mm ${padding.left}mm;
            box-sizing: border-box;
            margin: 0 auto;
            position: relative;
            page-break-after: always;
            background: #ffffff;
          }
          .print-paper-page.last-page { page-break-after: auto; }
          .print-page-footer {
            position: absolute;
            bottom: 10mm;
            left: ${padding.left}mm;
            right: ${padding.right}mm;
            display: flex;
            justify-content: space-between;
            font-size: 10pt;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 6px;
          }
        </style>
        <style>
          ${layoutCss}
        </style>
        ${template ? templatePrintPageRule(template) : ""}
      </head>
      <body>
        ${contentHtml}
      </body>
    </html>
  `;
}