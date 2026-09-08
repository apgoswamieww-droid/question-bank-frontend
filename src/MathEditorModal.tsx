import React, { useState, useEffect, useRef } from "react";
import katex from "katex";
import { X, Check, AlertTriangle } from "lucide-react";
import { readMathFromClipboard } from "./utils/mathPaste";

interface MathEditorModalProps {
  isOpen: boolean;
  initialLatex?: string;
  initialDisplayMode?: boolean;
  onClose: () => void;
  onSubmit: (latex: string, displayMode: boolean) => void;
}

type TabId = "formulas" | "greek" | "operators" | "calculus" | "setsarrows";

interface Snippet {
  name: string;
  group?: string;
  latex: string; // may contain a single "|" marking cursor position after insert
}

const formulaSnippets: Snippet[] = [
  { name: "Quadratic roots", group: "Algebra & Sequences", latex: "x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}" },
  { name: "Discriminant", group: "Algebra & Sequences", latex: "D = b^{2} - 4ac" },
  { name: "Square identity", group: "Algebra & Sequences", latex: "(a + b)^{2} = a^{2} + 2ab + b^{2}" },
  { name: "Difference of squares", group: "Algebra & Sequences", latex: "a^{2} - b^{2} = (a+b)(a-b)" },
  { name: "Sum/difference of cubes", group: "Algebra & Sequences", latex: "a^{3} \\pm b^{3}" },
  { name: "AP nth term", group: "Algebra & Sequences", latex: "a_{n} = a + (n-1)d" },
  { name: "AP sum", group: "Algebra & Sequences", latex: "S_{n} = \\frac{n}{2}\\left[2a + (n-1)d\\right]" },
  { name: "GP nth term", group: "Algebra & Sequences", latex: "a_{n} = ar^{n-1}" },
  { name: "Infinite GP sum", group: "Algebra & Sequences", latex: "S_{\\infty} = \\frac{a}{1-r},\\ |r| < 1" },
  { name: "Binomial general term", group: "Algebra & Sequences", latex: "T_{r+1} = {}^{n}C_{r}\\ a^{n-r} b^{r}" },
  { name: "Permutation", group: "Algebra & Sequences", latex: "{}^{n}P_{r} = \\frac{n!}{(n-r)!}" },
  { name: "Combination", group: "Algebra & Sequences", latex: "{}^{n}C_{r} = \\frac{n!}{r!\\,(n-r)!}" },

  { name: "Pythagorean identity", group: "Trigonometry", latex: "\\sin^{2}\\theta + \\cos^{2}\\theta = 1" },
  { name: "Secant identity", group: "Trigonometry", latex: "1 + \\tan^{2}\\theta = \\sec^{2}\\theta" },
  { name: "Cosecant identity", group: "Trigonometry", latex: "1 + \\cot^{2}\\theta = \\text{cosec}^{2}\\theta" },
  { name: "sin(A ± B)", group: "Trigonometry", latex: "\\sin(A \\pm B) = \\sin A\\cos B \\pm \\cos A\\sin B" },
  { name: "cos(A ± B)", group: "Trigonometry", latex: "\\cos(A \\pm B) = \\cos A\\cos B \\mp \\sin A\\sin B" },
  { name: "Double angle sin", group: "Trigonometry", latex: "\\sin 2\\theta = 2\\sin\\theta\\cos\\theta" },
  { name: "Double angle cos", group: "Trigonometry", latex: "\\cos 2\\theta = \\cos^{2}\\theta - \\sin^{2}\\theta" },
  { name: "Law of sines", group: "Trigonometry", latex: "\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C}" },
  { name: "Cosine rule", group: "Trigonometry", latex: "c^{2} = a^{2} + b^{2} - 2ab\\cos C" },

  { name: "Distance formula", group: "Coordinate & Complex", latex: "d = \\sqrt{(x_{2}-x_{1})^{2} + (y_{2}-y_{1})^{2}}" },
  { name: "Section formula", group: "Coordinate & Complex", latex: "P = \\left(\\frac{mx_{2} + nx_{1}}{m+n},\\ \\frac{my_{2} + ny_{1}}{m+n}\\right)" },
  { name: "Slope", group: "Coordinate & Complex", latex: "m = \\frac{y_{2} - y_{1}}{x_{2} - x_{1}}" },
  { name: "Line through point", group: "Coordinate & Complex", latex: "y - y_{1} = m(x - x_{1})" },
  { name: "Complex number", group: "Coordinate & Complex", latex: "z = a + ib" },
  { name: "Modulus", group: "Coordinate & Complex", latex: "|z| = \\sqrt{a^{2} + b^{2}}" },
  { name: "Conjugate", group: "Coordinate & Complex", latex: "\\bar{z} = a - ib" },

  { name: "First equation of motion", group: "Kinematics & Mechanics", latex: "v = u + at" },
  { name: "Second equation of motion", group: "Kinematics & Mechanics", latex: "s = ut + \\tfrac{1}{2}at^{2}" },
  { name: "Third equation of motion", group: "Kinematics & Mechanics", latex: "v^{2} = u^{2} + 2as" },
  { name: "Newton's second law", group: "Kinematics & Mechanics", latex: "F = ma" },
  { name: "Momentum", group: "Kinematics & Mechanics", latex: "p = mv" },
  { name: "Impulse", group: "Kinematics & Mechanics", latex: "F\\Delta t = \\Delta p" },
  { name: "Work done", group: "Kinematics & Mechanics", latex: "W = \\vec{F} \\cdot \\vec{d}" },
  { name: "Kinetic energy", group: "Kinematics & Mechanics", latex: "KE = \\tfrac{1}{2}mv^{2}" },
  { name: "Potential energy", group: "Kinematics & Mechanics", latex: "PE = mgh" },
  { name: "Power", group: "Kinematics & Mechanics", latex: "P = \\frac{W}{t} = \\vec{F} \\cdot \\vec{v}" },
  { name: "Torque", group: "Kinematics & Mechanics", latex: "\\vec{\\tau} = \\vec{r} \\times \\vec{F}" },
  { name: "Angular momentum", group: "Kinematics & Mechanics", latex: "L = I\\omega" },
  { name: "Centripetal acceleration", group: "Kinematics & Mechanics", latex: "a_{c} = \\frac{v^{2}}{r} = \\omega^{2}r" },
  { name: "SHM displacement", group: "Kinematics & Mechanics", latex: "x = A\\sin(\\omega t + \\phi)" },
  { name: "Spring period", group: "Kinematics & Mechanics", latex: "T = 2\\pi\\sqrt{\\frac{m}{k}}" },
  { name: "Simple pendulum", group: "Kinematics & Mechanics", latex: "T = 2\\pi\\sqrt{\\frac{l}{g}}" },

  { name: "Newton's law of gravitation", group: "Gravitation", latex: "F = G\\frac{m_{1}m_{2}}{r^{2}}" },
  { name: "Acceleration due to gravity", group: "Gravitation", latex: "g = \\frac{GM}{R^{2}}" },
  { name: "Escape velocity", group: "Gravitation", latex: "v_{e} = \\sqrt{\\frac{2GM}{R}}" },
  { name: "Orbital velocity", group: "Gravitation", latex: "v_{o} = \\sqrt{\\frac{GM}{r}}" },

  { name: "Ohm's law", group: "Electricity & Magnetism", latex: "V = IR" },
  { name: "Resistivity", group: "Electricity & Magnetism", latex: "R = \\rho\\frac{l}{A}" },
  { name: "Resistors in series", group: "Electricity & Magnetism", latex: "R_{eq} = R_{1} + R_{2}" },
  { name: "Resistors in parallel", group: "Electricity & Magnetism", latex: "\\frac{1}{R_{eq}} = \\frac{1}{R_{1}} + \\frac{1}{R_{2}}" },
  { name: "Electric power", group: "Electricity & Magnetism", latex: "P = VI = I^{2}R = \\frac{V^{2}}{R}" },
  { name: "Drift velocity", group: "Electricity & Magnetism", latex: "I = neAv_{d}" },
  { name: "Coulomb's law", group: "Electricity & Magnetism", latex: "F = k\\frac{q_{1}q_{2}}{r^{2}}" },
  { name: "Field of point charge", group: "Electricity & Magnetism", latex: "E = k\\frac{q}{r^{2}}" },
  { name: "Force on charge (Lorentz)", group: "Electricity & Magnetism", latex: "\\vec{F} = q(\\vec{E} + \\vec{v} \\times \\vec{B})" },
  { name: "Capacitance", group: "Electricity & Magnetism", latex: "C = \\frac{Q}{V}" },
  { name: "Parallel plate capacitor", group: "Electricity & Magnetism", latex: "C = \\frac{\\varepsilon_{0} A}{d}" },
  { name: "Capacitor energy", group: "Electricity & Magnetism", latex: "U = \\tfrac{1}{2}CV^{2}" },
  { name: "Capacitors in series", group: "Electricity & Magnetism", latex: "\\frac{1}{C_{eq}} = \\frac{1}{C_{1}} + \\frac{1}{C_{2}}" },
  { name: "Biot–Savart law", group: "Electricity & Magnetism", latex: "dB = \\frac{\\mu_{0}}{4\\pi}\\frac{I\\,dl\\sin\\theta}{r^{2}}" },
  { name: "Faraday's law", group: "Electricity & Magnetism", latex: "\\varepsilon = -\\frac{d\\Phi_{B}}{dt}" },

  { name: "Mirror formula", group: "Optics & Waves", latex: "\\frac{1}{f} = \\frac{1}{v} + \\frac{1}{u}" },
  { name: "Lens formula", group: "Optics & Waves", latex: "\\frac{1}{f} = \\frac{1}{v} - \\frac{1}{u}" },
  { name: "Magnification (mirror)", group: "Optics & Waves", latex: "m = -\\frac{v}{u} = \\frac{h'}{h}" },
  { name: "Power of lens", group: "Optics & Waves", latex: "P = \\frac{1}{f}\\ \\text{(m)}^{-1}" },
  { name: "Refractive index", group: "Optics & Waves", latex: "n = \\frac{c}{v}" },
  { name: "Snell's law", group: "Optics & Waves", latex: "n_{1}\\sin\\theta_{1} = n_{2}\\sin\\theta_{2}" },
  { name: "Young's fringe width", group: "Optics & Waves", latex: "\\beta = \\frac{\\lambda D}{d}" },
  { name: "Wave equation", group: "Optics & Waves", latex: "y = A\\sin(kx - \\omega t + \\phi)" },
  { name: "Wave speed", group: "Optics & Waves", latex: "v = f\\lambda" },
  { name: "Doppler effect", group: "Optics & Waves", latex: "f' = f\\left(\\frac{v \\pm v_{o}}{v \\mp v_{s}}\\right)" },

  { name: "Photoelectric effect", group: "Modern Physics", latex: "K_{max} = h\\nu - \\phi" },
  { name: "Photon energy", group: "Modern Physics", latex: "E = h\\nu = \\frac{hc}{\\lambda}" },
  { name: "de Broglie wavelength", group: "Modern Physics", latex: "\\lambda = \\frac{h}{p} = \\frac{h}{mv}" },
  { name: "de Broglie (accelerated)", group: "Modern Physics", latex: "\\lambda = \\frac{h}{\\sqrt{2mqV}}" },
  { name: "Bohr radius", group: "Modern Physics", latex: "r_{n} = 0.529\\ \\frac{n^{2}}{Z}\\ \\AA" },
  { name: "Bohr energy", group: "Modern Physics", latex: "E_{n} = -13.6\\ \\frac{Z^{2}}{n^{2}}\\ \\text{eV}" },
  { name: "Mass–energy", group: "Modern Physics", latex: "E = mc^{2}" },
  { name: "Radioactive decay", group: "Modern Physics", latex: "N = N_{0}e^{-\\lambda t}" },
  { name: "Half life", group: "Modern Physics", latex: "t_{1/2} = \\frac{0.693}{\\lambda}" },

  { name: "Ideal gas equation", group: "Thermal Physics", latex: "PV = nRT" },
  { name: "First law of thermodynamics", group: "Thermal Physics", latex: "\\Delta U = Q - W" },
  { name: "Carnot efficiency", group: "Thermal Physics", latex: "\\eta = 1 - \\frac{T_{2}}{T_{1}}" },
  { name: "Mayer's relation", group: "Thermal Physics", latex: "C_{p} - C_{v} = R" },
  { name: "Isothermal work", group: "Thermal Physics", latex: "W = nRT\\ln\\frac{V_{2}}{V_{1}}" },
  { name: "Adiabatic relation", group: "Thermal Physics", latex: "PV^{\\gamma} = \\text{constant}" },

  { name: "Number of moles", group: "Physical Chemistry", latex: "n = \\frac{m}{M}" },
  { name: "Molarity", group: "Physical Chemistry", latex: "M = \\frac{n_{\\text{solute}}}{V\\ \\text{(L)}}" },
  { name: "Dilution", group: "Physical Chemistry", latex: "M_{1}V_{1} = M_{2}V_{2}" },
  { name: "Ideal gas density", group: "Physical Chemistry", latex: "PM = dRT" },
  { name: "pH", group: "Physical Chemistry", latex: "pH = -\\log[H^{+}]" },
  { name: "pH + pOH", group: "Physical Chemistry", latex: "pH + pOH = 14" },
  { name: "Ionic product of water", group: "Physical Chemistry", latex: "K_{w} = [H^{+}][OH^{-}] = 10^{-14}" },
  { name: "Equilibrium Kp/Kc", group: "Physical Chemistry", latex: "K_{p} = K_{c}(RT)^{\\Delta n}" },

  { name: "Gibbs free energy", group: "Electrochemistry & Kinetics", latex: "\\Delta G = \\Delta H - T\\Delta S" },
  { name: "ΔG° and K", group: "Electrochemistry & Kinetics", latex: "\\Delta G^{\\circ} = -RT\\ln K" },
  { name: "ΔG° from cell potential", group: "Electrochemistry & Kinetics", latex: "\\Delta G^{\\circ} = -nFE^{\\circ}_{cell}" },
  { name: "Nernst equation", group: "Electrochemistry & Kinetics", latex: "E = E^{\\circ} - \\frac{0.0591}{n}\\log Q" },
  { name: "Rate law", group: "Electrochemistry & Kinetics", latex: "\\text{rate} = k[A]^{x}[B]^{y}" },
  { name: "First order kinetics", group: "Electrochemistry & Kinetics", latex: "k = \\frac{2.303}{t}\\log\\frac{a}{a-x}" },
  { name: "First order half life", group: "Electrochemistry & Kinetics", latex: "t_{1/2} = \\frac{0.693}{k}" },
  { name: "Arrhenius equation", group: "Electrochemistry & Kinetics", latex: "k = Ae^{-E_{a}/RT}" },
  { name: "Nuclide notation", group: "Electrochemistry & Kinetics", latex: "{}^{|}_{Z}\\text{X}" },
  { name: "Reaction with condition", group: "Electrochemistry & Kinetics", latex: "A + B \\xrightarrow{|} C" },
  { name: "Equilibrium reaction", group: "Electrochemistry & Kinetics", latex: "A + B \\rightleftharpoons C + D" },

  { name: "Photosynthesis", group: "Biology", latex: "6CO_{2} + 12H_{2}O \\xrightarrow{\\text{light}} C_{6}H_{12}O_{6} + 6O_{2} + 6H_{2}O" },
  { name: "Hardy–Weinberg equilibrium", group: "Biology", latex: "p^{2} + 2pq + q^{2} = 1" },
  { name: "Water potential", group: "Biology", latex: "\\Psi_{w} = \\Psi_{s} + \\Psi_{p}" },
  { name: "Exponential growth", group: "Biology", latex: "\\frac{dN}{dt} = rN" },
  { name: "Logistic growth", group: "Biology", latex: "\\frac{dN}{dt} = rN\\frac{(K - N)}{K}" },
];

