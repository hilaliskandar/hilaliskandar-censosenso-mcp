import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import process from "node:process";

const ROOTS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["src"];
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
]);

async function collect(path) {
  const info = await stat(path);
  if (info.isFile()) return [path];

  const out = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) out.push(...(await collect(child)));
    else if (entry.isFile()) out.push(child);
  }
  return out;
}

const crlf = [];
const loneCr = [];

for (const root of ROOTS) {
  for (const file of await collect(root)) {
    if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    const data = await readFile(file);
    const text = data.toString("utf8");

    if (text.includes("\r\n")) crlf.push(relative(process.cwd(), file));
    if (/\r(?!\n)/.test(text)) loneCr.push(relative(process.cwd(), file));
  }
}

if (crlf.length === 0 && loneCr.length === 0) {
  console.log("EOL OK: arquivos textuais verificados usam LF.");
  process.exit(0);
}

console.error("EOL invalido na worktree.");
if (crlf.length > 0) {
  console.error(`CRLF detectado em ${crlf.length} arquivo(s):`);
  for (const file of crlf.slice(0, 80)) console.error(`- ${file}`);
  if (crlf.length > 80) console.error(`... e mais ${crlf.length - 80}`);
}
if (loneCr.length > 0) {
  console.error(`CR isolado detectado em ${loneCr.length} arquivo(s):`);
  for (const file of loneCr.slice(0, 80)) console.error(`- ${file}`);
}

console.error("");
console.error("No Windows, execute: npm run eol:fix:windows");
process.exit(1);
