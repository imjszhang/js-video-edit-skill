#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { parseTranscript } from "../src/whisper.js";
import { log } from "../src/utils.js";

const program = new Command();

program
  .name("vep analyze")
  .description(
    "Read all transcript JSONs and output suggested editing decisions as JSON"
  )
  .argument("<transcriptsDir>", "Directory containing transcript JSONs")
  .action((transcriptsDir: string) => {
    const files = readdirSync(transcriptsDir).filter((f) =>
      f.endsWith(".json")
    );
    if (files.length === 0) {
      log.error(`No transcript JSONs found in ${transcriptsDir}`);
      process.exit(1);
    }

    log.scene(`Analyzing ${files.length} transcript(s)`);

    const allSegments: { file: string; segments: any[] }[] = [];
    for (const file of files) {
      const fp = path.join(transcriptsDir, file);
      try {
        const t = parseTranscript(fp);
        allSegments.push({ file, segments: t.segments });
      } catch (err) {
        log.error(`Skipping ${file}: ${err}`);
      }
    }

    // Output summary for LLM review
    const summary = {
      total_files: files.length,
      total_segments: allSegments.reduce((n, s) => n + s.segments.length, 0),
      files: allSegments.map((f) => ({
        file: f.file,
        segment_count: f.segments.length,
        duration_hint:
          f.segments.length > 0
            ? f.segments[f.segments.length - 1].end
            : 0,
        sample_text: f.segments.slice(0, 3).map((s) => s.text),
      })),
    };

    console.log(JSON.stringify(summary, null, 2));
    log.scene("Analysis output printed to stdout (pipe to LLM for decisions)");
  });

program.parse();
