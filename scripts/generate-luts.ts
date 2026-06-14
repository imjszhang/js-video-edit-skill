#!/usr/bin/env node
/** @deprecated Use `vep generate-luts` */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

console.warn("scripts/generate-luts.ts is deprecated — use: vep generate-luts");

const result = spawnSync(
  "npx",
  [
    "tsx",
    path.join(path.dirname(fileURLToPath(import.meta.url)), "cli.ts"),
    "generate-luts",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", shell: true }
);
process.exit(result.status ?? 1);
