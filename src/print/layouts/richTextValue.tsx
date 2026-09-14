import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { renderStoredHtml } from "../../admin/components/storedRichHelper";
import { coerceTiptap } from "./contentModel";
import type { PrintNode } from "../types";

interface RichTextValueProps {
  value: unknown;
  /** Language code for typography (data-lang), e.g. "gu". */
  lang?: string;
  className?: string;
}

/**
 * Reusable rich-text renderer for the print engine. Renders Tiptap JSON node
 * trees (marks, math, images, tables, question blocks) and falls back to the
 * stored-HTML renderer used across the admin UI when the value is stored HTML.
 */
export function RichTextValue({ value, lang, className }: RichTextValueProps): React.ReactNode {
  const tiptap = useMemo(() => coerceTiptap(value), [value]);
  const html = useMemo(() => renderStoredHtml(value), [value]);

  if (tiptap) {
    return (
      <span className={className} data-lang={lang}>
        <RichChildren nodes={tiptap.content} />
      </span>
    );
  }

  if (!html) return null;
  return <span className={className} data-lang={lang} dangerouslySetInnerHTML={{ __html: html }} />;
}

function applyMarks(text: string, marks?: PrintNode["marks"]): React.ReactNode {
  if (!marks || marks.length === 0) return text;

  const style: React.CSSProperties = {};
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;

  marks.forEach((m) => {
    if (m.type === "fontFamily" && m.attrs) {
      if (m.attrs.fontFamily) {
        style.fontFamily = `"${String(m.attrs.fontFamily)}", system-ui, sans-serif`;
      }
      if (m.attrs.fontSize) {
        style.fontSize = String(m.attrs.fontSize);
      }
    }
    if (m.type === "bold") isBold = true;
    if (m.type === "italic") isItalic = true;
    if (m.type === "underline") isUnderline = true;
  });

  let element: React.ReactNode = text;
  if (isBold) element = <strong>{element}</strong>;
  if (isItalic) element = <em>{element}</em>;
  if (isUnderline) element = <u>{element}</u>;

  if (Object.keys(style).length > 0) {
    element = <span style={style}>{element}</span>;
  }

  return element;
}

function RichChildren({ nodes }: { nodes?: PrintNode[] }): React.ReactNode {
  if (!nodes) return null;
  return (
    <>
      {nodes.map((node, index) => (
        <RichBlock key={index} node={node} />
      ))}
    </>
  );
}

function RichBlock({ node }: { node: PrintNode }): React.ReactNode {
  if (!node) return null;

  switch (node.type) {
    case "text":
      return <>{applyMarks(node.text ?? "", node.marks)}</>;

    case "paragraph": {
      const textAlign = (node.attrs?.textAlign as React.CSSProperties["textAlign"] | undefined) || "left";
      return (
        <p style={{ textAlign }}>
          <RichChildren nodes={node.content} />
        </p>
      );
    }

    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
      const textAlign = (node.attrs?.textAlign as React.CSSProperties["textAlign"] | undefined) || "left";
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return (
        <Tag style={{ textAlign }}>
          <RichChildren nodes={node.content} />
        </Tag>
      );
    }

    case "bulletList":
      return <ul><RichChildren nodes={node.content} /></ul>;

    case "orderedList":
      return <ol><RichChildren nodes={node.content} /></ol>;

    case "listItem":
      return <li><RichChildren nodes={node.content} /></li>;

    case "hardBreak":
      return <br />;

    case "horizontalRule":
      return <hr style={{ margin: 16, border: "0.5px solid #cbd5e1" }} />;

    case "mathNode": {
      const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
      const displayMode = !!node.attrs?.displayMode;
      const renderMath = (): string | null => {
        try {
          return katex.renderToString(latex, { displayMode, throwOnError: false });
        } catch {
          return null;
        }
      };
      const rendered = renderMath();
      if (rendered === null) {
        return <span className="print-math-inline" style={{ color: "red" }}>[{latex}]</span>;
      }
      return (
        <span
          className={displayMode ? "print-math-block" : "print-math-inline"}
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      );
    }

    case "resizableImage": {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : undefined;
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      const width = typeof node.attrs?.width === "string" ? node.attrs.width : "300px";
      const alignment = typeof node.attrs?.alignment === "string" ? node.attrs.alignment : "center";
      if (!src) return null;
      return (
        <div className={`print-image-wrapper align-${alignment}`}>
          <img src={src} alt={alt} style={{ width, maxWidth: "100%", height: "auto" }} />
        </div>
      );
    }

    case "table":
      return (
        <table className="bilingual-table">
          <tbody>
            <RichChildren nodes={node.content} />
          </tbody>
        </table>
      );

    case "tableRow":
      return <tr><RichChildren nodes={node.content} /></tr>;

    case "tableHeader":
      return <th><RichChildren nodes={node.content} /></th>;

    case "tableCell":
      return <td><RichChildren nodes={node.content} /></td>;

    // Legacy question block found inside a variant body: keep it printable.
    case "questionBlock": {
      const children = node.content || [];
      const questionTextNode = children.find((c) => c.type === "questionText");
      const optionNodes = children.filter((c) => c.type === "questionOption");
      return (
        <div className="print-question-block">
          <div className="print-question-text">
            <RichChildren nodes={questionTextNode?.content} />
          </div>
          {optionNodes.length > 0 && (
            <div className="bilingual-options">
              {optionNodes.map((opt, i) => (
                <div key={i} className="bilingual-option">
                  <span className="bilingual-option-label">
                    ({String(opt.attrs?.label ?? String.fromCharCode(65 + i))})
                  </span>
                  <span className="bilingual-option-content">
                    <RichChildren nodes={opt.content} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    default:
      if (node.content) return <RichChildren nodes={node.content} />;
      return null;
  }
}