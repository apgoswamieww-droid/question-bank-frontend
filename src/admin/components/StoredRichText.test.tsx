import { describe, it, expect } from "vitest";
import { storedHtml, renderStoredHtml } from "./storedRichHelper";

describe("renderStoredHtml", () => {
  it("extracts the html from a { html } object", () => {
    expect(storedHtml({ html: "<p>Hello</p>" })).toBe("<p>Hello</p>");
  });

  it("extracts the html from a JSON string", () => {
    expect(storedHtml('{"html":"<p>Hi</p>"}')).toBe("<p>Hi</p>");
  });

  it("returns plain strings unchanged", () => {
    expect(storedHtml("plain")).toBe("plain");
  });

  it("returns empty for null", () => {
    expect(storedHtml(null)).toBe("");
  });

  it("renders data-latex math nodes with KaTeX", () => {
    const out = renderStoredHtml({
      html: '<p><span data-latex="\\frac{2 M \\omega}{m + 2 m}" data-display="false" data-type="math-node" class="math-node-rendered is-inline"></span></p>',
    });
    expect(out).not.toContain("data-latex");
    expect(out).toContain("katex");
    expect(out).toContain("m + 2");
  });

  it("leaves HTML without math untouched", () => {
    const html = "<p>A &amp; B</p>";
    expect(renderStoredHtml({ html })).toBe(html);
  });
});