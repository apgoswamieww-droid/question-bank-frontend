import { ColumnarPaper } from "./ColumnarPaper";
import type { PaperLayoutProps } from "./types";

/**
 * Bilingual two-column layout: the SAME logical question is printed for both
 * languages on each row — left column and right column stay synchronized for
 * numbering, options, images, mathematics and page flow.
 */
export function BilingualTwoColumnLayout(props: PaperLayoutProps): React.ReactNode {
  return <ColumnarPaper {...props} columns={2} />;
}