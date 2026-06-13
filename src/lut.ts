/**
 * LUT (Look-Up Table) utilities for color grading.
 * Supports .cube file parsing, generation, and built-in transform curves.
 */

export interface LutData {
  size: number;
  title: string;
  data: number[][];
}

/**
 * Parse a .cube file content string into structured LUT data.
 */
export function parseCube(content: string): LutData {
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  let size = 0;
  let title = "";
  const data: number[][] = [];
  let inData = false;

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("TITLE")) {
      title = line.match(/"([^"]*)"/)?.[1] ?? "";
      continue;
    }

    if (line.startsWith("LUT_3D_SIZE")) {
      size = parseInt(line.split(/\s+/)[1]);
      inData = true;
      continue;
    }

    if (inData) {
      const parts = line.split(/\s+/).map(Number);
      if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
        data.push(parts);
      }
    }
  }

  return { size, title, data };
}

/**
 * Generate LUT 3D data by applying a transform function to each grid point.
 * @param size - LUT grid size (e.g., 17, 33, 65)
 * @param transformFn - function taking [r, g, b] (0-1) and returning [r, g, b] (0-1)
 */
export function generateLutData(
  size: number,
  transformFn: (rgb: [number, number, number]) => [number, number, number]
): number[][] {
  const data: number[][] = [];
  for (let r = 0; r < size; r++) {
    for (let g = 0; g < size; g++) {
      for (let b = 0; b < size; b++) {
        const rn = r / (size - 1);
        const gn = g / (size - 1);
        const bn = b / (size - 1);
        const result = transformFn([rn, gn, bn]);
        data.push([
          clamp01(result[0]),
          clamp01(result[1]),
          clamp01(result[2]),
        ]);
      }
    }
  }
  return data;
}

/**
 * Format LUT data as a .cube file string.
 */
export function cubeToString(data: number[][], size: number, title: string): string {
  const lines: string[] = [
    `# ${title}`,
    `TITLE "${title}"`,
    "LUT_3D_SIZE " + size,
    "",
  ];

  for (const [r, g, b] of data) {
    lines.push(
      `${r.toFixed(6)} ${g.toFixed(6)} ${b.toFixed(6)}`
    );
  }

  return lines.join("\n") + "\n";
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Built-in transform: S-Log3 to Rec.709 approximation */
export function sLog3ToRec709(rgb: [number, number, number]): [number, number, number] {
  // Approximate inverse S-Log3 gamma curve + Rec.709 matrix
  const [r, g, b] = rgb;
  return [
    applySLog3Curve(r),
    applySLog3Curve(g),
    applySLog3Curve(b),
  ];
}

function applySLog3Curve(v: number): number {
  // Simplified S-Log3 to linear approximation
  if (v < 0.01) return v * 0.1;
  // Power curve approximation
  return Math.pow(v, 0.45) * 1.05 - 0.02;
}
