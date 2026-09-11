import { useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { ExamMetadata } from "../types/examMetadata";
import { DEFAULT_EXAM_METADATA } from "../types/examMetadata";
import { migrateDocument } from "../utils/documentMigration";
import { extractQuestionRefs } from "../utils/questionRefs";
import {
  openFileFromDisk,
  saveFileToDisk,
  saveAsFileToDisk,
  clearSavedHandle,
} from "../web/fileApi";
import { addRecentFile } from "../web/recentFiles";
import type { ConfirmCloseResult } from "../types/files";

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Unknown error";

interface UseDocumentManagementOptions {
  editor: Editor | null;
  showToast: (msg: string) => void;
}

function confirmClosePrompt(isDirty: boolean): ConfirmCloseResult {
  if (!isDirty) return "dontsave";
  const choice = window.confirm(
    "You have unsaved changes. Do you want to save before continuing?"
  );
  return choice ? "save" : "dontsave";
}

export function useDocumentManagement({
  editor,
  showToast,
}: UseDocumentManagementOptions) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState<string>("Untitled Question Paper");
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [examMetadata, setExamMetadata] =
    useState<ExamMetadata>(DEFAULT_EXAM_METADATA);

  const saveDocumentContent = useCallback(
    async (): Promise<boolean> => {
      if (!editor) return false;

      const title = docTitle || "Untitled Question Paper";
      const docPayload = {
        format: "question-bank",
        version: 3,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: examMetadata,
        questionRefs: extractQuestionRefs(editor),
        content: editor.getJSON(),
      };

      try {
        const savedName = await saveFileToDisk(
          title,
          JSON.stringify(docPayload, null, 2)
        );
        if (savedName) {
          setFilePath(savedName);
          setDocTitle(title);
          setIsDirty(false);
          setAutoSaveStatus("saved");
          addRecentFile(savedName);
          return true;
        }
      } catch (err) {
        console.error("Save error:", err);
        setAutoSaveStatus("error");
        showToast(`Save failed: ${getErrorMessage(err)}`);
      }
      return false;
    },
    [editor, docTitle, examMetadata, showToast]
  );

  const handleSaveAs = useCallback(async (): Promise<boolean> => {
    if (!editor) return false;
    try {
      const title = docTitle || "Untitled Question Paper";
      const docPayload = {
        format: "question-bank",
        version: 3,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: examMetadata,
        questionRefs: extractQuestionRefs(editor),
        content: editor.getJSON(),
      };
      const savedName = await saveAsFileToDisk(
        title,
        JSON.stringify(docPayload, null, 2)
      );
      if (savedName) {
        setFilePath(savedName);
        setDocTitle(title);
        setIsDirty(false);
        setAutoSaveStatus("saved");
        addRecentFile(savedName);
        return true;
      }
    } catch (err) {
      console.error("Save As error:", err);
      showToast(`Save As failed: ${getErrorMessage(err)}`);
    }
    return false;
  }, [editor, docTitle, examMetadata, showToast]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    return await saveDocumentContent();
  }, [saveDocumentContent]);

  const handleOpenContent = useCallback(
    (targetName: string, jsonString: string) => {
      if (!editor) return;
      try {
        const parsed = JSON.parse(jsonString);
        if (parsed.format !== "question-bank" || !parsed.content) {
          alert(
            "Unable to open this file.\n\nThe selected file is not a valid Question Bank document."
          );
          return;
        }

        const migrated = migrateDocument(parsed);

        editor.commands.setContent(migrated.content);
        setExamMetadata(migrated.metadata);
        setFilePath(targetName);
        const name =
          targetName.replace(/\.qbank$/i, "") ||
          migrated.title ||
          "Untitled Document";
        setDocTitle(name);
        setIsDirty(false);
        setAutoSaveStatus("idle");
        addRecentFile(targetName);
      } catch (err) {
        console.error("Parse document error:", err);
        alert(
          "Unable to open this file.\n\nFailed to parse Question Bank document JSON structure."
        );
      }
    },
    [editor]
  );

  const handleOpen = useCallback(async () => {
    if (isDirty) {
      const choice = confirmClosePrompt(true);
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await handleSave();
        if (!saved) return;
      }
    }

    try {
      const result = await openFileFromDisk();
      if (result && result.content) {
        handleOpenContent(result.name, result.content);
      }
    } catch (err) {
      console.error("Open dialog error:", err);
      showToast(`Open failed: ${getErrorMessage(err)}`);
    }
  }, [isDirty, handleSave, handleOpenContent, showToast]);

  const handleNew = useCallback(async () => {
    if (!editor) return;
    if (isDirty) {
      const choice = confirmClosePrompt(true);
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await handleSave();
        if (!saved) return;
      }
    }

    editor.commands.setContent("<p></p>");
    clearSavedHandle();
    setFilePath(null);
    setDocTitle("Untitled Question Paper");
    setIsDirty(false);
    setAutoSaveStatus("idle");
  }, [editor, isDirty, handleSave]);

  const handleSaveExamMetadata = useCallback((updatedMetadata: ExamMetadata) => {
    setExamMetadata(updatedMetadata);
    setIsDirty(true);
  }, []);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  return {
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
  };
}
