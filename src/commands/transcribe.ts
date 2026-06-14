import path from "path";
import { transcribe } from "../whisper.js";
import { findVideos, ensureDir, log } from "../utils.js";

export interface TranscribeOptions {
  model?: string;
  language?: string;
}

export async function runTranscribe(
  inputDir: string,
  outputDir: string,
  opts: TranscribeOptions = {}
): Promise<void> {
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
}
