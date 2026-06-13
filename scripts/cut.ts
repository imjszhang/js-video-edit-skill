#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { validateDecision } from "../src/decision.js";
import { cutSegment, concatClips } from "../src/ffmpeg.js";
import { ensureDir, log, crossPath } from "../src/utils.js";
import type { EditingDecision } from "../src/types.js";

const program = new Command();

program
  .name("vep cut")
  .description("Execute ffmpeg cuts based on an editing decision JSON file")
  .argument("<decisionFile>", "Path to editing decision JSON file")
  .argument("[outputDir]", "Output directory for cut clips", "./cuts")
  .option("-f, --fast", "Use stream copy (fast but less accurate)")
  .option("--source-dir <dir>", "Directory containing source video files", "./raw")
  .action(async (decisionFile: string, outputDir: string, opts: any) => {
    const raw = readFileSync(decisionFile, "utf-8");
    const decision: EditingDecision = validateDecision(raw);

    ensureDir(outputDir);

    const cutListPath = path.join(outputDir, "concat_list.txt");
    const cutFiles: string[] = [];

    for (const scene of decision.scenes) {
      log.scene(
        `Scene ${scene.scene_id}: ${scene.scene_name} [${scene.in_point.toFixed(1)}s → ${scene.out_point.toFixed(1)}s]`
      );

      const srcFile = path.join(opts.sourceDir, scene.selected);
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

    // Generate concat list
    if (cutFiles.length > 0) {
      const concatLines = cutFiles.map((f) => `file '${crossPath(f)}'`).join("\n");
      writeFileSync(cutListPath, concatLines);
      log.scene(`Concat list written: ${cutListPath}`);

      const assembledPath = path.join(outputDir, "assembled.mp4");
      await concatClips(cutListPath, assembledPath);
      log.scene(`Assembled output: ${assembledPath}`);
    }

    log.scene(`Cut ${cutFiles.length} scene(s)`);
  });

program.parse();
