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
- 核心流程：文章 → 分段脚本 → HTML 画面 → TTS 语音 → 静音剪枝 → ffmpeg 合成

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

> 把文章变成视频，不需要任何视频素材。

### 核心流程

```
article.md
  → script.json（分段脚本，定义每段画面+文字+时长）
    → HTML 模板渲染（6 种布局）
      → JS-Eyes 浏览器截图（PNG）
        → edge-tts 生成语音（MP3）
          → ffmpeg silenceremove 剪掉静音间隔
            → ffmpeg 合成（画面 + 字幕 + 音频）
              → final.mp4
```

### 项目结构

```
project/
├── article.md              # 原始文章
├── script.json             # 分段脚本（LLM 生成）
├── templates/              # HTML 布局模板
│   ├── hero.html           # 封面/标题页
│   ├── text-card.html      # 纯文字卡片
│   ├── quote-card.html     # 引用卡片
│   ├── code-block.html     # 代码块卡片
│   ├── comparison.html     # 对比卡片
│   └── step-diagram.html   # 步骤列表
├── scenes/                 # 渲染的 HTML + 截图 PNG
├── audio/                  # TTS 语音 MP3
├── trimmed/                # 剪过静音的音频 + 最终视频
├── render.py               # HTML 模板渲染（Python）
├── screenshot.js           # JS-Eyes 浏览器截图
└── make_video.py           # 完整合成脚本
```

### script.json 格式

```json
{
  "title": "视频标题",
  "badge": "可选徽章文字",
  "width": 1080,
  "height": 1920,
  "fps": 24,
  "segments": [
    {
      "id": 1,
      "visual_type": "hero",
      "text": "主标题\n副标题",
      "subtitle": "副标题文字",
      "duration": 5
    },
    {
      "id": 2,
      "visual_type": "text-card",
      "heading": "卡片标题",
      "body": "正文内容。\n支持换行。",
      "duration": 6
    }
  ]
}
```

visual_type 可选值：`hero` | `text-card` | `quote-card` | `code-block` | `comparison` | `step-diagram` | `ending`

> **注意**：`badge` 字段控制封面页左上角标签，不传则不显示。不要再硬编码。

### 执行步骤

```bash
# 1. 渲染 HTML 场景
python render.py

# 2. JS-Eyes 截图（需要 Firefox + JS-Eyes 扩展运行中）
node screenshot.js

# 3. 生成 TTS 语音 + 完整合成
python make_video.py
```

### 语音剪枝

用 ffmpeg silenceremove 剪掉每段 TTS 的间隔停顿，通常可剪掉 ~19% 冗余时长：

```bash
ffmpeg -i seg01.mp3 -af "silenceremove=start_periods=0:stop_periods=-1:stop_threshold=-50dB:stop_duration=0.2:stop_silence=0.1" -c:a libmp3lame -b:a 128k trimmed/seg01.mp3
```

剪完后必须重新生成视频片段和字幕时间轴。

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

```python
import edge_tts
comm = edge_tts.Communicate(text, 'zh-CN-YunxiNeural')
await comm.save('output.mp3')
```

- 语音：`zh-CN-YunxiNeural`（中文男声，自然流畅）
- 逐段生成 MP3，再 concat 拼接
- 缺失段用静音补齐（否则 `-shortest` 会截断）

---

## ⚠️ 踩坑记录（必读）

### Windows / PowerShell

| 坑 | 解法 |
|---|---|
| PowerShell 不支持 `&&` | 用分号 `;` |
| Node ESM 不认 `d:/` 路径 | 用 CommonJS `require()` |
| `shutil.copy2` 文件被占用 | 先 `os.chdir()` 再操作 |
| **禁止用正则批量替换 CSS 中的宽高数值** | 见下方「HTML 模板设计规范」 |

### HTML 模板设计规范

**核心教训 1**：用正则暴力替换所有 CSS width/height，导致小元素（如 40px 序号）被改成画布尺寸，所有模板全坏。

**核心教训 2**：body 设 `width:1080px; height:1920px` 在 Firefox 里**不居中**——Firefox 视口比 1080px 宽，body 默认左对齐。

**核心教训 3**：横屏 PPT 思维在竖屏上内容使用率极低（hero 仅 16%W×20%H）。必须专为竖屏设计：大字 + 填满宽度。

**竖屏 HTML 模板标准结构：**
```css
/* body 用 min-width/min-height + flexbox 居中，不要用固定 width/height */
body{min-width:1080px;min-height:1920px;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}
/* 内容放在 .wrapper 里，确保 1080x1920 画布居中 */
.wrapper{width:1080px;height:1920px;position:relative;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center}
/* 网格背景 */
.grid{position:absolute;inset:0;background-size:50px 50px}
/* 容器填满宽度，不要用 max-width 限制 */
.card{padding:55px 50px;width:100%}
```

**竖屏内容使用率标准：**

