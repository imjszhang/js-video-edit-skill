import { writeFileSync } from "fs";
import path from "path";
import { generateLutData, cubeToString } from "../lut.js";
import { ensureDir, log } from "../utils.js";

const LUT_SIZE = 17;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function neutralFn(rgb: [number, number, number]): [number, number, number] {
  const fn = (v: number) => {
    if (v < 0.01) return v * 0.1;
    return Math.pow(v, 0.45) * 1.05 - 0.02;
  };
  return [fn(rgb[0]), fn(rgb[1]), fn(rgb[2])];
}

function warmCinematicFn(rgb: [number, number, number]): [number, number, number] {
  const [nr, ng, nb] = neutralFn(rgb);
  const warmth = (nr * 1.05 + ng * 0.1) / 1.15;
  const wb = (nb * 0.95 + ng * 0.1) / 1.05;
  const contrast = (c: number) => clamp01((c - 0.5) * 1.1 + 0.5);
  return [contrast(warmth), contrast(ng), contrast(wb)];
}

function highContrastFn(rgb: [number, number, number]): [number, number, number] {
  const fn = (v: number) => {
    if (v < 0.01) return v * 0.05;
    return Math.pow(v, 0.38) * 1.15 - 0.04;
  };
  const [nr, ng, nb] = [fn(rgb[0]), fn(rgb[1]), fn(rgb[2])];
  const contrast = (c: number) => clamp01((c - 0.5) * 1.3 + 0.5);
  return [contrast(nr), contrast(ng), contrast(nb)];
}

function tealOrangeFn(rgb: [number, number, number]): [number, number, number] {
  const [nr, ng, nb] = neutralFn(rgb);
  const luminance = nr * 0.299 + ng * 0.587 + nb * 0.114;
  const tealFactor = 1.0 - luminance;
  const orangeFactor = luminance;
  const or = clamp01(nr * (1.0 - tealFactor * 0.2) + orangeFactor * 0.15);
  const og = clamp01(ng + tealFactor * 0.05 + orangeFactor * 0.05);
  const ob = clamp01(nb * (1.0 - orangeFactor * 0.15) + tealFactor * 0.1);
  return [or, og, ob];
}

export function runGenerateLuts(outputDir: string): void {
  ensureDir(outputDir);

  const presets = [
    { name: "neutral.cube", title: "S-Log3 to Rec.709", fn: neutralFn },
    { name: "warm-cinematic.cube", title: "Warm Cinematic", fn: warmCinematicFn },
    { name: "high-contrast.cube", title: "High Contrast", fn: highContrastFn },
    { name: "teal-orange.cube", title: "Teal & Orange", fn: tealOrangeFn },
  ];

  for (const preset of presets) {
    log.color(`Generating ${preset.name} (${preset.title})`);
    const data = generateLutData(LUT_SIZE, preset.fn);
    const cube = cubeToString(data, LUT_SIZE, preset.title);
    const outPath = path.join(outputDir, preset.name);
    writeFileSync(outPath, cube);
    log.color(`  → ${outPath} (${data.length} entries)`);
  }

  log.color(`Generated ${presets.length} LUT presets in ${outputDir}`);
}
