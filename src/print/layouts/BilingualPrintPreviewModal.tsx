import React, { useMemo, useRef, useState } from "react";
import { FileDown, Printer, X, ZoomIn, ZoomOut } from "lucide-react";
import type { LanguagePaperDetail, PaperTemplate } from "../../api/client";
import type { PaperLayoutId, PaperLayoutInstructions } from "./types";
import { PaperLayoutRenderer } from "./PaperLayoutRenderer";
import { usePrintPagination } from "./usePrintPagination";
import { resolveTemplate, templatePrintSettings } from "./templateConfig";
import { buildPrintHtml, getErrorMessage } from "./previewHtml";
import { openPrintWindow } from "../../web/printApi";

export interface BilingualPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  left: LanguagePaperDetail;
  right?: LanguagePaperDetail;
  layout: PaperLayoutId;
  title?: string;
  instructions?: PaperLayoutInstructions;
  /** Optional saved template (Phase 11) — drives page size, margins, branding, typography. */
  template?: PaperTemplate;
}

export function BilingualPrintPreviewModal({
  isOpen,
  onClose,
  left,
  right,
  layout,
  title,
  instructions,
  template,
}: BilingualPrintPreviewModalProps): React.ReactNode {
  const resolved = useMemo(() => resolveTemplate(template), [template]);
  const settings = useMemo(() => templatePrintSettings(resolved), [resolved]);

  const [zoom, setZoom] = useState<number>(100);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const documentTitle = title ?? left.paper?.title ?? "Bilingual Question Paper";
  const contentKey = JSON.stringify({ left, right, layout, template, settings, title, instructions });

  usePrintPagination(
    containerRef,
    {
      active: isOpen,
      contentKey,
      settings,
      documentTitle,
      footer: { leftText: resolved.footer.leftText, centerText: resolved.footer.centerText, rightText: resolved.footer.rightText },
    }
  );

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 150));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));

  const getFullHtmlForPrint = (): string => {
    if (!containerRef.current) return "";
    return buildPrintHtml(containerRef.current.innerHTML, documentTitle, settings, resolved);
  };

  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      openPrintWindow(getFullHtmlForPrint());
    } catch (err) {
      console.error("PDF Export error:", err);
      alert(`Unable to export PDF: ${getErrorMessage(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleNativePrint = async () => {
    try {
      openPrintWindow(getFullHtmlForPrint());
    } catch (err) {
      console.error("Native Print error:", err);
      alert(`Unable to print document: ${getErrorMessage(err)}`);
    }
  };

  return (
    <div className="print-modal-overlay">
      <div className="print-modal-container">
        <div className="print-modal-header">
          <div className="modal-header-left">
            <h2>Paper Print Preview</h2>
            <span className="doc-title-tag">{documentTitle}</span>
          </div>

          <div className="modal-header-center">
            <div className="zoom-controls">
              <button type="button" className="btn-zoom" onClick={handleZoomOut} disabled={zoom <= 50} title="Zoom Out">
                <ZoomOut size={16} />
              </button>
              <span className="zoom-label">{zoom}%</span>
              <button type="button" className="btn-zoom" onClick={handleZoomIn} disabled={zoom >= 150} title="Zoom In">
                <ZoomIn size={16} />
              </button>
            </div>
          </div>

          <div className="modal-header-right">
            <button type="button" className="btn-print-action btn-print-primary" onClick={handleNativePrint}>
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

        <div className="print-modal-workspace">
          <div className="print-canvas-scroll">
            <div
              ref={containerRef}
              className="print-canvas-scaled"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
            >
              <PaperLayoutRenderer layout={layout} left={left} right={right} title={title} instructions={instructions} template={template} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}