| 元素 | 字号 | 目标使用率 |
|------|------|----------|
| 标题（hero） | 60-72px（根据行数动态） | 宽度 30%+, 高度 25%+ |
| 卡片标题 | 52-60px | 宽度 80%+ |
| 正文 | 36-44px | 高度 50%+ |
| 代码 | 26-28px | 宽度 80%+ |
| 列表项 | 32-34px | 宽度 80%+ |

**竖屏设计规则：**
1. 标题 60-72px，正文 36-44px（比横屏大 40-60%）
2. 容器宽度 100%（不要用 max-width 限制）
3. comparison 用**上下堆叠**（竖屏左右太挤）
4. step-diagram 用 `display:flex` 让步骤项填满宽度
5. 上下 padding 50-70px，减少留白
6. 截图验证：内容 h_offset < ±20px，宽度使用率 > 30%

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

- TTS 实际时长远超 script.json 的 duration 估算
- **必须按实际语音时长生成各场景视频**
- 用 silenceremove 剪掉停顿后，**必须重新生成所有视频片段和字幕时间轴**

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
文章在 article.md。
请生成分段脚本 script.json，用 6 种 HTML 模板渲染画面，
JS-Eyes 截图，edge-tts 生成语音，剪掉静音间隔，
最终合成带语音+字幕的视频。
```

---

## 🚀 执行方式推荐

### 全文视频化模式：使用 subagent 隔离执行

**强烈建议**：全文视频化的完整流程（渲染→截图→TTS→合成）使用 `sessions_spawn` 派发给 subagent 执行。

**原因：**
1. **流程长**：20 个场景 ×（渲染+截图+音频），主会话容易超时
2. **外部依赖**：JS-Eyes Firefox 截图可能挂起，subagent 隔离不影响主会话
3. **可并行**：截图阶段可多 tab 并行，subagent 更适合
4. **清理方便**：subagent 完成后自动清理临时会话

**执行简报模板：**
```
执行全文视频化 pipeline，项目目录：D:/path/to/project

步骤：
1. python render.py → 渲染 HTML
2. node screenshot.js → JS-Eyes 截图
3. 对每个 seg 生成 TTS → ffmpeg silenceremove 剪枝
4. ffmpeg 合成：画面 + 字幕 + 音频

要求：
- 截图后用 Python 验证居中：h_offset < ±20px
- 字幕用 ASS 格式，PlayResX=1080
- 最终视频输出到 project/trimmed/final.mp4
- 复制到 workspace 目录以便发送
```

### 素材剪辑模式：可直接在主会话执行

模式 A 的各步骤相对独立，可直接在主会话中逐步执行，不需要 subagent。

---

## 📦 项目初始化指南

### 从零创建全文视频化项目

#### 第 1 步：创建目录结构
```bash
mkdir -p project/{templates,scenes,trimmed}
```

#### 第 2 步：创建 6 个 HTML 模板
在 `project/templates/` 下创建以下文件（具体 CSS 见「HTML 模板设计规范」一节）：
- hero.html, text-card.html, quote-card.html, code-block.html, comparison.html, step-diagram.html

**关键**：所有模板必须使用竖屏标准结构（见上方规范）。

#### 第 3 步：创建 script.json
```json
{
  "title": "视频标题",
  "badge": "可选徽章",
  "width": 1080,
  "height": 1920,
  "fps": 24,
  "segments": [
    {
      "id": 1,
      "visual_type": "hero",
      "text": "标题文字",
      "subtitle": "副标题",
      "duration": 5
    }
  ]
}
```

#### 第 4 步：创建 render.py、screenshot.js 和 make_video.py
见下方「附录：完整脚本代码」。

---

## 附录：完整脚本代码

### render.py

```python
import json, os, re

DIR = r'你的项目路径'  # 修改为实际路径
TEMPLATES_DIR = os.path.join(DIR, 'templates')
SCENES_DIR = os.path.join(DIR, 'scenes')
os.makedirs(SCENES_DIR, exist_ok=True)

templates = {}
for fname in sorted(os.listdir(TEMPLATES_DIR)):
    if not fname.endswith('.html'): continue
    with open(os.path.join(TEMPLATES_DIR, fname), 'r', encoding='utf-8') as f:
        templates[os.path.splitext(fname)[0]] = f.read()

with open(os.path.join(DIR, 'script.json'), 'r', encoding='utf-8') as f:
    script = json.load(f)

def render(template, data):
    html = template
    html = re.sub(r'\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}', lambda m: m.group(2) if data.get(m.group(1)) else '', html)
    html = re.sub(r'\{\{\{(\w+)\}\}\}', lambda m: str(data.get(m.group(1), '')), html)
    html = re.sub(r'\{\{(\w+)\}\}', lambda m: str(data.get(m.group(1), '')), html)
    return html

def esc(s):
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

