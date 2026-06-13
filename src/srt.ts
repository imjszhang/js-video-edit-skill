/**
 * SRT subtitle generation from Whisper transcript segments.
 */

import type { Segment } from "./types.js";

/**
 * Convert seconds to SRT timestamp format: "HH:MM:SS,mmm"
 */
export function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms
    .toString()
    .padStart(3, "0")}`;
}

/**
 * Convert Whisper segments to SRT format string.
 */
export function segmentsToSrt(segments: Segment[]): string {
  const lines: string[] = [];
  let index = 1;

  for (const seg of segments) {
    if (!seg.text.trim()) continue;

    const textLines = maxLineLength(seg.text, 42);

    lines.push(index.toString());
    lines.push(`${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}`);
    lines.push(...textLines);
    lines.push("");
    index++;
  }

  return lines.join("\n");
}

/**
 * Split text into lines no longer than maxLen characters,
 * breaking at word boundaries when possible.
 */
export function maxLineLength(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const lines: string[] = [];
  const words = text.split(/\s+/);
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + " " + word).length <= maxLen) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}
