import assert from "node:assert";
import path from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  isOpenClawEnvironment,
  resolveJsEyesClient,
  isJsEyesClientPresent,
  isJsEyesAvailable,
  isJsEyesServerReachable,
  isPlaywrightAvailable,
  captureSceneJsEyesBot,
} from "../src/article/screenshot-backends.js";
import { VepConfigSchema } from "../src/article/types.js";

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

test("isOpenClawEnvironment detects OPENCLAW_STATE_DIR", () => {
  const prev = process.env.OPENCLAW_STATE_DIR;
  process.env.OPENCLAW_STATE_DIR = "/tmp/openclaw-test";
  try {
    assert.strictEqual(isOpenClawEnvironment(), true);
  } finally {
    if (prev === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = prev;
  }
});

test("isJsEyesClientPresent finds bundled client", () => {
  const config = VepConfigSchema.parse({});
  assert.strictEqual(isJsEyesClientPresent(config), true);
  assert.strictEqual(isJsEyesAvailable(config), true);
  const client = resolveJsEyesClient(config);
  assert.ok(client?.endsWith(path.join("lib", "js-eyes-client.js")));
});

test("resolveJsEyesClient skips missing override and uses bundled", () => {
  const config = VepConfigSchema.parse({
    jsEyesClientPath: "/nonexistent/js-eyes-client.js",
  });
  assert.strictEqual(isJsEyesClientPresent(config), true);
  assert.ok(resolveJsEyesClient(config)?.includes("js-eyes-client.js"));
});

test("isJsEyesServerReachable returns false when server down", async () => {
  const config = VepConfigSchema.parse({ jsEyesWs: "ws://127.0.0.1:1" });
  assert.strictEqual(await isJsEyesServerReachable(config), false);
});

test("captureSceneJsEyesBot returns false when openUrl throws", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "vep-eyes-"));
  const pngPath = path.join(dir, "scene01.png");
  const bot = {
    openUrl: async () => {
      throw new Error("open failed");
    },
    captureScreenshot: async () => ({ dataUrl: "data:image/png;base64,AA==" }),
    closeTab: async () => {},
  };
  const ok = await captureSceneJsEyesBot(bot, "http://localhost/scene01.html", pngPath, 0, 1);
  assert.strictEqual(ok, false);
});

test("captureSceneJsEyesBot returns false when screenshot skipped", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "vep-eyes-"));
  const pngPath = path.join(dir, "scene01.png");
  const bot = {
    openUrl: async () => "tab-1",
    captureScreenshot: async () => ({ dataUrl: null, skipped: "tab_not_active" }),
    closeTab: async () => {},
  };
  const ok = await captureSceneJsEyesBot(bot, "http://localhost/scene01.html", pngPath, 0, 1);
  assert.strictEqual(ok, false);
});

test("captureSceneJsEyesBot writes png on success", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "vep-eyes-"));
  const pngPath = path.join(dir, "scene01.png");
  const bot = {
    openUrl: async () => "tab-1",
    captureScreenshot: async () => ({
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    }),
    closeTab: async () => {},
  };
  const ok = await captureSceneJsEyesBot(bot, "http://localhost/scene01.html", pngPath, 0, 1);
  assert.strictEqual(ok, true);
  const { readFileSync } = await import("node:fs");
  assert.ok(readFileSync(pngPath).length > 0);
});

test("isPlaywrightAvailable checks chromium executable", async () => {
  const available = await isPlaywrightAvailable();
  assert.strictEqual(typeof available, "boolean");
});

test("VepConfig defaults screenshotBackend to auto", () => {
  const config = VepConfigSchema.parse({});
  assert.strictEqual(config.screenshotBackend, "auto");
  assert.strictEqual(config.openclawBrowserProfile, "openclaw");
});

console.log("\n✅ All screenshot-backends tests passed.");
