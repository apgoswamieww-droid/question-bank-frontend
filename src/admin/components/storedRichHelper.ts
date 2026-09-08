import katex from "katex";

/** Extract the TipTap-generated HTML string from a stored rich-text value. */
export function storedHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && typeof parsed.html === "string") return parsed.html;
    } catch {
      /* not JSON — treat as plain HTML/text */
    }
    return value;
  }
  if (typeof value === "object" && typeof (value as { html?: unknown }).html === "string") {
    return (value as { html: string }).html;
  }
  return "";
}

/**
 * Render editor-stored HTML to a safe HTML string, rendering any embedded
 * math nodes (`<span data-latex="…">`) with KaTeX.
 */
export function renderStoredHtml(value: unknown): string {
  const html = storedHtml(value);
  if (!html) return "";
  if (!html.includes("data-latex")) return html;

  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("[data-latex]").forEach((el) => {
    const latex = el.getAttribute("data-latex") || "";
    const display = el.getAttribute("data-display") === "true";
    try {
      el.outerHTML = katex.renderToString(latex, { displayMode: display, throwOnError: false });
    } catch {
      el.replaceChildren(doc.createTextNode(`[${latex}]`));
    }
  });
  return doc.body.innerHTML;
}