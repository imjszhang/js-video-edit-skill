import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateDecision } from "../src/decision.js";
import { parseTranscript } from "../src/whisper.js";
import {
  buildEditingDecision,
  buildWhisperTranscript,
  buildSrtFromTimeline,
  runArticleExportPost,
} from "../src/article/post-handoff.js";
import type { Storyboard, Timeline } from "../src/article/types.js";

const sampleStoryboard: Storyboard = {
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
      narration: "第一段旁白全文",
      text: "标题",
      reason: "封面镜",
      selected: "hero",
      candidates: [
        { visual_type: "text-card", reason_rejected: "密度太低" },
      ],
    },
    {
      id: 2,
      visual_type: "text-card",
      narration: "第二段旁白",
      heading: "小节",
      reason: "正文",
      selected: "text-card",
    },
  ],
};

const sampleTimeline: Timeline = {
  version: 1,
  total_duration: 8.5,
  generated_at: new Date().toISOString(),
  segments: [
    {
      id: 1,
      start: 0,
      end: 5.2,
      duration: 5.2,
      narration: "第一段旁白全文",
      audio_raw: "audio/seg01.mp3",
      audio_trimmed: "trimmed/seg01.mp3",
      visual: "scenes/scene01.png",
    },
    {
      id: 2,
      start: 5.2,
      end: 8.5,
      duration: 3.3,
      narration: "第二段旁白",
      audio_raw: "audio/seg02.mp3",
      audio_trimmed: "trimmed/seg02.mp3",
      visual: "scenes/scene02.png",
    },
  ],
};

{
  const decision = buildEditingDecision(sampleStoryboard, sampleTimeline);
  validateDecision(JSON.stringify(decision));
  assert.strictEqual(decision.scenes.length, 2);
  assert.strictEqual(decision.scenes[0]!.selected, "clip01.mp4");
  assert.strictEqual(decision.scenes[0]!.in_point, 0);
  assert.strictEqual(decision.scenes[0]!.out_point, 5.2);
  assert.strictEqual(decision.scenes[0]!.reason, "封面镜");
  assert.ok(decision.scenes[0]!.candidates.some((c) => c.reason_rejected === "密度太低"));
  assert.strictEqual(decision.global_settings.target_duration, "0:08");
  console.log("✅ buildEditingDecision validates and maps fields");
}

{
  const whisper = buildWhisperTranscript(sampleTimeline);
  assert.strictEqual(whisper.segments.length, 2);
  assert.strictEqual(whisper.segments[0]!.text, "第一段旁白全文");
  assert.strictEqual(whisper.segments[1]!.start, 5.2);
  assert.deepStrictEqual(whisper.segments[0]!.words, []);
  console.log("✅ buildWhisperTranscript segment timing and text");
}

{
  const srt = buildSrtFromTimeline(sampleTimeline);
  assert.ok(srt.includes("00:00:00,000 --> 00:00:05,200"));
  assert.ok(srt.includes("第一段旁白全文"));
  console.log("✅ buildSrtFromTimeline produces valid SRT timestamps");
}

{
  const dir = mkdtempSync(path.join(tmpdir(), "vep-export-dry-"));
  writeFileSync(
    path.join(dir, "storyboard.json"),
    JSON.stringify(sampleStoryboard, null, 2)
  );
  writeFileSync(path.join(dir, "timeline.json"), JSON.stringify(sampleTimeline, null, 2));

  runArticleExportPost(dir, { dryRun: true });
  assert.ok(!existsSync(path.join(dir, "post", "decision.json")));
  console.log("✅ runArticleExportPost dry-run writes nothing");
}

{
  const dir = mkdtempSync(path.join(tmpdir(), "vep-export-"));
  mkdirSync(path.join(dir, "trimmed"), { recursive: true });
  writeFileSync(
    path.join(dir, "storyboard.json"),
    JSON.stringify(sampleStoryboard, null, 2)
  );
  writeFileSync(path.join(dir, "timeline.json"), JSON.stringify(sampleTimeline, null, 2));
  writeFileSync(path.join(dir, "trimmed", "muxed.mp4"), "fake-muxed");

  runArticleExportPost(dir, { force: true });

  const decisionPath = path.join(dir, "post", "decision.json");
  const transcriptPath = path.join(dir, "post", "transcript.json");
  const srtPath = path.join(dir, "post", "subs.srt");
  const manifestPath = path.join(dir, "post", "manifest.json");
  const roughPath = path.join(dir, "trimmed", "rough.mp4");

  assert.ok(existsSync(decisionPath));
  assert.ok(existsSync(transcriptPath));
  assert.ok(existsSync(srtPath));
  assert.ok(existsSync(manifestPath));
  assert.ok(existsSync(roughPath));
  assert.strictEqual(readFileSync(roughPath, "utf-8"), "fake-muxed");

  validateDecision(readFileSync(decisionPath, "utf-8"));
  parseTranscript(transcriptPath);

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  assert.strictEqual(manifest.version, 1);
  assert.strictEqual(manifest.segment_count, 2);
  assert.ok(Array.isArray(manifest.recommended_commands));
  console.log("✅ runArticleExportPost writes post/ bundle and rough.mp4");
}

console.log("\n✅ All post-handoff tests passed.");
