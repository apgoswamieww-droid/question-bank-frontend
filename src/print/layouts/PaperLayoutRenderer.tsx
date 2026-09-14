import { useMemo } from "react";
import { SingleColumnLayout } from "./SingleColumnLayout";
import { getPaperLayout } from "./registry";
import { resolveTemplate, templateCssVars, templateSectionModifier } from "./templateConfig";
import type { PaperLayoutId, PaperLayoutProps } from "./types";

/**
 * Dispatcher used by the print preview: picks the layout's render component and
 * wraps it in a single printable container (pagination operates on this wrapper).
 * When a saved template (Phase 11) is supplied its CSS custom properties land on
 * this container so page size, typography, spacing and section styling are
 * inherited by every generated `.print-paper-page` block — including the
 * standalone print window HTML.
 */
export function PaperLayoutRenderer(props: PaperLayoutProps & { layout: PaperLayoutId }) {
  const { layout, template, ...rest } = props;
  const resolved = useMemo(() => resolveTemplate(template), [template]);
  const definition = getPaperLayout(layout) ?? getPaperLayout("single-column");
  const Render = definition?.render ?? SingleColumnLayout;
  const sectionModifier = templateSectionModifier(resolved);
  return (
    <div
      className={`print-paper-container${sectionModifier ? ` ${sectionModifier}` : ""}`}
      data-layout={layout}
      style={templateCssVars(resolved)}
    >
      <Render {...rest} template={template} />
    </div>
  );
}