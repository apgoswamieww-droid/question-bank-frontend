import { useEffect } from "react";
import type { RefObject } from "react";
import type { PrintSettings } from "../types";
import { escapeHtml } from "./previewHtml";

const MM_TO_PX = 96 / 25.4;

export interface UsePrintPaginationOptions {
  /** Only paginate while the preview is open. */
  active: boolean;
  /** Content fingerprint — repaginate when the paper/settings change. */
  contentKey: string;
  settings: PrintSettings;
  documentTitle: string;
  /** Optional template-driven footer strings (Phase 11). */
  footer?: { leftText?: string | null; centerText?: string | null; rightText?: string | null };
}

/**
 * Reusable browser-side paginator for the layout engine. It measures every
 * `.print-paper-page` block in the container, moves overflowing
 * `.print-document-body` children onto fresh A4 pages, and repeats the
 * `[data-bilingual-header]` block on continuation pages so headers/footers are
 * reproduced per page. Question rows are atomic (`break-inside: avoid`), so a
 * bilingual pair is never split across pages — columns stay synchronized.
 */
export function usePrintPagination(
  containerRef: RefObject<HTMLDivElement | null>,
  { active, contentKey, settings, documentTitle, footer }: UsePrintPaginationOptions
): void {
  useEffect(() => {
    if (!active) return;
    const root = containerRef.current;
    if (!root) return;

    let cancelled = false;

    const paginate = async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
      const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
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

      const containerEl = root.querySelector<HTMLElement>(".print-paper-container") ?? root;
      const pageBlocks = Array.from(containerEl.querySelectorAll<HTMLElement>(":scope > .print-paper-page"));
      if (pageBlocks.length === 0) return;

      // Snapshot each rendered page block (previous runs may have mutated the DOM).
      const snapshots = pageBlocks.map((block) => ({
        html: block.innerHTML,
        headerHtml: block.querySelector<HTMLElement>("[data-bilingual-header]")?.outerHTML ?? "",
      }));

      containerEl.innerHTML = "";
      const pages: HTMLElement[] = [];

      const makePage = (isLast: boolean): HTMLElement => {
        const pageEl = document.createElement("div");
        pageEl.className = `print-paper-page${isLast ? " last-page" : ""}`;
        pageEl.style.paddingTop = `${settings.marginTop}mm`;
        pageEl.style.paddingRight = `${settings.marginRight}mm`;
        pageEl.style.paddingBottom = `${settings.marginBottom}mm`;
        pageEl.style.paddingLeft = `${settings.marginLeft}mm`;
        return pageEl;
      };

      const appendFooter = (page: HTMLElement, pageNumber: number, totalPages: number): void => {
        const hasNumberText = settings.showPageNumbers;
        const footerProvided = Boolean(
          footer && (footer.leftText || footer.centerText || footer.rightText || hasNumberText)
        );
        if (!footerProvided) return;
        const rightText = footer?.rightText ?? (hasNumberText ? `Page ${pageNumber} of ${totalPages}` : "");
        const centerText = footer?.centerText ?? "";
        const leftText = footer?.leftText ?? documentTitle;
        const strip = document.createElement("div");
        strip.className = "print-page-footer";
        strip.style.left = `${settings.marginLeft}mm`;
        strip.style.right = `${settings.marginRight}mm`;
        strip.innerHTML = [
          `<span class="print-footer-left">${escapeHtml(leftText)}</span>`,
          centerText ? `<span class="print-footer-center">${escapeHtml(centerText)}</span>` : "",
          `<span class="print-footer-right">${escapeHtml(rightText)}</span>`,
        ].join("");
        page.appendChild(strip);
      };

      snapshots.forEach((snap, blockIndex) => {
        const isFinalBlock = blockIndex === snapshots.length - 1;
        const firstPage = makePage(isFinalBlock);
        firstPage.innerHTML = snap.html;
        containerEl.appendChild(firstPage);
        pages.push(firstPage);

        const bodyEl = firstPage.querySelector<HTMLElement>(".print-document-body");
        firstPage.querySelectorAll(".print-page-footer").forEach((f) => f.remove());
        if (!bodyEl) return;

        const items = Array.from(bodyEl.children) as HTMLElement[];

        // Usable content height for one A4 page (footer strip reserved).
        const pageCs = getComputedStyle(firstPage);
        const padTop = parseFloat(pageCs.paddingTop) || 0;
        const padBottom = parseFloat(pageCs.paddingBottom) || 0;
        const usableHeight = firstPage.offsetHeight - padTop - padBottom - 14 * MM_TO_PX;
        const limitY = firstPage.getBoundingClientRect().top + padTop + usableHeight;

        let currentBody = bodyEl;

        for (const item of items) {
          currentBody.appendChild(item);
          const overflow = item.getBoundingClientRect().bottom > limitY;

          if (overflow && currentBody.children.length > 1) {
            currentBody.removeChild(item);

            const nextPage = makePage(false);
            if (snap.headerHtml) {
              const headerShell = document.createElement("div");
              headerShell.innerHTML = snap.headerHtml;
              const headerNode = headerShell.firstElementChild;
              if (headerNode) nextPage.appendChild(headerNode);
            }
            const nextBody = document.createElement("div");
            nextBody.className = "print-document-body";
            nextPage.appendChild(nextBody);
            nextBody.appendChild(item);

            containerEl.appendChild(nextPage);
            pages.push(nextPage);
            currentBody = nextBody;
          }
        }
      });

      const totalPages = pages.length;
      pages.forEach((page, index) => appendFooter(page, index + 1, totalPages));
    };

    paginate();

    return () => {
      cancelled = true;
    };
    // Repagination is keyed on the content fingerprint only (zoom uses CSS transforms).
  }, [active, contentKey, settings, documentTitle, footer, containerRef]);
}