# Article-to-Video Quickstart

把一篇文章变成带语音、字幕、画面的竖屏视频。

## 前置依赖

```bash
# Node.js >= 18
npm install

# ffmpeg / ffprobe
ffmpeg -version

# TTS
pip install edge-tts

# 截图（可选，render 之后需要）
# JS-Eyes Firefox 扩展运行在 ws://localhost:18080
```

## 1. 初始化项目

```bash
vep article init ./my-video-project
```

编辑 `my-video-project/article.md` 撰写文章。

## 2. 生成分镜（Agent 辅助）

```bash
vep article storyboard ./my-video-project
```

将 stdout 的 digest JSON 交给 Agent，按 [storyboard-rules.md](./storyboard-rules.md) 生成 `storyboard.json`。

或写出初稿：

```bash
vep article storyboard ./my-video-project --write-template
```

校验：

```bash
vep article validate ./my-video-project
```

## 3. 端到端合成

```bash
vep article pipeline ./my-video-project
```

默认执行 `render → screenshot → tts → timeline → assemble`。

### 分步执行

```bash
vep article render ./my-video-project
vep article screenshot ./my-video-project
vep article tts ./my-video-project
vep article timeline ./my-video-project
vep article assemble ./my-video-project
```

### 续跑

```bash
vep article pipeline ./my-video-project --from timeline --to assemble
```

跳过已有步骤：

```bash
vep article pipeline ./my-video-project --skip-tts
```

## 4. 产出文件

| 文件 | 说明 |
|------|------|
| `storyboard.json` | 创作意图（人工/LLM 维护） |
| `timeline.json` | 音频权威时间轴（自动生成） |
| `subs.ass` | 字幕文件（可单独调整） |
| `shot-list.json` | 编辑决策摘要 |
| `trimmed/final.mp4` | 最终视频 |

## 5. 从存量素材恢复

若已有 `audio/seg*.mp3` 和 `scenes/scene*.png`：

```bash
vep article recover ./my-video-project
# 校对 storyboard.json 中的 narration
vep article timeline ./my-video-project
vep article assemble ./my-video-project
```

## Agent Prompt 模板

```
阅读 docs/storyboard-rules.md 和以下 article digest，
生成完整的 storyboard.json 写入项目目录。

要求：
- 每段必须有 narration、visual_type、reason、selected
- 不要包含 duration 字段
- 竖屏 1080x1920，封面 hero + 片尾 ending
```
