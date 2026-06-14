import assert from "node:assert";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  resolveSkillRoot,
  BUNDLED_JS_EYES_CLIENT,
  BUNDLED_JS_LOGO,
  BUNDLED_TEMPLATES,
} from "../src/skill-root.js";

function test(name: string, fn: () => void | Promise<void>) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`✅ ${name}`))
    .catch((err) => {
      console.error(`❌ ${name}`);
      console.error(err);
      process.exit(1);
    });
}

test("resolveSkillRoot from src/article path", () => {
  const srcArticleUrl = new URL("../src/article/init.ts", import.meta.url).href;
  const root = resolveSkillRoot(srcArticleUrl);
  assert.ok(root.endsWith("js-video-edit-skill") || root.includes("js-video-edit-skill"));
  assert.ok(BUNDLED_JS_EYES_CLIENT.includes(path.join("lib", "js-eyes-client.js")));
  assert.ok(BUNDLED_TEMPLATES.includes(path.join("templates", "article")));
  assert.ok(BUNDLED_JS_LOGO.includes(path.join("lib", "js-logo.svg")));
  assert.ok(existsSync(BUNDLED_JS_LOGO));
});

test("resolveSkillRoot from dist/src/article path", () => {
  const distFile = fileURLToPath(
    new URL("../dist/src/article/screenshot-backends.js", import.meta.url)
  );
  if (!existsSync(distFile)) {
    console.log("✅ resolveSkillRoot from dist (skipped — dist not built)");
    return;
  }
  const distArticleUrl = new URL(
    "../dist/src/article/screenshot-backends.js",
    import.meta.url
  ).href;
  const root = resolveSkillRoot(distArticleUrl);
  const client = path.join(root, "lib", "js-eyes-client.js");
  assert.ok(existsSync(client), `bundled client missing at ${client}`);
});

test("resolveSkillRoot from src/skill-root.ts", () => {
  const root = resolveSkillRoot(import.meta.url);
  assert.strictEqual(
    path.join(root, "package.json"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json")
  );
});

console.log("\n✅ All skill-root tests passed.");
