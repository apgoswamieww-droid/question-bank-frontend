import { MathMLToLaTeX } from "mathml-to-latex";
import katex from "katex";

export interface ExtractedMath {
  latex: string;
  displayMode: boolean;
}

const MATHML_MIME_TYPES = [
  "application/mathml+xml",
  "application/x-mathml",
  "application/mathml",
  "text/mathml",
  "mathml",
];

const XML_MIME_TYPES = ["application/xml", "text/xml"];

function isMathElement(node: Element): boolean {
  const local = node.localName || node.nodeName.toLowerCase();
  return local === "math";
}

/**
 * Extract the MathML markup contained inside every <math> element found in the
 * given HTML string. It uses a detached DOM (document.implementation) so it does
 * not touch the live document.
 */
function collectMathNodes(root: Element): Element[] {
  const result: Element[] = [];
  const walker = (el: Element) => {
    if (isMathElement(el)) {
      result.push(el);
      return;
    }
    Array.from(el.children).forEach(walker);
  };
  Array.from(root.children).forEach(walker);
  return result;
}

/**
 * Detect whether some clipboard HTML looks like a MathType / MathML copy.
 * MathType wraps its math in <html><math …><semantics>…</semantics></math></html>.
 */
export function containsMathML(html: string): boolean {
  if (!html || !html.toLowerCase().includes("<math")) return false;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return collectMathNodes(doc.body).length > 0;
  } catch {
    return false;
  }
}

/**
 * Decide whether a pasted <math> block should be inserted as a display
 * (centered block) equation. Prefers the "display" attribute that MathType and
 * MathJax both set. Falls back to a centered wrapper style when the attribute
 * is missing. Everything else defaults to inline so that inline math is never
 * promoted to a block equation.
 */
function isDisplayMath(mathEl: Element): boolean {
  const display = (mathEl.getAttribute("display") || "").toLowerCase();
  if (display === "block") return true;
  if (display === "inline") return false;

  let el: Element | null = mathEl.parentElement;
  while (el && el !== el.ownerDocument.body) {
    const style = el.getAttribute?.("style") || "";
    if (/text-align\s*:\s*center|display\s*:\s*block/i.test(style)) return true;
    if (el.tagName?.toLowerCase() === "center") return true;
    el = el.parentElement;
  }
  return false;
}

function createMo(doc: Document, text: string): Element {
  const mo = doc.createElementNS("http://www.w3.org/1998/Math/MathML", "mo");
  mo.textContent = text;
  return mo;
}

/**
 * Expand <mfenced> containers into an explicit <mrow> with real fence tokens.
 * This sidesteps the converter library inserting "," separators between every
 * direct child, which produced output like \left(a,+,b\right) instead of
 * \left(a + b\right) for parenthesized groups.
 */
function expandMfenced(scope: Element): void {
  const fences = Array.from(scope.querySelectorAll("mfenced"));
  for (const fence of fences) {
    const doc = scope.ownerDocument;
    const open = fence.getAttribute("open") || "(";
    const close = fence.getAttribute("close") || ")";
    const separatorsAttr = fence.getAttribute("separators");
    const seps = separatorsAttr === null ? "," : separatorsAttr;
    const children = Array.from(fence.childNodes).filter((node) => {
      if (node.nodeType === 3) return (node.textContent || "").trim().length > 0;
      return node.nodeType === 1;
    });

    const row = doc.createElementNS("http://www.w3.org/1998/Math/MathML", "mrow");
    row.appendChild(createMo(doc, open));
    children.forEach((child, index) => {
      if (index > 0 && seps.length > 0) {
        row.appendChild(createMo(doc, seps[(index - 1) % seps.length]));
      }
      row.appendChild(child);
    });
    row.appendChild(createMo(doc, close));
    fence.replaceWith(row);
  }
}

/**
 * Prefer an <annotation encoding="application/x-tex"> when the maths was
 * authored as LaTeX. This guarantees byte-perfect round trips for content with
 * a TeX annotation instead of walking it through MathML -> LaTeX conversion.
 */
function readTexAnnotation(mathEl: Element): string | null {
  const annotations = Array.from(mathEl.querySelectorAll("annotation"));
  for (const annotation of annotations) {
    const encoding = (annotation.getAttribute("encoding") || "").toLowerCase();
    if (encoding.includes("x-tex") || encoding.includes("tex")) {
      const text = (annotation.textContent || "").replace(/\s+/g, " ").trim();
      if (text) return text;
    }
  }
  return null;
}

/**
 * Clean up converter output: strip MathType spacing artifacts, empty text
 * wrappers and collapse whitespace so results stay KaTeX-friendly.
 */
export function normalizeLatexSafety(latex: string): string {
  let out = latex;
  out = out.replace(/\\&\s*\\text\{nbsp\};/gi, " ");
  out = out.replace(/\\text\{nbsp\}|\\textrm\{nbsp\}/gi, " ");
  out = out.replace(/\\text\{\s*\}|\\textrm\{\s*\}|\\mathrm\{\s*\}/g, "");
  out = out.replace(/\s+/g, " ");
  return out.trim();
}

/**
 * Verify a LaTeX fragment parses under KaTeX. Used to flag conversions that
 * the equation renderer would not be able to display.
 */
