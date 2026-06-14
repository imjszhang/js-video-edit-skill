---
name: js-video-edit-skill
description: >-
  Text-driven video editing pipeline powered by open-source tools.
  Use when the user wants to edit videos without traditional editing software,
  using code/text-based decisions instead. Covers: Whisper transcription,
  JSON editing decisions, ffmpeg cutting, LUT color grading, Remotion motion graphics,
  and article-to-video conversion (全文视频化).
  Triggered by: "剪辑视频" "video editing" "code-based editing" "用代码剪视频"
  "whisper转录" "ffmpeg剪辑" "remotion" "text-driven editing" "全文视频" "文章转视频"
---

# 视频剪辑 Pipeline

> 不需要打开传统剪辑软件，用代码和文本完成剪辑。

一套基于开源工具的文本驱动视频剪辑工作流。

## 适用场景

### 模式 A：素材剪辑（原始 Pipeline）
- 多段素材需要拼接成片
- 口语化视频（演讲/访谈/vlog）需要挑最佳镜头
- 需要自动去除口头禅（嗯、啊、那个…）
- 需要加字幕/图形/调色
- 预算有限，不想花钱买剪辑 AI

### 模式 B：全文视频化
- 把一篇文章变成带语音+字幕的完整视频
- 适合：公众号文章转视频、知识讲解视频、有声读物
- 核心流程：文章 → storyboard.json（分镜 + narration）→ HTML 画面 → TTS 语音 → timeline 实测 → ffmpeg 合成

---

## 模式 A：素材剪辑 Pipeline

### 技术栈

| 环节 | 工具 | 成本 |
|------|------|------|
| 转录 | Whisper（本地） | $0 |
| 剪辑决策 | LLM 生成 JSON | ~$1 |
| 拼接 | ffmpeg | $0 |
| 调色 | .cube LUT 文件 | $0 |
| 动效 | Remotion（React） | $0 |
| 渲染 | ffmpeg / Remotion render | $0 |

### 工作流程

#### 第 1 步：素材准备
用户把原始视频文件放到指定目录。
- 支持 mp4/mov/mkv 等常见格式
- 建议按场景分文件夹存放

#### 第 2 步：Whisper 转录
```bash
pip install openai-whisper
whisper input.mp4 --model medium --output_format json --output_dir ./transcripts
```

#### 第 3 步：生成剪辑决策 JSON
Agent 读取所有转录文件，根据用户指令生成剪辑决策。

**决策 JSON 格式：**
```json
{
  "scenes": [
    {
      "scene_id": 1,
      "candidates": [
        { "file": "C001.mp4", "reason_rejected": "开头有热身话" },
        { "file": "C003.mp4", "reason_selected": "嗯字为零，结尾干净" }
      ],
      "selected": "C003.mp4",
      "in_point": 0.0,
      "out_point": 45.2
    }
  ]
}
```

#### 第 4 步：ffmpeg 执行剪辑
```bash
ffmpeg -i C003.mp4 -ss 0 -to 45.2 -c copy scene1.mp4
ffmpeg -f concat -safe 0 -i filelist.txt -c copy rough_cut.mp4
```

#### 第 5 步：调色（可选）
```bash
ffmpeg -i rough_cut.mp4 -vf "lut3d=file=log_to_rec709.cube" graded.mp4
```

#### 第 6 步：字幕和动效
```bash
ffmpeg -i graded.mp4 -vf "subtitles=subs.srt" subtitled.mp4
```

#### 第 7 步：最终渲染
```bash
ffmpeg -i graded.mp4 -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 24 -s 3840x2160 -c:a aac -b:a 192k final.mp4
```

---

## 模式 B：全文视频化 Pipeline

> 把文章变成视频，不需要任何视频素材。使用 `vep article` CLI（TypeScript 实现）。

### 核心流程

```
article.md
  → storyboard.json（分镜脚本：画面 + narration + 编辑决策）
    → HTML 模板渲染（7 种布局）
      → 浏览器截图 PNG（JS-Eyes 优先，auto: 探活 js-eyes → openclaw → playwright）
        → edge-tts 生成语音（MP3）
          → silenceremove 剪静音 → timeline.json + subs.ass
            → ffmpeg 合成（画面 + 字幕 + 音频）
              → trimmed/final.mp4
```

