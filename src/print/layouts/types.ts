import type { LanguagePaperDetail, LanguagePaperQuestion, PaperTemplate } from "../../api/client";

/** Layout ids are extensible — future layouts register themselves in the engine registry. */
export type PaperLayoutId = "single-column" | "bilingual-two-column" | "custom";

/** Broad category of a layout, used by UI to decide what inputs a layout needs. */
export type PaperLayoutKind = "single-language" | "bilingual" | "custom";

/** A synchronized pair of the SAME logical question, one resolved variant per language column. */
export interface BilingualQuestionPair {
  /** Shared, synchronized question number (1-based) across all columns. */
  number: number;
  /** Master question family id this pair is derived from. */
  familyId: string | null;
  marks: number;
  negativeMarks: number;
  /** Section in the master blueprint a pair belongs to (null = unassigned). */
  sectionKey: string | null;
  left: LanguagePaperQuestion | null;
  right: LanguagePaperQuestion | null;
}

export interface PaperLayoutInstructions {
  left?: string[];
  right?: string[];
}

/** Inputs consumed by every layout implementation. */
export interface PaperLayoutProps {
  /** First language column (always required). */
  left: LanguagePaperDetail;
  /** Second language column — required for bilingual layouts, optional otherwise. */
  right?: LanguagePaperDetail;
  /** Optional document title; defaults to the master paper title. */
  title?: string;
  /** Per-language general instructions. Falls back to built-in per-language templates. */
  instructions?: PaperLayoutInstructions;
  /** Optional saved template (Phase 11) — drives page size, branding, typography, spacing. */
  template?: PaperTemplate;
}

export interface PaperLayoutDefinition<TProps extends PaperLayoutProps = PaperLayoutProps> {
  id: PaperLayoutId;
  label: string;
  description: string;
  kind: PaperLayoutKind;
  /** Number of language columns the layout renders side-by-side. */
  columns: number;
  /** Number of language paper artifacts the layout consumes. */
  languagesRequired: 1 | 2;
  /** The rendering component for this layout. */
  render: React.ComponentType<TProps>;
}