import { DEFAULT_EXAM_METADATA } from "../types/examMetadata";
import type { ExamMetadata, ExamSection, LogoSettings } from "../types/examMetadata";
import type { DocumentJson } from "../print/types";

interface RawMetadata {
  instituteName?: string;
  examTitle?: string;
  subject?: string;
  standard?: string;
  academicYear?: string;
  date?: string;
  timeAllowed?: string;
  totalMarks?: number | null;
  logo?: LogoSettings;
  instructions?: string[];
  numbering?: NumberingSettingsLike;
  sections?: ExamSection[];
}

interface NumberingSettingsLike {
  continueAcrossSections: boolean;
}

export interface QuestionRefV3 {
  familyId: string;
  position: number;
}

export interface RawDocument {
  format?: string;
  version?: number;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: RawMetadata;
  questionRefs?: QuestionRefV3[];
  content?: DocumentJson;
}

export interface QuestionBankDocument {
  format: "question-bank";
  version: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  metadata: ExamMetadata;
  questionRefs?: QuestionRefV3[];
  content: DocumentJson; // Tiptap JSON node
}

export function migrateDocument(rawJson: RawDocument): QuestionBankDocument {
  if (!rawJson || typeof rawJson !== "object") {
    throw new Error("Invalid document structure: JSON object expected.");
  }

  const content = rawJson.content || { type: "doc", content: [] };
  const title = rawJson.title || "Untitled Question Paper";
  const createdAt = rawJson.createdAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  let metadata: ExamMetadata = { ...DEFAULT_EXAM_METADATA };

  if (rawJson.metadata) {
    const raw = rawJson.metadata;
    metadata = {
      instituteName: raw.instituteName ?? DEFAULT_EXAM_METADATA.instituteName,
      examTitle: raw.examTitle ?? DEFAULT_EXAM_METADATA.examTitle,
      subject: raw.subject ?? DEFAULT_EXAM_METADATA.subject,
      standard: raw.standard ?? DEFAULT_EXAM_METADATA.standard,
      academicYear: raw.academicYear ?? DEFAULT_EXAM_METADATA.academicYear,
      date: raw.date ?? DEFAULT_EXAM_METADATA.date,
      timeAllowed: raw.timeAllowed ?? DEFAULT_EXAM_METADATA.timeAllowed,
      totalMarks:
        raw.totalMarks !== undefined ? raw.totalMarks : DEFAULT_EXAM_METADATA.totalMarks,
      logo: raw.logo || undefined,
      instructions: Array.isArray(raw.instructions)
        ? raw.instructions
        : [...DEFAULT_EXAM_METADATA.instructions],
      numbering: raw.numbering || { continueAcrossSections: true },
      sections: Array.isArray(raw.sections)
        ? raw.sections
        : [...DEFAULT_EXAM_METADATA.sections],
    };
  }

  return {
    format: "question-bank",
    version: 3,
    title,
    createdAt,
    updatedAt,
    metadata,
    questionRefs: Array.isArray(rawJson.questionRefs)
      ? rawJson.questionRefs.filter(
          (r) => typeof r?.familyId === "string" && typeof r?.position === "number"
        )
      : undefined,
    content,
  };
}
