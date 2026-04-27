import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");
const TARGET_EXT = new Set([".ts", ".tsx"]);

// Простая эвристика: ищем "подозрительные" EN-слова в UI-строках.
const EN_UI_TOKENS = [
  "Page Not Found",
  "Back to Dashboard",
  "Search",
  "Continue",
  "Unavailable",
  "Loading",
  "Settings",
  "Dashboard",
];

const IGNORE_PATH_PARTS = [
  "node_modules",
  ".next",
  "lib/i18n",
];

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (IGNORE_PATH_PARTS.some((p) => full.includes(p))) continue;
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (TARGET_EXT.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const hits = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const token of EN_UI_TOKENS) {
    // Ищем только литералы строк/JSX-текста в кавычках, чтобы не ловить имена
    // переменных, импортов и типы.
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const literalRe = new RegExp(`["'\`]${escaped}["'\`]`, "m");
    if (literalRe.test(text)) {
      hits.push({ file, token });
    }
  }
}

if (hits.length > 0) {
  console.error("Found possible non-localized UI strings:");
  for (const h of hits) {
    console.error(`- ${path.relative(process.cwd(), h.file)} :: "${h.token}"`);
  }
  process.exit(1);
}

console.log("UI locale check passed.");

