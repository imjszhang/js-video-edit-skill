#!/usr/bin/env node
import { Command } from "commander";
import { transcribe } from "../src/whisper.js";
import { findVideos, ensureDir, log, crossPath } from "../src/utils.js";
import path from "path";

const program = new Command();

program
  .name("vep transcribe")
  .description("Transcribe all videos in a directory using Whisper")
  .argument("<inputDir>", "Directory containing video files")
  .argument("[outputDir]", "Output directory for transcripts", "./transcripts")
  .option("-m, --model <model>", "Whisper model size", "base")
  .option("-l, --language <lang>", "Language code", undefined)
  .action(async (inputDir: string, outputDir: string, opts: any) => {
    const videos = findVideos(inputDir);
    if (videos.length === 0) {
      log.error(`No video files found in ${inputDir}`);
      process.exit(1);
    }

    log.scene(`Found ${videos.length} video(s) to transcribe`);
    ensureDir(outputDir);

    for (const video of videos) {
      log.text(`Transcribing: ${path.basename(video)}`);
      try {
        const result = await transcribe(video, outputDir, {
          model: opts.model,
          language: opts.language,
        });
        log.text(`  → ${result}`);
      } catch (err) {
        log.error(`Failed to transcribe ${video}: ${err}`);
      }
    }

    log.scene("Transcription complete");
  });

program.parse();
