#!/usr/bin/env node
/**
 * Pipeline demo video - Generate using ffmpeg drawtext.
 * Each scene is a color background with text overlay.
 */

import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import path from "path";
import { spawn } from "child_process";

const OUT = path.join(process.cwd(), "out");
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

// Font file (Windows)
const FONT = "C\\\\:\\\\/Windows\\\\/Fonts\\\\/msyh.ttc";

// Escape text for ffmpeg drawtext
// ffmpeg drawtext interprets % as variable expansion, $ also in some builds
function esc(text: string): string {
  return text
    .replace(/%/g, "%%%%")
    .replace(/\\/g, "\\\\");
}

// Escape the entire filter chain for shell safety when using spawn
function buildFilter(lines: { text: string; y: string; size: number; color: string }[]): string {
  return lines.map(l => {
    // Use double quotes for text value to avoid $ expansion issues
    const escaped = l.text
      .replace(/%/g, "%%%%")
      .replace(/"/g, "\\\\\"");
    return `drawtext=text=\"${escaped}\":x=(w-text_w)/2:y=${l.y}:fontsize=${l.size}:fontcolor=${l.color}:font=SimHei`;
  }).join(",");
}

type SceneLine = { text: string; y: string; size: number; color: string };
type Scene = { id: number; duration: number; lines: SceneLine[] };

// Scene definition
const scenes: Scene[] = [
  {
    id: 1, duration: 3,
    lines: [
      { text: "Text-Driven Video Editing", y: "(h-text_h)/2-30", size: 52, color: "FCD228" },
      { text: "js-video-edit-skill · Code First", y: "(h-text_h)/2+50", size: 28, color: "888888" },
    ]
  },
  {
    id: 2, duration: 3,
    lines: [
      { text: "Edit video without opening", y: "(h-text_h)/2-70", size: 42, color: "FFFFFF" },
      { text: "Premiere or Final Cut", y: "(h-text_h)/2-10", size: 42, color: "FFFFFF" },
      { text: "Decisions live in JSON", y: "(h-text_h)/2+50", size: 42, color: "FCD228" },
      { text: "ffmpeg executes the cuts", y: "(h-text_h)/2+110", size: 42, color: "FFFFFF" },
    ]
  },
  {
    id: 3, duration: 3,
    lines: [
      { text: "The real cost driver:", y: "(h-text_h)/2-60", size: 38, color: "FFFFFF" },
      { text: "Transcription + cutting ~ $10", y: "(h-text_h)/2+10", size: 46, color: "44FF44" },
      { text: "Most spend goes to UI iteration", y: "(h-text_h)/2+70", size: 32, color: "888888" },
    ]
  },
  {
    id: 4, duration: 4,
    lines: [
      { text: "Every tool is free", y: "(h-text_h)/2-120", size: 46, color: "FCD228" },
      { text: "Whisper  ·  Transcription  ·  Timestamps", y: "(h-text_h)/2-40", size: 30, color: "44FF44" },
      { text: "ffmpeg  ·  Cut  ·  Concat  ·  Encode", y: "(h-text_h)/2+5", size: 30, color: "44FF44" },
      { text: ".cube LUT  ·  Text-based color grading", y: "(h-text_h)/2+50", size: 30, color: "44FF44" },
      { text: "Remotion  ·  Motion graphics", y: "(h-text_h)/2+95", size: 30, color: "44FF44" },
    ]
  },
  {
    id: 5, duration: 4,
    lines: [
      { text: "Cost comparison", y: "(h-text_h)/2-120", size: 50, color: "FCD228" },
      { text: "Proprietary AI :  ~$100", y: "(h-text_h)/2-30", size: 42, color: "FF4444" },
      { text: "Open source    :  ~$1-5", y: "(h-text_h)/2+40", size: 42, color: "44FF44" },
      { text: "Same pipeline, 20x cheaper", y: "(h-text_h)/2+120", size: 46, color: "FCD228" },
    ]
  },
  {
    id: 6, duration: 3,
    lines: [
      { text: "The breakthrough is not AI", y: "(h-text_h)/2-60", size: 42, color: "FFFFFF" },
      { text: "Editing decisions as text", y: "(h-text_h)/2+10", size: 46, color: "FCD228" },
      { text: "Once rules are text", y: "(h-text_h)/2+90", size: 34, color: "FFFFFF" },
      { text: "Any agent can execute them", y: "(h-text_h)/2+140", size: 34, color: "44FF44" },
    ]
  },
  {
    id: 7, duration: 3,
    lines: [
      { text: "A reusable pipeline", y: "(h-text_h)/2-100", size: 46, color: "FCD228" },
      { text: "Ingest  →  Whisper  →  JSON decision", y: "(h-text_h)/2-20", size: 28, color: "FFFFFF" },
      { text: "→  ffmpeg  →  LUT grade  →  Render", y: "(h-text_h)/2+25", size: 28, color: "FFFFFF" },
      { text: "Every step is version-controlled", y: "(h-text_h)/2+85", size: 30, color: "44FF44" },
      { text: "Every step is swappable", y: "(h-text_h)/2+130", size: 30, color: "44FF44" },
    ]
  },
  {
    id: 8, duration: 3,
    lines: [
      { text: "One command to render", y: "(h-text_h)/2-100", size: 46, color: "FCD228" },
      { text: "$ vep pipeline ./raw ./output", y: "(h-text_h)/2-20", size: 28, color: "44FF44" },
      { text: "  --decision decision.json", y: "(h-text_h)/2+20", size: 22, color: "888888" },
      { text: "  --lut luts/warm-cinematic.cube", y: "(h-text_h)/2+50", size: 22, color: "888888" },
      { text: "  --subtitles  --final-encode --crf 18", y: "(h-text_h)/2+80", size: 22, color: "888888" },
    ]
  },
  {
    id: 9, duration: 4,
    lines: [
      { text: "Editing is not clicking.", y: "(h-text_h)/2-60", size: 54, color: "FCD228" },
      { text: "It is expression.", y: "(h-text_h)/2+15", size: 54, color: "FCD228" },
      { text: "Express it in your native language — text.", y: "(h-text_h)/2+100", size: 34, color: "FFFFFF" },
      { text: "js-video-edit-skill", y: "(h-text_h)/2+160", size: 22, color: "888888" },
    ]
  },
];

