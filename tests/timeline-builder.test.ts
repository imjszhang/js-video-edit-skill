import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getMissingTimelineAssets, runArticleTimeline } from "../src/article/timeline-builder.js";

const STORYBOARD = {
  version: 1,
  title: "Test",
  width: 1080,
  height: 1920,
  fps: 24,
  voice: "zh-CN-YunxiNeural",
  segments: [
    {
      id: 1,
      visual_type: "hero",
      narration: "cover narration text here",
      text: "Title",
      reason: "hero",
      selected: "hero",
    },
  ],
};

function writeMinimalProject(dir: string, opts: { audio?: boolean; png?: boolean } = {}) {
  writeFileSync(path.join(dir, "storyboard.json"), JSON.stringify(STORYBOARD, null, 2));
  mkdirSync(path.join(dir, "audio"), { recursive: true });
  mkdirSync(path.join(dir, "scenes"), { recursive: true });
  mkdirSync(path.join(dir, "trimmed"), { recursive: true });
  if (opts.audio) writeFileSync(path.join(dir, "audio", "seg01.mp3"), "x");
  if (opts.png) writeFileSync(path.join(dir, "scenes", "scene01.png"), "x");
}

{
  const dir = mkdtempSync(path.join(tmpdir(), "vep-tl-"));
  writeMinimalProject(dir, { audio: true });
  const { missingVisual, missingAudio } = getMissingTimelineAssets(dir, [1], false);
  assert.deepStrictEqual(missingAudio, []);
  assert.deepStrictEqual(missingVisual, [1]);
  console.log("✅ getMissingTimelineAssets finds missing visual");
}

{
  const dir = mkdtempSync(path.join(tmpdir(), "vep-tl-"));
  const result = getMissingTimelineAssets(dir, [1], true);
  assert.deepStrictEqual(result, { missingAudio: [], missingVisual: [] });
  console.log("✅ getMissingTimelineAssets skips checks in dry-run");
}

{
  const dir = mkdtempSync(path.join(tmpdir(), "vep-tl-"));
  writeMinimalProject(dir);
  const timeline = await runArticleTimeline(dir, { dryRun: true });
  assert.strictEqual(timeline.segments.length, 1);
  assert.strictEqual(timeline.segments[0]!.duration, 5);
  assert.strictEqual(timeline.total_duration, 5);
  console.log("✅ runArticleTimeline dry-run builds fake timeline");
}

console.log("\n✅ All timeline-builder tests passed.");
