import { writeFileSync, existsSync, copyFileSync } from "fs";
import path from "path";
import {
  imageToVideo,
  concatClips,
  concatAudio,
  muxVideoAudio,
  burnAss,
  generateSilence,
} from "../ffmpeg.js";
import { ensureDir, log, crossPath } from "../utils.js";
import { loadTimeline } from "./timeline.js";
import { loadVepConfig } from "./config.js";

export interface AssembleOptions {
  verbose?: boolean;
  dryRun?: boolean;
}

export async function runArticleAssemble(
  projectDir: string,
  opts: AssembleOptions = {}
): Promise<string> {
  const timeline = loadTimeline(projectDir);
  const config = loadVepConfig(projectDir);
  const trimmedDir = path.join(projectDir, "trimmed");
  ensureDir(trimmedDir);

  const clipFiles: string[] = [];
  const audioFiles: string[] = [];

  for (const seg of timeline.segments) {
    const visualPath = path.join(projectDir, seg.visual);
    const audioPath = path.join(projectDir, seg.audio_trimmed);
    const clipPath = path.join(trimmedDir, `clip${String(seg.id).padStart(2, "0")}.mp4`);

    if (!existsSync(visualPath)) {
      log.error(`Missing visual: ${visualPath}. Run 'vep article screenshot' first.`);
      process.exit(1);
    }

    if (opts.dryRun) {
      log.text(`[dry-run] clip ${seg.id}: ${seg.duration.toFixed(2)}s`);
      clipFiles.push(clipPath);
      audioFiles.push(audioPath);
      continue;
    }

    await imageToVideo(visualPath, seg.duration, clipPath, {
      width: config.width,
      height: config.height,
      fps: config.fps,
    });
    log.text(`Clip ${seg.id}: ${seg.duration.toFixed(2)}s → ${clipPath}`);
    clipFiles.push(clipPath);

    if (existsSync(audioPath)) {
      audioFiles.push(audioPath);
    } else {
      const silencePath = path.join(trimmedDir, `silence${String(seg.id).padStart(2, "0")}.m4a`);
      await generateSilence(seg.duration, silencePath);
      audioFiles.push(silencePath);
      log.text(`  Missing audio, generated silence for segment ${seg.id}`);
    }
  }

  if (opts.dryRun) {
    log.scene("[dry-run] assemble complete (no files written)");
    return path.join(trimmedDir, "final.mp4");
  }

  const videoListPath = path.join(trimmedDir, "video_concat.txt");
  writeFileSync(
    videoListPath,
    clipFiles.map((f) => `file '${crossPath(f)}'`).join("\n")
  );
  const videoOnlyPath = path.join(trimmedDir, "video_only.mp4");
  await concatClips(videoListPath, videoOnlyPath);
  log.text(`Video track: ${videoOnlyPath}`);

  const audioListPath = path.join(trimmedDir, "audio_concat.txt");
  writeFileSync(
    audioListPath,
    audioFiles.map((f) => `file '${crossPath(f)}'`).join("\n")
  );
  const audioFullPath = path.join(trimmedDir, "audio_full.m4a");
  await concatAudio(audioListPath, audioFullPath);
  log.text(`Audio track: ${audioFullPath}`);

  const muxedPath = path.join(trimmedDir, "muxed.mp4");
  await muxVideoAudio(videoOnlyPath, audioFullPath, muxedPath);
  log.text(`Muxed: ${muxedPath}`);

  const assSrc = path.join(projectDir, "subs.ass");
  const assDest = path.join(trimmedDir, "subs.ass");
  if (existsSync(assSrc)) {
    copyFileSync(assSrc, assDest);
  }

  const finalPath = path.join(trimmedDir, "final.mp4");
  if (existsSync(assDest)) {
    await burnAss(muxedPath, "subs.ass", finalPath);
    log.text(`Burned subtitles → ${finalPath}`);
  } else {
    copyFileSync(muxedPath, finalPath);
    log.text(`No subs.ass, copied muxed → ${finalPath}`);
  }

  log.scene(`Final video: ${finalPath} (${timeline.total_duration.toFixed(1)}s)`);
  return finalPath;
}
