// Debug script - run to analyze character codes
const text = "-M/FJJF/F ;DT, 5ZYL GSSZ UM/FG[ l:YZ l:YlTDF\\YL UA0FJFDF\\ VFJ[ K[ VG[ V[ H 16[ T[8,F H N/ WZFJTF V[S ,\\ARMZ; a,MSG[ l:YZ l:YlTDF\\YL ;DFG 3Q'6ZlCT -M/FJJF/L ;5F8L 5ZYL ;ZSFJJFDF\\ VFJ[ K[ TM";

console.log("Text length:", text.length);
console.log("\nCharacter analysis:");

const seen = new Map<number, { char: string; count: number }>();
for (let i = 0; i < text.length; i++) {
  const code = text.charCodeAt(i);
  if (!seen.has(code)) {
    seen.set(code, { char: text[i], count: 0 });
  }
  seen.get(code)!.count++;
}

console.log("\nUnique characters (code, char, count):");
for (const [code, info] of [...seen.entries()].sort((a, b) => a[0] - b[0])) {
  const hex = "0x" + code.toString(16).toUpperCase().padStart(2, "0");
  const isAscii = code < 128;
  console.log(`${code} (${hex}) = "${info.char}" x${info.count} ${isAscii ? "(ASCII)" : "(Extended)"}`);
}

console.log("\nExtended ASCII codes (128-255):");
const extended = [...seen.entries()].filter(([code]) => code >= 128);
if (extended.length === 0) {
  console.log("No extended ASCII codes found - this is PLAIN ASCII, not KrutiDev!");
} else {
  for (const [code, info] of extended) {
    console.log(`${code} (0x${code.toString(16).toUpperCase()}) = "${info.char}"`);
  }
}