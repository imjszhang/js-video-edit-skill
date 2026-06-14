import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import { transcribe, detectWhisper, parseTranscript } from "../whisper.js";
import { validateDecision } from "../decision.js";
import { cutSegment, concatClips, applyLut, burnSubtitles, encode } from "../ffmpeg.js";
import { segmentsToSrt } from "../srt.js";
import { findVideos, ensureDir, log, crossPath } from "../utils.js";

export interface FootagePipelineOptions {
  model?: string;
  language?: string;
  decision?: string;
  fastCuts?: boolean;
  lut?: string;
  subtitles?: boolean;
  finalEncode?: boolean;
  crf?: number;
}

function findJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f));
}

export async function runFootagePipeline(
  inputDir: string,
  outputDir: string,
  opts: FootagePipelineOptions = {}
): Promise<void> {
  log.scene("=== Video Edit Pipeline ===");

  const engine = detectWhisper();
  if (!engine) {
    log.error("Whisper not found. Install openai-whisper or whisper.cpp first.");
    process.exit(1);
  }
  log.zap(`Using Whisper engine: ${engine}`);

  ensureDir(outputDir);

  const transcriptsDir = path.join(outputDir, "transcripts");
  const cutsDir = path.join(outputDir, "cuts");

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

  log.scene("Step 2: Analysis & Decision");
  const decisionFile = opts.decision;
  if (!decisionFile || !existsSync(decisionFile)) {
    log.text("No decision file provided. Run 'vep analyze' and pipe to LLM, then save as decision.json");
    log.scene("Provide --decision for automation");
    return;
  }

  const decisionJson = readFileSync(decisionFile, "utf-8");
  const decision = validateDecision(decisionJson);

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

  log.scene("Step 4: Assembly");
  const concatListPath = path.join(cutsDir, "concat_list.txt");
  writeFileSync(concatListPath, concatLines.join("\n"));
  const assembledPath = path.join(outputDir, "assembled.mp4");
  await concatClips(concatListPath, assembledPath);

  let currentFile = assembledPath;

  if (opts.lut && existsSync(opts.lut)) {
    log.scene("Step 5: Color grading");
    const gradedPath = path.join(outputDir, "graded.mp4");
    await applyLut(assembledPath, opts.lut, gradedPath);
    currentFile = gradedPath;
  }

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

  if (opts.finalEncode) {
    log.scene("Step 7: Final encode");
    const finalPath = path.join(outputDir, "final.mp4");
    await encode(currentFile, finalPath, {
      crf: opts.crf ?? 18,
    });
    currentFile = finalPath;
  }

  log.scene(`=== Pipeline complete → ${currentFile} ===`);
}
