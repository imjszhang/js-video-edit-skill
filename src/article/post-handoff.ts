import { writeFileSync, existsSync, copyFileSync, readdirSync } from "fs";
import path from "path";
import { z } from "zod";
import { validateDecision } from "../decision.js";
import { segmentsToSrt } from "../srt.js";
import { ensureDir, log } from "../utils.js";
import type { EditingDecision, Segment } from "../types.js";
import { loadStoryboard } from "./storyboard.js";
import { loadTimeline } from "./timeline.js";
import { loadVepConfig } from "./config.js";
import type { Storyboard, StoryboardSegment, Timeline, VepConfig } from "./types.js";

export const PostHandoffManifestSchema = z.object({
  version: z.literal(1),
  generated_at: z.string(),
  project_dir: z.string(),
  storyboard: z.string(),
  timeline: z.string(),
  rough_video: z.string(),
  source_dir: z.string(),
  segment_count: z.number().int().nonnegative(),
  total_duration: z.number().nonnegative(),
  recommended_commands: z.array(z.string()),
});

export type PostHandoffManifest = z.infer<typeof PostHandoffManifestSchema>;

export interface ExportPostOptions {
  dryRun?: boolean;
  force?: boolean;
  storyboardFile?: string;
}

function clipBasename(segmentId: number): string {
  return `clip${String(segmentId).padStart(2, "0")}.mp4`;
}

function formatTargetDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function storyboardSegmentById(
  storyboard: Storyboard,
  id: number
): StoryboardSegment | undefined {
  return storyboard.segments.find((s) => s.id === id);
}

function sceneNameFromStoryboard(seg: StoryboardSegment | undefined, id: number): string {
  if (!seg) return `Segment ${id}`;
  const label =
    seg.heading?.slice(0, 30) ??
    seg.text?.split("\n")[0]?.slice(0, 30) ??
    seg.visual_type;
  return `${seg.visual_type}: ${label}`;
}

export function buildEditingDecision(
  storyboard: Storyboard,
  timeline: Timeline,
  config?: Pick<VepConfig, "color_profile">
): EditingDecision {
  const scenes: EditingDecision["scenes"] = timeline.segments.map((tlSeg) => {
    const sbSeg = storyboardSegmentById(storyboard, tlSeg.id);
    const clipFile = clipBasename(tlSeg.id);

    const candidates =
      sbSeg?.candidates?.map((c) => ({
        file: clipFile,
        ...(c.reason_rejected ? { reason_rejected: c.reason_rejected } : {}),
        ...(c.reason_selected ? { reason_selected: c.reason_selected } : {}),
      })) ?? [];

    if (candidates.length === 0) {
      candidates.push({
        file: clipFile,
        reason_selected: sbSeg?.reason ?? `Article segment ${tlSeg.id}`,
      });
    }

    return {
      scene_id: tlSeg.id,
      scene_name: sceneNameFromStoryboard(sbSeg, tlSeg.id),
      candidates,
      selected: clipFile,
      in_point: 0,
      out_point: tlSeg.duration,
      reason: sbSeg?.reason ?? `From article storyboard segment ${tlSeg.id}`,
    };
  });

  const globalSettings: EditingDecision["global_settings"] = {
    target_duration: formatTargetDuration(timeline.total_duration),
  };

  if (config?.color_profile) {
    globalSettings.color_profile = config.color_profile;
  }

  return { scenes, global_settings: globalSettings };
}

export interface WhisperTranscriptJson {
  segments: Array<{
    start: number;
    end: number;
    text: string;
    words: [];
  }>;
}

export function buildWhisperTranscript(timeline: Timeline): WhisperTranscriptJson {
  return {
    segments: timeline.segments.map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.narration,
      words: [],
    })),
  };
}

export function transcriptSegmentsFromTimeline(timeline: Timeline): Segment[] {
  return timeline.segments.map((seg, idx) => ({
    id: idx,
    start: seg.start,
    end: seg.end,
    text: seg.narration,
    words: [],
  }));
}

export function buildSrtFromTimeline(timeline: Timeline): string {
  return segmentsToSrt(transcriptSegmentsFromTimeline(timeline));
}