const greekSymbols: Snippet[] = [
  { name: "alpha", group: "Lowercase", latex: "\\alpha" },
  { name: "beta", group: "Lowercase", latex: "\\beta" },
  { name: "gamma", group: "Lowercase", latex: "\\gamma" },
  { name: "delta", group: "Lowercase", latex: "\\delta" },
  { name: "epsilon", group: "Lowercase", latex: "\\epsilon" },
  { name: "zeta", group: "Lowercase", latex: "\\zeta" },
  { name: "eta", group: "Lowercase", latex: "\\eta" },
  { name: "theta", group: "Lowercase", latex: "\\theta" },
  { name: "iota", group: "Lowercase", latex: "\\iota" },
  { name: "kappa", group: "Lowercase", latex: "\\kappa" },
  { name: "lambda", group: "Lowercase", latex: "\\lambda" },
  { name: "mu", group: "Lowercase", latex: "\\mu" },
  { name: "nu", group: "Lowercase", latex: "\\nu" },
  { name: "xi", group: "Lowercase", latex: "\\xi" },
  { name: "pi", group: "Lowercase", latex: "\\pi" },
  { name: "rho", group: "Lowercase", latex: "\\rho" },
  { name: "sigma", group: "Lowercase", latex: "\\sigma" },
  { name: "tau", group: "Lowercase", latex: "\\tau" },
  { name: "upsilon", group: "Lowercase", latex: "\\upsilon" },
  { name: "phi", group: "Lowercase", latex: "\\phi" },
  { name: "chi", group: "Lowercase", latex: "\\chi" },
  { name: "psi", group: "Lowercase", latex: "\\psi" },
  { name: "omega", group: "Lowercase", latex: "\\omega" },
  { name: "varepsilon", group: "Variants", latex: "\\varepsilon" },
  { name: "vartheta", group: "Variants", latex: "\\vartheta" },
  { name: "varphi", group: "Variants", latex: "\\varphi" },
  { name: "varsigma", group: "Variants", latex: "\\varsigma" },
  { name: "hbar (reduced Planck)", group: "Variants", latex: "\\hbar" },
  { name: "ell", group: "Variants", latex: "\\ell" },
  { name: "Gamma", group: "Uppercase", latex: "\\Gamma" },
  { name: "Delta", group: "Uppercase", latex: "\\Delta" },
  { name: "Theta", group: "Uppercase", latex: "\\Theta" },
  { name: "Lambda", group: "Uppercase", latex: "\\Lambda" },
  { name: "Xi", group: "Uppercase", latex: "\\Xi" },
  { name: "Pi", group: "Uppercase", latex: "\\Pi" },
  { name: "Sigma", group: "Uppercase", latex: "\\Sigma" },
  { name: "Upsilon", group: "Uppercase", latex: "\\Upsilon" },
  { name: "Phi", group: "Uppercase", latex: "\\Phi" },
  { name: "Psi", group: "Uppercase", latex: "\\Psi" },
  { name: "Omega", group: "Uppercase", latex: "\\Omega" },
];

