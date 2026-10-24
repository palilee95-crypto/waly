import fs from 'node:fs';
import path from 'node:path';

const roots = ['app', 'components', 'lib'];
const exts = new Set(['.tsx', '.ts']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.expo', 'dist'].includes(entry.name)) continue;
      walk(p);
    } else if (exts.has(path.extname(entry.name))) {
      files.push(p);
    }
  }
}
roots.forEach((r) => { if (fs.existsSync(r)) walk(r); });

const JSX_TEXT = />\s*([A-Z][^<>{}]{2,120}?)\s*</g;
const ATTR = /\b(?:placeholder|label|title|accessibilityLabel|heading)\s*=\s*["']([^"']{3,120})["']/g;
const ALERT = /Alert\.alert\(\s*["']([^"']{3,120})["']/g;

const rows = [];
let totalHard = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  let hard = 0;
  let bilingual = 0;
  let tCalls = 0;

  for (const line of lines) {
    if (/\bt\(\s*['"]/.test(line) || /\bt\(`/.test(line)) tCalls += 1;
    if (/locale\s*===\s*['"]en['"]|isMalay|locale\s*===\s*['"]ms['"]/.test(line)) { bilingual += 1; continue; }
    if (/\btr\(|\bt\(/.test(line)) { bilingual += 1; continue; }
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    if (/console\.(log|warn|error)/.test(line)) continue;
    if (/^\s*import\b/.test(line)) continue;

    // Skip pure style/prop lines that are clearly not UI copy.
    if (/StyleSheet\.create|^\s*[A-Za-z0-9_]+\s*:\s*[{[]/.test(line)) continue;
    if (/^\s*(fontFamily|fontSize|color|backgroundColor|borderColor)\s*:/.test(line)) continue;

    for (const re of [JSX_TEXT, ATTR, ALERT]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        const text = m[1].trim();
        if (!/[A-Za-z]{3}/.test(text)) continue;
        if (/^(http|www\.|RM\s?\d|\d)/.test(text)) continue;
        if (/^[a-z_]+$/.test(text)) continue;
        hard += 1;
      }
    }
  }

  if (hard > 0) {
    rows.push({ file, hard, bilingual, tCalls });
    totalHard += hard;
  }
}

rows.sort((a, b) => b.hard - a.hard);
console.log(`Files scanned: ${files.length}`);
console.log(`Hardcoded UI strings (heuristic): ${totalHard}`);
console.log(`Files with hardcoded copy: ${rows.length}\n`);
console.log('Top 25 offenders:');
for (const r of rows.slice(0, 25)) {
  console.log(`${String(r.hard).padStart(4)}  hard | ${String(r.bilingual).padStart(3)} bilingual | ${String(r.tCalls).padStart(3)} t()  ${r.file}`);
}
