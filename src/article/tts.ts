import path from "path";
import { ensureDir, log } from "../utils.js";
import { isEdgeTtsAvailable, synthesizeEdgeTts } from "../edge-tts.js";
import { loadStoryboard } from "./storyboard.js";
import { loadVepConfig } from "./config.js";

export interface TtsOptions {
  voice?: string;
  fromId?: number;
  toId?: number;
  verbose?: boolean;
  dryRun?: boolean;
  storyboardFile?: string;
}

export async function runArticleTts(
  projectDir: string,
  opts: TtsOptions = {}
): Promise<void> {
  if (!opts.dryRun) {
    const available = await isEdgeTtsAvailable();
    if (!available) {
      log.error("edge-tts not found. Install with: pip install edge-tts");
      process.exit(1);
    }
  }

  const storyboard = loadStoryboard(projectDir, opts.storyboardFile);
  const config = loadVepConfig(projectDir);
  const voice = opts.voice ?? config.voice;
  const audioDir = path.join(projectDir, "audio");
  ensureDir(audioDir);

  const segments = storyboard.segments.filter((seg) => {
    if (opts.fromId !== undefined && seg.id < opts.fromId) return false;
    if (opts.toId !== undefined && seg.id > opts.toId) return false;
    return true;
  });

  for (const seg of segments) {
    const outPath = path.join(audioDir, `seg${String(seg.id).padStart(2, "0")}.mp3`);
    log.text(`TTS segment ${seg.id}: ${seg.narration.slice(0, 40)}...`);

    if (opts.dryRun) {
      log.text(`  [dry-run] would write ${outPath}`);
      continue;
    }

    await synthesizeEdgeTts({
      voice,
      text: seg.narration,
      output: outPath,
      verbose: opts.verbose,
    });
    log.text(`  → ${outPath}`);
  }

  log.scene(`TTS complete — ${segments.length} segment(s)`);
}