### 项目结构

```
project/
├── article.md              # 原始文章
├── storyboard.json         # 分镜脚本（LLM 生成，含 narration）
├── timeline.json           # 时间轴（自动生成，音频权威）
├── subs.ass                # 字幕（自动生成）
├── shot-list.json          # 编辑决策摘要（自动生成）
├── vep.config.json         # 可选配置（voice、screenshotBackend 等）
├── templates/              # HTML 布局模板
├── scenes/                 # 渲染的 HTML + 截图 PNG
├── audio/                  # TTS 语音 MP3
├── trimmed/                # 剪过静音的音频 + 视频
│   ├── rough.mp4           # 无字幕粗剪（模式 A 输入）
│   └── final.mp4           # 烧字幕发布版
└── post/                   # export 生成：decision.json, transcript.json, subs.srt
```

### storyboard.json 格式

```json
{
  "version": 1,
  "title": "视频标题",
  "badge": "可选徽章文字",
  "width": 1080,
  "height": 1920,
  "fps": 24,
  "voice": "zh-CN-YunxiNeural",
  "segments": [
    {
      "id": 1,
      "visual_type": "hero",
      "narration": "旁白全文，TTS 和字幕唯一来源",
      "text": "主标题\n副标题",
      "subtitle": "副标题文字",
      "reason": "封面镜，建立话题",
      "selected": "hero"
    }
  ]
}
```

visual_type 可选值：`hero` | `text-card` | `quote-card` | `code-block` | `comparison` | `step-diagram` | `ending`

> **注意**：`narration` 是 TTS 和字幕的唯一数据源。`duration` 已废弃，时长由 `vep article timeline` 从实测音频生成。

### 执行步骤

```bash
# 初始化项目
vep article init ./project

# 分析文章，生成 digest 供 Agent 写 storyboard.json
vep article storyboard ./project

# 校验 + 端到端合成
vep article validate ./project
vep article pipeline ./project

# 或分步执行
vep article render ./project
vep article screenshot ./project
vep article tts ./project
vep article timeline ./project
vep article assemble ./project
vep article export ./project    # 模式 A 后期交接包（post/）
```

详细指南见 `docs/article-quickstart.md`，分镜规则见 `docs/storyboard-rules.md`，B→A 交接见 `docs/article-to-footage-handoff.md`。

> **Deprecated**：`render.py` / `screenshot.js` / `make_video.py` 已由 `vep article` 命令取代。

### 语音剪枝

`vep article timeline` 内置 silenceremove，剪掉每段 TTS 的间隔停顿（参数见 `vep.config.json`）。

剪完后重跑 `vep article timeline` + `assemble`（assemble 按 timeline 时长从 PNG 生成 clip）。

手动调试示例：

```bash
ffmpeg -i seg01.mp3 -af "silenceremove=start_periods=0:stop_periods=-1:stop_threshold=-50dB:stop_duration=0.2:stop_silence=0.1" -c:a libmp3lame -b:a 128k trimmed/seg01.mp3
```

### 字幕样式（电影风格）

用 ASS 格式，不要用 SRT（Windows 兼容性好）：

```ass
[Script Info]
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,40,40,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.000,0:00:05.498,Default,,0,0,0,,标题文字\N副标题
```

关键参数：
- `Alignment=2` → 底部居中
- `MarginV=100` → 距底部 100px
- `FontSize=48` → 竖屏 1080×1920 适配
- `PrimaryColour=&H00FFFFFF` → 白字
- `OutlineColour=&H00000000` → 黑边
- `BorderStyle=1` → 实线轮廓
- `Bold=-1` → 加粗

### TTS 语音

```bash
vep article tts ./project
# 或指定音色
vep article tts ./project --voice zh-CN-YunxiNeural
```

