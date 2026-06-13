#!/usr/bin/env node
import { Command } from "commander";
import { applyLut } from "../src/ffmpeg.js";
import { ensureDir, log } from "../src/utils.js";
import path from "path";

const program = new Command();

program
  .name("vep grade")
  .description("Apply LUT color grading to a video file")
  .argument("<input>", "Input video file")
  .argument("<lutFile>", "Path to .cube LUT file")
  .argument("[output]", "Output file path")
  .action(async (input: string, lutFile: string, output?: string) => {
    if (!output) {
      const parsed = path.parse(input);
      output = path.join(parsed.dir, `${parsed.name}_graded.mp4`);
    }

    log.color(`Applying LUT: ${path.basename(lutFile)}`);
    log.color(`  Input:  ${path.basename(input)}`);
    log.color(`  Output: ${path.basename(output)}`);

    try {
      await applyLut(input, lutFile, output);
      log.color("Color grading complete");
    } catch (err) {
      log.error(`Failed: ${err}`);
      process.exit(1);
    }
  });

program.parse();
