import { useMemo } from "react";
import "katex/dist/katex.min.css";
import { renderStoredHtml } from "./storedRichHelper";

interface StoredRichTextProps {
  value: unknown;
  className?: string;
}

/** Renders stored rich text (optionally containing KaTeX math) as HTML. */
export function StoredRichText({ value, className }: StoredRichTextProps) {
  const html = useMemo(() => renderStoredHtml(value), [value]);
  if (!html) return null;
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}