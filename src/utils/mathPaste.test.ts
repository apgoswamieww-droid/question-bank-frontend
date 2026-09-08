import { describe, it, expect } from "vitest";
import {
  containsMathML,
  extractMathFromHtml,
  readMathFromClipboard,
  hasMathMLOnClipboard,
  normalizeLatexSafety,
  type ExtractedMath,
} from "./mathPaste";

const mathtypeHtml = `
<html>
<head></head>
<body>
  <math display="block" xmlns="http://www.w3.org/1998/Math/MathML">
    <semantics>
      <mrow>
        <mi>A</mi>
        <mo>=</mo>
        <msup>
          <mi>x</mi>
          <mn>2</mn>
        </msup>
      </mrow>
      <annotation encoding="MathType-MTEF">MathType@MTEF@5@5@+=feaagKart1ev2aaatCvAUf</annotation>
    </semantics>
  </math>
</body>
</html>
`;

const mathjaxHtml = `
<p>Solve <math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mn>2</mn><mi>x</mi><mo>+</mo><mn>1</mn><mo>=</mo><mn>0</mn></math> for x.</p>
`;

const gujaratiHtml = `<p>ગુજરાતી લખાણ અને English text સાથે</p>`;
const imagePasteHtml = `<p><img src="data:image/png;base64,iVBORw0KGgo=" /></p>`;
const plainText = "This is just plain text with the number 10 and the letter x";

function makeDataTransfer(entries: Record<string, string>): DataTransfer {
  const store = new Map(Object.entries(entries));
  return {
    getData: (type: string) => store.get(type) ?? "",
  } as unknown as DataTransfer;
}

function one(html: string): ExtractedMath {
  const result = extractMathFromHtml(html);
  expect(result.length).toBe(1);
  return result[0];
}

const wrapMathML = (inner: string, display = "inline") =>
  `<html><body><math xmlns="http://www.w3.org/1998/Math/MathML"${display === "block" ? ' display="block"' : ""}>${inner}</math></body></html>`;

