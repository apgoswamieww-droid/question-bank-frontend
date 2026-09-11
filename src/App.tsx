import { useRef, useState, useCallback } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";

import {
  QuestionBlock,
  QuestionText,
  QuestionOption,
  QuestionFooter,
  QuestionAnswer,
  QuestionMarks,
} from "./QuestionBlock";
import { ResizableImage } from "./ResizableImage";
import { MathNode } from "./MathNode";
import { FontMark } from "./extensions/FontMark";
import { MathEditorModal } from "./MathEditorModal";
import { readMathFromClipboard, hasMathMLOnClipboard } from "./utils/mathPaste";
import { PrintPreviewModal } from "./print/PrintPreviewModal";
import { ExamSettingsModal } from "./components/ExamSettingsModal";
import { AppHeader } from "./components/AppHeader";
import { DocumentToolbar } from "./components/DocumentToolbar";
import { EditorToolbar } from "./components/EditorToolbar";
import {
  QuestionPickerPanel,
  type PickerQuestion,
} from "./components/QuestionPickerPanel";
import { buildQuestionBlockFromBank } from "./utils/questionBlockTemplate";
import { extractFamilyIds } from "./utils/questionRefs";
import { api, type Language, type PaperInput, type QuestionVariant } from "./api/client";

import { useToast } from "./hooks/useToast";
import { useAutoSave } from "./hooks/useAutoSave";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useWindowCloseHandler } from "./hooks/useWindowCloseHandler";
import { useRecentFiles } from "./hooks/useRecentFiles";
import { useMathModal } from "./hooks/useMathModal";
import { useFontMarks } from "./hooks/useFontMarks";
import { useDocumentManagement } from "./hooks/useDocumentManagement";

import "./index.css";

