/**
 * Analyze the Gujarati Romanization text
 * Based on common mapping: Capital = consonant, lowercase = vowel indicator
 */

const text = "-M/FJJF/F ;DT, 5ZYL GSSZ UM/FG[ l:YZ l:YlTDF\\YL UA0FJFDF\\ VFJ[ K[ VG[ V[ H 16[ T[8,F H N/ WZFJTF V[S ,\\ARMZ; a,MSG[ l:YZ l:YlTDF\\YL ;DFG 3Q'6ZlCT -M/FJJF/L ;5F8L 5ZYL ;ZSFJJFDF\\ VFJ[ K[ TM";

// Common Gujarati Romanization mapping (phonetic)
const romanToGujarati: Record<string, string> = {
  // Vowels (standalone)
  "a": "અ", "A": "આ", "i": "ઇ", "I": "ઈ", "u": "ઉ", "U": "ઊ",
  "e": "એ", "ai": "ઐ", "o": "ઓ", "au": "ઔ",
  "ri": "ઋ", "RI": "ઋ",

  // Consonants (capital letters typically)
  "k": "ક", "K": "ક", "kh": "ખ", "g": "ગ", "G": "ગ", "gh": "ઘ", "ng": "ઙ",
  "c": "ચ", "ch": "છ", "j": "જ", "J": "જ", "jh": "ઝ", "ny": "ઞ",
  "T": "ટ", "Th": "ઠ", "D": "ડ", "Dh": "ઢ", "N": "ણ",
  "t": "ત", "th": "થ", "d": "દ", "dh": "ધ", "n": "ન", "N": "ન",
  "p": "પ", "P": "પ", "ph": "ફ", "b": "બ", "B": "બ", "bh": "ભ",
  "m": "મ", "M": "મ", "y": "ય", "Y": "ય", "r": "ર", "R": "ર",
  "l": "લ", "L": "ળ", "v": "વ", "V": "વ", "w": "વ",
  "sh": "શ", "Sh": "શ", "S": "ષ", "s": "સ", "h": "હ",
  "H": "હ",

  // Vowel signs (following consonant)
  "a": "",   // implicit 'a'
  "A": "ા",  // aa
  "i": "િ",  // i
  "I": "ી",  // ii
  "u": "ુ",  // u
  "U": "ૂ",  // uu
  "e": "ే",  // e
  "ai": "ૈ", // ai
  "o": "ો",  // o
  "au": "ૌ", // au
  "ri": "ૃ", // ri
};

// Common conjuncts
const conjuncts: Record<string, string> = {
  "ksha": "ક્ષ", "ksh": "ક્ષ", "tra": "ત્ર", "tr": "ત્ર",
  "shr": "શ્ર", "shri": "શ્રી", "gya": "જ્ય",
};

// Detect common patterns
console.log("=== GUJARATI ROMANIZATION ANALYZER ===\n");
console.log("Input text:");
console.log(text);
console.log("\n" + "=".repeat(60));

// Count character types
let upper = 0, lower = 0, digit = 0, symbol = 0, space = 0;
for (const ch of text) {
  if (ch >= 'A' && ch <= 'Z') upper++;
  else if (ch >= 'a' && ch <= 'z') lower++;
  else if (ch >= '0' && ch <= '9') digit++;
  else if (ch === ' ' || ch === '\t') space++;
  else symbol++;
}

console.log(`\nCharacter breakdown:`);
console.log(`  Uppercase letters: ${upper}`);
console.log(`  Lowercase letters: ${lower}`);
console.log(`  Digits: ${digit}`);
console.log(`  Symbols/punctuation: ${symbol}`);
console.log(`  Spaces: ${space}`);

// Check if this matches KrutiDev (has extended ASCII)
const hasExtendedAscii = /[\x80-\xFF]/.test(text);
console.log(`\n  Extended ASCII (KrutiDev): ${hasExtendedAscii ? "YES" : "NO (plain ASCII)"}`);

console.log("\n" + "=".repeat(60));
console.log("\nThis appears to be: ROMANIZED GUJARATI (phonetic transliteration)");
console.log("Not KrutiDev (which uses extended ASCII codes 128-255)");

// Simple conversion attempt
console.log("\n" + "=".repeat(60));
console.log("Simple conversion attempt:");
console.log("=".repeat(60));

let converted = text;
for (const [roman, guj] of Object.entries(romanToGujarati).sort((a, b) => b[0].length - a[0].length)) {
  const regex = new RegExp(roman.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  converted = converted.replace(regex, guj);
}

console.log("\nResult:");
console.log(converted);

// Show unique characters
console.log("\n" + "=".repeat(60));
console.log("Unique characters in text (for mapping verification):");
const unique = [...new Set(text)].sort();
for (const ch of unique) {
  const code = ch.charCodeAt(0);
  console.log(`  "${ch}" = ${code} (0x${code.toString(16).toUpperCase().padStart(2, '0')})`);
}