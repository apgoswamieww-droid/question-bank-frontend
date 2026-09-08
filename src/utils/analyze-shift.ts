/**
 * Gujarati Font Decoder - Identifies and decodes shifted encodings
 * Common patterns:
 * - Standard KrutiDev: codes 128-255
 * - Shifted fonts: A→F, B→G, etc. (shift by +5 or similar)
 */

const text = "-M/FJJF/F ;DT, 5ZYL GSSZ UM/FG[ l:YZ l:YlTDF\\YL UA0FJFDF\\ VFJ[ K[ VG[ V[ H 16[ T[8,F H N/ WZFJTF V[S ,\\ARMZ; a,MSG[ l:YZ l:YlTDF\\YL ;DFG 3Q'6ZlCT -M/FJJF/L ;5F8L 5ZYL ;ZSFJJFDF\\ VFJ[ K[ TM";

// Character frequency analysis
const freq = new Map<string, number>();
for (const ch of text) {
  freq.set(ch, (freq.get(ch) || 0) + 1);
}

// Sort by frequency
const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);

console.log("=== CHARACTER FREQUENCY ANALYSIS ===\n");
console.log("Top 20 most frequent characters:");
for (const [ch, count] of sorted.slice(0, 20)) {
  const code = ch.charCodeAt(0);
  const hex = code.toString(16).toUpperCase();
  const isAscii = code < 128;
  console.log(`  "${ch}" (0x${hex.padStart(2,'0')}) = ${count}x ${isAscii ? "(ASCII)" : "(Extended)"}`);
}

console.log("\n" + "=".repeat(60));
console.log("\nASCII RANGE ANALYSIS:");

// Analyze ASCII range
const asciiChars = [...freq.entries()].filter(([ch]) => {
  const code = ch.charCodeAt(0);
  return code >= 32 && code <= 126;
}).sort((a, b) => a[0].charCodeAt(0) - b[0].charCodeAt(0));

console.log("All printable ASCII characters in text:");
for (const [ch, count] of asciiChars) {
  const code = ch.charCodeAt(0);
  console.log(`  "${ch}" = ${code} (0x${code.toString(16).toUpperCase().padStart(2,'0')})`);
}

console.log("\n" + "=".repeat(60));
console.log("\nDETECTING SHIFT PATTERN...\n");

// Common Gujarati characters that appear frequently
// In Gujarati: 'a' vowel sign (implicit), 'u', 'i', 'halant' are most common
// If this is a shifted font, we can try different shifts

const shifts = [];
for (let shift = 1; shift <= 10; shift++) {
  const shifted: string[] = [];
  let valid = true;
  for (const [ch, count] of sorted.slice(0, 15)) {
    if (ch === ' ') continue;
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) {
      const newChar = String.fromCharCode(code - shift);
      shifted.push(newChar);
    }
  }
  shifts.push({ shift, sample: shifted.slice(0, 8).join('') });
}

console.log("Trying shifts (most frequent chars, shifted left):");
for (const { shift, sample } of shifts.slice(0, 8)) {
  console.log(`  Shift -${shift}: ${sample}`);
}

console.log("\n" + "=".repeat(60));
console.log("\nMANUAL PATTERN MATCHING:");
console.log("\nIf 'F' is most frequent, it's likely:");
console.log("  - 'a' vowel (most common in Gujarati) = shift -5 (F - 5 = A)");
console.log("  - halant/viram (也很 common) = shift -20 (F - 20 = )");
console.log("  - 'u' vowel = shift -13 (F - 13 = U)");

// Check specific shift patterns
console.log("\nTrying shift -5 (A→F mapping):");
let result = "";
for (const ch of text) {
  const code = ch.charCodeAt(0);
  if (code >= 65 && code <= 90) { // A-Z
    result += String.fromCharCode(code - 5);
  } else if (code >= 97 && code <= 122) { // a-z
    result += String.fromCharCode(code - 5);
  } else {
    result += ch;
  }
}
console.log(result.substring(0, 200) + "...");

console.log("\n" + "=".repeat(60));
console.log("\nTry a DIFFERENT approach - use a known Gujarati word:");
console.log('If "JEE" appears in text and should be "JEE", no shift.');
console.log('If "JEE" should be "JEE" in Gujarati, we need to find mapping.');