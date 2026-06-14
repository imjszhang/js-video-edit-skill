import { readdirSync } from "fs";
import path from "path";
import { parseTranscript } from "../whisper.js";
import { log } from "../utils.js";

export function runAnalyze(transcriptsDir: string): void {
  const files = readdirSync(transcriptsDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    log.error(`No transcript JSONs found in ${transcriptsDir}`);
    process.exit(1);
  }

  log.scene(`Analyzing ${files.length} transcript(s)`);

  const allSegments: { file: string; segments: { end: number; text: string }[] }[] = [];
  for (const file of files) {
    const fp = path.join(transcriptsDir, file);
    try {
      const t = parseTranscript(fp);
      allSegments.push({ file, segments: t.segments });
    } catch (err) {
      log.error(`Skipping ${file}: ${err}`);
    }
  }

  const summary = {
    total_files: files.length,
    total_segments: allSegments.reduce((n, s) => n + s.segments.length, 0),
    files: allSegments.map((f) => ({
      file: f.file,
      segment_count: f.segments.length,
      duration_hint:
        f.segments.length > 0 ? f.segments[f.segments.length - 1].end : 0,
      sample_text: f.segments.slice(0, 3).map((s) => s.text),
    })),
  };

  console.log(JSON.stringify(summary, null, 2));
  log.scene("Analysis output printed to stdout (pipe to LLM for decisions)");
}
