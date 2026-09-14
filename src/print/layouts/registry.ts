import { SingleColumnLayout } from "./SingleColumnLayout";
import { BilingualTwoColumnLayout } from "./BilingualTwoColumnLayout";
import type { PaperLayoutDefinition, PaperLayoutId } from "./types";

/** Registry of every printable paper layout. Adding a layout = add one entry + a render component. */
export const PAPER_LAYOUTS: PaperLayoutDefinition[] = [
  {
    id: "single-column",
    label: "Single Column",
    description: "One language per full-width sheet — classic paper layout.",
    kind: "single-language",
    columns: 1,
    languagesRequired: 1,
    render: SingleColumnLayout,
  },
  {
    id: "bilingual-two-column",
    label: "Bilingual Two-Column",
    description:
      "Same logical questions printed side by side for two languages (e.g. English & Gujarati). Columns stay synchronized.",
    kind: "bilingual",
    columns: 2,
    languagesRequired: 2,
    render: BilingualTwoColumnLayout,
  },
  {
    id: "custom",
    label: "Custom Layout",
    description:
      "Extensibility point — implement your own render component and register it here.",
    kind: "custom",
    columns: 1,
    languagesRequired: 1,
    render: SingleColumnLayout,
  },
];

export function getAllPaperLayouts(): PaperLayoutDefinition[] {
  return PAPER_LAYOUTS;
}

export function getPaperLayout(id: PaperLayoutId): PaperLayoutDefinition | undefined {
  return PAPER_LAYOUTS.find((l) => l.id === id);
}