function App() {
  const { toastMessage, showToast } = useToast();
  const {
    recentFiles,
    isRecentOpen,
    setIsRecentOpen,
  } = useRecentFiles();

  const {
    isMathModalOpen,
    mathInitialLatex,
    mathInitialDisplayMode,
    mathUpdateCallback,
    handleOpenMathEditor,
    openNewMathModal,
    closeMathModal,
  } = useMathModal();

  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [isExamSettingsOpen, setIsExamSettingsOpen] = useState(false);
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState(false);
  const [paperLanguage, setPaperLanguage] = useState<Language | null>(null);
  const [isSwitchingLanguage, setIsSwitchingLanguage] = useState(false);
  const [missingTranslations, setMissingTranslations] = useState<string[]>([]);
  const [cloudPaperId, setCloudPaperId] = useState<string | null>(null);
  const [cloudSaving, setCloudSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    filePath,
    docTitle,
    isDirty,
    autoSaveStatus,
    examMetadata,
    saveDocumentContent,
    handleSave,
    handleSaveAs,
    handleOpen,
    handleNew,
    handleSaveExamMetadata,
    markDirty,
  } = useDocumentManagement({ editor: null, showToast });

  useAutoSave({
    filePath,
    isDirty,
    onSave: saveDocumentContent,
    onStatusChange: () => {},
  });

  useWindowCloseHandler({ isDirty, onSave: handleSave });

  useKeyboardShortcuts({
    onSave: handleSave,
    onSaveAs: handleSaveAs,
    onNew: handleNew,
    onOpen: handleOpen,
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: "left",
      }),
      FontMark,
      QuestionBlock,
      QuestionText,
      QuestionOption,
      QuestionFooter,
      QuestionAnswer,
      QuestionMarks,
      ResizableImage,
      MathNode.configure({
        onOpenEditor: handleOpenMathEditor,
      }),
    ],

    editorProps: {
      handlePaste: (_view, event) => {
        if (event.clipboardData) {
          const math = readMathFromClipboard(event.clipboardData);
          if (math.length > 0) {
            event.preventDefault();
            const chain = editor.chain().focus();
            math.forEach(({ latex, displayMode }, idx) => {
              chain.insertContent({
                type: "mathNode",
                attrs: { latex, displayMode },
              });
              if (idx < math.length - 1) chain.insertContent(" ");
            });
            chain.run();
            return true;
          }
          if (hasMathMLOnClipboard(event.clipboardData)) {
            event.preventDefault();
            showToast(
              "MathType equation could not be converted to LaTeX. Please copy the equation again and retry."
            );
            return true;
          }
        }

        const items = event.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                editor
                  ?.chain()
                  .focus()
                  .insertContent({
                    type: "resizableImage",
                    attrs: {
                      src: dataUrl,
                      alt: file.name || "Pasted image",
                      width: "300px",
                      alignment: "center",
                    },
                  })
                  .run();
              };
              reader.readAsDataURL(file);
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const file = files[0];
        if (file.type.startsWith("image/")) {
          event.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            editor
              ?.chain()
              .focus()
              .insertContent({
                type: "resizableImage",
                attrs: {
                  src: dataUrl,
                  alt: file.name || "Dropped image",
                  width: "300px",
                  alignment: "center",
                },
              })
              .run();
          };
          reader.readAsDataURL(file);
          return true;
        }
        return false;
      },
    },

    content: `
      <p>Example question paper text.</p>
      <p>English text: Calculate the value of X when x² + 2x + 1 = 0.</p>
    `,

    onUpdate: () => {
      markDirty();
    },
  });

  const { selectedFontSize, saveSelection, applyFontSize } = useFontMarks(editor);

  const handleAlignment = useCallback(
    (alignment: "left" | "center" | "right" | "justify") => {
      if (!editor) return;

      if (editor.isActive("resizableImage")) {
        const targetAlign = alignment === "justify" ? "center" : alignment;
        editor
          .chain()
          .focus()
          .updateAttributes("resizableImage", { alignment: targetAlign })
          .run();
      } else {
        editor.chain().focus().setTextAlign(alignment).run();
      }
    },
    [editor]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file (.png, .jpg, .jpeg, .webp, .gif)");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        editor
          ?.chain()
          .focus()
          .insertContent({
            type: "resizableImage",
            attrs: {
              src: dataUrl,
              alt: file.name,
              width: "300px",
              alignment: "center",
            },
          })
          .run();
      };
      reader.readAsDataURL(file);

      e.target.value = "";
    },
    [editor]
  );

  const handleMathSubmit = useCallback(
    (latex: string, displayMode: boolean) => {
      if (!editor) return;

      if (mathUpdateCallback) {
        mathUpdateCallback(latex, displayMode);
      } else {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "mathNode",
            attrs: {
              latex,
              displayMode,
            },
          })
          .run();
      }
    },
    [editor, mathUpdateCallback]
  );

  const handleInsertFromBank = useCallback(
    (questions: PickerQuestion[]) => {
      if (!editor) return;
      const nodes = [];
      for (const q of questions) {
        nodes.push(
          buildQuestionBlockFromBank({
            id: q.question_id,
            family_id: q.family_id,
            content: q.question.content,
            marks: q.question.marks,
            options: q.variants?.[0]?.options ?? [],
          })
        );
        nodes.push({ type: "paragraph" });
      }
      editor.chain().focus().insertContent(nodes).run();
      markDirty();
    },
    [editor, markDirty]
  );

  const handleSwitchLanguage = useCallback(
    async (lang: Language) => {
      if (!editor) return;
      setIsSwitchingLanguage(true);
      try {
        const blocks: { pos: number; nodeSize: number; questionId: string }[] = [];
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === "questionBlock" && node.attrs.question_id) {
            blocks.push({
              pos,
              nodeSize: node.nodeSize,
              questionId: node.attrs.question_id as string,
            });
          }
          return true;
        });

        const uniqueIds = [...new Set(blocks.map((b) => b.questionId))];
        const variantMap = new Map<string, { family_id: string | null; variants: QuestionVariant[] }>();
        for (const id of uniqueIds) {
          try {
            variantMap.set(id, await api.questions.variants(id));
          } catch {
            variantMap.set(id, { family_id: null, variants: [] });
          }
        }

        const missing: string[] = [];
        for (let i = blocks.length - 1; i >= 0; i--) {
          const { pos, nodeSize, questionId } = blocks[i];
          const data = variantMap.get(questionId);
          const target = data?.variants?.find((v) => v.language_id === lang.id);
          if (!target) {
            missing.push(questionId);
            continue;
          }
          const newBlock = buildQuestionBlockFromBank({
            id: target.id,
            family_id: target.family_id ?? data?.family_id ?? null,
            content: target.content,
            marks: target.marks,
            options: target.options,
          });
          editor.chain().focus().command(({ tr }) => {
            tr.replaceWith(pos, pos + nodeSize, editor.schema.nodeFromJSON(newBlock));
            return true;
          }).run();
        }

        setPaperLanguage(lang);
        setMissingTranslations(missing);
        if (missing.length > 0) {
          showToast(
            `Switched to ${lang.name}: ${missing.length} question(s) not available in this language yet.`
          );
        }
        markDirty();
      } catch {
        showToast("Failed to switch paper language.");
      } finally {
        setIsSwitchingLanguage(false);
      }
    },
    [editor, markDirty, showToast]
  );

  const handleSaveToCloud = useCallback(async () => {
    if (!editor) return;
    const familyIds = extractFamilyIds(editor);
    if (familyIds.length === 0) {
      showToast("Insert questions from the Question Bank before saving to cloud.");
      return;
    }
    setCloudSaving(true);
    try {
      const input: PaperInput = {
        title: docTitle || "Untitled Question Paper",
        familyIds,
        status: "published",
      };
      if (cloudPaperId) {
        const updated = await api.papers.update(cloudPaperId, input);
        setCloudPaperId(updated.id);
        showToast("Paper updated in cloud.");
      } else {
        const created = await api.papers.create(input);
        setCloudPaperId(created.id);
        showToast(`Paper saved to cloud (id ${created.id.slice(0, 8)}…).`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save to cloud.");
    } finally {
      setCloudSaving(false);
    }
  }, [editor, docTitle, cloudPaperId, showToast]);

  if (!editor) {
    return null;
  }

  return (
    <div className="app">
      <AppHeader
        docTitle={docTitle}
        isDirty={isDirty}
        autoSaveStatus={autoSaveStatus}
      />

      {toastMessage && (
        <div className="toast-notification">{toastMessage}</div>
      )}

      <main className="editor-wrapper">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp, image/gif"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <DocumentToolbar
          onNew={handleNew}
          onOpen={handleOpen}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onExamSettings={() => setIsExamSettingsOpen(true)}
          onPrintPreview={() => setIsPrintPreviewOpen(true)}
          onQuestionBank={() => setIsQuestionPickerOpen(true)}
          onSaveToCloud={handleSaveToCloud}
          cloudSaving={cloudSaving}
          language={paperLanguage}
          languageSwitching={isSwitchingLanguage}
          missingLanguageCount={missingTranslations.length}
          onSwitchLanguage={handleSwitchLanguage}
          recentFiles={recentFiles}
          isRecentOpen={isRecentOpen}
          setIsRecentOpen={setIsRecentOpen}
        />

        <EditorToolbar
          editor={editor}
          selectedFontSize={selectedFontSize}
          saveSelection={saveSelection}
          applyFontSize={applyFontSize}
          onAlignment={handleAlignment}
          onInsertImage={() => fileInputRef.current?.click()}
          onInsertEquation={openNewMathModal}
        />

        <EditorContent editor={editor} />
      </main>

      {isMathModalOpen && (
        <MathEditorModal
          isOpen={isMathModalOpen}
          initialLatex={mathInitialLatex}
          initialDisplayMode={mathInitialDisplayMode}
          onClose={closeMathModal}
          onSubmit={handleMathSubmit}
        />
      )}

      {isExamSettingsOpen && (
        <ExamSettingsModal
          isOpen
          onClose={() => setIsExamSettingsOpen(false)}
          metadata={examMetadata}
          onSave={handleSaveExamMetadata}
        />
      )}

      <QuestionPickerPanel
        isOpen={isQuestionPickerOpen}
        onClose={() => setIsQuestionPickerOpen(false)}
        onInsert={handleInsertFromBank}
      />

      <PrintPreviewModal
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
        documentJSON={editor?.getJSON() || {}}
        documentTitle={docTitle}
        metadata={examMetadata}
      />
    </div>
  );
}

export default App;
