import { z } from "zod";
import type { EditingDecision } from "./types.js";

const WordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});

const SegmentSchema = z.object({
  id: z.number(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
  words: z.array(WordSchema),
});

const TranscriptSchema = z.object({
  file: z.string(),
  segments: z.array(SegmentSchema),
});

const SceneCandidateSchema = z.object({
  file: z.string(),
  reason_rejected: z.string().optional(),
  reason_selected: z.string().optional(),
});

const SceneSchema = z.object({
  scene_id: z.number(),
  scene_name: z.string(),
  candidates: z.array(SceneCandidateSchema),
  selected: z.string(),
  in_point: z.number(),
  out_point: z.number(),
  reason: z.string(),
});

const GlobalSettingsSchema = z.object({
  target_duration: z.string().optional(),
  color_profile: z.string().optional(),
  subtitle_style: z.string().optional(),
});

export const EditingDecisionSchema = z.object({
  scenes: z.array(SceneSchema),
  global_settings: GlobalSettingsSchema,
});

/**
 * Validate a raw JSON string against the EditingDecision schema.
 * Returns parsed EditingDecision or throws a detailed Zod error.
 */
export function validateDecision(jsonStr: string): EditingDecision {
  try {
    const parsed = JSON.parse(jsonStr);
    return EditingDecisionSchema.parse(parsed);
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Invalid editing decision: ${err.message}`);
    }
    throw err;
  }
}
