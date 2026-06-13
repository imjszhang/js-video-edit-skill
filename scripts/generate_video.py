#!/usr/bin/env python3
"""Pipeline demo video generator - uses ffmpeg drawtext with proper UTF-8 handling."""

import subprocess
import os
import sys

OUT = "out"
FONT = r"C:\Windows\Fonts\msyh.ttc"
W, H, FPS = 1920, 1080, 30

scenes = [
    {
        "id": 1, "dur": 3,
        "texts": [
            ("Text-Driven Video Editing", "(h-text_h)/2-30", 52, "FCD228"),
            ("js-video-edit-skill · Code First", "(h-text_h)/2+50", 28, "888888"),
        ]
    },
    {
        "id": 2, "dur": 3,
        "texts": [
            ("Edit video without opening", "(h-text_h)/2-70", 42, "FFFFFF"),
            ("Premiere or Final Cut", "(h-text_h)/2-10", 42, "FFFFFF"),
            ("Decisions live in JSON", "(h-text_h)/2+50", 42, "FCD228"),
            ("ffmpeg executes the cuts", "(h-text_h)/2+110", 42, "FFFFFF"),
        ]
    },
    {
        "id": 3, "dur": 3,
        "texts": [
            ("The real cost driver:", "(h-text_h)/2-60", 38, "FFFFFF"),
            ("Transcription + cutting ~ $10", "(h-text_h)/2+10", 46, "44FF44"),
            ("Most spend goes to UI iteration", "(h-text_h)/2+70", 32, "888888"),
        ]
    },
    {
        "id": 4, "dur": 4,
        "texts": [
            ("Every tool is free", "(h-text_h)/2-120", 46, "FCD228"),
            ("Whisper  ·  Transcription  ·  Timestamps", "(h-text_h)/2-40", 30, "44FF44"),
            ("ffmpeg  ·  Cut  ·  Concat  ·  Encode", "(h-text_h)/2+5", 30, "44FF44"),
            (".cube LUT  ·  Text-based color grading", "(h-text_h)/2+50", 30, "44FF44"),
            ("Remotion  ·  Motion graphics", "(h-text_h)/2+95", 30, "44FF44"),
        ]
    },
    {
        "id": 5, "dur": 4,
        "texts": [
            ("Cost comparison", "(h-text_h)/2-120", 50, "FCD228"),
            ("Proprietary AI :  ~$100", "(h-text_h)/2-30", 42, "FF4444"),
            ("Open source    :  ~$1-5", "(h-text_h)/2+40", 42, "44FF44"),
            ("Same pipeline, 20x cheaper", "(h-text_h)/2+120", 46, "FCD228"),
        ]
    },
    {
        "id": 6, "dur": 3,
        "texts": [
            ("The breakthrough is not AI", "(h-text_h)/2-60", 42, "FFFFFF"),
            ("Editing decisions as text", "(h-text_h)/2+10", 46, "FCD228"),
            ("Once rules are text", "(h-text_h)/2+90", 34, "FFFFFF"),
            ("Any agent can execute them", "(h-text_h)/2+140", 34, "44FF44"),
        ]
    },
    {
        "id": 7, "dur": 3,
        "texts": [
            ("A reusable pipeline", "(h-text_h)/2-100", 46, "FCD228"),
            ("Ingest  →  Whisper  →  JSON decision", "(h-text_h)/2-20", 28, "FFFFFF"),
            ("→  ffmpeg  →  LUT grade  →  Render", "(h-text_h)/2+25", 28, "FFFFFF"),
            ("Every step is version-controlled", "(h-text_h)/2+85", 30, "44FF44"),
            ("Every step is swappable", "(h-text_h)/2+130", 30, "44FF44"),
        ]
    },
    {
        "id": 8, "dur": 3,
        "texts": [
            ("One command to render", "(h-text_h)/2-100", 46, "FCD228"),
            ("$ vep pipeline ./raw ./output", "(h-text_h)/2-20", 28, "44FF44"),
            ("  --decision decision.json", "(h-text_h)/2+20", 22, "888888"),
            ("  --lut luts/warm-cinematic.cube", "(h-text_h)/2+50", 22, "888888"),
            ("  --subtitles  --final-encode --crf 18", "(h-text_h)/2+80", 22, "888888"),
        ]
    },
    {
        "id": 9, "dur": 4,
        "texts": [
            ("Editing is not clicking.", "(h-text_h)/2-60", 54, "FCD228"),
            ("It is expression.", "(h-text_h)/2+15", 54, "FCD228"),
            ("Express it in your native language — text.", "(h-text_h)/2+100", 34, "FFFFFF"),
            ("js-video-edit-skill", "(h-text_h)/2+160", 22, "888888"),
        ]
    },
]


def drawtext(text, x, y, size, color):
    """Build a drawtext filter string."""
    # Escape % and \ for ffmpeg
    text = text.replace("%", "%%%%").replace("\\", "\\\\")
    return (
        f"drawtext=text='{text}':x={x}:y={y}:fontsize={size}"
        f":fontcolor={color}:fontfile='{FONT}'"
    )


def generate_scene(scene):
    outfile = os.path.join(OUT, f"scene_{scene['id']:02d}.mp4")
    if os.path.exists(outfile):
        print(f"  [SKIP] Scene {scene['id']} exists")
        return outfile

    filters = ",".join(
        drawtext(t, "(w-text_w)/2", y, s, c)
        for t, y, s, c in scene["texts"]
    )

    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", f"color=c=0a0a0a:s={W}x{H}:d={scene['dur']}:r={FPS}",
        "-vf", filters,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-an",
        outfile,
    ]

    print(f"  [GEN] Scene {scene['id']} ({scene['dur']}s)...")
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode == 0:
        print(f"  [OK] Scene {scene['id']} done")
        return outfile
    else:
        print(f"  [FAIL] Scene {scene['id']} failed:")
        print(result.stderr.decode('utf-8', errors='replace')[-500:])
        sys.exit(1)


def concat(files, outfile):
    listfile = os.path.join(OUT, "concat_list.txt")
    with open(listfile, "w") as f:
        for path in files:
            f.write(f"file '{path.replace(os.sep, '/')}'\n")

    print("\n[CONCAT] Concatenating...")
    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", listfile,
        "-c", "copy",
        outfile,
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode == 0:
        print(f"[OK] Done -> {outfile}")
        return outfile
    else:
        print(f"[FAIL] Concat failed:")
        print(result.stderr.decode('utf-8', errors='replace')[-500:])
        sys.exit(1)


def main():
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    print("Pipeline demo - Python + ffmpeg\n")
    os.makedirs(OUT, exist_ok=True)

    # Clean old scenes
    for i in range(1, 10):
        f = os.path.join(OUT, f"scene_{i:02d}.mp4")
        if os.path.exists(f):
            os.remove(f)

    # Generate scenes
    files = []
    for scene in scenes:
        f = generate_scene(scene)
        files.append(f)

    # Concat
    final = os.path.join(OUT, "pipeline-demo.mp4")
    concat(files, final)

    # Stats
    size = os.path.getsize(final)
    dur = sum(s["dur"] for s in scenes)
    print(f"\n[OUTPUT] {final}")
    print(f"  Duration: {dur}s ({len(scenes)} scenes)")
    print(f"  Size: {size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
