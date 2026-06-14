import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import path from "path";
import { runCommandOutput } from "./utils.js";

const LONG_TEXT_THRESHOLD = 2000;

export async function isEdgeTtsAvailable(): Promise<boolean> {
  try {
    await runCommandOutput("edge-tts", ["--help"]);
    return true;
  } catch {
    return false;
  }
}

export interface EdgeTtsOptions {
  voice: string;
  text: string;
  output: string;
  verbose?: boolean;
  tmpDir?: string;
  segmentId?: number;
}

export async function synthesizeEdgeTts(opts: EdgeTtsOptions): Promise<void> {
  const { spawn } = await import("child_process");
  const { ensureDir } = await import("./utils.js");

  ensureDir(path.dirname(opts.output));

  const useFile = opts.text.length > LONG_TEXT_THRESHOLD;
  let tmpFile: string | undefined;

  if (useFile) {
    const dir = opts.tmpDir ?? path.join(path.dirname(opts.output), "..", ".vep-tmp");
    mkdirSync(dir, { recursive: true });
    const slug = opts.segmentId !== undefined ? `seg${String(opts.segmentId).padStart(2, "0")}` : "tts";
    tmpFile = path.join(dir, `${slug}.txt`);
    writeFileSync(tmpFile, opts.text, "utf-8");
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const args = ["--voice", opts.voice];

      if (useFile && tmpFile) {
        args.push("--file", tmpFile);
      } else {
        args.push("--text", opts.text);
      }

      args.push("--write-media", opts.output);

      if (opts.verbose) {
        console.log(`edge-tts ${args.join(" ")}`);
      }

      const child = spawn("edge-tts", args, { stdio: "inherit" });
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`edge-tts exited with code ${code}`));
      });
      child.on("error", reject);
    });
  } finally {
    if (tmpFile) {
      try {
        unlinkSync(tmpFile);
      } catch {
        /* ignore cleanup errors */
      }
    }
  }
}
