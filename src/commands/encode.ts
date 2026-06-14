import path from "path";
import { encode } from "../ffmpeg.js";
import { log } from "../utils.js";

export interface EncodeOptions {
  codec?: string;
  preset?: string;
  crf?: number;
  resolution?: string;
  fps?: number;
}

export async function runEncode(
  input: string,
  output?: string,
  opts: EncodeOptions = {}
): Promise<void> {
  if (!output) {
    const parsed = path.parse(input);
    output = path.join(parsed.dir, `${parsed.name}_final.mp4`);
  }

  log.zap("Final encode:");
  log.zap(`  Codec:      ${opts.codec ?? "libx264"}`);
  log.zap(`  Preset:     ${opts.preset ?? "medium"}`);
  log.zap(`  CRF:        ${opts.crf ?? 18}`);
  log.zap(`  Resolution: ${opts.resolution ?? "1920:1080"}`);
  log.zap(`  FPS:        ${opts.fps ?? 30}`);

  await encode(input, output, {
    codec: opts.codec,
    preset: opts.preset,
    crf: opts.crf,
    resolution: opts.resolution,
    fps: opts.fps,
  });
  log.zap(`Final output: ${output}`);
}
