import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runArticleAssemble } from "../src/article/assemble.js";

{
  const dir = mkdtempSync(path.join(tmpdir(), "vep-asm-"));
  mkdirSync(path.join(dir, "trimmed"), { recursive: true });
  const out = await runArticleAssemble(dir, { dryRun: true });
  assert.ok(out.endsWith("final.mp4"));
  console.log("✅ assemble dry-run without timeline exits early");
}

{
  const dir = mkdtempSync(path.join(tmpdir(), "vep-asm-"));
  mkdirSync(path.join(dir, "trimmed"), { recursive: true });
  writeFileSync(
    path.join(dir, "timeline.json"),
    JSON.stringify(
      {
        version: 1,
        total_duration: 5,
        generated_at: new Date().toISOString(),
        segments: [
          {
            id: 1,
            start: 0,
            end: 5,
            duration: 5,
            narration: "test",
            audio_raw: "audio/seg01.mp3",
            audio_trimmed: "trimmed/seg01.mp3",
            visual: "scenes/scene01.png",
          },
        ],
      },
      null,
      2
    )
  );
  const out = await runArticleAssemble(dir, { dryRun: true });
  assert.ok(out.endsWith("final.mp4"));
  console.log("✅ assemble dry-run with timeline previews clips");
}

console.log("\n✅ All assemble tests passed.");
