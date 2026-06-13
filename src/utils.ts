import { spawn, SpawnOptions } from "child_process";
import { mkdirSync, existsSync, readdirSync, statSync } from "fs";
import path from "path";

/** Simple emoji-prefixed console logger (no external dependency) */
const logger = {
  info: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};

export { logger };

/** Emoji-prefixed logging helpers */
export const log = {
  scene: (msg: string) => logger.info(`🎬 ${msg}`),
  text: (msg: string) => logger.info(`📝 ${msg}`),
  cut: (msg: string) => logger.info(`✂️  ${msg}`),
  color: (msg: string) => logger.info(`🎨 ${msg}`),
  screen: (msg: string) => logger.info(`📺 ${msg}`),
  zap: (msg: string) => logger.info(`⚡ ${msg}`),
  error: (msg: string) => logger.error(`❌ ${msg}`),
};

/** Create directory if it doesn't exist */
export function ensureDir(dir: string): string {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** Scan directory for video files (.mp4, .mov, .mkv) */
export function findVideos(dir: string): string[] {
  const exts = new Set([".mp4", ".mov", ".mkv"]);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => exts.has(path.extname(f).toLowerCase()))
    .map((f) => path.join(dir, f));
}

/** Normalize path separators for cross-platform compatibility */
export function crossPath(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Run a shell command via spawn, returning a Promise */
export function runCommand(
  cmd: string,
  args: string[],
  opts?: SpawnOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      ...opts,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command "${cmd}" exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

/** Run a command and capture stdout */
export function runCommandOutput(
  cmd: string,
  args: string[],
  opts?: SpawnOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "inherit"],
      ...opts,
    });
    let out = "";
    child.stdout!.on("data", (d) => (out += d.toString()));
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`Command "${cmd}" exited with code ${code}`));
    });
    child.on("error", reject);
  });
}
