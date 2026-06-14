import path from "path";
import { applyLut } from "../ffmpeg.js";
import { log } from "../utils.js";

export async function runGrade(
  input: string,
  lutFile: string,
  output?: string
): Promise<void> {
  if (!output) {
    const parsed = path.parse(input);
    output = path.join(parsed.dir, `${parsed.name}_graded.mp4`);
  }

  log.color(`Applying LUT: ${path.basename(lutFile)}`);
  log.color(`  Input:  ${path.basename(input)}`);
  log.color(`  Output: ${path.basename(output)}`);

  await applyLut(input, lutFile, output);
  log.color("Color grading complete");
}
