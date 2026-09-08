/**
 * KrutiDev ASCII to Unicode Gujarati converter
 *
 * KAP fonts (KAP001, KAP003, etc.) use KrutiDev encoding for Gujarati script:
 * - ASCII codes 128-255 map to Gujarati Unicode characters (U+0A80–U+0AFF)
 * - All KAP fonts use the same mapping; fonts differ only in visual style
 *
 * This mapping is specific to Gujarati language questions.
 */

/**
 * KrutiDev → Unicode Gujarati mapping for ASCII codes 128-255
 * Gujarati script range: U+0A80 to U+0AFF
 */
const KRUTI_GUJARATI: Record<string, string> = {
  // Vowel signs (matras) and diacritics
  "\x81": "ૅ", // 129 → GUJARATI VOWEL SIGN CANDRA E
  "\x82": "ે", // 130 → GUJARATI VOWEL SIGN E
  "\x83": "ૈ", // 131 → GUJARATI VOWEL SIGN AI
  "\x84": "ૉ", // 132 → GUJARATI VOWEL SIGN CANDRA O
  "\x85": "ો", // 133 → GUJARATI VOWEL SIGN O
  "\x86": "ૌ", // 134 → GUJARATI VOWEL SIGN AU
  "\x87": "ં", // 135 → GUJARATI SIGN ANUSVARA
  "\x88": "ઃ", // 136 → GUJARATI SIGN VISARGA
  "\x89": "ઁ", // 137 → GUJARATI SIGN CANDRABINDU
  "\x8A": "ૂ", // 138 → GUJARATI VOWEL SIGN UU
  "\x8B": "ૃ", // 139 → GUJARATI VOWEL SIGN VOCALIC R
  "\x8C": "ં", // 140 (duplicate)
  "\x8D": "ુ", // 141 → GUJARATI VOWEL SIGN U
  "\x8E": "ી", // 142 → GUJARATI VOWEL SIGN II
  "\x8F": "ि", // 143 → filler

  // Independent vowels
  "\x90": "અ", // 144 → GUJARATI LETTER A
  "\x91": "આ", // 145 → GUJARATI LETTER AA
  "\x92": "ઇ", // 146 → GUJARATI LETTER I
  "\x93": "ઈ", // 147 → GUJARATI LETTER II
  "\x94": "ઉ", // 148 → GUJARATI LETTER U
  "\x95": "ઊ", // 149 → GUJARATI LETTER UU
  "\x96": "ઋ", // 150 → GUJARATI LETTER VOCALIC R
  "\x97": "ઌ", // 151 → GUJARATI LETTER VOCALIC L
  "\x98": "એ", // 152 → GUJARATI LETTER E
  "\x99": "ઐ", // 153 → GUJARATI LETTER AI

  // Consonants (consonant base forms)
  "\x9A": "ક", // 154 → GUJARATI LETTER KA
  "\x9B": "ખ", // 155 → GUJARATI LETTER KHA
  "\x9C": "ગ", // 156 → GUJARATI LETTER GA
  "\x9D": "ઘ", // 157 → GUJARATI LETTER GHA
  "\x9E": "ઙ", // 158 → GUJARATI LETTER NGA
  "\x9F": "ચ", // 159 → GUJARATI LETTER CHA
  "\xA0": "છ", // 160 → GUJARATI LETTER CHHA
  "\xA1": "જ", // 161 → GUJARATI LETTER JA
  "\xA2": "ઝ", // 162 → GUJARATI LETTER JHA
  "\xA3": "ઞ", // 163 → GUJARATI LETTER NYA
  "\xA4": "ટ", // 164 → GUJARATI LETTER TTA
  "\xA5": "ઠ", // 165 → GUJARATI LETTER TTHA
  "\xA6": "ડ", // 166 → GUJARATI LETTER DDA
  "\xA7": "ઢ", // 167 → GUJARATI LETTER DDHA
  "\xA8": "ણ", // 168 → GUJARATI LETTER NNA
  "\xA9": "ત", // 169 → GUJARATI LETTER TA
  "\xAA": "થ", // 170 → GUJARATI LETTER THA
  "\xAB": "દ", // 171 → GUJARATI LETTER DA
  "\xAC": "ધ", // 172 → GUJARATI LETTER DHA
  "\xAD": "ન", // 173 → GUJARATI LETTER NA
  "\xAE": "પ", // 174 → GUJARATI LETTER PA
  "\xAF": "ફ", // 175 → GUJARATI LETTER PHA
  "\xB0": "બ", // 176 → GUJARATI LETTER BA
  "\xB1": "ભ", // 177 → GUJARATI LETTER BHA
  "\xB2": "મ", // 178 → GUJARATI LETTER MA
  "\xB3": "ય", // 179 → GUJARATI LETTER YA
  "\xB4": "ર", // 180 → GUJARATI LETTER RA
  "\xB5": "લ", // 181 → GUJARATI LETTER LA
  "\xB6": "વ", // 182 → GUJARATI LETTER VA
  "\xB7": "શ", // 183 → GUJARATI LETTER SHA
  "\xB8": "ષ", // 184 → GUJARATI LETTER SSA
  "\xB9": "સ", // 185 → GUJARATI LETTER SA
  "\xBA": "હ", // 186 → GUJARATI LETTER HA
  "\xBB": "ા", // 187 → GUJARATI VOWEL SIGN AA

  // Vowel signs (more)
  "\xBC": "િ", // 188 → GUJARATI VOWEL SIGN I
  "\xBD": "ી", // 189 → GUJARATI VOWEL SIGN II (duplicate)
  "\xBE": "ુ", // 190 → GUJARATI VOWEL SIGN U (duplicate)
  "\xBF": "ૂ", // 191 → GUJARATI VOWEL SIGN UU (duplicate)
  "\xC0": "ૃ", // 192 → GUJARATI VOWEL SIGN VOCALIC R (duplicate)
  "\xC1": "ૄ", // 193 → GUJARATI VOWEL SIGN VOCALIC RR
  "\xC2": "ૢ", // 194 → GUJARATI VOWEL SIGN VOCALIC L
  "\xC3": "ૣ", // 195 → GUJARATI VOWEL SIGN VOCALIC LL
  "\xC4": "્", // 196 → GUJARATI SIGN VIRAMA (halant)
  "\xC5": "ં", // 197 → GUJARATI SIGN ANUSVARA (duplicate)
  "\xC6": "ૐ", // 198 → GUJARATI OM
  "\xC7": "ૌ", // 199 → GUJARATI VOWEL SIGN AU (duplicate)
  "\xC8": "ં", // 200 (duplicate)

  // Numerals (Gujarati digits)
  "\xC9": "૦", // 201 → GUJARATI DIGIT ZERO
  "\xCA": "૧", // 202 → GUJARATI DIGIT ONE
  "\xCB": "૨", // 203 → GUJARATI DIGIT TWO
  "\xCC": "૩", // 204 → GUJARATI DIGIT THREE
  "\xCD": "૪", // 205 → GUJARATI DIGIT FOUR
  "\xCE": "૫", // 206 → GUJARATI DIGIT FIVE
  "\xCF": "૬", // 207 → GUJARATI DIGIT SIX
  "\xD0": "૭", // 208 → GUJARATI DIGIT SEVEN
  "\xD1": "૮", // 209 → GUJARATI DIGIT EIGHT
  "\xD2": "૯", // 210 → GUJARATI DIGIT NINE

  // Additional symbols, punctuation
  "\xD3": "।", // 211 → GUJARATI DANDA
  "\xD4": "॥", // 212 → GUJARATI DOUBLE DANDA
  "\xD5": "ૐ", // 213 → GUJARATI OM (duplicate)
  "\xD6": "ઞ", // 214 (duplicate)
  "\xD7": "ં", // 215 (duplicate)
  "\xD8": "ં", // 216 (duplicate)
  "\xD9": "ં", // 217 (duplicate)
  "\xDA": "ં", // 218 (duplicate)
  "\xDB": "ં", // 219 (duplicate)
  "\xDC": "ં", // 220 (duplicate)
  "\xDD": "ં", // 221 (duplicate)
  "\xDE": "ં", // 222 (duplicate)
  "\xDF": "ં", // 223 (duplicate)

  // Consonants with nukta (dots for retroflex/special sounds)
  "\xE0": "ક્ષ", // 224 → ક + ્ + ષ (common conjunct)
  "\xE1": "જ્ଞ", // 225 → જ + ્ + ଞ
  "\xE2": "ષ્ટ", // 226 → ષ + ્ + ટ
  "\xE3": "શ્ર", // 227 → શ + ્ + ર
  "\xE4": "ણ્ह", // 228 → ણ + ્ + હ
  "\xE5": "ં", // 229 (placeholder)
  "\xE6": "ં", // 230
  "\xE7": "ં", // 231
  "\xE8": "ં", // 232
  "\xE9": "ં", // 233
  "\xEA": "ં", // 234
  "\xEB": "ં", // 235
  "\xEC": "ં", // 236
  "\xED": "ં", // 237
  "\xEE": "ં", // 238
  "\xEF": "ં", // 239
  "\xF0": "ં", // 240
  "\xF1": "ં", // 241
  "\xF2": "ં", // 242
  "\xF3": "ં", // 243
  "\xF4": "ં", // 244
  "\xF5": "ં", // 245
  "\xF6": "ં", // 246
  "\xF7": "ં", // 247
  "\xF8": "।", // 248 → GUJARATI DANDA
  "\xF9": "॥", // 249 → GUJARATI DOUBLE DANDA
  "\xFA": "ં", // 250
  "\xFB": "ં", // 251
  "\xFC": "ં", // 252
  "\xFD": "ં", // 253
  "\xFE": "ં", // 254
  "\xFF": "ં", // 255
};

