import { existsSync, copyFileSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { createRequire } from "module";
import { createServer } from "http";
import { runCommandOutput, log } from "../utils.js";
import { BUNDLED_JS_EYES_CLIENT } from "../skill-root.js";
import type { VepConfig } from "./types.js";
import { parseSegmentId, scenePngName } from "./segment-files.js";

const require = createRequire(import.meta.url);

const SILENT_LOGGER = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

export type ScreenshotBackendKind = "openclaw" | "playwright" | "js-eyes";
export type ScreenshotBackendPreference = ScreenshotBackendKind | "auto";

export interface JsEyesCaptureResult {
  dataUrl: string | null;
  skipped?: string | null;
}

export interface JsEyesBot {
  openUrl: (url: string) => Promise<string>;
  captureScreenshot: (tabId: string, opts: object) => Promise<JsEyesCaptureResult>;
  closeTab: (tabId: string) => Promise<void>;
}

export interface SceneCaptureContext {
  scenesDir: string;
  htmlFiles: string[];
  port: number;
  tabDelay: number;
  retries: number;
  width: number;
  height: number;
  config: VepConfig;
}

export interface SceneCaptureResult {
  succeeded: number;
  failed: string[];
}

export function isOpenClawEnvironment(): boolean {
  if (
    process.env.OPENCLAW_STATE_DIR ||
    process.env.OPENCLAW_HOME ||
    process.env.OPENCLAW_SHELL ||
    process.env.OPENCLAW_CONFIG_PATH
  ) {
    return true;
  }

  const home = process.env.HOME ?? process.env.USERPROFILE;
  if (home && existsSync(path.join(home, ".openclaw"))) {
    return true;
  }

  return false;
}

export function resolveOpenClawCli(config: VepConfig): string {
  return (
    config.openclawCli ??
    process.env.OPENCLAW_CLI ??
    process.env.VEP_OPENCLAW_CLI ??
    "openclaw"
  );
}

export function resolveJsEyesClient(config: VepConfig): string | null {
  const candidates = [
    config.jsEyesClientPath,
    process.env.JS_EYES_CLIENT_PATH,
    BUNDLED_JS_EYES_CLIENT,
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

export function isJsEyesClientPresent(config: VepConfig): boolean {
  return resolveJsEyesClient(config) !== null;
}

/** @deprecated Use isJsEyesClientPresent */
export function isJsEyesAvailable(config: VepConfig): boolean {
  return isJsEyesClientPresent(config);
}

export async function isJsEyesServerReachable(config: VepConfig): Promise<boolean> {
  const clientPath = resolveJsEyesClient(config);
  if (!clientPath) return false;

  const wsUrl = process.env.JS_EYES_WS ?? config.jsEyesWs;
  const { BrowserAutomation } = require(clientPath) as {
    BrowserAutomation: new (
      url: string,
      opts?: { logger?: { info: () => void; warn: () => void; error: () => void } }
    ) => {
      connect: () => Promise<void>;
      disconnect: () => void;
    };
  };
  const bot = new BrowserAutomation(wsUrl, { logger: SILENT_LOGGER });

  try {
    await bot.connect();
    return true;
  } catch {
    return false;
  } finally {
    bot.disconnect();
  }
}

export async function isOpenClawCliAvailable(config: VepConfig): Promise<boolean> {
  const cli = resolveOpenClawCli(config);
  try {
    await runCommandOutput(cli, ["browser", "status", "--json"]);
    return true;
  } catch {
    try {
      await runCommandOutput(cli, ["browser", "doctor", "--json"]);
      return true;
    } catch {
      return false;
    }
  }
}

export async function isPlaywrightAvailable(): Promise<boolean> {
  try {
    const { chromium } = await import("playwright");
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

export async function resolveScreenshotBackend(
  config: VepConfig
): Promise<ScreenshotBackendKind> {
  const pref = config.screenshotBackend ?? "auto";

  if (pref !== "auto") {
    await assertBackendAvailable(pref, config);
    return pref;
  }

  if (isJsEyesClientPresent(config)) {
    if (await isJsEyesServerReachable(config)) {
      return "js-eyes";
    }
    log.text(
      "Warning: js-eyes client found but server unreachable, trying next backend..."
    );
  }

  if (isOpenClawEnvironment() && (await isOpenClawCliAvailable(config))) {
    return "openclaw";
  }

  if (await isPlaywrightAvailable()) {
    return "playwright";
  }

  throw new Error(
    "No screenshot backend available. Options:\n" +
      "  1. JS-Eyes: Firefox 扩展 + ws://localhost:18080（内置 lib/js-eyes-client.js）\n" +
      "  2. OpenClaw: Gateway + `openclaw browser start --headless`\n" +
      "  3. Playwright: npm install playwright && npx playwright install chromium\n" +
      "Or set screenshotBackend in vep.config.json"
  );
}

async function assertBackendAvailable(
  kind: ScreenshotBackendKind,
  config: VepConfig
): Promise<void> {
  if (kind === "openclaw" && !(await isOpenClawCliAvailable(config))) {
    throw new Error(
      `screenshotBackend=openclaw but \`${resolveOpenClawCli(config)} browser\` is unavailable`
    );
  }
  if (kind === "playwright" && !(await isPlaywrightAvailable())) {
    throw new Error(
      "screenshotBackend=playwright but playwright chromium is not installed (npm install playwright && npx playwright install chromium)"
    );
  }
  if (kind === "js-eyes" && !isJsEyesClientPresent(config)) {
    throw new Error(
      "screenshotBackend=js-eyes but JS-Eyes client not found (set jsEyesClientPath)"
    );
  }
}

function resolveSceneFile(scenesDir: string, urlPath: string): string | null {
  const normalized = urlPath.replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return null;
  const filePath = path.resolve(scenesDir, normalized);
  const scenesRoot = path.resolve(scenesDir);
  if (filePath !== scenesRoot && !filePath.startsWith(scenesRoot + path.sep)) {
    return null;
  }
  return filePath;
}

function sceneStaticContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html;charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".woff2") return "font/woff2";
  if (ext === ".woff") return "font/woff";
  return "application/octet-stream";
}

export function startSceneStaticServer(
  scenesDir: string,
  port: number
): Promise<{ close: () => void }> {
  const server = createServer((req, res) => {
    const urlPath = (req.url ?? "/").split("?")[0] ?? "/";
    const filePath = resolveSceneFile(scenesDir, urlPath);
    if (filePath && existsSync(filePath)) {
      res.writeHead(200, {
        "Content-Type": sceneStaticContentType(filePath),
      });
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end("404");
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({
        close: () => server.close(),
      });
    });
  });
}

async function runOpenClawJson<T>(
  config: VepConfig,
  args: string[]
): Promise<T> {
  const cli = resolveOpenClawCli(config);
  const out = await runCommandOutput(cli, ["browser", ...args, "--json"]);
  return JSON.parse(out.trim()) as T;
}

async function runOpenClaw(config: VepConfig, args: string[]): Promise<string> {
  const cli = resolveOpenClawCli(config);
  return runCommandOutput(cli, ["browser", ...args]);
}

function parseMediaPath(output: string): string | null {
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("MEDIA:")) {
      return trimmed.slice("MEDIA:".length).trim();
    }
  }
  return null;
}

