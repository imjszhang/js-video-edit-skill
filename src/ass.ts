/**
 * ASS subtitle generation for vertical video (1080x1920).
 */

export interface AssCue {
  start: number;
  end: number;
  text: string;
}

export interface AssStyleOptions {
  playResX?: number;
  playResY?: number;
  fontName?: string;
  fontSize?: number;
  marginV?: number;
}

/** Convert seconds to ASS timestamp: H:MM:SS.cc (centiseconds) */
export function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

/** Escape ASS control characters in subtitle text */
export function escapeAssText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

/** Wrap long narration into subtitle lines */
export function wrapAssText(text: string, maxLen = 20): string {
  const safe = escapeAssText(text);
  if (safe.length <= maxLen) return safe;

  const lines: string[] = [];
  let current = "";

  for (const ch of safe) {
    if (current.length >= maxLen && (ch === "，" || ch === "。" || ch === " " || ch === "、")) {
      lines.push(current + ch);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= 1) {
    const mid = Math.ceil(safe.length / 2);
    return `${safe.slice(0, mid)}\\N${safe.slice(mid)}`;
  }

  return lines.join("\\N");
}

export function cuesToAss(
  cues: AssCue[],
  opts: AssStyleOptions = {}
): string {
  const {
    playResX = 1080,
    playResY = 1920,
    fontName = "Microsoft YaHei",
    fontSize = 48,
    marginV = 100,
  } = opts;

  const header = `[Script Info]
Title: VEP Subtitles
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = cues
    .map((cue) => {
      const text = wrapAssText(cue.text.trim());
      if (!text) return "";
      return `Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},Default,,0,0,0,,${text}`;
    })
    .filter(Boolean)
    .join("\n");

  return header + events + (events ? "\n" : "");
}
