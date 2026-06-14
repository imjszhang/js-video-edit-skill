#!/usr/bin/env node
/** @deprecated Use `vep cut` */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

console.warn("scripts/cut.ts is deprecated — use: vep cut");

const result = spawnSync(
  "npx",
  [
    "tsx",
    path.join(path.dirname(fileURLToPath(import.meta.url)), "cli.ts"),
    "cut",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", shell: true }
);
process.exit(result.status ?? 1);