export function isLatexRenderable(latex: string): boolean {
  try {
    katex.renderToString(latex, { throwOnError: true, strict: false, displayMode: false });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a pasted HTML string and convert every <math> block into our own
 * LaTeX-based equation representation. Returns an empty array when no MathML
 * is present or nothing could be converted.
 */
export function extractMathFromHtml(html: string): ExtractedMath[] {
  if (!html || !html.toLowerCase().includes("<math")) return [];

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return [];
  }

  const nodes = collectMathNodes(doc.body);
  if (nodes.length === 0) return [];

  const out: ExtractedMath[] = [];
  for (const mathEl of nodes) {
    try {
      const texAnnotation = readTexAnnotation(mathEl);
      let latex: string;
      if (texAnnotation !== null) {
        latex = texAnnotation;
      } else {
        expandMfenced(mathEl);
        const serialized = new XMLSerializer().serializeToString(mathEl);
        latex = MathMLToLaTeX.convert(serialized);
      }
      latex = normalizeLatexSafety(latex);
      if (latex) {
        out.push({ latex, displayMode: isDisplayMath(mathEl) });
      }
    } catch {
      // Skip any single block that fails to convert rather than aborting the batch.
    }
  }
  return out;
}

/** Read the list of MIME types a clipboard event exposes. */
export function getClipboardFormats(clipboardData: DataTransfer | null): string[] {
  if (!clipboardData) return [];
  const raw = clipboardData.types as unknown;
  if (Array.isArray(raw)) return raw as string[];
  if (raw && typeof raw === "object" && typeof (raw as { length?: number }).length === "number") {
    const list = raw as { length: number; item(index: number): string };
    const out: string[] = [];
    for (let i = 0; i < list.length; i++) out.push(list.item(i));
    return out;
  }
  if (Array.isArray(raw)) return raw as string[];
  return [];
}

function isDevRuntime(): boolean {
  try {
    const env = import.meta.env as { DEV?: boolean; MODE?: string };
    return env.DEV === true && env.MODE !== "test";
  } catch {
    return false;
  }
}

/**
 * Development-only clipboard inspector. Logs the MIME formats carried on a
 * paste event plus a truncated snapshot of each, so clipboard format issues can
 * be diagnosed without touching production logging.
 */
export function inspectClipboard(clipboardData: DataTransfer | null): void {
  if (!isDevRuntime() || !clipboardData) return;
  const formats = getClipboardFormats(clipboardData);
  console.groupCollapsed("[mathPaste] clipboard inspection");
  console.log("formats:", formats);
  for (const format of formats) {
    try {
      const snapshot = clipboardData.getData(format);
      console.log(format, "=>", snapshot.slice(0, 240));
    } catch (error) {
      console.log(format, "unreadable:", error);
    }
  }
  console.groupEnd();
}

/**
 * True when the clipboard appears to carry MathML (either an explicit mathml
 * MIME type or <math> markup inside one of the readable formats). Used to
 * distinguish "nothing to do" from "a real equation that failed to convert".
 */
export function hasMathMLOnClipboard(clipboardData: DataTransfer | null): boolean {
  if (!clipboardData) return false;
  const formats = getClipboardFormats(clipboardData);
  if (formats.some((format) => format.toLowerCase().includes("mathml"))) return true;

  const candidates = [...formats, "text/html", "text/plain", ...XML_MIME_TYPES];
  for (const format of candidates) {
    try {
      const value = clipboardData.getData(format);
      if (value && containsMathML(value)) return true;
    } catch {
      // Some formats cannot be read back; skip them.
    }
  }
  return false;
}

/**
 * Convenience helper for pasting that pulls any MathML off the clipboard data.
 * Detection priority:
 *   1. explicit MathML MIME types (application/mathml+xml, text/mathml, …)
 *   2. MathML embedded in text/html  (MathType's "<html><math …>…" copy)
 *   3. generic XML formats (application/xml, text/xml)
 *   4. raw MathML in text/plain
 */
export function readMathFromClipboard(clipboardData: DataTransfer): ExtractedMath[] {
  inspectClipboard(clipboardData);
  const formats = getClipboardFormats(clipboardData);

  const snapshot = (type: string): string => {
    try {
      return clipboardData.getData(type);
    } catch {
      return "";
    }
  };

  for (const type of [...MATHML_MIME_TYPES, ...formats]) {
    const raw = snapshot(type);
    if (raw && containsMathML(raw)) {
      const extracted = extractMathFromHtml(raw);
      if (extracted.length > 0) return extracted;
    }
  }

  const html = snapshot("text/html");
  if (html && containsMathML(html)) {
    const extracted = extractMathFromHtml(html);
    if (extracted.length > 0) return extracted;
  }

  for (const type of XML_MIME_TYPES) {
    const raw = snapshot(type);
    if (raw && containsMathML(raw)) {
      const extracted = extractMathFromHtml(raw);
      if (extracted.length > 0) return extracted;
    }
  }

  const plain = snapshot("text/plain");
  if (plain && containsMathML(plain)) {
    const extracted = extractMathFromHtml(plain);
    if (extracted.length > 0) return extracted;
  }

  return [];
}