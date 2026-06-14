#!/usr/bin/env node
/** @deprecated Use `vep pipeline` */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

console.warn("scripts/pipeline.ts is deprecated — use: vep pipeline");

const result = spawnSync(
  "npx",
  [
    "tsx",
    path.join(path.dirname(fileURLToPath(import.meta.url)), "cli.ts"),
    "pipeline",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", shell: true }
);
process.exit(result.status ?? 1);
