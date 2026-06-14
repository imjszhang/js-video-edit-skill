import { readdirSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { log } from "../utils.js";
import { probeAudioDuration } from "../ffmpeg.js";

export interface RecoverOptions {
  dryRun?: boolean;
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

  const audioFiles = readdirSync(audioDir)
    .filter((f) => /^seg\d+\.mp3$/i.test(f))
    .sort();

  if (audioFiles.length === 0) {
    log.error("No seg*.mp3 files found in audio/");
    process.exit(1);
  }

  const pngFiles = existsSync(scenesDir)
    ? readdirSync(scenesDir).filter((f) => /^scene\d+\.png$/i.test(f)).sort()
    : [];

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

  for (let i = 0; i < audioFiles.length; i++) {
    const id = i + 1;
    const audioFile = audioFiles[i]!;
    const audioPath = path.join(audioDir, audioFile);
    const trimmedRel = `trimmed/${audioFile}`;
    const trimmedPath = path.join(projectDir, trimmedRel);

    let duration: number;
    if (existsSync(trimmedPath)) {
      duration = await probeAudioDuration(trimmedPath);
    } else {
      duration = await probeAudioDuration(audioPath);
    }

    const pngMatch = pngFiles.find((f) => f === `scene${String(id).padStart(2, "0")}.png`);
    const visualRel = pngMatch
      ? `scenes/${pngMatch}`
      : `scenes/scene${String(id).padStart(2, "0")}.png`;

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