function generateScene(scene: Scene): Promise<string> {
  const outFile = path.join(OUT, `scene_${String(scene.id).padStart(2, "0")}.mp4`);
  if (existsSync(outFile)) {
    console.log(`  ⏭️  Scene ${scene.id} exists, skip`);
    return Promise.resolve(outFile);
  }

  const vf = buildFilter(scene.lines);
  const args = [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=0a0a0a:s=1920x1080:d=${scene.duration}:r=30`,
    "-vf", vf,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-an",
    outFile,
  ];

  console.log(`  🎬 Scene ${scene.id} (${scene.duration}s)...`);

  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`  ✅ Scene ${scene.id} done`);
        resolve(outFile);
      } else {
        reject(new Error(`ffmpeg exit ${code}`));
      }
    });
    child.on("error", reject);
  });
}

function concat(files: string[], outFile: string): Promise<string> {
  const listFile = path.join(OUT, "concat_list.txt");
  const content = files.map((f: string) => `file '${f.replace(/\\/g, "/")}'`).join("\n");
  writeFileSync(listFile, content);

  console.log("\n🔗 Concatenating...");

  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", [
      "-y", "-f", "concat", "-safe", "0",
      "-i", listFile,
      "-c", "copy",
      outFile,
    ], { stdio: ["ignore", "inherit", "inherit"] });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Done → ${outFile}`);
        resolve(outFile);
      } else {
        reject(new Error(`concat exit ${code}`));
      }
    });
  });
}

async function main() {
  console.log("🎬 Pipeline demo — ffmpeg drawtext mode\n");

  // Clean old scenes
  for (let i = 1; i <= 9; i++) {
    const f = path.join(OUT, `scene_${String(i).padStart(2, "0")}.mp4`);
    if (existsSync(f)) unlinkSync(f);
  }

  // Generate scenes
  const files: string[] = [];
  for (const s of scenes) {
    const f = await generateScene(s);
    files.push(f);
  }

  // Concat
  const final = path.join(OUT, "pipeline-demo.mp4");
  await concat(files, final);

  // Stats
  const { stat } = await import("fs/promises");
  const info = await stat(final);
  const dur = scenes.reduce((a, b) => a + b.duration, 0);
  console.log(`\n📹 ${final}`);
  console.log(`⏱️  ${dur}s (${scenes.length} scenes)`);
  console.log(`📦 ${(info.size / 1024).toFixed(0)} KB`);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
