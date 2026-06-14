import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import path from "path";
import { VepConfigSchema, type VepConfig, type Storyboard } from "./types.js";
import { loadStoryboard } from "./storyboard.js";
import { log } from "../utils.js";

const DEFAULT_CONFIG: VepConfig = VepConfigSchema.parse({});

export function loadVepConfig(projectDir: string): VepConfig {
  const configPath = path.join(projectDir, "vep.config.json");
  if (!existsSync(configPath)) {
    try {
      const sb = loadStoryboard(projectDir);
      return VepConfigSchema.parse({
        voice: sb.voice,
        fps: sb.fps,
        width: sb.width,
        height: sb.height,
      });
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));
  return VepConfigSchema.parse(raw);
}

export function warnConfigStoryboardMismatch(
  projectDir: string,
  storyboard: Storyboard,
  config: VepConfig
): void {
  const configPath = path.join(projectDir, "vep.config.json");
  if (!existsSync(configPath)) return;

  const mismatches: string[] = [];
  if (config.width !== storyboard.width) {
    mismatches.push(`width ${config.width} vs storyboard ${storyboard.width}`);
  }
  if (config.height !== storyboard.height) {
    mismatches.push(`height ${config.height} vs storyboard ${storyboard.height}`);
  }
  if (config.fps !== storyboard.fps) {
    mismatches.push(`fps ${config.fps} vs storyboard ${storyboard.fps}`);
  }
  if (storyboard.voice && config.voice !== storyboard.voice) {
    mismatches.push(`voice ${config.voice} vs storyboard ${storyboard.voice}`);
  }

  if (mismatches.length > 0) {
    log.text(
      `Warning: vep.config.json overrides storyboard — ${mismatches.join("; ")}`
    );
  }
}

export function writeDefaultVepConfig(projectDir: string): void {
  const configPath = path.join(projectDir, "vep.config.json");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf-8");
  }
}

export const PROJECT_DIRS = ["scenes", "audio", "trimmed"] as const;

export const PROJECT_FILES = {
  article: "article.md",
  storyboard: "storyboard.json",
  timeline: "timeline.json",
  subsAss: "subs.ass",
  shotList: "shot-list.json",
  postDecision: "post/decision.json",
  postTranscript: "post/transcript.json",
  postSubsSrt: "post/subs.srt",
  postManifest: "post/manifest.json",
} as const;
