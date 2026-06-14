import assert from "node:assert";
import {
  parseSegmentId,
  sortBySegmentId,
  scenePngName,
} from "../src/article/segment-files.js";

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

test("parseSegmentId extracts numeric id", () => {
  assert.strictEqual(parseSegmentId("seg01.mp3", "seg"), 1);
  assert.strictEqual(parseSegmentId("seg20.mp3", "seg"), 20);
  assert.strictEqual(parseSegmentId("scene14.png", "scene"), 14);
  assert.strictEqual(parseSegmentId("other.mp3", "seg"), null);
});

test("sortBySegmentId orders numerically not lexicographically", () => {
  const files = ["seg02.mp3", "seg10.mp3", "seg01.mp3", "seg20.mp3"];
  const sorted = sortBySegmentId(files, "seg");
  assert.deepStrictEqual(sorted, [
    "seg01.mp3",
    "seg02.mp3",
    "seg10.mp3",
    "seg20.mp3",
  ]);
});

test("sortBySegmentId handles scene html files", () => {
  const files = ["scene10.html", "scene02.html", "scene01.html"];
  const sorted = sortBySegmentId(files, "scene");
  assert.deepStrictEqual(sorted, [
    "scene01.html",
    "scene02.html",
    "scene10.html",
  ]);
});

test("scenePngName zero-pads id", () => {
  assert.strictEqual(scenePngName(1), "scene01.png");
  assert.strictEqual(scenePngName(14), "scene14.png");
});

console.log("\n✅ All segment-files tests passed.");
