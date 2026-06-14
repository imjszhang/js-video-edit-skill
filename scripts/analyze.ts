#!/usr/bin/env node
/** @deprecated Use `vep analyze` */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

console.warn("scripts/analyze.ts is deprecated — use: vep analyze");

const result = spawnSync(
  "npx",
  [
    "tsx",
    path.join(path.dirname(fileURLToPath(import.meta.url)), "cli.ts"),
    "analyze",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", shell: true }
);
process.exit(result.status ?? 1);
