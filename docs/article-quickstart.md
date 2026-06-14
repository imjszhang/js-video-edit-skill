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

# 截图（render 之后需要）
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

> **注意**：`--write-template` 会写入 `storyboard.json`。若文件已存在，必须加 `--force`（自动备份为 `storyboard.json.bak`）。

校验：

```bash
vep article validate ./my-video-project
vep article validate ./my-video-project --strict   # CI：有 warning 则 exit 1
```

## 3. 端到端合成

已有 `storyboard.json` 时（推荐入口）：

```bash
vep article pipeline ./my-video-project
```

默认执行 `render → screenshot → tts → timeline → assemble`（`--from render`）。

### storyboard 步骤说明

`storyboard` 步只向 stdout 输出 digest，**不会**自动更新 `storyboard.json`：

```bash
# 仅生成 digest（pipeline 在此停止，除非加了 --write-template）
vep article pipeline ./project --from storyboard --to storyboard

# 写出初稿 storyboard.json 后可继续全流程
vep article pipeline ./project --from storyboard --write-template
```

**不要**在无 `--write-template` 时执行 `--from storyboard --to assemble`，pipeline 会退出并提示。

### 预览（dry-run）

全局 `--dry-run` 打印计划步骤，不写盘（timeline/assemble 跳过缺 audio/PNG 检查）：

```bash
vep --dry-run article pipeline ./my-video-project
vep --dry-run article render ./my-video-project
vep --dry-run article screenshot ./my-video-project
vep --dry-run article tts ./my-video-project
vep --dry-run article timeline ./my-video-project
vep --dry-run article assemble ./my-video-project
vep --dry-run article recover ./my-video-project
```

### 分步执行

```bash
vep article render ./my-video-project
vep article screenshot ./my-video-project
vep article tts ./my-video-project
vep article timeline ./my-video-project
vep article assemble ./my-video-project
```

### 续跑与跳过

```bash
vep article pipeline ./my-video-project --from timeline --to assemble
vep article pipeline ./my-video-project --skip-tts
vep article pipeline ./my-video-project --skip-screenshot
vep article timeline ./my-video-project --skip-trim   # 使用已有 trimmed/，跳过 silenceremove
```

### 部分 TTS

```bash
vep article tts ./project --from-id 3 --to-id 5
```

部分 TTS 后，`timeline` 仍要求 storyboard 中**每一镜**都有对应 `audio/segXX.mp3`，否则失败。续跑前请保证其余段的 audio 已存在。

### CLI 选项速查

| 选项 | 命令 | 说明 |
|------|------|------|
| `--dry-run` | 全局 | 预览步骤，不写盘 |
| `--force` | `init`, `storyboard --write-template`, `recover`, `pipeline` | 覆写已有文件 |
| `--storyboard <file>` | `render`, `tts`, `timeline`, `validate` | 自定义分镜路径 |
| `--from-id` / `--to-id` | `tts` | 分段合成范围 |
| `--skip-trim` | `timeline` | 跳过 silenceremove |
| `--skip-screenshot` | `pipeline` | 跳过截图 |
| `--port` / `--tab-delay` / `--retries` | `screenshot` | JS-Eyes 截图参数 |

`vep.config.json` 可覆盖 TTS 音色、分辨率、silenceremove 阈值、截图端口等（存在时优先于 `storyboard.json` 的同名字段）。

## 4. 产出文件

| 文件 | 说明 |
|------|------|
| `storyboard.json` | 创作意图（人工/LLM 维护） |
| `timeline.json` | 音频权威时间轴（自动生成） |
| `subs.ass` | 字幕文件（可单独调整；重跑 timeline 会覆盖） |
| `shot-list.json` | 编辑决策摘要 |
| `trimmed/final.mp4` | 最终视频 |

## 5. 从存量素材恢复

若已有 `audio/seg*.mp3` 和/或 `scenes/scene*.png`：

```bash
vep --dry-run article recover ./my-video-project   # 预览 JSON，不写盘
vep article recover ./my-video-project             # 生成 storyboard + timeline（占位 narration）
# 若已存在 storyboard/timeline，需 --force
```

recover 会检测段数不一致（如 8 段音频 / 5 张画面），区分 missing PNG 与 orphan PNG。

**恢复后必做：**

1. 校对 `storyboard.json` 中每段 `narration`（recover 仅为占位符）
2. 处理段数不一致：补截图、删 orphan PNG、或合并 storyboard 分镜
3. `vep article timeline ./my-video-project`
4. `vep article assemble ./my-video-project`

## Agent Prompt 模板

```
阅读 docs/storyboard-rules.md 和以下 article digest，
生成完整的 storyboard.json 写入项目目录。

要求：
- 每段必须有 narration、visual_type、reason、selected
- 不要包含 duration 字段
- 竖屏 1080x1920，封面 hero + 片尾 ending
```

参考示例：[examples/storyboard.json](../examples/storyboard.json)
