# Article-to-Footage Handoff (模式 B → 模式 A)

模式 B 产出粗剪后，用 `vep article export` 生成**后期交接包**，供模式 A 做调色、精剪、重烧字幕与最终编码。

## 何时 export

在 `timeline` + `assemble` 完成后：

```bash
vep article assemble ./project
vep article export ./project
```

或 pipeline 一步：

```bash
vep article pipeline ./project --export-post
# 等价于 --to export（assemble + export）
vep article pipeline ./project --to export
```

预览不写盘：

```bash
vep --dry-run article export ./project
```

已有 `post/` 时需 `--force` 覆写。

## 产出目录

```
project/
├── trimmed/
│   ├── muxed.mp4      # 无字幕 A+V（assemble 中间件）
│   ├── rough.mp4      # muxed 副本，供模式 A 调色/动效（无字幕）
│   └── final.mp4      # 烧 ASS 字幕的发布版
└── post/
    ├── manifest.json      # 交接清单 + 推荐命令
    ├── decision.json      # 模式 A EditingDecision
    ├── transcript.json    # Whisper 兼容 segment 级转写
    └── subs.srt           # 段级字幕（与 subs.ass 同源）
```

### rough vs final

| 文件 | 字幕 | 用途 |
|------|------|------|
| `trimmed/rough.mp4` | 无 | 模式 A 调色、Remotion 包装、重烧字幕 |
| `trimmed/final.mp4` | 已烧 ASS | 直接发布（抖音/B站/飞书） |
| `trimmed/muxed.mp4` | 无 | 与 rough 内容相同（assemble 中间件） |

只要粗剪、不要字幕：

```bash
vep article assemble ./project --skip-subtitles
# 产出 rough.mp4，跳过 final 烧字幕
```

## post/ 文件说明

### decision.json

每 timeline 段对应一条 scene：

- `selected`: `clip01.mp4` …（相对 `trimmed/`）
- `in_point`: `0`
- `out_point`: 实测音频时长（秒）
- `reason` / `candidates`: 来自 `storyboard.json`

### transcript.json

openai-whisper 兼容格式，时间戳为**相对 rough.mp4 的全局时间**。`vep subtitle` 可直接读取。

阶段 1 为 **segment 级**（`words: []`）。词级对齐留待后续版本。

### subs.srt

与 `transcript.json` 同源，可在外部字幕工具编辑后，配合 `vep subtitle --srt-only` 使用。

### manifest.json

记录段数、总时长、`source_dir`（默认 `trimmed`）及推荐的模式 A 命令链。

## 模式 A 后期典型流程

在项目根目录执行（路径相对 `./project`）：

```bash
# 1. 可选：按 decision 重剪单镜（source 为 trimmed/clipXX.mp4）
vep cut post/decision.json post/cuts --source-dir trimmed

# 2. 调色（输入无字幕 rough）
vep grade trimmed/rough.mp4 luts/warm-cinematic.cube post/graded.mp4

# 3. 重烧字幕（segment 级）
vep subtitle post/graded.mp4 post/transcript.json post/final_graded.mp4

# 4. 最终编码
vep encode post/final_graded.mp4 post/delivery.mp4 --crf 18
```

仅导出 SRT、不烧录：

```bash
vep subtitle post/graded.mp4 post/transcript.json --srt-only
```

## 改内容后重跑顺序

| 改了什么 | 重跑 |
|----------|------|
| 旁白 / narration | `tts` → `timeline` → `assemble` → `export` |
| 画面 / 模板 | `render` → `screenshot` → `assemble` → `export` |
| 仅字幕样式 | 编辑 `subs.ass` 或 `post/subs.srt`，从 `muxed`/`rough` 重 burn |
| storyboard 结构 | `validate` → 上述对应步骤 → `export` |

## Recover 场景（KL52 等）

从已有 `audio/seg*.mp3` 恢复后：

```bash
vep article recover ./project --force
# 人工补全 storyboard.json 每段 narration
vep article timeline ./project
vep article assemble ./project
vep article export ./project --force
```

recover 的 narration 为占位符，export 前必须校对，否则 transcript/decision 中的文案不正确。

## 相关文档

- [article-quickstart.md](./article-quickstart.md) — 模式 B 全流程
- [storyboard-rules.md](./storyboard-rules.md) — 分镜规则
