import { spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { crossPath, ensureDir, runCommand } from "./utils.js";

interface CutOptions {
  fast?: boolean;
}

interface EncodeOptions {
  codec?: string;
  preset?: string;
  crf?: number;
  resolution?: string;
  fps?: number;
}

interface SubtitleOptions {
  fontSize?: number;
  fontName?: string;
  primaryColor?: string;
}

/**
 * Cut a segment from a video.
 * fast=true uses stream copy (-c copy); false re-encodes for frame-accurate cuts.
 */
export async function cutSegment(
  input: string,
  startTime: number,
  endTime: number,
  output: string,
  opts: CutOptions = {}
): Promise<void> {
  const { fast = false } = opts;
  const duration = endTime - startTime;
  ensureDir(path.dirname(output));

  const args = [
    "-y",
    "-ss",
    formatTime(startTime),
    "-i",
    crossPath(input),
    "-t",
    duration.toString(),
  ];

  if (fast) {
    args.push("-c", "copy", "-avoid_negative_ts", "make_zero");
  } else {
    args.push("-c:v", "libx264", "-c:a", "aac", "-preset", "medium");
  }

  args.push(crossPath(output));
  await runCommand("ffmpeg", args);
}

/**
 * Concatenate clips using the FFmpeg concat demuxer.
 * fileList is a path to a text file listing input files (one per line).
 */
export async function concatClips(
  fileList: string,
  output: string
): Promise<void> {
  ensureDir(path.dirname(output));
  await runCommand("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    crossPath(fileList),
    "-c",
    "copy",
    crossPath(output),
  ]);
}

/**
 * Apply a 3D LUT for color grading.
 */
export async function applyLut(
  input: string,
  lutPath: string,
  output: string
): Promise<void> {
  ensureDir(path.dirname(output));
  await runCommand("ffmpeg", [
    "-y",
    "-i",
    crossPath(input),
    "-vf",
    `lut3d=file='${crossPath(lutPath)}'`,
    "-c:a",
    "copy",
    crossPath(output),
  ]);
}

/**
 * Burn subtitles into video using the subtitles filter.
 */
export async function burnSubtitles(
  input: string,
  srtPath: string,
  output: string,
  opts: SubtitleOptions = {}
): Promise<void> {
  const { fontSize = 24, fontName = "Arial", primaryColor = "&H00FFFFFF" } =
    opts;
  ensureDir(path.dirname(output));

  const vf = `subtitles='${crossPath(
    srtPath
  )}':force_style='FontSize=${fontSize},FontName=${fontName},PrimaryColour=${primaryColor}'`;

  await runCommand("ffmpeg", [
    "-y",
    "-i",
    crossPath(input),
    "-vf",
    vf,
    "-c:a",
    "copy",
    crossPath(output),
  ]);
}

/**
 * Final encode with quality control options.
 */
export async function encode(
  input: string,
  output: string,
  opts: EncodeOptions = {}
): Promise<void> {
  const {
    codec = "libx264",
    preset = "medium",
    crf = 18,
    resolution = "1920:1080",
    fps = 30,
  } = opts;
  ensureDir(path.dirname(output));

  await runCommand("ffmpeg", [
    "-y",
    "-i",
    crossPath(input),
    "-c:v",
    codec,
    "-preset",
    preset,
    "-crf",
    crf.toString(),
    "-vf",
    `scale=${resolution}`,
    "-r",
    fps.toString(),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    crossPath(output),
  ]);
}

/**
 * Extract frames from a video for review at a given fps (default 1).
 */
export async function extractFrames(
  input: string,
  outputDir: string,
  fps = 1
): Promise<void> {
  ensureDir(outputDir);
  const pattern = path.join(outputDir, "frame_%04d.jpg");
  await runCommand("ffmpeg", [
    "-y",
    "-i",
    crossPath(input),
    "-vf",
    `fps=${fps}`,
    "-q:v",
    "2",
    pattern,
  ]);
}

interface MediaInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

/**
 * Get media information via ffprobe.
 */
export async function getMediaInfo(input: string): Promise<MediaInfo> {
  const showStreamsArgs = [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,r_frame_rate,duration",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    crossPath(input),
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", showStreamsArgs, {
      stdio: ["ignore", "pipe", "inherit"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error("ffprobe failed"));
      try {
        const data = JSON.parse(out);
        const stream = data.streams?.[0];
        const format = data.format;
        const fpsParts = stream?.r_frame_rate?.split("/") ?? ["30", "1"];
        const fps =
          fpsParts.length === 2
            ? parseInt(fpsParts[0]) / parseInt(fpsParts[1])
            : 30;
        resolve({
          duration: parseFloat(format?.duration ?? stream?.duration ?? "0"),
          width: stream?.width ?? 1920,
          height: stream?.height ?? 1080,
          fps: parseFloat(fps.toFixed(3)),
        });
      } catch (e) {
        reject(e);
      }
    });
    child.on("error", reject);
  });
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms
    .toString()
    .padStart(3, "0")}`;
}
