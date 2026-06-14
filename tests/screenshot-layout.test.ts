import assert from "node:assert";
import { evaluateSceneLayoutWarnings } from "../src/article/screenshot.js";
import { LEFT_ALIGN_VISUAL_TYPES } from "../src/article/storyboard.js";

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

test("LEFT_ALIGN_VISUAL_TYPES includes hero and text-card", () => {
  assert.ok(LEFT_ALIGN_VISUAL_TYPES.includes("hero"));
  assert.ok(LEFT_ALIGN_VISUAL_TYPES.includes("text-card"));
});

test("evaluateSceneLayoutWarnings skips h_offset for left-align types", () => {
  const w = evaluateSceneLayoutWarnings("text-card", { hOffset: -200, usageW: 70 });
  assert.strictEqual(w.length, 0);
});

test("evaluateSceneLayoutWarnings warns low usageW for left-align", () => {
  const w = evaluateSceneLayoutWarnings("hero", { hOffset: 0, usageW: 40 });
  assert.ok(w.some((x) => x.includes("usageW")));
});

test("evaluateSceneLayoutWarnings warns h_offset for centered types", () => {
  const w = evaluateSceneLayoutWarnings("comparison", { hOffset: 50, usageW: 90 });
  assert.ok(w.some((x) => x.includes("h_offset")));
});

console.log("\n✅ All screenshot-layout tests passed.");
