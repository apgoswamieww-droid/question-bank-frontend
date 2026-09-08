import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { MathNode } from "./MathNode";

describe("MathNode", () => {
  it("serializes a leaf math node without a content hole", () => {
    const editor = new Editor({
      extensions: [StarterKit, MathNode],
      content:
        '<p>Solve <span data-type="math-node" data-latex="x^2" data-display="false"></span> = 4</p>',
    });

    const html = editor.getHTML();
    expect(html).toContain('data-type="math-node"');
    expect(html).toContain('data-latex="x^2"');
    expect(() => editor.getHTML()).not.toThrow();
    editor.destroy();
  });

  it("round-trips inline math through getHTML and setContent", () => {
    const editor = new Editor({
      extensions: [StarterKit, MathNode],
      content: "",
    });

    editor.commands.insertContent([
      {
        type: "mathNode",
        attrs: { latex: "\\frac{a}{b}", displayMode: false },
      },
    ]);

    const html = editor.getHTML();
    expect(html).toContain('data-type="math-node"');
    expect(html).toContain("\\frac{a}{b}");

    editor.commands.setContent(html);
    expect(editor.getHTML()).toBe(html);
    editor.destroy();
  });
});