for seg in script['segments']:
    tname = seg.get('visual_type', 'text-card')
    if tname == 'ending': tname = 'hero'
    if tname not in templates: tname = 'text-card'
    template = templates[tname]
    
    if tname == 'hero':
        lines = (seg.get('text', '') or '').split('\n')
        ts = 90 if len(lines) > 2 else (110 if len(lines) > 1 else 130)
        html = render(template, {
            'badge': seg.get('badge', script.get('badge', '')),
            'title': (seg.get('text', '') or '').replace('\n', '<br>'),
            'titleSize': ts,
            'subtitle': seg.get('subtitle', '')
        })
    elif tname == 'text-card':
        html = render(template, {
            'heading': seg.get('heading', ''),
            'body': (seg.get('body', '') or '').replace('\n', '<br>')
        })
    elif tname == 'quote-card':
        html = render(template, {
            'quote': (seg.get('quote', '') or '').replace('\n', '<br>'),
            'author': seg.get('author', '')
        })
    elif tname == 'code-block':
        html = render(template, {
            'heading': seg.get('heading', ''),
            'code': esc(seg.get('code', '')).replace('\n', '<br>')
        })
    elif tname == 'comparison':
        li = ''.join(f'<li>{i}</li>' for i in (seg.get('left_items') or []))
        ri = ''.join(f'<li>{i}</li>' for i in (seg.get('right_items') or []))
        html = render(template, {
            'heading': seg.get('heading', ''),
            'left_title': seg.get('left_title', ''),
            'left_items': li,
            'right_title': seg.get('right_title', ''),
            'right_items': ri
        })
    elif tname == 'step-diagram':
        sh = ''.join(f'<div class="step"><span class="step-num">{i+1}</span><span class="step-text">{s}</span></div>'
                     for i, s in enumerate(seg.get('steps') or []))
        html = render(template, {
            'heading': seg.get('heading', ''),
            'steps': sh
        })
    else:
        html = render(templates['text-card'], {
            'heading': seg.get('heading', seg.get('text', '')),
            'body': (seg.get('body', '') or '').replace('\n', '<br>')
        })
    
    out = os.path.join(SCENES_DIR, f"scene{seg['id']:02d}.html")
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'Rendered scene {seg["id"]:02d} ({tname})')

print(f'\nDone! {len(script["segments"])} scenes rendered')
```

### screenshot.js

```javascript
const { BrowserAutomation } = require('<path-to-js-eyes>/skills/js-browser-ops-skill/lib/js-eyes-client.js');
const fs = require('fs');
const http = require('http');
const pathMod = require('path');

const DIR = 'D:\\path\\to\\project';  // 修改为你的项目路径
const SCENES_DIR = pathMod.join(DIR, 'scenes');
const PORT = 18998;

const server = http.createServer((req, res) => {
  const fileName = req.url.split('?')[0].split('/').pop();
  const filePath = pathMod.join(SCENES_DIR, fileName);
  const ext = pathMod.extname(fileName);
  if (fs.existsSync(filePath)) {
    res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html;charset=utf-8' : 'image/png' });
    fs.createReadStream(filePath).pipe(res);
  } else { res.writeHead(404); res.end('404'); }
});

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  const files = fs.readdirSync(SCENES_DIR).filter(f => f.endsWith('.html')).sort();
  const bot = new BrowserAutomation('ws://localhost:18080');
  await bot.connect();

  for (const file of files) {
    const num = file.replace('scene', '').replace('.html', '');
    const url = `http://localhost:${PORT}/${file}`;
    const tabId = await bot.openUrl(url);
    await new Promise(r => setTimeout(r, 3000));

    const result = await bot.captureScreenshot(tabId, {
      fullPage: true,  // 必须 true，否则只截视口
      format: 'png',
      timeout: 120,
    });

    const buf = Buffer.from(result.dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(pathMod.join(SCENES_DIR, `scene${num}.png`), buf);
    await bot.closeTab(tabId);
    await new Promise(r => setTimeout(r, 300));
  }

  bot.disconnect();
  server.close();
  console.log(`All ${files.length} screenshots done!`);
}
main().catch(err => { console.error('Error:', err.message); server?.close(); process.exit(1); });
```

### 居中验证脚本（Python）

截图后运行，确保内容居中：
```python
from PIL import Image; import numpy as np
for f in ['scene01.png','scene05.png','scene09.png']:
    img=Image.open(f'scenes/{f}').convert('L'); arr=np.array(img); h,w=arr.shape
    cm=arr.mean(axis=0); rm=arr.mean(axis=1)
    l=next((i for i in range(w) if cm[i]>20),0); r=next((w-1-i for i in range(w) if cm[w-1-i]>20),w-1)
    t=next((i for i in range(h) if rm[i]>20),0); b=next((h-1-i for i in range(h) if rm[h-1-i]>20),h-1)
    ho=((l+r)/2-w/2); vo=((t+b)/2-h/2)
    print(f'{f}: h_offset={ho:+.0f}px, v_offset={vo:+.0f}px, usage={(r-l)/w*100:.0f}%W x {(b-t)/h*100:.0f}%H')
```

合格标准：`h_offset < ±20px`，宽度使用率 `> 30%`。
