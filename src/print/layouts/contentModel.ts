import type { PrintNode } from "../types";

/**
 * Coerces an arbitrary stored rich-text value into a Tiptap/ProseMirror node
 * tree when possible, otherwise returns null (callers fall back to stored HTML).
 */
export function coerceTiptap(value: unknown): PrintNode | null {
  if (Array.isArray(value)) return { type: "doc", content: value as PrintNode[] };
  if (value && typeof value === "object") {
    const candidate = value as { type?: unknown; content?: unknown };
    if (typeof candidate.type === "string" && Array.isArray(candidate.content)) {
      return candidate as PrintNode;
    }
  }
  return null;
}