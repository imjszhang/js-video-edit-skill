import { existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { ensureDir, runCommand, crossPath, log } from "./utils.js";
import type { Transcript, Segment, Word } from "./types.js";

interface TranscribeOptions {
  model?: string;
  language?: string;
}

/**
 * Detect whether openai-whisper (Python) or whisper.cpp CLI is available.
 * Returns 'openai-whisper', 'whisper-cpp', or null.
 */
export function detectWhisper(): "openai-whisper" | "whisper-cpp" | null {
  // Try whisper (openai-whisper Python package)
  try {
    execSync("whisper --help", { stdio: "ignore" });
    return "openai-whisper";
  } catch {
    // Try whisper.cpp
    try {
      execSync("main --help", { stdio: "ignore" });
      return "whisper-cpp";
    } catch {
      return null;
    }
  }
}

/**
 * Transcribe an audio/video file using the detected Whisper CLI.
 * Returns the path to the generated JSON transcript.
 */
export async function transcribe(
  inputPath: string,
  outputDir: string,
  opts: TranscribeOptions = {}
): Promise<string> {
  const engine = detectWhisper();
  if (!engine) {
    throw new Error(
      "Neither openai-whisper nor whisper.cpp is available. Install one first:\n" +
        "  pip install openai-whisper  OR  build whisper.cpp"
    );
  }

  ensureDir(outputDir);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputBase = path.join(outputDir, baseName);

  if (engine === "openai-whisper") {
    const args = [
      crossPath(inputPath),
      "--model",
      opts.model ?? "base",
      "--output_format",
      "json",
      "--output_dir",
      crossPath(outputDir),
    ];
    if (opts.language) {
      args.push("--language", opts.language);
    }
    await runCommand("whisper", args);
    return `${outputBase}.json`;
  } else {
    // whisper.cpp
    const args = [
      "-m",
      `models/ggml-${opts.model ?? "base"}.bin`,
      "-f",
      crossPath(inputPath),
      "-ojf",
    ];
    if (opts.language) {
      args.push("-l", opts.language);
    }
    await runCommand("main", args);
    // whisper.cpp outputs to stdout; redirect to file
    return `${outputBase}.json`;
  }
}

/**
 * Parse a Whisper JSON transcript file into a Transcript object.
 */
export function parseTranscript(jsonPath: string): Transcript {
  const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

  // openai-whisper format
  if (raw.segments && Array.isArray(raw.segments)) {
    const segments: Segment[] = raw.segments.map((seg: any, idx: number) => ({
      id: idx,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
      words: (seg.words ?? []).map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      })),
    }));
    return {
      file: jsonPath,
      segments,
    };
  }

  // whisper.cpp JSON format
  if (raw.transcribe) {
    const segments: Segment[] = raw.transcribe.map((seg: any, idx: number) => ({
      id: idx,
      start: seg.t_start ?? seg.offsets.from / 100,
      end: seg.t_end ?? seg.offsets.to / 100,
      text: seg.text.trim(),
      words: [],
    }));
    return {
      file: jsonPath,
      segments,
    };
  }

  throw new Error(`Unrecognized transcript format: ${jsonPath}`);
}
