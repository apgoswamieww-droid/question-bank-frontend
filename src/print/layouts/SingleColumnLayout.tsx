import { ColumnarPaper } from "./ColumnarPaper";
import type { PaperLayoutProps } from "./types";

/**
 * Single-column layout: renders each provided language artifact as its own
 * full-width A4 sheet in document order.
 */
export function SingleColumnLayout(props: PaperLayoutProps): React.ReactNode {
  const { right } = props;
  if (right) {
    return (
      <>
        <ColumnarPaper {...props} right={undefined} columns={1} />
        <ColumnarPaper {...props} left={right} right={undefined} columns={1} />
      </>
    );
  }
  return <ColumnarPaper {...props} columns={1} />;
}