import {
  FilePlus,
  FolderOpen,
  Save,
  FileDown,
  Printer,
  Sliders,
  Clock,
  Library,
  CloudUpload,
  Loader2,
} from "lucide-react";
import type { RecentFileItem } from "../types/files";
import type { Language } from "../api/client";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface DocumentToolbarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExamSettings: () => void;
  onPrintPreview: () => void;
  onQuestionBank: () => void;
  onSaveToCloud: () => void;
  cloudSaving: boolean;
  language: Language | null;
  languageSwitching: boolean;
  missingLanguageCount: number;
  onSwitchLanguage: (lang: Language) => void;
  recentFiles: RecentFileItem[];
  isRecentOpen: boolean;
  setIsRecentOpen: (open: boolean) => void;
}

export function DocumentToolbar({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExamSettings,
  onPrintPreview,
  onQuestionBank,
  onSaveToCloud,
  cloudSaving,
  language,
  languageSwitching,
  missingLanguageCount,
  onSwitchLanguage,
  recentFiles,
  isRecentOpen,
  setIsRecentOpen,
}: DocumentToolbarProps) {
  return (
    <div className="toolbar doc-toolbar">
      <div className="toolbar-group">
        <button
          type="button"
          className="btn-with-label"
          title="New Document (Ctrl+N)"
          onClick={onNew}
        >
          <FilePlus size={15} strokeWidth={2} /> <span>New</span>
        </button>
        <button
          type="button"
          className="btn-with-label"
          title="Open Document (Ctrl+O)"
          onClick={onOpen}
        >
          <FolderOpen size={15} strokeWidth={2} /> <span>Open</span>
        </button>
        <button
          type="button"
          className="btn-with-label"
          title="Save Document (Ctrl+S)"
          onClick={onSave}
        >
          <Save size={15} strokeWidth={2} /> <span>Save</span>
        </button>
        <button
          type="button"
          className="btn-with-label"
          title="Save As... (Ctrl+Shift+S)"
          onClick={onSaveAs}
        >
          <FileDown size={15} strokeWidth={2} /> <span>Save As</span>
        </button>
        <button
          type="button"
          className="btn-with-label"
          title="Configure Exam Paper Header & Sections"
          onClick={onExamSettings}
        >
          <Sliders size={15} strokeWidth={2} /> <span>Exam Settings</span>
        </button>
        <button
          type="button"
          className="btn-with-label"
          title="Insert questions from the question bank"
          onClick={onQuestionBank}
        >
          <Library size={15} strokeWidth={2} /> <span>Question Bank</span>
        </button>
        <LanguageSwitcher
          current={language}
          disabled={languageSwitching}
          missingCount={missingLanguageCount}
          onSwitch={onSwitchLanguage}
        />
        <button
          type="button"
          className="btn-with-label"
          title="Save this paper to the cloud question bank"
          onClick={onSaveToCloud}
          disabled={cloudSaving}
        >
          {cloudSaving ? (
            <Loader2 size={15} strokeWidth={2} className="animate-spin" />
          ) : (
            <CloudUpload size={15} strokeWidth={2} />
          )}{" "}
          <span>Save to Cloud</span>
        </button>
        <button
          type="button"
          className="btn-with-label btn-action-accent"
          title="Print Preview & PDF Export"
          onClick={onPrintPreview}
        >
          <Printer size={15} strokeWidth={2} />{" "}
          <span>Print Preview / PDF</span>
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group recent-files-container">
        <button
          type="button"
          className="btn-with-label"
          title="Recent Documents"
          onClick={() => setIsRecentOpen(!isRecentOpen)}
        >
          <Clock size={15} strokeWidth={2} /> <span>Recent Files</span>
        </button>
        {isRecentOpen && (
          <div className="recent-dropdown">
            {recentFiles.length === 0 ? (
              <div className="recent-item empty">No recent files</div>
            ) : (
              recentFiles.map((file) => (
                <div
                  key={file.openedAt}
                  className="recent-item"
                >
                  <span className="recent-name">{file.name}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
