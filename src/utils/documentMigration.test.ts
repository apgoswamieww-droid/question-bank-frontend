import { describe, it, expect } from "vitest";
import { migrateDocument } from "./documentMigration";
import { DEFAULT_EXAM_METADATA } from "../types/examMetadata";

describe("migrateDocument", () => {
  it("throws on invalid input", () => {
    expect(() => migrateDocument(null as never)).toThrow();
    expect(() => migrateDocument("string" as never)).toThrow();
  });

  it("fills defaults for empty metadata", () => {
    const raw = {
      format: "question-bank",
      version: 1,
      content: { type: "doc", content: [] },
    };
    const result = migrateDocument(raw);
    expect(result.format).toBe("question-bank");
    expect(result.version).toBe(3);
    expect(result.metadata.instituteName).toBe(DEFAULT_EXAM_METADATA.instituteName);
    expect(result.metadata.sections).toEqual(DEFAULT_EXAM_METADATA.sections);
  });

  it("preserves existing metadata fields", () => {
    const raw = {
      format: "question-bank",
      version: 1,
      title: "My Exam",
      metadata: {
        instituteName: "Custom School",
        subject: "Mathematics",
        totalMarks: 100,
      },
      content: { type: "doc", content: [] },
    };
    const result = migrateDocument(raw);
    expect(result.metadata.instituteName).toBe("Custom School");
    expect(result.metadata.subject).toBe("Mathematics");
    expect(result.metadata.totalMarks).toBe(100);
  });

  it("uses default title when missing", () => {
    const raw = {
      format: "question-bank",
      content: { type: "doc", content: [] },
    };
    const result = migrateDocument(raw);
    expect(result.title).toBe("Untitled Question Paper");
  });

  it("preserves provided title", () => {
    const raw = {
      format: "question-bank",
      title: "My Exam",
      content: { type: "doc", content: [] },
    };
    const result = migrateDocument(raw);
    expect(result.title).toBe("My Exam");
  });

  it("handles missing content gracefully", () => {
    const raw = {};
    const result = migrateDocument(raw);
    expect(result.content).toEqual({ type: "doc", content: [] });
  });

  it("always sets version to 3", () => {
    const raw = {
      format: "question-bank",
      version: 1,
      content: { type: "doc", content: [] },
    };
    const result = migrateDocument(raw);
    expect(result.version).toBe(3);
  });

  it("preserves custom sections", () => {
    const customSections = [
      {
        id: "custom-1",
        title: "Custom Section",
        numberingMode: "restart" as const,
      },
    ];
    const raw = {
      format: "question-bank",
      metadata: {
        sections: customSections,
      },
      content: { type: "doc", content: [] },
    };
    const result = migrateDocument(raw);
    expect(result.metadata.sections).toEqual(customSections);
  });

  it("preserves custom instructions", () => {
    const customInstructions = ["Custom instruction 1", "Custom instruction 2"];
    const raw = {
      format: "question-bank",
      metadata: {
        instructions: customInstructions,
      },
      content: { type: "doc", content: [] },
    };
    const result = migrateDocument(raw);
    expect(result.metadata.instructions).toEqual(customInstructions);
  });

  it("sets createdAt from raw data when provided", () => {
    const raw = {
      format: "question-bank",
      createdAt: "2025-01-15T10:30:00.000Z",
      content: { type: "doc", content: [] },
    };
    const result = migrateDocument(raw);
    expect(result.createdAt).toBe("2025-01-15T10:30:00.000Z");
  });

  it("generates createdAt when not provided", () => {
    const raw = {
      format: "question-bank",
      content: { type: "doc", content: [] },
    };
    const result = migrateDocument(raw);
    expect(result.createdAt).toBeTruthy();
    expect(new Date(result.createdAt).getTime()).not.toBeNaN();
  });
});
