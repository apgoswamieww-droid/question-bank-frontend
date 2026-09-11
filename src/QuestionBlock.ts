import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { Node as PMNode } from "@tiptap/pm/model";

export const QuestionText = Node.create({
  name: "questionText",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      { tag: 'div[data-type="question-text"]' },
      { tag: "div.question-text" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "question-text",
        class: "question-text",
      }),
      0,
    ];
  },
});

export const QuestionOption = Node.create({
  name: "questionOption",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      label: {
        default: "A",
        parseHTML: (element) => element.getAttribute("data-label") || "A",
        renderHTML: (attributes) => ({
          "data-label": attributes.label,
        }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="question-option"]' },
      { tag: "div.question-option" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const label = HTMLAttributes["data-label"] || "A";
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "question-option",
        class: "question-option",
      }),
      ["span", { class: "option-label", contenteditable: "false" }, `(${label})`],
      ["div", { class: "option-content" }, 0],
    ];
  },
});

export const QuestionAnswer = Node.create({
  name: "questionAnswer",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      { tag: 'div[data-type="question-answer"]' },
      { tag: "div.question-answer" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "question-answer",
        class: "question-answer",
      }),
      ["span", { class: "footer-label", contenteditable: "false" }, "Answer:"],
      ["div", { class: "answer-content" }, 0],
    ];
  },
});

export const QuestionMarks = Node.create({
  name: "questionMarks",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      { tag: 'div[data-type="question-marks"]' },
      { tag: "div.question-marks" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "question-marks",
        class: "question-marks",
      }),
      ["span", { class: "footer-label", contenteditable: "false" }, "Marks:"],
      ["div", { class: "marks-content" }, 0],
    ];
  },
});

export const QuestionFooter = Node.create({
  name: "questionFooter",
  group: "block",
  content: "questionAnswer questionMarks",
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      { tag: 'div[data-type="question-footer"]' },
      { tag: "div.question-footer" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "question-footer",
        class: "question-footer",
      }),
      0,
    ];
  },
});

export const QuestionBlock = Node.create({
  name: "questionBlock",
  group: "block",
  content: "questionText questionOption questionOption questionOption questionOption questionFooter",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      family_id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-family-id"),
        renderHTML: (attributes) =>
          attributes.family_id ? { "data-family-id": attributes.family_id } : {},
      },
      question_id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-question-id"),
        renderHTML: (attributes) =>
          attributes.question_id ? { "data-question-id": attributes.question_id } : {},
      },
      source: {
        default: "manual",
        parseHTML: (element) => element.getAttribute("data-source") || "manual",
        renderHTML: (attributes) =>
          attributes.source && attributes.source !== "manual"
            ? { "data-source": attributes.source }
            : {},
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="question-block"]' },
      { tag: "div.question-block" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "question-block",
        class: "question-block",
      }),
      ["div", { class: "question-header", contenteditable: "false" }],
      ["div", { class: "question-body" }, 0],
    ];
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { state, dispatch } = this.editor.view;
        const { selection } = state;
        const $pos = selection.$from;

        let questionBlockPos = -1;
        let questionBlockNode: PMNode | null = null;
        for (let d = $pos.depth; d > 0; d--) {
          if ($pos.node(d).type.name === "questionBlock") {
            questionBlockPos = $pos.before(d);
            questionBlockNode = $pos.node(d);
            break;
          }
        }

        if (!questionBlockNode || questionBlockPos === -1) {
          return false;
        }

        const subPositions: number[] = [];
        questionBlockNode.descendants((node: PMNode, pos: number) => {
          if (
            node.type.name === "questionText" ||
            node.type.name === "questionOption" ||
            node.type.name === "questionAnswer" ||
            node.type.name === "questionMarks"
          ) {
            subPositions.push(questionBlockPos + 1 + pos + 2);
          }
          return true;
        });

        const currentPos = $pos.pos;
        const nextTarget = subPositions.find((p) => p > currentPos + 2);

        if (nextTarget !== undefined) {
          const tr = state.tr.setSelection(
            TextSelection.create(state.doc, Math.min(nextTarget, state.doc.content.size - 1))
          );
          dispatch(tr);
          return true;
        }

        return false;
      },
      "Shift-Tab": () => {
        const { state, dispatch } = this.editor.view;
        const { selection } = state;
        const $pos = selection.$from;

        let questionBlockPos = -1;
        let questionBlockNode: PMNode | null = null;
        for (let d = $pos.depth; d > 0; d--) {
          if ($pos.node(d).type.name === "questionBlock") {
            questionBlockPos = $pos.before(d);
            questionBlockNode = $pos.node(d);
            break;
          }
        }

        if (!questionBlockNode || questionBlockPos === -1) {
          return false;
        }

        const subPositions: number[] = [];
        questionBlockNode.descendants((node: PMNode, pos: number) => {
          if (
            node.type.name === "questionText" ||
            node.type.name === "questionOption" ||
            node.type.name === "questionAnswer" ||
            node.type.name === "questionMarks"
          ) {
            subPositions.push(questionBlockPos + 1 + pos + 2);
          }
          return true;
        });

        const currentPos = $pos.pos;
        const prevTarget = [...subPositions].reverse().find((p) => p < currentPos - 2);

        if (prevTarget !== undefined) {
          const tr = state.tr.setSelection(
            TextSelection.create(state.doc, Math.min(prevTarget, state.doc.content.size - 1))
          );
          dispatch(tr);
          return true;
        }

        return false;
      },
    };
  },
});

