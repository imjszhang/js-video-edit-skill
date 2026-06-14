import { readFileSync, existsSync } from "fs";
import path from "path";
import { StoryboardSchema, type Storyboard } from "./types.js";
import { log } from "../utils.js";

export function validateStoryboard(jsonStr: string): Storyboard {
  try {
    const parsed = JSON.parse(jsonStr);
    const result = StoryboardSchema.parse(parsed);

    for (const seg of result.segments) {
      if (seg.duration !== undefined) {
        log.text(
          `Warning: segment ${seg.id} has deprecated 'duration' field — ignored; use timeline.json instead`
        );
      }
    }

    return result;
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Invalid storyboard: ${err.message}`);
    }
    throw err;
  }
}

export function loadStoryboard(projectDir: string, filePath?: string): Storyboard {
  const sbPath = filePath ?? path.join(projectDir, "storyboard.json");
  if (!existsSync(sbPath)) {
    throw new Error(`storyboard.json not found at ${sbPath}`);
  }
  return validateStoryboard(readFileSync(sbPath, "utf-8"));
}

export function validateSegmentFields(seg: Storyboard["segments"][number]): string[] {
  const warnings: string[] = [];
  const vt = seg.visual_type === "ending" ? "hero" : seg.visual_type;

  switch (vt) {
    case "hero":
      if (!seg.text) warnings.push(`segment ${seg.id}: hero missing 'text'`);
      break;
    case "text-card":
      if (!seg.heading && !seg.body) {
        warnings.push(`segment ${seg.id}: text-card missing 'heading' or 'body'`);
      }
      break;
    case "quote-card":
      if (!seg.quote) warnings.push(`segment ${seg.id}: quote-card missing 'quote'`);
      break;
    case "code-block":
      if (!seg.code) warnings.push(`segment ${seg.id}: code-block missing 'code'`);
      break;
    case "comparison":
      if (!seg.left_items?.length && !seg.right_items?.length) {
        warnings.push(`segment ${seg.id}: comparison missing items`);
      }
      break;
    case "step-diagram":
      if (!seg.steps?.length) warnings.push(`segment ${seg.id}: step-diagram missing 'steps'`);
      break;
  }

  return warnings;
}
