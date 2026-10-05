#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();

function json(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function fail(message) {
  console.error(`version-sync: ${message}`);
  process.exitCode = 1;
}

const pkg = json("package.json");
const expected = pkg.version;

if (!/^\d+\.\d+\.\d+$/.test(expected)) {
  fail(`package.json has invalid version ${JSON.stringify(expected)}`);
}

const checks = [
  ["package-lock.json.version", json("package-lock.json").version],
  ["package-lock.json.packages[\"\"].version", json("package-lock.json").packages?.[""]?.version],
  ["server.json.version", json("server.json").version],
  ["lhm.plugin.json.version", json("lhm.plugin.json").version],
  ["docs/reproducibility.json.project.version", json("docs/reproducibility.json").project?.version],
];

for (const [label, actual] of checks) {
  if (actual !== expected) {
    fail(`${label}=${JSON.stringify(actual)} but package.json=${JSON.stringify(expected)}`);
  }
}

const baseline = join(root, "baselines", `surface-stdio-${expected}.json`);
if (!existsSync(baseline)) {
  fail(`missing current surface baseline: baselines/surface-stdio-${expected}.json`);
}

if (expected.startsWith("0.")) {
  const [, minor, patch] = expected.split(".").map(Number);
  if (minor > 9) fail(`pre-1.0 public minor must be 0..9; received ${minor}`);
  if (minor === 9) {
    console.log(`version-sync: ${expected} is in the reserved beta line 0.9.x`);
  } else {
    console.log(`version-sync: ${expected} is in the prototype line 0.${minor}.x (patch ${patch})`);
  }
}

if (!process.exitCode) {
  console.log(`version-sync: all manifests and baseline agree on ${expected}`);
}
