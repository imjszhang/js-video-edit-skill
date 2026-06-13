#!/usr/bin/env node
import { Command } from "commander";
import { encode } from "../src/ffmpeg.js";
import { log } from "../src/utils.js";
import path from "path";

const program = new Command();

program
  .name("vep render")
  .description("Final encode with quality control options")
  .argument("<input>", "Input video file")
  .argument("[output]", "Output file path")
  .option("--codec <codec>", "Video codec", "libx264")
  .option("--preset <preset>", "Encoding preset", "medium")
  .option("--crf <n>", "Quality (lower = better)", "18")
  .option("--resolution <res>", "Output resolution (W:H)", "1920:1080")
  .option("--fps <n>", "Frame rate", "30")
  .action(async (input: string, output?: string, opts?: any) => {
    if (!output) {
      const parsed = path.parse(input);
      output = path.join(parsed.dir, `${parsed.name}_final.mp4`);
    }

    log.zap("Final encode:");
    log.zap(`  Codec:      ${opts.codec}`);
    log.zap(`  Preset:     ${opts.preset}`);
    log.zap(`  CRF:        ${opts.crf}`);
    log.zap(`  Resolution: ${opts.resolution}`);
    log.zap(`  FPS:        ${opts.fps}`);

    try {
      await encode(input, output, {
        codec: opts.codec,
        preset: opts.preset,
        crf: parseInt(opts.crf),
        resolution: opts.resolution,
        fps: parseInt(opts.fps),
      });
      log.zap(`Final output: ${output}`);
    } catch (err) {
      log.error(`Failed: ${err}`);
      process.exit(1);
    }
  });

program.parse();