async function ensureOpenClawBrowser(config: VepConfig): Promise<void> {
  const profile = config.openclawBrowserProfile;
  const profileArgs = ["--browser-profile", profile];

  try {
    await runOpenClaw(config, ["start", "--headless", ...profileArgs]);
  } catch {
    /* may already be running */
  }

  try {
    await runOpenClaw(config, [
      "resize",
      String(config.width),
      String(config.height),
      ...profileArgs,
    ]);
  } catch (err) {
    log.text(`Warning: openclaw browser resize failed: ${err}`);
  }
}

async function captureSceneOpenClaw(
  config: VepConfig,
  url: string,
  pngPath: string,
  tabDelay: number,
  retries: number
): Promise<boolean> {
  const profileArgs = ["--browser-profile", config.openclawBrowserProfile];

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) log.text(`Retry ${attempt + 1} (openclaw) for ${url}`);

    try {
      const opened = await runOpenClawJson<{ targetId?: string; tabId?: string }>(config, [
        "open",
        url,
        ...profileArgs,
      ]);
      const targetId = opened.targetId ?? opened.tabId;
      await new Promise((r) => setTimeout(r, tabDelay));

      let shotPath: string | null = null;
      try {
        const shotArgs = [
          "screenshot",
          ...(targetId ? [targetId] : []),
          "--full-page",
          ...profileArgs,
        ];
        const shot = await runOpenClawJson<{ path?: string }>(config, shotArgs);
        shotPath = shot.path ?? null;
      } catch {
        const shotArgs = [
          "screenshot",
          ...(targetId ? [targetId] : []),
          "--full-page",
          ...profileArgs,
        ];
        const stdout = await runOpenClaw(config, shotArgs);
        shotPath = parseMediaPath(stdout);
      }

      if (!shotPath || !existsSync(shotPath)) {
        throw new Error(`openclaw screenshot returned no file for ${url}`);
      }

      copyFileSync(shotPath, pngPath);

      if (targetId) {
        try {
          await runOpenClaw(config, ["close", targetId, ...profileArgs]);
        } catch {
          /* best-effort */
        }
      }

      return true;
    } catch (err) {
      log.text(`openclaw capture attempt failed: ${err}`);
    }
  }

  return false;
}

