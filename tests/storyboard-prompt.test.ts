import assert from "node:assert";
import { parseArticle } from "../src/article/article-blocks.js";

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

test("parseArticle extracts heading and paragraph", () => {
  const blocks = parseArticle("# Title\n\nHello world.");
  assert.strictEqual(blocks.length, 2);
  assert.strictEqual(blocks[0]!.type, "heading");
  assert.strictEqual(blocks[1]!.type, "paragraph");
});

test("parseArticle flushes unclosed code block", () => {
  const blocks = parseArticle("```js\nconst x = 1;\n");
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0]!.type, "code");
  assert.ok(blocks[0]!.content.includes("const x"));
});

test("parseArticle detects code block with closing fence", () => {
  const blocks = parseArticle("```\nline1\nline2\n```");
  assert.strictEqual(blocks[0]!.type, "code");
  assert.strictEqual(blocks[0]!.content, "line1\nline2");
});

console.log("\n✅ All storyboard-prompt tests passed.");
