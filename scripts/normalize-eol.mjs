import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function normalizeCrlf(buffer) {
  let changed = false;
  const out = Buffer.allocUnsafe(buffer.length);
  let j = 0;

  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i];
    if (byte === 0x0d && buffer[i + 1] === 0x0a) {
      out[j] = 0x0a;
      j += 1;
      i += 1;
      changed = true;
      continue;
    }
    out[j] = byte;
    j += 1;
  }

  return changed ? out.subarray(0, j) : null;
}

const roots = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["src"];

try {
  git(["rev-parse", "--show-toplevel"]);
} catch {
  console.error("Execute este comando dentro do repositorio Git.");
  process.exit(1);
}

const dirtyBefore = git(["status", "--porcelain", "--untracked-files=no"]).trim();
if (dirtyBefore) {
  console.error("Ha alteracoes versionadas na worktree:");
  console.error(dirtyBefore);
  console.error("Faca commit ou stash antes de normalizar EOL.");
  process.exit(1);
}

// Override only this repository; do not modify the user's global/system Git config.
git(["config", "--local", "core.autocrlf", "false"]);
git(["config", "--local", "core.eol", "lf"]);

const raw = execFileSync("git", ["ls-files", "-z", "--", ...roots], {
  cwd: process.cwd(),
  encoding: "buffer",
});
const files = raw
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

let changed = 0;
for (const file of files) {
  const input = await readFile(file);
  const output = normalizeCrlf(input);
  if (!output) continue;
  await writeFile(file, output);
  changed += 1;
}

const dirtyAfter = git(["status", "--porcelain", "--untracked-files=no"]).trim();
if (dirtyAfter) {
  console.error("A normalizacao alterou o conteudo versionado alem de EOL:");
  console.error(dirtyAfter);
  console.error("Interrompendo para revisao manual.");
  process.exit(2);
}

console.log(`EOL normalizado: ${changed} arquivo(s) CRLF -> LF.`);
console.log("Configuracao local: core.autocrlf=false; core.eol=lf.");
