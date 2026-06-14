import { createServer } from "http";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { createRequire } from "module";
import { log } from "../utils.js";
import { loadVepConfig } from "./config.js";
import { sortBySegmentId, parseSegmentId, scenePngName } from "./segment-files.js";

const require = createRequire(import.meta.url);

export interface ScreenshotOptions {
  port?: number;
  tabDelay?: number;
  retries?: number;
  verbose?: boolean;
  dryRun?: boolean;
  skipValidate?: boolean;
}

async function validateCentering(
  pngPath: string,
  maxOffset = 20
): Promise<{ hOffset: number; vOffset: number; usageW: number; usageH: number }> {
  try {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(pngPath)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const colMean = new Float32Array(w);
    const rowMean = new Float32Array(h);

    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = 0; x < w; x++) sum += data[y * w + x]!;
      rowMean[y] = sum / w;
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = 0; y < h; y++) sum += data[y * w + x]!;
      colMean[x] = sum / h;
    }

    const threshold = 20;
    let l = 0;
    for (let i = 0; i < w; i++) {
      if (colMean[i]! > threshold) {
        l = i;
        break;
      }
    }
    let r = w - 1;
    for (let i = 0; i < w; i++) {
      if (colMean[w - 1 - i]! > threshold) {
        r = w - 1 - i;
        break;
      }
    }
    let t = 0;
    for (let i = 0; i < h; i++) {
      if (rowMean[i]! > threshold) {
        t = i;
        break;
      }
    }
    let b = h - 1;
    for (let i = 0; i < h; i++) {
      if (rowMean[h - 1 - i]! > threshold) {
        b = h - 1 - i;
        break;
      }
    }

    const hOffset = (l + r) / 2 - w / 2;
    const vOffset = (t + b) / 2 - h / 2;
    const usageW = ((r - l) / w) * 100;
    const usageH = ((b - t) / h) * 100;

    if (Math.abs(hOffset) > maxOffset) {
      log.text(
        `Warning: ${path.basename(pngPath)} h_offset=${hOffset.toFixed(0)}px (max ±${maxOffset})`
      );
    }

    return { hOffset, vOffset, usageW, usageH };
  } catch {
    log.text(`Skipping centering validation for ${path.basename(pngPath)} (sharp not available)`);
    return { hOffset: 0, vOffset: 0, usageW: 0, usageH: 0 };
  }
}

function resolveJsEyesClient(configPath?: string): string {
  if (configPath && existsSync(configPath)) {
    return configPath;
  }

  const candidates = [
    process.env.JS_EYES_CLIENT_PATH,
    "D:/.openclaw/workspace/skills/js-browser-ops-skill/lib/js-eyes-client.js",
    path.join(process.cwd(), "node_modules", "js-eyes-client", "index.js"),
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }

  throw new Error(
    "JS-Eyes client not found. Set jsEyesClientPath in vep.config.json or JS_EYES_CLIENT_PATH env var."
  );
}

function resolveSceneFile(scenesDir: string, fileName: string): string | null {
  const safeName = path.basename(fileName);
  const filePath = path.resolve(scenesDir, safeName);
  if (!filePath.startsWith(path.resolve(scenesDir) + path.sep)) {
    return null;
  }
  return filePath;
}

export async function runArticleScreenshot(
  projectDir: string,
  opts: ScreenshotOptions = {}
): Promise<void> {
  const config = loadVepConfig(projectDir);
  const scenesDir = path.join(projectDir, "scenes");
  const port = opts.port ?? config.screenshotPort;
  const tabDelay = opts.tabDelay ?? config.screenshotTabDelay;
  const retries = opts.retries ?? 1;

  const htmlFiles = sortBySegmentId(
    readdirSync(scenesDir).filter((f) => f.endsWith(".html")),
    "scene"
  );

  if (htmlFiles.length === 0) {
    log.error(`No HTML scenes in ${scenesDir}. Run 'vep article render' first.`);
    process.exit(1);
  }

  if (opts.dryRun) {
    log.scene(`[dry-run] would screenshot ${htmlFiles.length} scene(s)`);
    return;
  }

  const server = createServer((req, res) => {
    const rawName = (req.url ?? "/").split("?")[0]!.split("/").pop() ?? "";
    const filePath = resolveSceneFile(scenesDir, rawName);
    const ext = path.extname(rawName);
    if (filePath && existsSync(filePath)) {
      res.writeHead(200, {
        "Content-Type": ext === ".html" ? "text/html;charset=utf-8" : "image/png",
      });
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end("404");
    }
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  log.text(`Static server on http://localhost:${port}`);

  const clientPath = resolveJsEyesClient(config.jsEyesClientPath);
  const wsUrl = process.env.JS_EYES_WS ?? config.jsEyesWs;
  const { BrowserAutomation } = require(clientPath);
  const bot = new BrowserAutomation(wsUrl);

  const failed: string[] = [];
  let succeeded = 0;

  try {
    await bot.connect();

    for (const file of htmlFiles) {
      const segId = parseSegmentId(file, "scene");
      const url = `http://localhost:${port}/${file}`;
      let success = false;

      for (let attempt = 0; attempt < retries && !success; attempt++) {
        if (attempt > 0) log.text(`Retry ${attempt + 1} for ${file}`);

        const tabId = await bot.openUrl(url);
        await new Promise((r) => setTimeout(r, tabDelay));

        try {
          const result = await bot.captureScreenshot(tabId, {
            fullPage: true,
            format: "png",
            timeout: 120,
          });

          const buf = Buffer.from(result.dataUrl.split(",")[1]!, "base64");
          const pngName = segId !== null ? scenePngName(segId) : file.replace(".html", ".png");
          const pngPath = path.join(scenesDir, pngName);
          writeFileSync(pngPath, buf);
          log.text(`Screenshot ${pngName}`);

          if (!opts.skipValidate) {
            const v = await validateCentering(pngPath);
            log.text(
              `  h_offset=${v.hOffset >= 0 ? "+" : ""}${v.hOffset.toFixed(0)}px, usage=${v.usageW.toFixed(0)}%W x ${v.usageH.toFixed(0)}%H`
            );
          }

          success = true;
          succeeded++;
        } finally {
          await bot.closeTab(tabId);
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      if (!success) {
        log.error(`Failed to screenshot ${file} after ${retries} attempt(s)`);
        failed.push(file);
      }
    }
  } finally {
    bot.disconnect();
    server.close();
  }

  if (failed.length > 0) {
    log.error(
      `Screenshot failed for ${failed.length}/${htmlFiles.length} scene(s): ${failed.join(", ")}`
    );
    process.exit(1);
  }

  log.scene(`Screenshots complete — ${succeeded}/${htmlFiles.length} scene(s)`);
}