- 默认语音：`zh-CN-YunxiNeural`（在 `storyboard.json` 或 `vep.config.json` 配置）
- 逐段生成 `audio/segXX.mp3`；旁白 ≥1500 字自动写 `.vep-tmp/*.txt` 调用 edge-tts
- 缺失段在 assemble 时用静音补齐

---

## ⚠️ 踩坑记录（必读）

### 全文视频化（vep article）

| 坑 | 解法 |
|---|---|
| `pipeline --from storyboard --to assemble` 无 `--write-template` | storyboard 步只输出 digest，pipeline 会自动退出；用 `--write-template` 或 `--from render` |
| 音频段数 ≠ PNG 段数（如 8 audio / 5 scene） | `vep article recover` 会 Warning；补截图或合并分镜后再 assemble |
| `--dry-run` 仍报缺 audio | 已修复：dry-run 跳过文件存在检查 |
| TTS 旁白过长（Windows） | ≥1500 字自动写 `.vep-tmp/*.txt` 用 `--file` 调用 edge-tts |
| `--write-template` / `recover` 覆写已有文件 | 默认拒绝；加 `--force`（自动 `.bak` 备份） |
| 合成视频比音频短、尾部旁白被截 | mux 以 `timeline.total_duration` 为准，不用 `-shortest` |
| 模式 A 后期需要无字幕片 | 用 `trimmed/rough.mp4`；`vep article export` 写 `post/decision.json` + `post/transcript.json` |

### Windows / PowerShell

| 坑 | 解法 |
|---|---|
| PowerShell 不支持 `&&` | 用分号 `;` |
| Node ESM 不认 `d:/` 路径 | 用 CommonJS `require()` |
| `shutil.copy2` 文件被占用 | 先 `os.chdir()` 再操作 |
| **禁止用正则批量替换 CSS 中的宽高数值** | 见下方「HTML 模板设计规范」 |

### HTML 模板设计规范

模板位于 `templates/article/`（Neo-brutalist 竖屏风格，参考 Cyber-Taoist 海报体系）。`vep article render` 会注入 `_design-system.css`、本地 Web 字体；**JS LOGO**（`lib/js-logo.svg`）**仅出现在封面 `hero`**，与 badge 同一行（LOGO 在左、标签在右，约 40px），标题单独一行。

**竖屏安全区（1080×1920）：**
- **顶区**：badge（`hero`/`ending`）
- **中部**：`.vep-body` 主内容（`padding-top:112px; padding-bottom:168px`）
- **底部 ~168px**：留给 ASS 烧录字幕，画面不放关键信息

**核心教训 1**：用正则暴力替换所有 CSS width/height，导致小元素（如序号块）被改成画布尺寸，所有模板全坏。

**核心教训 2**：body 用 `min-width/min-height` + flexbox 居中；内容在 `.wrapper` 1080×1920 内。

**核心教训 3**：横屏 PPT 思维在竖屏上内容使用率极低。必须专为竖屏设计：大字 + 填满宽度。

**字体**：Space Grotesk（标题/正文）+ JetBrains Mono（标签/终端）；字幕仍用 ASS 微软雅黑。

**竖屏设计规则（TikTok 向）：**
1. 画面字短于旁白；底区 168px padding 留给 ASS（默认 `subtitleFontSize: 54`, `marginV: 115`）
2. 封面 `hero`：JS LOGO 与 badge 横排（非全镜水印）；无中文 global uppercase
3. `quote-card` / `ending` 使用黄底反色 `.vep-invert` 冲击镜
4. comparison 右列强化、左列弱化；每侧 storyboard ≤2 条
5. 截图校验：左对齐镜（hero/text-card/quote/ending）查 **宽度使用率 ≥55%**；居中镜查 **h_offset < ±20px**

### ffmpeg 字幕烧录（Windows 必踩）

**问题**：`-vf "subtitles='D:/path/subs.srt'"` → `Invalid argument`

**根因**：Windows 下 ffmpeg 的 subtitles/ass 过滤器把 `D:` 当成参数分隔符解析。

