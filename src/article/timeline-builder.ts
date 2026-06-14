import { writeFileSync, existsSync, statSync } from "fs";
import path from "path";
import { cuesToAss } from "../ass.js";
import {
  silenceRemove,
  probeAudioDuration,
} from "../ffmpeg.js";
import { ensureDir, log } from "../utils.js";
import { loadStoryboard } from "./storyboard.js";
import { loadVepConfig, warnConfigStoryboardMismatch } from "./config.js";
import type { Timeline, ShotList } from "./types.js";

export interface TimelineBuildOptions {
  verbose?: boolean;
  dryRun?: boolean;
  storyboardFile?: string;
  skipTrim?: boolean;
}

function segAudioPath(audioDir: string, id: number): string {
  return path.join(audioDir, `seg${String(id).padStart(2, "0")}.mp3`);
}

function segTrimmedPath(trimmedDir: string, id: number): string {
  return path.join(trimmedDir, `seg${String(id).padStart(2, "0")}.mp3`);
}

function relPath(projectDir: string, absPath: string): string {
  return path.relative(projectDir, absPath).replace(/\\/g, "/");
}

function warnSubsOverwrite(projectDir: string): void {
  const subsPath = path.join(projectDir, "subs.ass");
  const timelinePath = path.join(projectDir, "timeline.json");
  if (!existsSync(subsPath) || !existsSync(timelinePath)) return;

  const subsMtime = statSync(subsPath).mtimeMs;
  const timelineMtime = statSync(timelinePath).mtimeMs;
  if (subsMtime > timelineMtime) {
    log.text(
      "Warning: subs.ass is newer than timeline.json — re-running timeline will overwrite manual subtitle edits"
    );
  }
}

function segVisualPath(scenesDir: string, id: number): string {
  return path.join(scenesDir, `scene${String(id).padStart(2, "0")}.png`);
}

export function getMissingTimelineAssets(
  projectDir: string,
  segmentIds: number[],
  dryRun: boolean
): { missingAudio: number[]; missingVisual: number[] } {
  if (dryRun) return { missingAudio: [], missingVisual: [] };

  const audioDir = path.join(projectDir, "audio");
  const scenesDir = path.join(projectDir, "scenes");
  const missingAudio: number[] = [];
  const missingVisual: number[] = [];

  for (const id of segmentIds) {
    if (!existsSync(segAudioPath(audioDir, id))) missingAudio.push(id);
    if (!existsSync(segVisualPath(scenesDir, id))) missingVisual.push(id);
  }

  return { missingAudio, missingVisual };
}

export async function runArticleTimeline(
  projectDir: string,
  opts: TimelineBuildOptions = {}
): Promise<Timeline> {
  const storyboard = loadStoryboard(projectDir, opts.storyboardFile);
  const config = loadVepConfig(projectDir);
  warnConfigStoryboardMismatch(projectDir, storyboard, config);

  const audioDir = path.join(projectDir, "audio");
  const trimmedDir = path.join(projectDir, "trimmed");
  const scenesDir = path.join(projectDir, "scenes");
  ensureDir(trimmedDir);

  if (!opts.dryRun) {
    warnSubsOverwrite(projectDir);
  }

  let offset = 0;
  const segments: Timeline["segments"] = [];

  for (const seg of storyboard.segments) {
    const rawPath = segAudioPath(audioDir, seg.id);
    const trimmedPath = segTrimmedPath(trimmedDir, seg.id);
    const visualPath = segVisualPath(scenesDir, seg.id);

    if (!opts.dryRun && !existsSync(rawPath)) {
      log.error(`Missing audio: ${rawPath}. Run 'vep article tts' first.`);
      process.exit(1);
    }

    if (!opts.dryRun && !existsSync(visualPath)) {
      log.error(
        `Missing visual: ${visualPath}. Run 'vep article screenshot' first.`
      );
      process.exit(1);
    }

    if (opts.dryRun) {
      log.text(`[dry-run] trim ${rawPath} → ${trimmedPath}`);
      const fakeDur = 5;
      segments.push({
        id: seg.id,
        start: offset,
        end: offset + fakeDur,
        duration: fakeDur,
        narration: seg.narration,
        audio_raw: relPath(projectDir, rawPath),
        audio_trimmed: relPath(projectDir, trimmedPath),
        visual: relPath(projectDir, visualPath),
      });
      offset += fakeDur;
      continue;
    }

    if (!opts.skipTrim) {
      await silenceRemove(rawPath, trimmedPath, {
        stopThreshold: config.silenceThreshold,
        stopDuration: config.silenceDuration,
        stopSilence: config.silencePadding,
      });
    } else if (!existsSync(trimmedPath)) {
      const { copyFileSync } = await import("fs");
      copyFileSync(rawPath, trimmedPath);
    }

    let duration = await probeAudioDuration(trimmedPath);
    if (duration < 0.1) {
      const rawDuration = await probeAudioDuration(rawPath);
      log.text(
        `Warning: segment ${seg.id} trimmed audio too short (${duration.toFixed(3)}s) — using raw duration ${rawDuration.toFixed(3)}s`
      );
      duration = rawDuration;
    }

    const start = offset;
    const end = offset + duration;

    segments.push({
      id: seg.id,
      start,
      end,
      duration,
      narration: seg.narration,
      audio_raw: relPath(projectDir, rawPath),
      audio_trimmed: relPath(projectDir, trimmedPath),
      visual: relPath(projectDir, visualPath),
    });

    log.text(
      `Segment ${seg.id}: ${duration.toFixed(2)}s [${start.toFixed(2)} → ${end.toFixed(2)}]`
    );
    offset = end;
  }

  const timeline: Timeline = {
    version: 1,
    total_duration: offset,
    generated_at: new Date().toISOString(),
    segments,
  };

  if (!opts.dryRun) {
    const timelinePath = path.join(projectDir, "timeline.json");
    writeFileSync(timelinePath, JSON.stringify(timeline, null, 2) + "\n", "utf-8");
    log.text(`Wrote ${timelinePath}`);

    const assContent = cuesToAss(
      segments.map((s) => ({
        start: s.start,
        end: s.end,
        text: s.narration,
      })),
      {
        playResX: config.width,
        playResY: config.height,
        fontSize: config.subtitleFontSize,
        marginV: config.subtitleMarginV,
      }
    );
    const assPath = path.join(projectDir, "subs.ass");
    writeFileSync(assPath, assContent, "utf-8");
    log.text(`Wrote ${assPath}`);

    const shotList: ShotList = {
      version: 1,
      title: storyboard.title,
      generated_at: new Date().toISOString(),
      total_segments: storyboard.segments.length,
      entries: storyboard.segments.map((seg) => ({
        id: seg.id,
        visual_type: seg.visual_type,
        narration_preview: seg.narration.slice(0, 80),
        reason: seg.reason,
        candidates: seg.candidates,
        selected: seg.selected ?? seg.visual_type,
      })),
    };
    const shotListPath = path.join(projectDir, "shot-list.json");
    writeFileSync(shotListPath, JSON.stringify(shotList, null, 2) + "\n", "utf-8");
    log.text(`Wrote ${shotListPath}`);
  }

  log.scene(`Timeline built — total ${offset.toFixed(2)}s, ${segments.length} segment(s)`);
  return timeline;
}