export function buildPostHandoffManifest(
  projectDir: string,
  timeline: Timeline
): PostHandoffManifest {
  return PostHandoffManifestSchema.parse({
    version: 1,
    generated_at: new Date().toISOString(),
    project_dir: projectDir,
    storyboard: "storyboard.json",
    timeline: "timeline.json",
    rough_video: "trimmed/rough.mp4",
    source_dir: "trimmed",
    segment_count: timeline.segments.length,
    total_duration: timeline.total_duration,
    recommended_commands: [
      "vep cut post/decision.json post/cuts --source-dir trimmed",
      "vep grade trimmed/rough.mp4 luts/warm-cinematic.cube post/graded.mp4",
      "vep subtitle post/graded.mp4 post/transcript.json post/final_graded.mp4",
      "vep encode post/final_graded.mp4 post/delivery.mp4 --crf 18",
    ],
  });
}

function hasClipFiles(trimmedDir: string): boolean {
  if (!existsSync(trimmedDir)) return false;
  return readdirSync(trimmedDir).some((f) => /^clip\d+\.mp4$/i.test(f));
}

export function runArticleExportPost(
  projectDir: string,
  opts: ExportPostOptions = {}
): PostHandoffManifest {
  const storyboardPath =
    opts.storyboardFile ?? path.join(projectDir, "storyboard.json");
  const timelinePath = path.join(projectDir, "timeline.json");
  const postDir = path.join(projectDir, "post");
  const trimmedDir = path.join(projectDir, "trimmed");
  const muxedPath = path.join(trimmedDir, "muxed.mp4");
  const roughPath = path.join(trimmedDir, "rough.mp4");

  if (!existsSync(storyboardPath)) {
    log.error(`storyboard not found: ${storyboardPath}`);
    process.exit(1);
  }
  if (!existsSync(timelinePath)) {
    log.error(`timeline.json not found. Run 'vep article timeline' first.`);
    process.exit(1);
  }

  const storyboard = loadStoryboard(projectDir, opts.storyboardFile);
  const timeline = loadTimeline(projectDir);
  const config = loadVepConfig(projectDir);

  const decision = buildEditingDecision(storyboard, timeline, config);
  validateDecision(JSON.stringify(decision));

  const whisperJson = buildWhisperTranscript(timeline);
  const srtContent = buildSrtFromTimeline(timeline);
  const manifest = buildPostHandoffManifest(projectDir, timeline);

  if (opts.dryRun) {
    log.text(`[dry-run] would write post/decision.json (${decision.scenes.length} scenes)`);
    log.text(`[dry-run] would write post/transcript.json, post/subs.srt, post/manifest.json`);
    if (existsSync(muxedPath)) {
      log.text(`[dry-run] would copy trimmed/muxed.mp4 → trimmed/rough.mp4`);
    } else if (!hasClipFiles(trimmedDir)) {
      log.text("Warning: no trimmed/muxed.mp4 or clip*.mp4 — run assemble first for rough video");
    }
    log.scene("[dry-run] export complete (no files written)");
    return manifest;
  }

  if (!existsSync(muxedPath) && !hasClipFiles(trimmedDir)) {
    log.text(
      "Warning: no trimmed/muxed.mp4 or clip*.mp4 — JSON handoff files will still be written"
    );
  }

  if (existsSync(muxedPath)) {
    copyFileSync(muxedPath, roughPath);
    log.text(`Rough video: ${roughPath}`);
  }

  ensureDir(postDir);

  const decisionPath = path.join(postDir, "decision.json");
  const transcriptPath = path.join(postDir, "transcript.json");
  const srtPath = path.join(postDir, "subs.srt");
  const manifestPath = path.join(postDir, "manifest.json");

  for (const [filePath, label] of [
    [decisionPath, "decision.json"],
    [transcriptPath, "transcript.json"],
    [srtPath, "subs.srt"],
    [manifestPath, "manifest.json"],
  ] as const) {
    if (existsSync(filePath) && !opts.force) {
      log.error(`${label} already exists at ${filePath}. Use --force to overwrite.`);
      process.exit(1);
    }
  }

  writeFileSync(decisionPath, JSON.stringify(decision, null, 2) + "\n", "utf-8");
  writeFileSync(transcriptPath, JSON.stringify(whisperJson, null, 2) + "\n", "utf-8");
  writeFileSync(srtPath, srtContent, "utf-8");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

  log.text(`Wrote ${decisionPath}`);
  log.text(`Wrote ${transcriptPath}`);
  log.text(`Wrote ${srtPath}`);
  log.text(`Wrote ${manifestPath}`);
  log.scene(
    `Post handoff exported — ${timeline.segments.length} segment(s), ${timeline.total_duration.toFixed(1)}s`
  );

  return manifest;
}
