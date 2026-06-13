#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import { transcribe, detectWhisper, parseTranscript } from "../src/whisper.js";
import { validateDecision } from "../src/decision.js";
import { cutSegment, concatClips, applyLut, burnSubtitles, encode } from "../src/ffmpeg.js";
import { segmentsToSrt } from "../src/srt.js";
import { findVideos, ensureDir, log, crossPath } from "../src/utils.js";

const program = new Command();

program
  .name("vep pipeline")
  .description("Run the full video editing pipeline end-to-end")
  .argument("<inputDir>", "Directory containing raw video files")
  .argument("[outputDir]", "Base output directory", "./output")
  .option("-m, --model <model>", "Whisper model", "base")
  .option("-l, --language <lang>", "Language code", undefined)
  .option("--decision <file>", "Skip analysis, use existing decision JSON")
  .option("--fast-cuts", "Use stream copy for cutting")
  .option("--lut <file>", "Apply LUT color grading")
  .option("--subtitles", "Burn subtitles from transcript")
  .option("--final-encode", "Run final encode step")
  .option("--crf <n>", "CRF for final encode", "18")
  .action(async (inputDir: string, outputDir: string, opts: any) => {
    log.scene("=== Video Edit Pipeline ===");

    // Check dependencies
    const engine = detectWhisper();
    if (!engine) {
      log.error("Whisper not found. Install openai-whisper or whisper.cpp first.");
      process.exit(1);
    }
    log.zap(`Using Whisper engine: ${engine}`);

    ensureDir(outputDir);

    const transcriptsDir = path.join(outputDir, "transcripts");
    const cutsDir = path.join(outputDir, "cuts");

    // Step 1: Transcribe
    log.scene("Step 1: Transcription");
    ensureDir(transcriptsDir);
    const videos = findVideos(inputDir);
    if (videos.length === 0) {
      log.error(`No video files found in ${inputDir}`);
      process.exit(1);
    }

    for (const video of videos) {
      log.text(`Transcribing: ${path.basename(video)}`);
      await transcribe(video, transcriptsDir, {
        model: opts.model,
        language: opts.language,
      });
    }

    // Step 2: Decision
    log.scene("Step 2: Analysis & Decision");
    const decisionFile = opts.decision;
    if (!decisionFile || !existsSync(decisionFile)) {
      log.text("No decision file provided. Run 'vep analyze' and pipe to LLM, then save as decision.json");
      log.scene("Provide --decision for automation");
      return;
    }

    const decisionJson = readFileSync(decisionFile, "utf-8");
    const decision = validateDecision(decisionJson);

    // Step 3: Cut scenes
    log.scene("Step 3: Cutting scenes");
    ensureDir(cutsDir);
    const cutFiles: string[] = [];
    const concatLines: string[] = [];

    for (const scene of decision.scenes) {
      const srcFile = path.join(inputDir, scene.selected);
      if (!existsSync(srcFile)) {
        log.error(`Source not found: ${scene.selected}`);
        continue;
      }

      const outName = `scene_${scene.scene_id}.mp4`;
      const outPath = path.join(cutsDir, outName);

      await cutSegment(srcFile, scene.in_point, scene.out_point, outPath, {
        fast: opts.fastCuts,
      });
      log.cut(`  → ${outName}`);
      cutFiles.push(outPath);
      concatLines.push(`file '${crossPath(outPath)}'`);
    }

    // Step 4: Assemble
    log.scene("Step 4: Assembly");
    const concatListPath = path.join(cutsDir, "concat_list.txt");
    writeFileSync(concatListPath, concatLines.join("\n"));
    const assembledPath = path.join(outputDir, "assembled.mp4");
    await concatClips(concatListPath, assembledPath);

    let currentFile = assembledPath;

    // Step 5: Color grade
    if (opts.lut && existsSync(opts.lut)) {
      log.scene("Step 5: Color grading");
      const gradedPath = path.join(outputDir, "graded.mp4");
      await applyLut(assembledPath, opts.lut, gradedPath);
      currentFile = gradedPath;
    }

    // Step 6: Subtitles
    if (opts.subtitles) {
      log.scene("Step 6: Subtitles");
      const transcriptFiles = findJsonFiles(transcriptsDir);
      if (transcriptFiles.length > 0) {
        const transcript = parseTranscript(transcriptFiles[0]);
        const srtContent = segmentsToSrt(transcript.segments);
        const srtPath = path.join(outputDir, "subtitles.srt");
        writeFileSync(srtPath, srtContent);

        const subtitledPath = path.join(outputDir, "subtitled.mp4");
        await burnSubtitles(currentFile, srtPath, subtitledPath);
        currentFile = subtitledPath;
      }
    }

    // Step 7: Final encode
    if (opts.finalEncode) {
      log.scene("Step 7: Final encode");
      const finalPath = path.join(outputDir, "final.mp4");
      await encode(currentFile, finalPath, {
        crf: parseInt(opts.crf),
      });
      currentFile = finalPath;
    }

    log.scene(`=== Pipeline complete → ${currentFile} ===`);
  });

function findJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f));
}

program.parse();