const mathOperators: Snippet[] = [
  { name: "plus", group: "Arithmetic", latex: "+" },
  { name: "minus", group: "Arithmetic", latex: "-" },
  { name: "plus-minus", group: "Arithmetic", latex: "\\pm" },
  { name: "minus-plus", group: "Arithmetic", latex: "\\mp" },
  { name: "times", group: "Arithmetic", latex: "\\times" },
  { name: "divided by", group: "Arithmetic", latex: "\\div" },
  { name: "dot product", group: "Arithmetic", latex: "\\cdot" },
  { name: "proportional to", group: "Comparison", latex: "\\propto" },
  { name: "equal", group: "Comparison", latex: "=" },
  { name: "not equal", group: "Comparison", latex: "\\neq" },
  { name: "less than", group: "Comparison", latex: "<" },
  { name: "greater than", group: "Comparison", latex: ">" },
  { name: "less or equal", group: "Comparison", latex: "\\le" },
  { name: "greater or equal", group: "Comparison", latex: "\\ge" },
  { name: "much less", group: "Comparison", latex: "\\ll" },
  { name: "much greater", group: "Comparison", latex: "\\gg" },
  { name: "approximately equal", group: "Comparison", latex: "\\approx" },
  { name: "identical/equivalent", group: "Comparison", latex: "\\equiv" },
  { name: "similar", group: "Comparison", latex: "\\sim" },
  { name: "perpendicular", group: "Geometry", latex: "\\perp" },
  { name: "parallel lines", group: "Geometry", latex: "\\parallel" },
  { name: "angle", group: "Geometry", latex: "\\angle" },
  { name: "triangle", group: "Geometry", latex: "\\triangle" },
  { name: "not", group: "Logic", latex: "\\neg" },
  { name: "and", group: "Logic", latex: "\\land" },
  { name: "or", group: "Logic", latex: "\\lor" },
  { name: "direct sum / xor", group: "Logic", latex: "\\oplus" },
  { name: "infinity", group: "Miscellaneous", latex: "\\infty" },
  { name: "partial derivative", group: "Miscellaneous", latex: "\\partial" },
  { name: "nabla / del operator", group: "Miscellaneous", latex: "\\nabla" },
  { name: "degree mark", group: "Miscellaneous", latex: "^{\\circ}" },
  { name: "angstrom", group: "Miscellaneous", latex: "\\AA" },
  { name: "prime mark", group: "Miscellaneous", latex: "'" },
  { name: "percent", group: "Miscellaneous", latex: "\\%" },
  { name: "sine", group: "Functions", latex: "\\sin" },
  { name: "cosine", group: "Functions", latex: "\\cos" },
  { name: "tangent", group: "Functions", latex: "\\tan" },
  { name: "cotangent", group: "Functions", latex: "\\cot" },
  { name: "secant", group: "Functions", latex: "\\sec" },
  { name: "cosecant", group: "Functions", latex: "\\text{cosec}" },
  { name: "logarithm", group: "Functions", latex: "\\log" },
  { name: "log base b", group: "Functions", latex: "\\log_{b}" },
  { name: "natural log", group: "Functions", latex: "\\ln" },
  { name: "exponential", group: "Functions", latex: "\\exp" },
  { name: "maximum", group: "Functions", latex: "\\max" },
  { name: "minimum", group: "Functions", latex: "\\min" },
  { name: "determinant", group: "Functions", latex: "\\det" },
  { name: "greatest common divisor", group: "Functions", latex: "\\gcd" },
  { name: "curly braces", group: "LaTeX Escapes", latex: "\\{\\}" },
  { name: "percent sign", group: "LaTeX Escapes", latex: "\\%" },
  { name: "hash", group: "LaTeX Escapes", latex: "\\#" },
  { name: "ampersand", group: "LaTeX Escapes", latex: "\\&" },
];

