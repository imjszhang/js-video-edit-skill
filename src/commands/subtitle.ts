import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { parseTranscript } from "../whisper.js";
import { segmentsToSrt } from "../srt.js";
import { burnSubtitles } from "../ffmpeg.js";
import { log } from "../utils.js";

export interface SubtitleOptions {
  fontSize?: number;
  fontName?: string;
  primaryColor?: string;
  srtOnly?: boolean;
}

export async function runSubtitle(
  input: string,
  transcriptJson: string,
  output?: string,
  opts: SubtitleOptions = {}
): Promise<void> {
  const transcript = parseTranscript(transcriptJson);
  log.text(`Loaded ${transcript.segments.length} subtitle segments`);

  const srtContent = segmentsToSrt(transcript.segments);
  const parsed = path.parse(input);
  const srtPath = path.join(parsed.dir, `${parsed.name}.srt`);
  writeFileSync(srtPath, srtContent);
  log.text(`SRT written: ${srtPath}`);

  if (opts.srtOnly) {
    log.text("SRT-only mode. Done.");
    return;
  }

  const outputPath = output ?? path.join(parsed.dir, `${parsed.name}_subtitled.mp4`);

  log.screen("Burning subtitles into video...");
  await burnSubtitles(input, srtPath, outputPath, {
    fontSize: opts.fontSize ?? 24,
    fontName: opts.fontName ?? "Arial",
    primaryColor: opts.primaryColor ?? "&H00FFFFFF",
  });
  log.screen(`Subtitled output: ${outputPath}`);
}
