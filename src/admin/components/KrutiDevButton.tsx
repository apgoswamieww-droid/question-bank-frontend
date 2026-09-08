import { Languages } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { krutiDevToUnicode, isKrutiDev } from "../../utils/krutidevConverter";
import { toast } from "sonner";

interface KrutiDevButtonProps {
  editor: Editor | null;
  compact?: boolean;
}

export function KrutiDevButton({ editor, compact }: KrutiDevButtonProps) {
  if (!editor) return null;

  const handleConvert = () => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");

    if (!selectedText) {
      toast.error("No text selected", {
        description: "Select KrutiDev text to convert to Unicode",
      });
      return;
    }

    if (!isKrutiDev(selectedText)) {
      toast.info("Already Unicode", {
        description: "The selected text doesn't contain KrutiDev characters",
      });
      return;
    }

    const converted = krutiDevToUnicode(selectedText);
    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent(converted)
      .run();

    const charCount = selectedText.replace(/[\x00-\x7F]/g, "").length; // count non-ASCII
    toast.success("Converted to Unicode", {
      description: `${charCount} KrutiDev character(s) converted`,
    });
  };

  return (
    <button
      type="button"
      title="Convert KrutiDev to Unicode"
      onMouseDown={(e) => {
        e.preventDefault();
        handleConvert();
      }}
      className={`flex items-center justify-center rounded-lg transition ${
        compact ? "h-6 w-6" : "h-8 w-8"
      } text-slate-500 hover:bg-slate-100 hover:text-slate-800`}
    >
      <Languages className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </button>
  );
}
