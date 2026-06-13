#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { parseTranscript } from "../src/whisper.js";
import { segmentsToSrt } from "../src/srt.js";
import { burnSubtitles } from "../src/ffmpeg.js";
import { ensureDir, log } from "../src/utils.js";

const program = new Command();

program
  .name("vep subtitle")
  .description("Generate and burn subtitles from a transcript JSON")
  .argument("<input>", "Input video file")
  .argument("<transcriptJson>", "Path to transcript JSON file")
  .argument("[output]", "Output file path")
  .option("--font-size <n>", "Subtitle font size", "24")
  .option("--font-name <name>", "Subtitle font name", "Arial")
  .option("--color <color>", "Subtitle primary color (ASS hex)", "&H00FFFFFF")
  .option(
    "--srt-only",
    "Only generate .srt file without burning into video",
    false
  )
  .action(async (input: string, transcriptJson: string, outputOrOpts: string | undefined | Record<string, unknown>, opts?: Record<string, unknown>) => {
    // Commander passes positional args first, then options object as last arg
    const output: string | undefined = typeof outputOrOpts === "string" ? outputOrOpts : undefined;
    const optsObj: Record<string, unknown> = typeof outputOrOpts === "object" ? outputOrOpts : (opts ?? {});

    const transcript = parseTranscript(transcriptJson);
    log.text(`Loaded ${transcript.segments.length} subtitle segments`);

    // Generate SRT
    const srtContent = segmentsToSrt(transcript.segments);
    const parsed = path.parse(input);
    const srtPath = path.join(
      parsed.dir,
      `${parsed.name}.srt`
    );
    writeFileSync(srtPath, srtContent);
    log.text(`SRT written: ${srtPath}`);

    if (optsObj?.srtOnly) {
      log.text("SRT-only mode. Done.");
      return;
    }

    // Burn subtitles
    const outputPath = output ?? path.join(parsed.dir, `${parsed.name}_subtitled.mp4`);

    log.screen("Burning subtitles into video...");
    try {
      await burnSubtitles(input, srtPath, outputPath, {
        fontSize: parseInt(optsObj?.fontSize as string ?? "24"),
        fontName: optsObj?.fontName as string ?? "Arial",
        primaryColor: optsObj?.color as string ?? "&H00FFFFFF",
      });
      log.screen(`Subtitled output: ${outputPath}`);
    } catch (err) {
      log.error(`Failed: ${err}`);
      process.exit(1);
    }
  });

program.parse();
