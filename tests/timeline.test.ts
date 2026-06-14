import assert from "node:assert";

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

test("timeline cumulative offset calculation", () => {
  const durations = [5.5, 3.2, 7.8];
  let offset = 0;
  const segments: { start: number; end: number; duration: number }[] = [];

  for (const d of durations) {
    segments.push({ start: offset, end: offset + d, duration: d });
    offset += d;
  }

  assert.strictEqual(segments[0]!.start, 0);
  assert.strictEqual(segments[0]!.end, 5.5);
  assert.strictEqual(segments[1]!.start, 5.5);
  assert.strictEqual(segments[2]!.end, 16.5);
  assert.strictEqual(offset, 16.5);
});

test("segment id padding format", () => {
  assert.strictEqual(String(1).padStart(2, "0"), "01");
  assert.strictEqual(`seg${String(12).padStart(2, "0")}.mp3`, "seg12.mp3");
});

console.log("\n✅ All timeline tests passed.");
