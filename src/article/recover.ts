import { readdirSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { log } from "../utils.js";
import { probeAudioDuration } from "../ffmpeg.js";
import {
  parseSegmentId,
  sortBySegmentId,
  scenePngName,
} from "./segment-files.js";

export interface RecoverOptions {
  dryRun?: boolean;
}

function warnSegmentMismatch(
  audioIds: number[],
  pngIds: Set<number>,
  scenesDir: string
): void {
  const audioCount = audioIds.length;
  const pngCount = pngIds.size;

  if (audioCount !== pngCount) {
    log.text(
      `Warning: ${audioCount} audio segment(s) but ${pngCount} PNG scene(s) — assemble may fail for missing visuals`
    );
  }

  const missingVisuals = audioIds.filter((id) => !pngIds.has(id));
  if (missingVisuals.length > 0) {
    const preview = missingVisuals.slice(0, 5).join(", ");
    const suffix =
      missingVisuals.length > 5 ? ` … (+${missingVisuals.length - 5} more)` : "";
    log.text(
      `Warning: missing PNG for segment id(s): ${preview}${suffix}`
    );
    log.text(
      "Action: run vep article screenshot, reduce storyboard segments, or map multiple audio to one visual"
    );
  }

  if (audioCount > 0 && pngCount === 0 && existsSync(scenesDir)) {
    log.text("Warning: no scene*.png found — run vep article screenshot before assemble");
  }

  log.text(
    "Note: recovered narration is placeholder — edit storyboard.json before timeline/assemble"
  );
}

export async function runArticleRecover(
  projectDir: string,
  opts: RecoverOptions = {}
): Promise<void> {
  const audioDir = path.join(projectDir, "audio");
  const scenesDir = path.join(projectDir, "scenes");

  if (!existsSync(audioDir)) {
    log.error(`audio/ not found in ${projectDir}`);
    process.exit(1);
  }

  const audioFiles = sortBySegmentId(
    readdirSync(audioDir).filter((f) => /^seg\d+\.mp3$/i.test(f)),
    "seg"
  );

  if (audioFiles.length === 0) {
    log.error("No seg*.mp3 files found in audio/");
    process.exit(1);
  }

  const pngFiles = existsSync(scenesDir)
    ? sortBySegmentId(
        readdirSync(scenesDir).filter((f) => /^scene\d+\.png$/i.test(f)),
        "scene"
      )
    : [];

  const pngIds = new Set(
    pngFiles
      .map((f) => parseSegmentId(f, "scene"))
      .filter((id): id is number => id !== null)
  );

  const audioIds: number[] = [];

  let offset = 0;
  const segments: {
    id: number;
    start: number;
    end: number;
    duration: number;
    narration: string;
    audio_raw: string;
    audio_trimmed: string;
    visual: string;
  }[] = [];

  const storyboardSegments: {
    id: number;
    visual_type: string;
    narration: string;
    text: string;
    reason: string;
    selected: string;
  }[] = [];

  for (const audioFile of audioFiles) {
    const id = parseSegmentId(audioFile, "seg");
    if (id === null) continue;

    audioIds.push(id);
    const audioPath = path.join(audioDir, audioFile);
    const trimmedRel = `trimmed/${audioFile}`;
    const trimmedPath = path.join(projectDir, trimmedRel);

    let duration: number;
    if (!opts.dryRun && existsSync(trimmedPath)) {
      duration = await probeAudioDuration(trimmedPath);
    } else if (!opts.dryRun) {
      duration = await probeAudioDuration(audioPath);
    } else {
      duration = 5;
    }

    const pngName = scenePngName(id);
    const pngMatch = pngFiles.find((f) => f === pngName);
    const visualRel = pngMatch ? `scenes/${pngMatch}` : `scenes/${pngName}`;

    const start = offset;
    const end = offset + duration;

    segments.push({
      id,
      start,
      end,
      duration,
      narration: `[recovered] segment ${id}`,
      audio_raw: `audio/${audioFile}`,
      audio_trimmed: existsSync(trimmedPath) ? trimmedRel : `audio/${audioFile}`,
      visual: visualRel,
    });

    storyboardSegments.push({
      id,
      visual_type: id === 1 ? "hero" : "text-card",
      narration: `[recovered] segment ${id} — edit narration manually`,
      text: `Segment ${id}`,
      reason: "Recovered from existing audio files",
      selected: id === 1 ? "hero" : "text-card",
    });

    offset = end;
  }

  warnSegmentMismatch(audioIds, pngIds, scenesDir);

  const timeline = {
    version: 1 as const,
    total_duration: offset,
    generated_at: new Date().toISOString(),
    _recovered: true,
    segments,
  };

  const storyboard = {
    version: 1,
    title: "Recovered Project",
    width: 1080,
    height: 1920,
    fps: 24,
    voice: "zh-CN-YunxiNeural",
    _recovered: true,
    segments: storyboardSegments,
  };

  if (opts.dryRun) {
    console.log(JSON.stringify({ timeline, storyboard }, null, 2));
    log.scene("[dry-run] recover preview printed");
    return;
  }

  writeFileSync(
    path.join(projectDir, "timeline.json"),
    JSON.stringify(timeline, null, 2) + "\n",
    "utf-8"
  );
  writeFileSync(
    path.join(projectDir, "storyboard.json"),
    JSON.stringify(storyboard, null, 2) + "\n",
    "utf-8"
  );

  log.scene(
    `Recovered ${audioFiles.length} segment(s), total ${offset.toFixed(1)}s — review storyboard.json narration before assemble`
  );
}
