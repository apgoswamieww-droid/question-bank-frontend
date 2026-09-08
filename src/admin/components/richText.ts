function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[]; attrs?: Record<string, unknown>; html?: string };
  if (typeof n.text === "string") return n.text;
  if (typeof n.html === "string") return htmlToText(n.html);
  if (n.type === "text") return "";
  if (n.type === "image") return n.attrs?.alt ? `[Image: ${String(n.attrs.alt)}]` : "[Image]";
  if (Array.isArray(n.content)) return n.content.map(nodeText).join(" ");
  return "";
}

function htmlToText(html: string): string {
  const raw = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<span[^>]*data-latex=["']([^"']*)["'][^>]*>[\s\S]*?<\/span>/gi, (_, latex: string) => ` ${latex} `)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return raw.replace(/\s+/g, " ").trim();
}

export function richTextToPlain(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" ? nodeText(parsed) : parsed;
    } catch {
      return value;
    }
  }
  return typeof value === "object" ? nodeText(value) : String(value);
}

export type QuestionChoice =
  | { type: "mcq"; options: { content: unknown; is_correct: boolean }[] }
  | { type: "multi"; options: { content: unknown; is_correct: boolean }[] }
  | { type: "true_false"; options: { content: unknown; is_correct: boolean }[] }
  | { type: "match"; options: { content: unknown; is_correct: boolean }[] }
  | { type: "fill_blank"; options: { content: unknown; is_correct: boolean }[] }
  | { type: "essay" | "short" | "long" | "number" | "sq" | "other"; options: { content: unknown; is_correct: boolean }[] };