describe("mathPaste", () => {
  describe("containsMathML", () => {
    it("returns true for MathType HTML fragments", () => {
      expect(containsMathML(mathtypeHtml)).toBe(true);
    });

    it("returns true for MathJax inline math", () => {
      expect(containsMathML(mathjaxHtml)).toBe(true);
    });

    it("returns false for plain HTML", () => {
      expect(containsMathML("<p>Just <b>text</b> here</p>")).toBe(false);
    });

    it("returns false for empty input", () => {
      expect(containsMathML("")).toBe(false);
    });
  });

  describe("extractMathFromHtml: 14 equation conversions", () => {
    it("1) x + y = 10", () => {
      const { latex, displayMode } = one(
        wrapMathML("<mi>x</mi><mo>+</mo><mi>y</mi><mo>=</mo><mn>10</mn>")
      );
      expect(latex).toBe("x + y = 10");
      expect(displayMode).toBe(false);
    });

    it("2) fraction (a+b)/(c+d)", () => {
      const { latex } = one(
        wrapMathML(
          `<mfrac><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mrow><mi>c</mi><mo>+</mo><mi>d</mi></mrow></mfrac>`
        )
      );
      expect(latex).toBe("\\frac{a + b}{c + d}");
    });

    it("3) x^2 + y^2 = z^2", () => {
      const { latex } = one(
        wrapMathML(
          `<msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><msup><mi>y</mi><mn>2</mn></msup><mo>=</mo><msup><mi>z</mi><mn>2</mn></msup>`
        )
      );
      expect(latex).toBe("x^{2} + y^{2} = z^{2}");
    });

    it("4) sqrt(x^2 + y^2)", () => {
      const { latex } = one(
        wrapMathML(
          `<msqrt><mrow><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><msup><mi>y</mi><mn>2</mn></msup></mrow></msqrt>`
        )
      );
      expect(latex).toBe("\\sqrt{x^{2} + y^{2}}");
    });

    it("5) quadratic formula", () => {
      const { latex } = one(
        wrapMathML(
          `<mi>x</mi><mo>=</mo><mfrac><mrow><mo>-</mo><mi>b</mi><mo>±</mo><msqrt><msup><mi>b</mi><mn>2</mn></msup><mo>-</mo><mn>4</mn><mi>a</mi><mi>c</mi></msqrt></mrow><mrow><mn>2</mn><mi>a</mi></mrow></mfrac>`
        )
      );
      expect(latex).toBe("x = \\frac{- b \\pm \\sqrt{b^{2} - 4 a c}}{2 a}");
    });

    it("6) a_1 + a_2 + a_3", () => {
      const { latex } = one(
        wrapMathML(
          `<msub><mi>a</mi><mn>1</mn></msub><mo>+</mo><msub><mi>a</mi><mn>2</mn></msub><mo>+</mo><msub><mi>a</mi><mn>3</mn></msub>`
        )
      );
      expect(latex).toBe("a_{1} + a_{2} + a_{3}");
    });

    it("7) α + β + γ = θ", () => {
      const { latex } = one(
        wrapMathML(
          `<mi>α</mi><mo>+</mo><mi>β</mi><mo>+</mo><mi>γ</mi><mo>=</mo><mi>θ</mi>`
        )
      );
      expect(latex).toBe("\\alpha + \\beta + \\gamma = \\theta");
    });

    it("8) x ≤ 10", () => {
      const { latex } = one(wrapMathML(`<mi>x</mi><mo>≤</mo><mn>10</mn>`));
      expect(latex).toBe("x \\leq 10");
    });

    it("9) x ≥ 5", () => {
      const { latex } = one(wrapMathML(`<mi>x</mi><mo>≥</mo><mn>5</mn>`));
      expect(latex).toBe("x \\geq 5");
    });

    it("10) ∫₀¹ x² dx", () => {
      const { latex } = one(
        wrapMathML(
          `<msubsup><mo>∫</mo><mn>0</mn><mn>1</mn></msubsup><msup><mi>x</mi><mn>2</mn></msup><mi>dx</mi>`
        )
      );
      expect(latex).toBe("\\int_{0}^{1} x^{2} dx");
    });

    it("11) Σ_{i=1}^{n} i", () => {
      const { latex } = one(
        wrapMathML(
          `<munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover><mi>i</mi>`
        )
      );
      expect(latex).toBe("\\sum_{i = 1}^{n} i");
    });

    it("12) 2x2 matrix", () => {
      const { latex } = one(
        wrapMathML(
          `<mtable><mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr><mtr><mtd><mi>c</mi></mtd><mtd><mi>d</mi></mtd></mtr></mtable>`,
          "block"
        )
      );
      expect(latex).toContain("\\begin{matrix}");
      expect(latex).toContain("a & b");
      expect(latex).toContain("c & d");
      expect(latex).toContain("\\\\");
      expect(one(wrapMathML(
        `<mtable><mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr><mtr><mtd><mi>c</mi></mtd><mtd><mi>d</mi></mtd></mtr></mtable>`,
        "block"
      )).displayMode).toBe(true);
    });

    it("13) nested fractions", () => {
      const { latex } = one(
        wrapMathML(`<mfrac><mfrac><mn>1</mn><mn>2</mn></mfrac><mn>3</mn></mfrac>`)
      );
      expect(latex).toBe("\\frac{\\frac{1}{2}}{3}");
    });

    it("14) parenthesized (a+b)", () => {
      const { latex } = one(
        wrapMathML(`<mfenced><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow></mfenced>`)
      );
      expect(latex).toBe("\\left(a + b\\right)");
    });
  });

  describe("extractMathFromHtml: sizing & existing behavior", () => {
    it("extracts a single display equation from MathType HTML", () => {
      const result = extractMathFromHtml(mathtypeHtml);
      expect(result.length).toBe(1);
      expect(result[0].displayMode).toBe(true);
      expect(result[0].latex).toContain("A");
      expect(result[0].latex).toContain("=");
    });

    it("extracts inline maths and keeps them inline", () => {
      const result = extractMathFromHtml(mathjaxHtml);
      expect(result.length).toBe(1);
      expect(result[0].displayMode).toBe(false);
    });

    it("does not promote inline mfenced math to display", () => {
      const { latex, displayMode } = one(
        wrapMathML(`<mfenced><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow></mfenced>`)
      );
      expect(displayMode).toBe(false);
      expect(latex).toContain("a + b");
    });

    it("prefers a TeX annotation when the source provides one", () => {
      const { latex } = one(
        wrapMathML(
          `<semantics><mrow><mfrac><mi>a</mi><mi>b</mi></mfrac></mrow><annotation encoding="application/x-tex">\\frac{a}{b}</annotation></semantics>`
        )
      );
      expect(latex).toBe("\\frac{a}{b}");
    });

    it("skips blocks that cannot be converted", () => {
      const result = extractMathFromHtml(
        `<p>Some text <math display="block"><semantics><mrow>…broken…</mrow></semantics></math></p>`
      );
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns [] for text with no <math> tags", () => {
      expect(extractMathFromHtml("<p>hello world</p>")).toEqual([]);
    });

    it("returns [] for empty input", () => {
      expect(extractMathFromHtml("")).toEqual([]);
    });
  });

  describe("readMathFromClipboard", () => {
    it("reads MathType edition from text/html", () => {
      const dt = makeDataTransfer({ "text/html": mathtypeHtml });
      const result: ExtractedMath[] = readMathFromClipboard(dt);
      expect(result.length).toBe(1);
      expect(result[0].displayMode).toBe(true);
    });

    it("reads raw MathML from application/xml when no html present", () => {
      const raw = `<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>1</mn><mo>+</mo><mn>1</mn></math>`;
      const dt = makeDataTransfer({ "application/xml": raw });
      const result = readMathFromClipboard(dt);
      expect(result.length).toBe(1);
      expect(result[0].latex.trim()).toBe("1 + 1");
    });

    it("reads MathML from application/mathml+xml", () => {
      const raw = `<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>3</mn></msup></math>`;
      const dt = makeDataTransfer({ "application/mathml+xml": raw });
      const result = readMathFromClipboard(dt);
      expect(result.length).toBe(1);
      expect(result[0].latex.trim()).toBe("x^{3}");
    });

    it("reflects a display='block' equation through mathml MIME", () => {
      const raw = `<math display="block" xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>`;
      const dt = makeDataTransfer({ "application/mathml+xml": raw });
      const result = readMathFromClipboard(dt);
      expect(result[0].displayMode).toBe(true);
    });

    it("returns [] when clipboard has no math", () => {
      const dt = makeDataTransfer({ "text/html": "<p>nothing here</p>" });
      expect(readMathFromClipboard(dt)).toEqual([]);
    });

    it("returns [] for an empty clipboard", () => {
      expect(readMathFromClipboard(makeDataTransfer({}))).toEqual([]);
    });

    it("returns [] for Gujarati / English text paste", () => {
      const dt = makeDataTransfer({ "text/html": gujaratiHtml, "text/plain": gujaratiHtml });
      expect(readMathFromClipboard(dt)).toEqual([]);
    });

    it("returns [] for an image paste", () => {
      const dt = makeDataTransfer({ "text/html": imagePasteHtml });
      expect(readMathFromClipboard(dt)).toEqual([]);
    });

    it("returns [] for plain-text paste", () => {
      const dt = makeDataTransfer({ "text/plain": plainText });
      expect(readMathFromClipboard(dt)).toEqual([]);
    });
  });

  describe("hasMathMLOnClipboard", () => {
    it("detects MathML inside text/html", () => {
      expect(hasMathMLOnClipboard(makeDataTransfer({ "text/html": mathtypeHtml }))).toBe(true);
    });

    it("detects an explicit mathml MIME type even when unreadable", () => {
      const dt = makeDataTransfer({}) as DataTransfer;
      Object.defineProperty(dt, "types", { value: ["application/mathml+xml"], configurable: true });
      expect(hasMathMLOnClipboard(dt)).toBe(true);
    });

    it("returns false for normal text", () => {
      expect(hasMathMLOnClipboard(makeDataTransfer({ "text/plain": plainText }))).toBe(false);
    });
  });

  describe("normalizeLatexSafety", () => {
    it("strips MathType nbsp artifacts", () => {
      expect(normalizeLatexSafety("x \\&\\text{nbsp}; = 1")).toBe("x = 1");
    });

    it("strips empty text wrappers", () => {
      expect(normalizeLatexSafety("a \\textrm{ } + \\text{} b")).toBe("a + b");
    });

    it("collapses whitespace", () => {
      expect(normalizeLatexSafety("  x   +   1  ")).toBe("x + 1");
    });
  });
});