import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateStoryboard, validateSegmentFields, collectStoryboardWarnings } from "../src/article/storyboard.js";
import { validateTimeline } from "../src/article/timeline.js";

const STORYBOARD_PATH = resolve(import.meta.dirname, "..", "examples", "storyboard.json");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

test("parses example storyboard.json", () => {
  const raw = readFileSync(STORYBOARD_PATH, "utf-8");
  const sb = validateStoryboard(raw);
  assert.strictEqual(sb.segments.length, 4);
  assert.strictEqual(sb.version, 1);
  assert.strictEqual(sb.title, "用 JSON 驱动视频剪辑");
});

test("all segments have narration", () => {
  const raw = readFileSync(STORYBOARD_PATH, "utf-8");
  const sb = validateStoryboard(raw);
  for (const seg of sb.segments) {
    assert.ok(seg.narration.length > 0, `segment ${seg.id} missing narration`);
    assert.ok(seg.visual_type, `segment ${seg.id} missing visual_type`);
  }
});

test("rejects invalid storyboard JSON", () => {
  assert.throws(() => validateStoryboard("not json"), /invalid/i);
});

test("rejects storyboard without segments", () => {
  const invalid = JSON.stringify({ version: 1, title: "Test", segments: [] });
  assert.throws(() => validateStoryboard(invalid));
});

test("validateSegmentFields warns on missing hero text", () => {
  const warnings = validateSegmentFields({
    id: 1,
    visual_type: "hero",
    narration: "test narration",
  });
  assert.ok(warnings.some((w) => w.includes("hero missing")));
});

test("collectStoryboardWarnings detects duplicate id", () => {
  const dup = JSON.stringify({
    version: 1,
    title: "Test",
    segments: [
      { id: 1, visual_type: "hero", narration: "a", text: "t" },
      { id: 1, visual_type: "text-card", narration: "b", heading: "h" },
    ],
  });
  const { warnings } = collectStoryboardWarnings(dup);
  assert.ok(warnings.some((w) => w.includes("duplicate segment id")));
});

test("collectStoryboardWarnings flags deprecated duration", () => {
  const withDur = JSON.stringify({
    version: 1,
    title: "Test",
    segments: [{ id: 1, visual_type: "hero", narration: "a", text: "t", duration: 5 }],
  });
  const { warnings } = collectStoryboardWarnings(withDur);
  assert.ok(warnings.some((w) => w.includes("deprecated 'duration'")));
});

test("validates timeline schema", () => {
  const timeline = {
    version: 1,
    total_duration: 10.5,
    generated_at: new Date().toISOString(),
    segments: [
      {
        id: 1,
        start: 0,
        end: 5.5,
        duration: 5.5,
        narration: "test",
        audio_raw: "audio/seg01.mp3",
        audio_trimmed: "trimmed/seg01.mp3",
        visual: "scenes/scene01.png",
      },
      {
        id: 2,
        start: 5.5,
        end: 10.5,
        duration: 5,
        narration: "test2",
        audio_raw: "audio/seg02.mp3",
        audio_trimmed: "trimmed/seg02.mp3",
        visual: "scenes/scene02.png",
      },
    ],
  };
  const result = validateTimeline(JSON.stringify(timeline));
  assert.strictEqual(result.total_duration, 10.5);
  assert.strictEqual(result.segments.length, 2);
});

console.log("\n✅ All storyboard tests passed.");
