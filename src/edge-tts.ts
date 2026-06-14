import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import path from "path";
import { runCommandOutput } from "./utils.js";

const LONG_TEXT_THRESHOLD = 1500;

type EdgeTtsInvoker = {
  cmd: string;
  prefixArgs: string[];
};

function resolveEdgeTtsInvoker(): EdgeTtsInvoker {
  const override = process.env.VEP_EDGE_TTS_CMD;
  if (override) {
    const parts = override.split(/\s+/).filter(Boolean);
    return { cmd: parts[0]!, prefixArgs: parts.slice(1) };
  }
  return { cmd: "edge-tts", prefixArgs: [] };
}

let cachedInvoker: EdgeTtsInvoker | null = null;

async function getEdgeTtsInvoker(): Promise<EdgeTtsInvoker> {
  if (cachedInvoker) return cachedInvoker;

  const primary = resolveEdgeTtsInvoker();
  try {
    await runCommandOutput(primary.cmd, [...primary.prefixArgs, "--help"]);
    cachedInvoker = primary;
    return primary;
  } catch {
    /* try python module */
  }

  for (const py of ["python", "python3", "py"]) {
    try {
      await runCommandOutput(py, ["-m", "edge_tts", "--help"]);
      cachedInvoker = { cmd: py, prefixArgs: ["-m", "edge_tts"] };
      return cachedInvoker;
    } catch {
      /* next */
    }
  }

  throw new Error(
    "edge-tts not found. Install: pip install edge-tts (or set VEP_EDGE_TTS_CMD)"
  );
}

export async function isEdgeTtsAvailable(): Promise<boolean> {
  try {
    await getEdgeTtsInvoker();
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

  const useFile = opts.text.length >= LONG_TEXT_THRESHOLD;
  let tmpFile: string | undefined;

  if (useFile) {
    const dir = opts.tmpDir ?? path.join(path.dirname(opts.output), "..", ".vep-tmp");
    mkdirSync(dir, { recursive: true });
    const slug = opts.segmentId !== undefined ? `seg${String(opts.segmentId).padStart(2, "0")}` : "tts";
    tmpFile = path.join(dir, `${slug}.txt`);
    writeFileSync(tmpFile, opts.text, "utf-8");
  }

  try {
    const invoker = await getEdgeTtsInvoker();
    await new Promise<void>((resolve, reject) => {
      const args = [...invoker.prefixArgs, "--voice", opts.voice];

      if (useFile && tmpFile) {
        args.push("--file", tmpFile);
      } else {
        args.push("--text", opts.text);
      }

      args.push("--write-media", opts.output);

      if (opts.verbose) {
        console.log(`${invoker.cmd} ${args.join(" ")}`);
      }

      const child = spawn(invoker.cmd, args, { stdio: "inherit" });
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
