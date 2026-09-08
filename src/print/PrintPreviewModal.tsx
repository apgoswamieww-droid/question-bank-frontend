import React, { useState, useRef, useEffect } from "react";
import { PrintDocument } from "./PrintDocument";
import type { DocumentJson, PrintSettings } from "./types";
import type { ExamMetadata } from "../types/examMetadata";
import {
  Printer,
  FileDown,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import katexCss from "katex/dist/katex.min.css?raw";
import { openPrintWindow } from "../web/printApi";

const MM_TO_PX = 96 / 25.4;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Unknown error";

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentJSON: DocumentJson;
  documentTitle: string;
  metadata: ExamMetadata;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  documentJSON,
  documentTitle,
  metadata,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [settings] = useState<PrintSettings>({
    paperSize: "A4",
    orientation: "portrait",
    marginTop: 15,
    marginRight: 15,
    marginBottom: 15,
    marginLeft: 15,
    showPageNumbers: true,
  });

  const printContainerRef = useRef<HTMLDivElement>(null);
  const pristineHtmlRef = useRef<string | null>(null);
  const pristineKeyRef = useRef<string>("");

  function countQuestions(body: HTMLElement): number {
    return body.querySelectorAll(".print-question-block").length;
  }

  function appendFooter(page: HTMLElement, pageNumber: number, totalPages: number): void {
    if (!settings.showPageNumbers) return;
    const footer = document.createElement("div");
    footer.className = "print-page-footer";
    footer.innerHTML = `<span>${escapeHtml(documentTitle)}</span><span>Page ${pageNumber} of ${totalPages}</span>`;
    page.appendChild(footer);
  }

  /**
   * Splits the rendered single-page document into real A4 pages.
   * Measures each top-level node of the document body and moves
   * overflowing nodes onto new .print-paper-page elements, keeping
   * question counter numbering continuous across pages and adding a
   * "Page X of Y" footer on every page.
   */
  useEffect(() => {
    if (!isOpen) return;
    const root = printContainerRef.current;
    if (!root) return;

    let cancelled = false;

    const paginate = async () => {
      // Wait for custom fonts and images so height measurements are accurate
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
      const images = Array.from(root.querySelectorAll("img"));
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
              } else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }
            })
        )
      );
      if (cancelled) return;

      const containerEl =
        root.querySelector<HTMLElement>(".print-paper-container") ?? root;

      // Capture the untouched React-rendered page once per content change
      const contentKey = JSON.stringify({ documentJSON, settings, metadata });
      const firstRenderedPage =
        containerEl.querySelector<HTMLElement>(".print-paper-page");
      if (!firstRenderedPage) return;
      if (pristineHtmlRef.current === null || pristineKeyRef.current !== contentKey) {
        pristineHtmlRef.current = firstRenderedPage.innerHTML;
        pristineKeyRef.current = contentKey;
      }

      // Rebuild from the pristine snapshot (previous runs may have mutated DOM)
      containerEl.innerHTML = "";
      const pageEl = document.createElement("div");
      pageEl.className = "print-paper-page last-page";
      pageEl.style.paddingTop = `${settings.marginTop}mm`;
      pageEl.style.paddingRight = `${settings.marginRight}mm`;
      pageEl.style.paddingBottom = `${settings.marginBottom}mm`;
      pageEl.style.paddingLeft = `${settings.marginLeft}mm`;
      containerEl.appendChild(pageEl);
      pageEl.innerHTML = pristineHtmlRef.current;

      const bodyEl = pageEl.querySelector<HTMLElement>(".print-document-body");
      if (!bodyEl) return;
      pageEl.querySelectorAll(".print-page-footer").forEach((f) => f.remove());

      // Usable content height for one A4 page (footer strip reserved)
      const pageCs = getComputedStyle(pageEl);
      const padTop = parseFloat(pageCs.paddingTop) || 0;
      const padBottom = parseFloat(pageCs.paddingBottom) || 0;
      const usableHeight = pageEl.offsetHeight - padTop - padBottom - 14 * MM_TO_PX;

      const items = Array.from(bodyEl.children) as HTMLElement[];
      if (items.length === 0) {
        appendFooter(pageEl, 1, 1);
        return;
      }

      const pages: HTMLElement[] = [pageEl];
      let currentBody = bodyEl;
      let placedQuestions = 0;
      bodyEl.style.counterReset = "printQuestionCounter 0";
      const limitY = pageEl.getBoundingClientRect().top + padTop + usableHeight;

      for (const item of items) {
        currentBody.appendChild(item);
        const overflow = item.getBoundingClientRect().bottom > limitY;

        if (overflow && currentBody.children.length > 1) {
          placedQuestions += countQuestions(currentBody);
          currentBody.removeChild(item);

          const nextPage = document.createElement("div");
          nextPage.className = "print-paper-page";
          nextPage.style.paddingTop = `${settings.marginTop}mm`;
          nextPage.style.paddingRight = `${settings.marginRight}mm`;
          nextPage.style.paddingBottom = `${settings.marginBottom}mm`;
          nextPage.style.paddingLeft = `${settings.marginLeft}mm`;

          const nextBody = document.createElement("div");
          nextBody.className = "print-document-body";
          nextBody.style.counterReset = `printQuestionCounter ${placedQuestions}`;
          nextPage.appendChild(nextBody);
          nextBody.appendChild(item);
          containerEl.appendChild(nextPage);

          pages.push(nextPage);
          currentBody = nextBody;
        }
      }

      pages.forEach((page, index) => appendFooter(page, index + 1, pages.length));
    };

    paginate();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, documentJSON, settings, metadata, documentTitle]);

  if (!isOpen) return null;

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 150));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  const getFullHtmlForPrint = (): string => {
    if (!printContainerRef.current) return "";
    const contentHtml = printContainerRef.current.innerHTML;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(documentTitle)}</title>
          <style>
            ${katexCss}
          </style>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
            }

            .print-paper-container { background: #fff; font-family: "Times New Roman", Times, serif; font-size: 14pt; }
            .print-paper-page { width: 210mm; min-height: 297mm; padding: ${settings.marginTop}mm ${settings.marginRight}mm ${settings.marginBottom}mm ${settings.marginLeft}mm; box-sizing: border-box; margin: 0 auto; page-break-after: always; position: relative; }
            .print-paper-page.last-page { page-break-after: auto; }
            .print-exam-header { border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px; text-align: center; }
            .print-exam-header h1 { font-size: 20pt; font-weight: 700; margin: 0 0 4px 0; text-transform: uppercase; }
            .print-exam-subtitle { font-size: 14pt; font-weight: 600; color: #334155; margin: 2px 0 8px 0; }
            .print-logo-wrapper { margin-bottom: 8px; }
            .print-logo-wrapper img { max-height: 120px; height: auto; }
            .print-exam-header .exam-sub-info { display: flex; justify-content: space-between; font-size: 11pt; font-weight: 600; color: #334155; margin-top: 8px; flex-wrap: wrap; gap: 8px; }
            
            .print-instructions-box { border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px 14px; margin-bottom: 18px; background: #f8fafc; font-size: 11pt; }
            .instructions-heading { font-size: 11pt; font-weight: 700; margin: 0 0 4px 0; text-transform: uppercase; }
            .print-instructions-box ul { margin: 0; padding-left: 20px; }
            .print-instructions-box li { margin-bottom: 2px; }

            .print-section-divider { border-top: 2px solid #0f172a; border-bottom: 1px solid #94a3b8; padding: 6px 0; margin: 20px 0 14px 0; }
            .print-section-header-bar { display: flex; justify-content: space-between; font-weight: 700; font-size: 13pt; text-transform: uppercase; }
            .print-section-desc { font-size: 11pt; font-style: italic; color: #475569; margin: 4px 0 0 0; }

            .print-document-body { counter-reset: printQuestionCounter; }
            .print-question-block { counter-increment: printQuestionCounter; margin-bottom: 18px; page-break-inside: avoid; break-inside: avoid; }
            .print-question-header { font-weight: 700; font-size: 14pt; margin-bottom: 6px; }
            .print-question-header::before { content: "Q." counter(printQuestionCounter) " "; font-weight: 700; }
            .print-question-options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-left: 20px; margin-bottom: 10px; }
            .print-question-option { display: flex; align-items: baseline; gap: 6px; }
            .print-option-label { font-weight: 700; color: #334155; min-width: 24px; }
            .print-question-footer { display: flex; justify-content: space-between; font-size: 11pt; font-weight: 600; color: #475569; border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 8px; }
            .print-math-inline { display: inline-block; vertical-align: middle; padding: 0 2px; }
            .print-math-block { display: block; text-align: center; margin: 12px 0; }
            .print-image-wrapper { margin: 12px 0; display: flex; }
            .print-image-wrapper.align-left { justify-content: flex-start; }
            .print-image-wrapper.align-center { justify-content: center; }
            .print-image-wrapper.align-right { justify-content: flex-end; }
            .print-image-wrapper img { max-width: 100%; height: auto; }
            .print-document-body p { margin: 0 0 10px 0; }
            .print-document-body ul, .print-document-body ol { margin: 0 0 10px 0; padding-left: 24px; }
            .print-document-body li { margin-bottom: 4px; }
            .print-page-footer { position: absolute; bottom: 10mm; left: ${settings.marginLeft}mm; right: ${settings.marginRight}mm; display: flex; justify-content: space-between; font-size: 10pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 6px; }
          </style>
        </head>
        <body>
          ${contentHtml}
        </body>
      </html>
    `;
  };

  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const htmlContent = getFullHtmlForPrint();
      openPrintWindow(htmlContent);
    } catch (err) {
      console.error("PDF Export error:", err);
      alert(`Unable to export PDF: ${getErrorMessage(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleNativePrint = async () => {
    try {
      const htmlContent = getFullHtmlForPrint();
      openPrintWindow(htmlContent);
    } catch (err) {
      console.error("Native Print error:", err);
      alert(`Unable to print document: ${getErrorMessage(err)}`);
    }
  };

  return (
    <div className="print-modal-overlay">
      <div className="print-modal-container">
        {/* Modal Toolbar Header */}
        <div className="print-modal-header">
          <div className="modal-header-left">
            <h2>A4 Exam Paper Print Preview</h2>
            <span className="doc-title-tag">{documentTitle}</span>
          </div>

          <div className="modal-header-center">
            <div className="zoom-controls">
              <button
                type="button"
                className="btn-zoom"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="zoom-label">{zoom}%</span>
              <button
                type="button"
                className="btn-zoom"
                onClick={handleZoomIn}
                disabled={zoom >= 150}
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
            </div>
          </div>

          <div className="modal-header-right">
            <button
              type="button"
              className="btn-print-action btn-print-primary"
              onClick={handleNativePrint}
            >
              <Printer size={16} /> <span>Print</span>
            </button>
            <button
              type="button"
              className="btn-print-action btn-pdf-export"
              onClick={handleExportPDF}
              disabled={isExporting}
            >
              <FileDown size={16} /> <span>{isExporting ? "Exporting PDF..." : "Export PDF"}</span>
            </button>
            <button type="button" className="btn-close-modal" onClick={onClose} title="Close Preview">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Main Workspace */}
        <div className="print-modal-workspace">
          {/* Scrollable Preview Canvas */}
          <div className="print-canvas-scroll">
            <div
              ref={printContainerRef}
              className="print-canvas-scaled"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
              }}
            >
              <PrintDocument
                content={documentJSON}
                title={documentTitle}
                settings={settings}
                metadata={metadata}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
