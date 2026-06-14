import { readFileSync, existsSync } from "fs";
import path from "path";
import { TimelineSchema, type Timeline } from "./types.js";

export function validateTimeline(jsonStr: string): Timeline {
  try {
    const parsed = JSON.parse(jsonStr);
    return TimelineSchema.parse(parsed);
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Invalid timeline: ${err.message}`);
    }
    throw err;
  }
}

export function loadTimeline(projectDir: string): Timeline {
  const tlPath = path.join(projectDir, "timeline.json");
  if (!existsSync(tlPath)) {
    throw new Error(`timeline.json not found at ${tlPath}. Run 'vep article timeline' first.`);
  }
  return validateTimeline(readFileSync(tlPath, "utf-8"));
}
