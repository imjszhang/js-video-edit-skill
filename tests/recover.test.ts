import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { warnSegmentMismatch, runArticleRecover } from "../src/article/recover.js";

function captureLogs(fn: () => void): string[] {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return lines;
}

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

test("warnSegmentMismatch reports missing PNG for extra audio", () => {
  const audioIds = [1, 2, 3, 4, 5, 6, 7, 8];
  const pngIds = new Set([1, 2, 3, 4, 5]);
  const logs = captureLogs(() =>
    warnSegmentMismatch(audioIds, pngIds, path.join("/tmp", "scenes"))
  );
  assert.ok(logs.some((l) => l.includes("missing PNG")));
  assert.ok(logs.some((l) => l.includes("6")));
});

test("warnSegmentMismatch reports orphan PNG", () => {
  const audioIds = [1, 2, 3];
  const pngIds = new Set([1, 2, 3, 9, 10]);
  const logs = captureLogs(() =>
    warnSegmentMismatch(audioIds, pngIds, path.join("/tmp", "scenes"))
  );
  assert.ok(logs.some((l) => l.includes("orphan PNG")));
});

test("warnSegmentMismatch warns when scenes dir missing", () => {
  const logs = captureLogs(() =>
    warnSegmentMismatch([1], new Set(), path.join("/nonexistent", "scenes"))
  );
  assert.ok(logs.some((l) => l.includes("scenes/ directory not found")));
});

{
  const dir = mkdtempSync(path.join(tmpdir(), "vep-recover-"));
  mkdirSync(path.join(dir, "audio"));
  writeFileSync(path.join(dir, "audio", "seg01.mp3"), "");
  writeFileSync(path.join(dir, "audio", "seg02.mp3"), "");

  let jsonOut = "";
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    const s = args.map(String).join(" ");
    if (s.startsWith("{")) jsonOut = s;
    else origLog(...args);
  };
  await runArticleRecover(dir, { dryRun: true });
  console.log = origLog;

  const parsed = JSON.parse(jsonOut);
  assert.strictEqual(parsed.storyboard.segments.length, 2);
  assert.strictEqual(parsed.timeline.segments.length, 2);
  console.log("✅ recover dry-run prints preview JSON");
}

console.log("\n✅ All recover tests passed.");
