import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MathNodeComponent } from "./MathNodeComponent";

export interface MathNodeOptions {
  onOpenEditor?: (
    latex: string,
    displayMode: boolean,
    updateFn: (latex: string, displayMode: boolean) => void
  ) => void;
}

export const MathNode = Node.create<MathNodeOptions>({
  name: "mathNode",
  group: "inline",
  inline: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      onOpenEditor: undefined,
    };
  },

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex") || "",
        renderHTML: (attributes) => ({
          "data-latex": attributes.latex,
        }),
      },
      displayMode: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-display") === "true",
        renderHTML: (attributes) => ({
          "data-display": attributes.displayMode ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="math-node"]',
      },
      {
        tag: 'div[data-type="math-node"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const displayMode = HTMLAttributes["data-display"] === "true";
    const tag = displayMode ? "div" : "span";

    return [
      tag,
      mergeAttributes(HTMLAttributes, {
        "data-type": "math-node",
        class: `math-node-rendered ${displayMode ? "is-display" : "is-inline"}`,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeComponent);
  },
});
