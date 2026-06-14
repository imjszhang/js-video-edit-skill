#!/usr/bin/env node
/** @deprecated Use `vep transcribe` */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

console.warn("scripts/transcribe.ts is deprecated — use: vep transcribe");

const result = spawnSync(
  "npx",
  [
    "tsx",
    path.join(path.dirname(fileURLToPath(import.meta.url)), "cli.ts"),
    "transcribe",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", shell: true }
);
process.exit(result.status ?? 1);
