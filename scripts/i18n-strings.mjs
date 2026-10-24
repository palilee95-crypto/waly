import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2];
if (!target) {
  console.log('usage: node scripts/i18n-strings.mjs <file>');
  process.exit(1);
}
const src = fs.readFileSync(target, 'utf8');
const lines = src.split(/\r?\n/);

const JSX_TEXT = />\s*([A-Z][^<>{}]{2,120}?)\s*</g;
const ATTR = /\b(?:placeholder|label|title|accessibilityLabel|heading)\s*=\s*["']([^"']{3,120})["']/g;
const ALERT = /Alert\.alert\(\s*["']([^"']{3,120})["']/g;

let n = 0;
lines.forEach((line, i) => {
  if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
  if (/console\.(log|warn|error)/.test(line)) return;
  if (/^\s*import\b/.test(line)) return;
  if (/StyleSheet\.create|^\s*[A-Za-z0-9_]+\s*:\s*[{[]/.test(line)) return;
  if (/^\s*(fontFamily|fontSize|color|backgroundColor|borderColor)\s*:/.test(line)) return;
  if (/locale\s*===\s*['"]en['"]|isMalay|locale\s*===\s*['"]ms['"]/.test(line)) return;
  if (/\btr\(|\bt\(/.test(line)) return;
  const found = new Set();
  for (const re of [JSX_TEXT, ATTR, ALERT]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line))) {
      const text = m[1].trim();
      if (!/[A-Za-z]{3}/.test(text)) continue;
      if (/^(http|www\.|RM\s?\d|\d)/.test(text)) continue;
      if (/^[a-z_]+$/.test(text)) continue;
      found.add(text);
    }
  }
  if (found.size) {
    n += found.size;
    console.log(`${String(i + 1).padStart(5)}: ${[...found].map((s) => JSON.stringify(s)).join(' | ')}`);
  }
});
console.log(`\n${n} candidate strings in ${target}`);
