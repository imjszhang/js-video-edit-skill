import { readdirSync } from "fs";
import path from "path";
import { log } from "../utils.js";
import { loadVepConfig } from "./config.js";
import { VepConfigSchema } from "./types.js";
import { sortBySegmentId, parseSegmentId, scenePngName } from "./segment-files.js";
import {
  resolveScreenshotBackend,
  startSceneStaticServer,
  captureScenes,
} from "./screenshot-backends.js";

export interface ScreenshotOptions {
  port?: number;
  tabDelay?: number;
  retries?: number;
  verbose?: boolean;
  dryRun?: boolean;
  skipValidate?: boolean;
  backend?: string;
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

export async function runArticleScreenshot(
  projectDir: string,
  opts: ScreenshotOptions = {}
): Promise<void> {
  const config = loadVepConfig(projectDir);
  if (opts.backend) {
    const parsed = VepConfigSchema.shape.screenshotBackend.safeParse(opts.backend);
    if (!parsed.success) {
      log.error(
        `Invalid --backend: ${opts.backend}. Must be one of: auto, openclaw, playwright, js-eyes`
      );
      process.exit(1);
    }
    config.screenshotBackend = parsed.data;
  }

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
    const backend = config.screenshotBackend === "auto" ? "auto-detect" : config.screenshotBackend;
    log.scene(
      `[dry-run] would screenshot ${htmlFiles.length} scene(s) via backend: ${backend}`
    );
    return;
  }

  const backend = await resolveScreenshotBackend(config);
  log.text(`Screenshot backend: ${backend}`);

  const server = await startSceneStaticServer(scenesDir, port);
  log.text(`Static server on http://localhost:${port}`);

  try {
    const { succeeded, failed } = await captureScenes(backend, {
      scenesDir,
      htmlFiles,
      port,
      tabDelay,
      retries,
      width: config.width,
      height: config.height,
      config,
    });

    if (!opts.skipValidate) {
      for (const file of htmlFiles) {
        if (failed.includes(file)) continue;
        const segId = parseSegmentId(file, "scene");
        const pngName = segId !== null ? scenePngName(segId) : file.replace(".html", ".png");
        const pngPath = path.join(scenesDir, pngName);
        const v = await validateCentering(pngPath);
        log.text(
          `  ${pngName} h_offset=${v.hOffset >= 0 ? "+" : ""}${v.hOffset.toFixed(0)}px, usage=${v.usageW.toFixed(0)}%W x ${v.usageH.toFixed(0)}%H`
        );
      }
    }

    if (failed.length > 0) {
      log.error(
        `Screenshot failed for ${failed.length}/${htmlFiles.length} scene(s): ${failed.join(", ")}`
      );
      process.exit(1);
    }

    log.scene(`Screenshots complete — ${succeeded}/${htmlFiles.length} scene(s) [${backend}]`);
  } finally {
    server.close();
  }
}