**解法**：
1. 把 SRT/ASS 文件和视频文件放到**同一目录**
2. ffmpeg 命令**切到该目录**执行
3. 用**相对路径**引用字幕文件：`-vf "ass=subs.ass"`

### 音频容器

| 问题 | 解法 |
|---|---|
| AAC 不能写入 `.mp3` | 用 `.m4a` 容器，再转码为 `.mp3` |
| 缺失场景无 TTS | 用 `anullsrc` 生成静音音频补齐 |
| concat 不同采样率 MP3 | 最终统一重采样到 44.1kHz stereo |

### ASS 字幕烧录（Windows 坑位补充）

**问题**：`-vf "ass=subs.ass:OriginalSize=1"` → 报错

**根因**：Windows 下 ffmpeg 的 ass 过滤器不支持 `OriginalSize` 参数。

**解法**：去掉 `OriginalSize=1`，直接使用 `-vf "ass=subs.ass"` 即可。

### 语音时长

- **不要**在 `storyboard.json` 填写 `duration`；时长由 `vep article timeline` 从实测音频生成
- assemble 按 `timeline.total_duration` 生成各场景 clip 并 mux
- 修改旁白或重跑 TTS 后，重跑 `vep article timeline` + `assemble`

### 飞书兼容

| 坑 | 解法 |
|---|---|
| 媒体上传只认 workspace 目录 | 复制到 workspace 目录再发 |
| 飞书播放器可能丢音频 | 用 H.264 + AAC 44.1kHz stereo + `-movflags +faststart` |

---

## 快捷命令

### 素材剪辑模式
```
素材在 ./raw/ 目录下。
请转录所有素材，选出每个场景最好的镜头，
生成剪辑决策 JSON，用 ffmpeg 拼接成片。
```

### 全文视频化模式
```
文章在 article.md，项目目录 ./project。
请运行 vep article storyboard ./project 获取 digest，
生成 storyboard.json 后执行 vep article pipeline ./project。
需要模式 A 后期时追加：vep article export ./project
（详见 docs/article-to-footage-handoff.md）
```

---

## 🚀 执行方式推荐

### 全文视频化模式：使用 subagent 隔离执行

**强烈建议**：全文视频化的完整流程（渲染→截图→TTS→合成）使用 `sessions_spawn` 派发给 subagent 执行。

**原因：**
1. **流程长**：20 个场景 ×（渲染+截图+音频），主会话容易超时
2. **外部依赖**：浏览器截图（OpenClaw/Playwright）可能挂起，subagent 隔离不影响主会话
3. **可并行**：截图阶段可多 tab 并行，subagent 更适合
4. **清理方便**：subagent 完成后自动清理临时会话

**执行简报模板：**
```
执行全文视频化 pipeline，项目目录：D:/path/to/project

步骤：
vep article pipeline D:/path/to/project

或分步：
1. vep article render → HTML
2. vep article screenshot → PNG（auto: 探活 js-eyes → openclaw → playwright；显式 `--backend js-eyes` 不 fallback）
3. vep article tts → edge-tts MP3
4. vep article timeline → timeline.json + subs.ass
5. vep article assemble → trimmed/final.mp4

要求：
- 截图后用 sharp 验证居中：h_offset < ±20px
- 字幕用 ASS 格式，PlayResX=1080
- 最终视频输出到 project/trimmed/final.mp4
```

### 素材剪辑模式：可直接在主会话执行

模式 A 的各步骤相对独立，可直接在主会话中逐步执行，不需要 subagent。

---

## 📦 项目初始化指南（模式 B）

```bash
vep article init ./project
```

编辑 `project/article.md`，然后：

```bash
vep article storyboard ./project              # stdout digest → Agent 生成 storyboard.json
vep article storyboard ./project --write-template   # 或写出初稿（已有文件需 --force）
vep article validate ./project
vep article pipeline ./project
```

`init` 会创建：`article.md`、`storyboard.json`（模板）、`templates/`（7 种竖屏 HTML）、`vep.config.json`、`scenes/`、`audio/`、`trimmed/`。

详细步骤见 `docs/article-quickstart.md`，分镜规则见 `docs/storyboard-rules.md`。
