import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { validateDecision } from "../decision.js";
import { cutSegment, concatClips } from "../ffmpeg.js";
import { ensureDir, log, crossPath } from "../utils.js";
import type { EditingDecision } from "../types.js";

export interface CutOptions {
  fast?: boolean;
  sourceDir?: string;
}

export async function runCut(
  decisionFile: string,
  outputDir: string,
  opts: CutOptions = {}
): Promise<void> {
  const raw = readFileSync(decisionFile, "utf-8");
  const decision: EditingDecision = validateDecision(raw);
  const sourceDir = opts.sourceDir ?? "./raw";

  ensureDir(outputDir);

  const cutListPath = path.join(outputDir, "concat_list.txt");
  const cutFiles: string[] = [];

  for (const scene of decision.scenes) {
    log.scene(
      `Scene ${scene.scene_id}: ${scene.scene_name} [${scene.in_point.toFixed(1)}s → ${scene.out_point.toFixed(1)}s]`
    );

    const srcFile = path.join(sourceDir, scene.selected);
    if (!existsSync(srcFile)) {
      log.error(`Source file not found: ${srcFile}`);
      continue;
    }

    const outName = `scene_${scene.scene_id}_${scene.scene_name.replace(/\s+/g, "_").toLowerCase()}.mp4`;
    const outPath = path.join(outputDir, outName);

    try {
      await cutSegment(srcFile, scene.in_point, scene.out_point, outPath, {
        fast: opts.fast,
      });
      log.cut(`  → ${outName}`);
      cutFiles.push(outPath);
    } catch (err) {
      log.error(`  Failed: ${err}`);
    }
  }

  if (cutFiles.length > 0) {
    const concatLines = cutFiles.map((f) => `file '${crossPath(f)}'`).join("\n");
    writeFileSync(cutListPath, concatLines);
    log.scene(`Concat list written: ${cutListPath}`);

    const assembledPath = path.join(outputDir, "assembled.mp4");
    await concatClips(cutListPath, assembledPath);
    log.scene(`Assembled output: ${assembledPath}`);
  }

  log.scene(`Cut ${cutFiles.length} scene(s)`);
}
