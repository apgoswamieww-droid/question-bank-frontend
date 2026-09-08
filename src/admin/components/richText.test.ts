import { describe, it, expect } from "vitest";
import { richTextToPlain } from "../../admin/components/richText";

describe("richTextToPlain", () => {
  it("extracts plain text from the stored { html } rich-text format", () => {
    expect(richTextToPlain({ html: "<p>What is the smallest unit?</p>" })).toBe("What is the smallest unit?");
  });

  it("flattens block elements into spaced text", () => {
    expect(richTextToPlain({ html: "<p>Line one</p><p>Line two</p>" })).toBe("Line one Line two");
  });

  it("decodes basic HTML entities", () => {
    expect(richTextToPlain({ html: "<p>A &amp; B &gt; C&nbsp;D</p>" })).toBe("A & B > C D");
  });

  it("handles ProseMirror node arrays as before", () => {
    expect(richTextToPlain({ type: "doc", content: [{ type: "text", text: "Hello" }, { type: "text", text: "World" }] })).toBe("Hello World");
  });

  it("returns plain strings unchanged", () => {
    expect(richTextToPlain("Just text")).toBe("Just text");
  });

  it("returns an empty string for null/undefined", () => {
    expect(richTextToPlain(null)).toBe("");
    expect(richTextToPlain(undefined)).toBe("");
  });
});