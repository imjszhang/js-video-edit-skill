import { getMediaInfo } from "../ffmpeg.js";
import { log } from "../utils.js";

export async function runInfo(file: string): Promise<void> {
  const info = await getMediaInfo(file);
  console.log(JSON.stringify(info, null, 2));
  log.zap(`Duration: ${info.duration.toFixed(3)}s, ${info.width}x${info.height} @ ${info.fps}fps`);
}
