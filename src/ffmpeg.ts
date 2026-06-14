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

export interface SilenceRemoveOptions {
  stopThreshold?: string;
  stopDuration?: number;
  stopSilence?: number;
}

/**
 * Remove trailing silence from audio using silenceremove filter.
 */
export async function silenceRemove(
  input: string,
  output: string,
  opts: SilenceRemoveOptions = {}
): Promise<void> {
  const {
    stopThreshold = "-50dB",
    stopDuration = 0.2,
    stopSilence = 0.1,
  } = opts;
  ensureDir(path.dirname(output));

  const af = `silenceremove=start_periods=0:stop_periods=-1:stop_threshold=${stopThreshold}:stop_duration=${stopDuration}:stop_silence=${stopSilence}`;

  await runCommand("ffmpeg", [
    "-y",
    "-i",
    crossPath(input),
    "-af",
    af,
    "-c:a",
    "libmp3lame",
    "-b:a",
    "128k",
    crossPath(output),
  ]);
}

export interface ImageToVideoOptions {
  width?: number;
  height?: number;
  fps?: number;
}

/**
 * Create a video from a static image with specified duration.
 */
export async function imageToVideo(
  imagePath: string,
  duration: number,
  output: string,
  opts: ImageToVideoOptions = {}
): Promise<void> {
  const { width = 1080, height = 1920, fps = 24 } = opts;
  ensureDir(path.dirname(output));

  await runCommand("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-i",
    crossPath(imagePath),
    "-c:v",
    "libx264",
    "-t",
    duration.toString(),
    "-pix_fmt",
    "yuv420p",
    "-vf",
    `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
    "-r",
    fps.toString(),
    "-an",
    crossPath(output),
  ]);
}

/**
 * Mux video and audio streams. Duration follows audio when provided.
 */
export async function muxVideoAudio(
  videoPath: string,
  audioPath: string,
  output: string,
  opts: { duration?: number } = {}
): Promise<void> {
  ensureDir(path.dirname(output));
  const args = [
    "-y",
    "-i",
    crossPath(videoPath),
    "-i",
    crossPath(audioPath),
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
  ];

  if (opts.duration !== undefined) {
    args.push("-t", opts.duration.toString());
  }

  args.push(crossPath(output));
  await runCommand("ffmpeg", args);
}

/**
 * Burn ASS subtitles (Windows-friendly: use relative ass filename in same dir).
 */
export async function burnAss(
  input: string,
  assFileName: string,
  output: string
): Promise<void> {
  ensureDir(path.dirname(output));
  const workDir = path.dirname(input);
  const inputName = path.basename(input);
  const outputName = path.basename(output);

  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-i",
      inputName,
      "-vf",
      `ass=${assFileName}`,
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      outputName,
    ],
    { cwd: workDir }
  );
}

/**
 * Generate silent audio of given duration.
 */
export async function generateSilence(
  duration: number,
  output: string,
  sampleRate = 44100
): Promise<void> {
  ensureDir(path.dirname(output));
  await runCommand("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=${sampleRate}:cl=stereo`,
    "-t",
    duration.toString(),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    crossPath(output),
  ]);
}

/**
 * Concatenate audio files with re-encode to uniform format.
 */
export async function concatAudio(
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
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-ac",
    "2",
    crossPath(output),
  ]);
}

/**
 * Get audio duration via ffprobe (audio stream).
 */
export async function probeAudioDuration(input: string): Promise<number> {
  const args = [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=duration",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    crossPath(input),
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", args, {
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
        const duration = parseFloat(
          stream?.duration ?? format?.duration ?? "0"
        );
        if (!duration || duration <= 0) {
          return reject(new Error(`Could not probe audio duration: ${input}`));
        }
        resolve(duration);
      } catch (e) {
        reject(e);
      }
    });
    child.on("error", reject);
  });
}
