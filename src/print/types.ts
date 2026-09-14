import type { ExamMetadata } from "../types/examMetadata";

export interface PrintSettings {
  paperSize: "A4" | "A3" | "Letter";
  orientation: "portrait" | "landscape";
  marginTop: number; // in mm
  marginRight: number; // in mm
  marginBottom: number; // in mm
  marginLeft: number; // in mm
  showPageNumbers: boolean;
}

/** Loose representation of a Tiptap/ProseMirror JSON node. */
export interface PrintNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: PrintNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface DocumentJson {
  type?: string;
  content?: PrintNode[];
}

export interface PrintDocumentProps {
  content: DocumentJson;
  title?: string;
  settings?: PrintSettings;
  metadata: ExamMetadata;
}