async function captureScenePlaywright(
  url: string,
  pngPath: string,
  width: number,
  height: number,
  tabDelay: number,
  retries: number
): Promise<boolean> {
  const { chromium } = await import("playwright");

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) log.text(`Retry ${attempt + 1} (playwright) for ${url}`);

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width, height },
      });
      await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
      await page.waitForTimeout(tabDelay);
      await page.screenshot({ path: pngPath, fullPage: true });
      return true;
    } catch (err) {
      log.text(`playwright capture attempt failed: ${err}`);
    } finally {
      await browser.close();
    }
  }

  return false;
}

export async function captureSceneJsEyesBot(
  bot: JsEyesBot,
  url: string,
  pngPath: string,
  tabDelay: number,
  retries: number
): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt++) {
    let tabId: string | undefined;

    try {
      if (attempt > 0) log.text(`Retry ${attempt + 1} (js-eyes) for ${url}`);

      tabId = await bot.openUrl(url);
      await new Promise((r) => setTimeout(r, tabDelay));

      const result = await bot.captureScreenshot(tabId, {
        fullPage: true,
        format: "png",
        timeout: 120,
      });

      if (result.skipped || !result.dataUrl) {
        throw new Error(`screenshot skipped: ${result.skipped ?? "no dataUrl"}`);
      }

      const buf = Buffer.from(result.dataUrl.split(",")[1]!, "base64");
      writeFileSync(pngPath, buf);
      return true;
    } catch (err) {
      log.text(`js-eyes capture attempt failed: ${err}`);
    } finally {
      if (tabId !== undefined) {
        try {
          await bot.closeTab(tabId);
        } catch {
          /* best-effort */
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  return false;
}

export async function captureScenes(
  backend: ScreenshotBackendKind,
  ctx: SceneCaptureContext
): Promise<SceneCaptureResult> {
  if (backend === "openclaw") {
    await ensureOpenClawBrowser(ctx.config);
  }

  const failed: string[] = [];
  let succeeded = 0;
  const baseUrl = `http://localhost:${ctx.port}`;

  if (backend === "js-eyes") {
    const clientPath = resolveJsEyesClient(ctx.config);
    if (!clientPath) {
      throw new Error("js-eyes client not found");
    }
    const wsUrl = process.env.JS_EYES_WS ?? ctx.config.jsEyesWs;
    const { BrowserAutomation } = require(clientPath);
    const bot = new BrowserAutomation(wsUrl);
    await bot.connect();
    try {
      for (const file of ctx.htmlFiles) {
        const segId = parseSegmentId(file, "scene");
        const pngName = segId !== null ? scenePngName(segId) : file.replace(".html", ".png");
        const pngPath = path.join(ctx.scenesDir, pngName);
        const url = `${baseUrl}/${file}`;
        const ok = await captureSceneJsEyesBot(
          bot,
          url,
          pngPath,
          ctx.tabDelay,
          ctx.retries
        );
        if (ok) {
          log.text(`Screenshot ${pngName} (js-eyes)`);
          succeeded++;
        } else {
          failed.push(file);
        }
      }
    } finally {
      bot.disconnect();
    }
    return { succeeded, failed };
  }

  for (const file of ctx.htmlFiles) {
    const segId = parseSegmentId(file, "scene");
    const pngName = segId !== null ? scenePngName(segId) : file.replace(".html", ".png");
    const pngPath = path.join(ctx.scenesDir, pngName);
    const url = `${baseUrl}/${file}`;

    let ok = false;
    if (backend === "openclaw") {
      ok = await captureSceneOpenClaw(
        ctx.config,
        url,
        pngPath,
        ctx.tabDelay,
        ctx.retries
      );
    } else if (backend === "playwright") {
      ok = await captureScenePlaywright(
        url,
        pngPath,
        ctx.width,
        ctx.height,
        ctx.tabDelay,
        ctx.retries
      );
    }

    if (ok) {
      log.text(`Screenshot ${pngName} (${backend})`);
      succeeded++;
    } else {
      failed.push(file);
    }
  }

  return { succeeded, failed };
}
