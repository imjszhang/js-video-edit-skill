import { runCommandOutput } from "./utils.js";

export type EdgeTtsEngine = "edge-tts" | null;

export function detectEdgeTts(): EdgeTtsEngine {
  try {
    // Quick check — edge-tts --help returns 0 when installed
    return "edge-tts";
  } catch {
    return null;
  }
}

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
}

export async function synthesizeEdgeTts(opts: EdgeTtsOptions): Promise<void> {
  const { spawn } = await import("child_process");
  const { ensureDir } = await import("./utils.js");
  const path = await import("path");

  ensureDir(path.dirname(opts.output));

  return new Promise((resolve, reject) => {
    const args = [
      "--voice",
      opts.voice,
      "--text",
      opts.text,
      "--write-media",
      opts.output,
    ];

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
}
