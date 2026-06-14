import { z } from "zod";

export const VisualTypeSchema = z.enum([
  "hero",
  "text-card",
  "quote-card",
  "code-block",
  "comparison",
  "step-diagram",
  "ending",
]);

export type VisualType = z.infer<typeof VisualTypeSchema>;

export const StoryboardCandidateSchema = z.object({
  visual_type: VisualTypeSchema.optional(),
  reason_rejected: z.string().optional(),
  reason_selected: z.string().optional(),
});

export const StoryboardSegmentSchema = z
  .object({
    id: z.number().int().positive(),
    visual_type: VisualTypeSchema,
    narration: z.string().min(1, "narration is required for TTS and subtitles"),
    reason: z.string().optional(),
    candidates: z.array(StoryboardCandidateSchema).optional(),
    selected: z.string().optional(),
    duration: z.number().optional(),
    // hero / ending
    text: z.string().optional(),
    subtitle: z.string().optional(),
    badge: z.string().optional(),
    // text-card / code-block
    heading: z.string().optional(),
    body: z.string().optional(),
    // quote-card
    quote: z.string().optional(),
    author: z.string().optional(),
    // code-block
    code: z.string().optional(),
    // comparison
    left_title: z.string().optional(),
    right_title: z.string().optional(),
    left_items: z.array(z.string()).optional(),
    right_items: z.array(z.string()).optional(),
    // step-diagram
    steps: z.array(z.string()).optional(),
  })
  .passthrough();

export const StoryboardSchema = z.object({
  version: z.literal(1).default(1),
  title: z.string().min(1),
  badge: z.string().optional(),
  width: z.number().int().positive().default(1080),
  height: z.number().int().positive().default(1920),
  fps: z.number().int().positive().default(24),
  voice: z.string().default("zh-CN-YunxiNeural"),
  segments: z.array(StoryboardSegmentSchema).min(1),
});

export type StoryboardCandidate = z.infer<typeof StoryboardCandidateSchema>;
export type StoryboardSegment = z.infer<typeof StoryboardSegmentSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;

export const TimelineSegmentSchema = z.object({
  id: z.number().int().positive(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  duration: z.number().positive(),
  narration: z.string(),
  audio_raw: z.string(),
  audio_trimmed: z.string(),
  visual: z.string(),
});

export const TimelineSchema = z.object({
  version: z.literal(1).default(1),
  total_duration: z.number().nonnegative(),
  generated_at: z.string(),
  segments: z.array(TimelineSegmentSchema).min(1),
});

export type TimelineSegment = z.infer<typeof TimelineSegmentSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;

export const VepConfigSchema = z.object({
  voice: z.string().default("zh-CN-YunxiNeural"),
  fps: z.number().int().positive().default(24),
  width: z.number().int().positive().default(1080),
  height: z.number().int().positive().default(1920),
  jsEyesWs: z.string().default("ws://localhost:18080"),
  jsEyesClientPath: z.string().optional(),
  screenshotBackend: z
    .enum(["auto", "openclaw", "playwright", "js-eyes"])
    .default("auto"),
  openclawCli: z.string().optional(),
  openclawBrowserProfile: z.string().default("openclaw"),
  screenshotPort: z.number().int().positive().default(18998),
  screenshotTabDelay: z.number().int().nonnegative().default(3000),
  silenceThreshold: z.string().default("-50dB"),
  silenceDuration: z.number().default(0.2),
  silencePadding: z.number().default(0.1),
  subtitleFontSize: z.number().int().positive().default(48),
  subtitleMarginV: z.number().int().positive().default(100),
  color_profile: z.string().optional(),
});

export type VepConfig = z.infer<typeof VepConfigSchema>;

export const ShotListEntrySchema = z.object({
  id: z.number(),
  visual_type: z.string(),
  narration_preview: z.string(),
  reason: z.string().optional(),
  candidates: z.array(StoryboardCandidateSchema).optional(),
  selected: z.string().optional(),
});

export const ShotListSchema = z.object({
  version: z.literal(1),
  title: z.string(),
  generated_at: z.string(),
  total_segments: z.number(),
  entries: z.array(ShotListEntrySchema),
});

export type ShotList = z.infer<typeof ShotListSchema>;
