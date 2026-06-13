#!/usr/bin/env node
// Fails if any dependency in package.json uses a `^` or `~` version range.
// We pin exact versions so installs are reproducible and `minimumReleaseAge`
// (see pnpm-workspace.yaml) can't be sidestepped by a caret/tilde upgrade.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const groups = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

const violations = [];
for (const group of groups) {
  for (const [name, range] of Object.entries(pkg[group] ?? {})) {
    if (typeof range === "string" && (range.startsWith("^") || range.startsWith("~"))) {
      violations.push(`  ${group}.${name}: "${range}"`);
    }
  }
}

if (violations.length > 0) {
  console.error(
    `Dependencies must be pinned to exact versions (no "^" or "~"):\n` +
      violations.join("\n"),
  );
  process.exit(1);
}

console.log("All dependencies are pinned to exact versions.");
