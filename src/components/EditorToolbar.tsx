import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  RemoveFormatting,
  HelpCircle,
  Image as ImageIcon,
  Sigma,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import {
  QUESTION_BLOCK_TEMPLATE,
  QUESTION_PLACEHOLDER,
} from "../utils/questionBlockTemplate";
import { TextSelection } from "@tiptap/pm/state";

const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36];

interface EditorToolbarProps {
  editor: Editor;
  selectedFontSize: string;
  saveSelection: () => void;
  applyFontSize: (size: string) => void;
  onAlignment: (alignment: "left" | "center" | "right" | "justify") => void;
  onInsertImage: () => void;
  onInsertEquation: () => void;
}

export function EditorToolbar({
  editor,
  selectedFontSize,
  saveSelection,
  applyFontSize,
  onAlignment,
  onInsertImage,
  onInsertEquation,
}: EditorToolbarProps) {
  const insertQuestionBlock = () => {
    editor
      .chain()
      .focus()
      .insertContent([...QUESTION_BLOCK_TEMPLATE])
      .run();

    setTimeout(() => {
      const { state, dispatch } = editor.view;
      const { $from } = state.selection;

      let qPos = -1;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === "questionBlock") {
          qPos = $from.before(d);
          break;
        }
      }

      if (qPos !== -1) {
        const textPos = qPos + 3;
        const tr = state.tr.setSelection(
          TextSelection.create(
            state.doc,
            textPos,
            textPos + QUESTION_PLACEHOLDER.length
          )
        );
        dispatch(tr);
      }
    }, 10);
  };

  return (
    <div className="toolbar editor-toolbar">
      <div className="toolbar-group">
        <button
          type="button"
          className="btn-icon-only"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          disabled={!editor.can().undo()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={16} strokeWidth={2} />
        </button>

        <button
          type="button"
          className="btn-icon-only"
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          disabled={!editor.can().redo()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          type="button"
          className={`btn-icon-only ${editor.isActive("bold") ? "active" : ""}`}
          title="Bold (Ctrl+B)"
          aria-label="Bold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={16} strokeWidth={2} />
        </button>

        <button
          type="button"
          className={`btn-icon-only ${editor.isActive("italic") ? "active" : ""}`}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={16} strokeWidth={2} />
        </button>

        <button
          type="button"
          className={`btn-icon-only ${editor.isActive("underline") ? "active" : ""}`}
          title="Underline (Ctrl+U)"
          aria-label="Underline"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <select
          className="toolbar-select size-select"
          value={selectedFontSize}
          onMouseDown={saveSelection}
          onChange={(e) => applyFontSize(e.target.value)}
          title="Font Size"
        >
          {fontSizes.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          type="button"
          className={`btn-icon-only ${
            editor.isActive("resizableImage", { alignment: "left" }) ||
            editor.isActive({ textAlign: "left" })
              ? "active"
              : ""
          }`}
          title="Align Left"
          aria-label="Align Left"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAlignment("left")}
        >
          <AlignLeft size={16} strokeWidth={2} />
        </button>

        <button
          type="button"
          className={`btn-icon-only ${
            editor.isActive("resizableImage", { alignment: "center" }) ||
            editor.isActive({ textAlign: "center" })
              ? "active"
              : ""
          }`}
          title="Align Center"
          aria-label="Align Center"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAlignment("center")}
        >
          <AlignCenter size={16} strokeWidth={2} />
        </button>

        <button
          type="button"
          className={`btn-icon-only ${
            editor.isActive("resizableImage", { alignment: "right" }) ||
            editor.isActive({ textAlign: "right" })
              ? "active"
              : ""
          }`}
          title="Align Right"
          aria-label="Align Right"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAlignment("right")}
        >
          <AlignRight size={16} strokeWidth={2} />
        </button>

        <button
          type="button"
          className={`btn-icon-only ${editor.isActive({ textAlign: "justify" }) ? "active" : ""}`}
          title="Justify"
          aria-label="Justify"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAlignment("justify")}
        >
          <AlignJustify size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          type="button"
          className={`btn-icon-only ${editor.isActive("bulletList") ? "active" : ""}`}
          title="Bullet List"
          aria-label="Bullet List"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={16} strokeWidth={2} />
        </button>

        <button
          type="button"
          className={`btn-icon-only ${editor.isActive("orderedList") ? "active" : ""}`}
          title="Numbered List"
          aria-label="Numbered List"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          type="button"
          className="btn-with-label btn-action-accent"
          title="Insert Question Block"
          aria-label="Insert Question"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertQuestionBlock}
        >
          <HelpCircle size={16} strokeWidth={2} /> <span>MCQ Block</span>
        </button>

        <button
          type="button"
          className="btn-with-label btn-action-accent"
          title="Insert Image"
          aria-label="Insert Image"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onInsertImage}
        >
          <ImageIcon size={16} strokeWidth={2} /> <span>Image</span>
        </button>

        <button
          type="button"
          className="btn-with-label btn-action-accent"
          title="Insert Equation"
          aria-label="Insert Equation"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onInsertEquation}
        >
          <Sigma size={16} strokeWidth={2} /> <span>Equation</span>
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          type="button"
          className="btn-icon-only"
          title="Clear Formatting"
          aria-label="Clear Formatting"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
        >
          <RemoveFormatting size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
