import assert from "node:assert";
import { cuesToAss, formatAssTime, wrapAssText } from "../src/ass.js";

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

test("formatAssTime converts seconds correctly", () => {
  assert.strictEqual(formatAssTime(0), "0:00:00.00");
  assert.strictEqual(formatAssTime(65.5), "0:01:05.50");
  assert.strictEqual(formatAssTime(3661.25), "1:01:01.25");
});

test("wrapAssText handles short text", () => {
  assert.strictEqual(wrapAssText("短字幕"), "短字幕");
});

test("cuesToAss generates valid ASS header", () => {
  const ass = cuesToAss([
    { start: 0, end: 5, text: "第一段字幕" },
    { start: 5, end: 10, text: "第二段字幕" },
  ]);
  assert.ok(ass.includes("[Script Info]"));
  assert.ok(ass.includes("PlayResX: 1080"));
  assert.ok(ass.includes("PlayResY: 1920"));
  assert.ok(ass.includes("Dialogue:"));
  assert.ok(ass.includes("第一段字幕"));
});

test("cuesToAss uses custom resolution", () => {
  const ass = cuesToAss([{ start: 0, end: 3, text: "test" }], {
    playResX: 1920,
    playResY: 1080,
    fontSize: 32,
  });
  assert.ok(ass.includes("PlayResX: 1920"));
  assert.ok(ass.includes(",32,"));
});

console.log("\n✅ All ASS tests passed.");
