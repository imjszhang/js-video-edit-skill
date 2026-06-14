# js-video-edit-skill

[![MIT License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org)
[![ffmpeg](https://img.shields.io/badge/ffmpeg-required-orange)](https://ffmpeg.org)

> Text-driven video editing pipeline using open-source tools. No traditional editing software required.

Inspired by the [Claude Fable 5 code-based editing workflow](https://thariqs.github.io/cc-video-editing-deck/), but using free, open-source tools. The same pipeline — Whisper transcription → JSON editing decisions → ffmpeg cutting → LUT color grading → Remotion motion graphics — costs ~$1 with this tool vs ~$100 with proprietary AI.

## What Is This?

A Node.js + TypeScript pipeline that lets you edit videos using only **text and code**. No Premiere, no Final Cut, no DaVinci Resolve.

You describe what you want in a prompt. The AI generates an editing decision as a JSON file. ffmpeg executes the cuts. LUT files handle color grading. Remotion handles motion graphics.

Everything is text. Everything is version-controllable. Everything is reproducible.

## Architecture

```
Raw Footage        Transcripts         Decision JSON        Cuts           Final Video
┌──────────┐     ┌──────────────┐    ┌───────────────┐   ┌──────────┐   ┌──────────────┐
│ .mp4/.mov│────▶│ Whisper JSON │───▶│ LLM generates │──▶│ ffmpeg   │──▶│ LUT grade    │
│ .mkv     │     │ (word-level  │    │ editing rules │   │ cut/     │   │ subtitles    │
│          │     │  timestamps) │    │ (in/out points│   │ assemble │   │ Remotion     │
└──────────┘     └──────────────┘    │  per scene)   │   └──────────┘   │ encode       │
                                     └───────────────┘                  └──────────────┘
```

## Quick Start

```bash
npm install

# Mode A: footage editing
vep pipeline ./raw ./output --decision decision.json

# Mode B: article-to-video
vep article init ./project
vep article storyboard ./project
vep article pipeline ./project
```

See [docs/article-quickstart.md](docs/article-quickstart.md) for Mode B details.

## Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| **Node.js >= 18** | Runtime | [nodejs.org](https://nodejs.org) |
| **ffmpeg** | Video cutting/encoding | `brew install ffmpeg` / `apt install ffmpeg` |
| **ffprobe** | Media info (bundled with ffmpeg) | — |
| **Whisper** | Transcription | `pip install openai-whisper` **or** [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |

Whisper is auto-detected — the pipeline uses whichever one it finds first.

## Installation

```bash
npm install
```

Or use globally:

```bash
npm install -g .
vep --help
```

## Commands

Unified CLI entry: `vep <command>`. Run `vep --help` for full list.

### Mode A: Footage Editing

```bash
vep pipeline ./raw ./output \
  --model base \
  --language en \
  --decision decision.json \
  --fast-cuts \
  --lut luts/warm-cinematic.cube \
  --subtitles \
  --final-encode --crf 18
```

| Command | Description |
|---------|-------------|
| `vep pipeline <inputDir> [outputDir]` | Full footage pipeline |
| `vep transcribe <dir> [outputDir]` | Transcribe all videos |
| `vep analyze <transcriptsDir>` | Output analysis digest for LLM |
| `vep cut <decision.json> [outputDir]` | Execute ffmpeg cuts |
| `vep grade <input> <lut> [output]` | Apply LUT color grading |
| `vep subtitle <input> <transcript> [output]` | Generate and burn subtitles |
| `vep encode <input> [output]` | Final encode |
| `vep render <input> [output]` | Deprecated alias for `encode` |
| `vep generate-luts [dir]` | Generate preset LUT files |
| `vep info <file>` | Show media info via ffprobe |

### Mode B: Article-to-Video

See [docs/article-quickstart.md](docs/article-quickstart.md) for full guide.

```bash
vep article init ./project
vep article storyboard ./project          # digest for LLM → storyboard.json
vep article validate ./project
vep article pipeline ./project            # render → screenshot → tts → timeline → assemble
```

| Command | Description |
|---------|-------------|
| `vep article init <projectDir>` | Initialize project structure + templates |
| `vep article storyboard <projectDir>` | Analyze article.md, output LLM digest |
| `vep article validate <projectDir>` | Validate storyboard.json (`--strict` for CI) |
| `vep article render <projectDir>` | Render HTML scenes |
| `vep article screenshot <projectDir>` | JS-Eyes PNG capture |
| `vep article tts <projectDir>` | edge-tts audio generation |
| `vep article timeline <projectDir>` | Build timeline.json + subs.ass |
| `vep article assemble <projectDir>` | Compose final.mp4 |
| `vep article recover <projectDir>` | Recover from existing audio/scenes (`--force` to overwrite) |
| `vep article pipeline <projectDir>` | End-to-end with `--from` / `--to` / `--dry-run` / `--force` |

Full Mode B guide: [docs/article-quickstart.md](docs/article-quickstart.md)

**Data layers:** `storyboard.json` (intent) → `timeline.json` (audio-authoritative) → `subs.ass` + `shot-list.json` (post-production)

> **Note:** Standalone scripts under `scripts/*.ts` (except `cli.ts`) are deprecated thin wrappers — use `vep <command>` instead.

### Footage Pipeline Options

| Option | Description | Default |
|--------|-------------|---------|
| `<inputDir>` | Raw video files directory | — |
| `[outputDir]` | Output directory | `./output` |
| `--model` | Whisper model | `base` |
| `--language` | Language code | auto-detect |
| `--decision` | Editing decision JSON path | — |
| `--fast-cuts` | Use stream copy | false |
| `--lut` | LUT file for color grading | none |
| `--subtitles` | Burn subtitles from transcript | false |
| `--final-encode` | Run final quality encode | false |
| `--crf` | CRF for final encode | `18` |

## Editing Decision Format

The core of this pipeline is the `decision.json` file — a structured JSON that tells ffmpeg exactly what to do:

```json
{
  "scenes": [
    {
      "scene_id": 1,
      "scene_name": "Opening",
      "candidates": [
        { "file": "clip_001.mp4", "reason_rejected": "Poor audio" },
        { "file": "clip_003.mp4", "reason_selected": "Clean start, strong hook" }
      ],
      "selected": "clip_003.mp4",
      "in_point": 0.0,
      "out_point": 12.5,
      "reason": "Sets the tone. Cut at 12.5s before topic transition."
    }
  ],
  "global_settings": {
    "target_duration": "3:30",
    "color_profile": "warm-cinematic",
    "subtitle_style": "Arial, 24px"
  }
}
```

Each scene records: **which clips were available**, **which was chosen**, **why**, and **exactly where to cut**. Every editing decision is documented and reproducible.

## LUT Presets

The pipeline includes 4 color grading presets:

| Preset | Description |
|--------|-------------|
| `neutral.cube` | S-Log3 to Rec.709 base conversion |
| `warm-cinematic.cube` | Warm tones, slight contrast boost |
| `high-contrast.cube` | Expanded dynamic range, punchy |
| `teal-orange.cube` | Shadows teal, highlights orange (blockbuster look) |

Generate them:
```bash
vep generate-luts ./luts
```

## Remotion Integration

For complex motion graphics (animated titles, lower thirds, kinetic typography), the pipeline integrates with [Remotion](https://www.remotion.dev/) — a React-based video rendering framework.

```bash
cd remotion
npm install
npx remotion render src/index.ts MainComposition output.mp4
```

Subtitles and title cards are driven by transcript JSON data, so timing is always accurate.

## Comparison with Fable 5

| Aspect | Fable 5 | js-video-edit-skill |
|--------|---------|---------------------|
| Transcription | Whisper (local) | Whisper (local) |
| Editing Decision | Claude Code + Fable 5 | Any LLM + this pipeline |
| Cutting | ffmpeg | ffmpeg |
| Color Grading | Hand-written .cube LUTs | Hand-written .cube LUTs (4 presets included) |
| Motion Graphics | Remotion React | Remotion React |
| Design Sync | Figma MCP | Not included (future) |
| Cost | ~$100 | ~$1-5 |
| Open Source | No | Yes (MIT) |

## File Structure

### Mode A (footage)

```
project/
├── raw/              # Raw video files
├── output/           # Pipeline output
│   ├── transcripts/
│   ├── cuts/
│   └── final.mp4
├── decision.json
└── luts/
```

### Mode B (article-to-video)

```
my-video-project/
├── article.md           # Source article
├── storyboard.json      # Creative intent (narration + visuals)
├── timeline.json        # Audio-authoritative timeline (auto)
├── subs.ass             # Subtitles (auto; editable)
├── shot-list.json       # Edit decision summary (auto)
├── vep.config.json      # TTS voice, resolution, trim thresholds
├── templates/           # HTML scene templates (from init)
├── scenes/              # sceneXX.html + sceneXX.png
├── audio/               # segXX.mp3 (TTS raw)
└── trimmed/             # trimmed audio, clips, final.mp4
```

## Why This Exists

The Fable 5 demo proved that code-based video editing is viable. But it cost $100 and required a proprietary AI model.

This project proves the same thing can be done with **free, open-source tools** — because the actual breakthrough wasn't the AI model. It was the idea that **editing decisions can be expressed as text**.

Once decisions are text, any text-reading agent can execute them. The tools are all free. The format is all open.

## Contributing

PRs welcome. Key areas for improvement:

- [x] Article-to-video CLI (`vep article`)
- [ ] Support for more transcription engines (AssemblyAI, Groq Whisper)
- [ ] Auto-detect scene boundaries from transcript
- [ ] Figma MCP integration for design sync
- [ ] GPU-accelerated encoding (NVENC, HEVC_VT)
- [ ] Web UI for reviewing editing decisions
- [ ] More LUT presets

## License

MIT. See [LICENSE](LICENSE) for details.
