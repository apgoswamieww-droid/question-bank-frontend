import { useState, useRef, useEffect, useCallback } from "react";
import type { Editor } from "@tiptap/react";

export function useFontMarks(editor: Editor | null) {
  const [selectedFontSize, setSelectedFontSize] = useState("14");
  const savedSelection = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (!editor) return;

    const updateFromEditor = () => {
      const attrs = editor.getAttributes("fontFamily");
      const fontSize = attrs?.fontSize || null;

      setSelectedFontSize(fontSize ? fontSize.replace("px", "") : "14");
    };

    updateFromEditor();

    editor.on("selectionUpdate", updateFromEditor);

    return () => {
      editor.off("selectionUpdate", updateFromEditor);
    };
  }, [editor]);

  const saveSelection = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    savedSelection.current = { from, to };
  }, [editor]);

  const applyFontSize = useCallback(
    (size: string) => {
      if (!editor) return;
      setSelectedFontSize(size);
      const selection = savedSelection.current;

      if (selection) {
        editor
          .chain()
          .focus()
          .setTextSelection(selection)
          .setMark("fontFamily", { fontSize: `${size}px` })
          .run();
        savedSelection.current = null;
      } else {
        editor
          .chain()
          .focus()
          .setMark("fontFamily", { fontSize: `${size}px` })
          .run();
      }
    },
    [editor]
  );

  return {
    selectedFontSize,
    saveSelection,
    applyFontSize,
  };
}