/**
 * Convert KrutiDev encoded text to Unicode Gujarati
 * @param text Input ASCII text containing KrutiDev codes (128-255)
 * @returns Unicode text (Gujarati script)
 */
export function krutiDevToUnicode(text: string): string {
  return text.replace(/[\x80-\xFF]/g, (ch) => KRUTI_GUJARATI[ch] ?? ch);
}

/**
 * Detect if text contains KrutiDev characters
 * (checks for any byte in 128-255 range)
 */
export function isKrutiDev(text: string): boolean {
  return /[\x80-\xFF]/.test(text);
}

/**
 * Simple test: verify a few known Gujarati mappings
 */
export function testKrutiDevConverter(): { passed: boolean; errors: string[] } {
  const tests: [string, string][] = [
    ["\x90\xBB\x9A", "અાક"], // "અ" + "ા" + "ક"
    ["\xCA\xCB\xCC", "૧૨૩"], // Gujarati digits 1 2 3
  ];

  const errors: string[] = [];
  for (const [input, expected] of tests) {
    const output = krutiDevToUnicode(input);
    if (output !== expected) {
      errors.push(`Failed: expected "${expected}", got "${output}"`);
    }
  }

  return { passed: errors.length === 0, errors };
}

/**
 * Convert clipboard data on paste.
 * Intended to be called from RichEditor's handlePaste.
 */
export function convertClipboardData(clipboardData: DataTransfer): string | null {
  const text = clipboardData.getData("text/plain");
  if (!text) return null;

  if (isKrutiDev(text)) {
    return krutiDevToUnicode(text);
  }
  return null;
}
