import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { VepConfigSchema, type VepConfig } from "./types.js";
import { loadStoryboard } from "./storyboard.js";

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
} as const;