const calculusSnippets: Snippet[] = [
  { name: "Power rule", group: "Derivatives", latex: "\\frac{d}{dx}(x^{n}) = nx^{n-1}" },
  { name: "Derivative of sin/cos/exp/ln", group: "Derivatives", latex: "(\\sin x)' = \\cos x" },
  { name: "Product rule", group: "Derivatives", latex: "(uv)' = u'v + uv'" },
  { name: "Quotient rule", group: "Derivatives", latex: "\\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^{2}}" },
  { name: "Chain rule", group: "Derivatives", latex: "\\frac{dy}{dx} = \\frac{dy}{du} \\cdot \\frac{du}{dx}" },
  { name: "Velocity (dot notation)", group: "Derivatives", latex: "v = \\dot{x} = \\frac{dx}{dt}" },
  { name: "Acceleration (double dot)", group: "Derivatives", latex: "a = \\ddot{x} = \\frac{d^{2}x}{dt^{2}}" },
  { name: "Second partial derivative", group: "Derivatives", latex: "\\frac{\\partial^{2} f}{\\partial x^{2}}" },
  { name: "Power rule integral", group: "Integrals", latex: "\\int x^{n}\\,dx = \\frac{x^{n+1}}{n+1} + C,\\ n \\neq -1" },
  { name: "Integral of 1/x", group: "Integrals", latex: "\\int \\frac{dx}{x} = \\ln|x| + C" },
  { name: "Integral of e^x", group: "Integrals", latex: "\\int e^{x}\\,dx = e^{x} + C" },
  { name: "Integral of sin x", group: "Integrals", latex: "\\int \\sin x\\,dx = -\\cos x + C" },
  { name: "Fundamental theorem", group: "Integrals", latex: "\\int_{a}^{b} f(x)\\,dx = F(b) - F(a)" },
  { name: "Definite with bounds", group: "Integrals", latex: "\\int_{a}^{|}" },
  { name: "Sum with limits", group: "Series & Special", latex: "\\sum_{i=1}^{n}|" },
  { name: "Product with limits", group: "Series & Special", latex: "\\prod_{i=1}^{n}|" },
  { name: "Infinite series", group: "Series & Special", latex: "\\sum_{n=0}^{\\infty}|" },
  { name: "Limit x→a", group: "Series & Special", latex: "\\lim_{x \\to |}" },
  { name: "One-sided limit (right)", group: "Series & Special", latex: "\\lim_{x \\to a^{+}}" },
  { name: "Limit at infinity", group: "Series & Special", latex: "\\lim_{x \\to \\infty}" },
  { name: "Taylor series", group: "Series & Special", latex: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^{n}" },
  { name: "Gradient dot field", group: "Vector Calculus", latex: "\\vec{\\nabla} \\cdot \\vec{F}" },
  { name: "Curl", group: "Vector Calculus", latex: "\\vec{\\nabla} \\times \\vec{F}" },
  { name: "Laplacian", group: "Vector Calculus", latex: "\\nabla^{2} f" },
  { name: "Line integral", group: "Vector Calculus", latex: "\\oint_{C} \\vec{F} \\cdot d\\vec{r}" },
  { name: "Evaluate at point", group: "Notation", latex: "\\left. \\frac{dy}{dx} \\right|_{x=|a}" },
];

const setsArrowsSnippets: Snippet[] = [
  { name: "implies", group: "Logic Arrows", latex: "\\Rightarrow" },
  { name: "iff", group: "Logic Arrows", latex: "\\Leftrightarrow" },
  { name: "maps to", group: "Logic Arrows", latex: "\\mapsto" },
  { name: "right arrow", group: "Logic Arrows", latex: "\\to" },
  { name: "left-right arrow", group: "Logic Arrows", latex: "\\leftrightarrow" },
  { name: "element of", group: "Set Theory", latex: "\\in" },
  { name: "not element of", group: "Set Theory", latex: "\\notin" },
  { name: "contains as member", group: "Set Theory", latex: "\\ni" },
  { name: "subset", group: "Set Theory", latex: "\\subset" },
  { name: "subset or equal", group: "Set Theory", latex: "\\subseteq" },
  { name: "superset", group: "Set Theory", latex: "\\supset" },
  { name: "superset or equal", group: "Set Theory", latex: "\\supseteq" },
  { name: "union", group: "Set Theory", latex: "\\cup" },
  { name: "intersection", group: "Set Theory", latex: "\\cap" },
  { name: "empty set", group: "Set Theory", latex: "\\emptyset" },
  { name: "for all", group: "Quantifiers", latex: "\\forall" },
  { name: "there exists", group: "Quantifiers", latex: "\\exists" },
  { name: "therefore", group: "Quantifiers", latex: "\\therefore" },
  { name: "because", group: "Quantifiers", latex: "\\because" },
  { name: "Real numbers", group: "Number Systems", latex: "\\mathbb{R}" },
  { name: "Natural numbers", group: "Number Systems", latex: "\\mathbb{N}" },
  { name: "Integers", group: "Number Systems", latex: "\\mathbb{Z}" },
  { name: "Rational numbers", group: "Number Systems", latex: "\\mathbb{Q}" },
  { name: "Complex numbers", group: "Number Systems", latex: "\\mathbb{C}" },
  { name: "reversible reaction", group: "Chemistry", latex: "\\rightleftharpoons" },
  { name: "arrow with condition", group: "Chemistry", latex: "\\xrightarrow{\\ \\Delta\\ }" },
  { name: "arrow with condition (custom)", group: "Chemistry", latex: "\\xrightarrow{|}" },
  { name: "precipitate forms", group: "Chemistry", latex: "\\downarrow" },
  { name: "gas evolves", group: "Chemistry", latex: "\\uparrow" },
  { name: "heating", group: "Chemistry", latex: "\\overset{\\Delta}{\\longrightarrow}" },
];

const tabs: { id: TabId; label: string }[] = [
  { id: "formulas", label: "Formulas" },
  { id: "greek", label: "Greek" },
  { id: "operators", label: "Operators" },
  { id: "calculus", label: "Calculus" },
  { id: "setsarrows", label: "Sets & Arrows" },
];

const paletteData: Record<TabId, Snippet[]> = {
  formulas: formulaSnippets,
  greek: greekSymbols,
  operators: mathOperators,
  calculus: calculusSnippets,
  setsarrows: setsArrowsSnippets,
};

const glyphCache = new Map<string, string>();
const getGlyphHtml = (latexCmd: string): string => {
  const key = latexCmd.replace("|", "").trim();
  let html = glyphCache.get(key);
  if (html === undefined) {
    try {
      html = katex.renderToString(key, { throwOnError: false });
    } catch {
      html = key;
    }
    glyphCache.set(key, html);
  }
  return html;
};

const isFormulaSnippet = (latexCmd: string): boolean => {
  const clean = latexCmd.replace("|", "");
  return (
    clean.includes("\\begin") ||
    clean.includes("\\frac") ||
    clean.includes("\\xrightarrow") ||
    clean.length > 22
  );
};

export const MathEditorModal: React.FC<MathEditorModalProps> = ({
  isOpen,
  initialLatex = "",
  initialDisplayMode = false,
  onClose,
  onSubmit,
}) => {
  const [latex, setLatex] = useState(initialLatex);
  const [displayMode, setDisplayMode] = useState(initialDisplayMode);
  const [activeTab, setActiveTab] = useState<TabId>("formulas");
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ dx: 0, dy: 0, w: 0 });

  // The modal is mounted fresh for each open (conditional mount in App.tsx),
  // so state initializers above are the reset logic.

  // Focus the LaTeX input once on mount.
  useEffect(() => {
    const id = window.setTimeout(() => textareaRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, []);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({ x: rect.left, y: rect.top });
    dragStartRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, w: rect.width };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const { dx, dy, w } = dragStartRef.current;
      const x = Math.min(Math.max(e.clientX - dx, 80 - w), window.innerWidth - 80);
      const y = Math.min(Math.max(e.clientY - dy, 0), window.innerHeight - 56);
      setPosition({ x, y });
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  // Pure derivation: preview HTML + parse error are computed per render.
  let previewHtml: string;
  let parseError: string | null = null;
  try {
    previewHtml = katex.renderToString(latex.trim() || "\\text{Preview}", {
      displayMode,
      throwOnError: true,
    });
  } catch (err) {
    previewHtml = katex.renderToString(latex.trim() || "\\text{Preview}", {
      displayMode,
      throwOnError: false,
    });
    parseError = err instanceof Error ? err.message : "Invalid LaTeX expression";
  }

  const doSubmit = () => {
    if (!latex.trim()) return;
    onSubmit(latex.trim(), displayMode);
    onClose();
  };

  const handleLatexPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const math = e.clipboardData ? readMathFromClipboard(e.clipboardData) : [];
    if (math.length === 0) return;
    e.preventDefault();
    const pastedLatex = math.map((m) => m.latex).join(" ");
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? latex.length;
    const end = textarea?.selectionEnd ?? latex.length;
    const next = latex.substring(0, start) + ` ${pastedLatex} ` + latex.substring(end);
    setLatex(next.trim());
    window.setTimeout(() => {
      textarea?.focus();
      const caret = start + pastedLatex.length + 1;
      textarea?.setSelectionRange(caret, caret);
    }, 10);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        doSubmit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!isOpen) return null;

  const insertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    const cursorMark = snippet.indexOf("|");
    const cleanSnippet = snippet.replace("|", "");
    const wrapWithSpaces = !isFormulaSnippet(snippet);
    const insertedText = wrapWithSpaces ? ` ${cleanSnippet} ` : cleanSnippet;

    const start = textarea?.selectionStart ?? latex.length;
    const end = textarea?.selectionEnd ?? latex.length;

    setLatex(latex.substring(0, start) + insertedText + latex.substring(end));

    window.setTimeout(() => {
      textarea?.focus();
      if (textarea) {
        const spaceOffset = wrapWithSpaces && cursorMark !== -1 ? 1 : 0;
        const caret =
          cursorMark === -1
            ? start + insertedText.length
            : start + cursorMark + spaceOffset;
        textarea.setSelectionRange(caret, caret);
      }
    }, 10);
  };

  const activeItems = paletteData[activeTab];

  return (
    <div className="math-modal-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className={`math-modal-container ${position ? "is-positioned" : ""}`}
        style={position ? { left: position.x, top: position.y } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`math-modal-header ${isDragging ? "dragging" : ""}`}
          onMouseDown={handleHeaderMouseDown}
          onDoubleClick={() => setPosition(null)}
          title="Drag to move · double-click to re-center"
        >
          <h3>Mathematical Equation Editor</h3>
          <button type="button" className="close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            doSubmit();
          }}
          className="math-modal-body"
        >
          {/* Live Render Preview */}
          <div className="math-preview-box">
            <span className="math-preview-label">Live Preview:</span>
            <div
              className={`math-preview-content ${displayMode ? "is-display" : "is-inline"}`}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>

          {parseError && latex.trim() !== "" && (
            <div className="math-error-strip" role="alert">
              <AlertTriangle size={14} />
              <span>{parseError}</span>
            </div>
          )}

          {/* Mode Selection */}
          <div className="math-mode-selector">
            <label className="math-radio-label">
              <input
                type="radio"
                name="displayMode"
                checked={!displayMode}
                onChange={() => setDisplayMode(false)}
              />
              Inline Equation (Inside Text)
            </label>
            <label className="math-radio-label">
              <input
                type="radio"
                name="displayMode"
                checked={displayMode}
                onChange={() => setDisplayMode(true)}
              />
              Display Equation (Centered Block)
            </label>
          </div>

          {/* Symbol & Template Tabs */}
          <div className="math-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Palette Chips */}
          <div className="math-palette-scroll">
            {activeItems.map((item, i) => (
              <React.Fragment key={`${item.name}-${i}`}>
                {item.group && item.group !== activeItems[i - 1]?.group && (
                  <div className="palette-group">{item.group}</div>
                )}
                <button
                  type="button"
                  className={
                    isFormulaSnippet(item.latex) ? "formula-chip" : "symbol-chip"
                  }
                  title={item.name}
                  aria-label={item.name}
                  onClick={() => insertSnippet(item.latex)}
                >
                  <span dangerouslySetInnerHTML={{ __html: getGlyphHtml(item.latex) }} />
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* LaTeX Input */}
          <div className="math-input-group">
            <label htmlFor="latex-input">LaTeX Expression:</label>
            <textarea
              id="latex-input"
              ref={textareaRef}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              onPaste={handleLatexPaste}
              placeholder="Click a chip above, then edit its values  —  Ctrl+Enter to insert"
              rows={3}
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="math-modal-footer">
            <span className="math-kbd-hint">
              <kbd>Esc</kbd> close &nbsp;·&nbsp; <kbd>Ctrl</kbd>+<kbd>↵</kbd> insert
            </span>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!latex.trim()}>
              <Check size={16} />
              {initialLatex ? "Update Equation" : "Insert Equation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
