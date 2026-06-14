# Storyboard 分镜规则

供 `vep article storyboard` 输出 digest 后，Agent/LLM 生成 `storyboard.json` 时遵循。

## 画布

- 竖屏：**1080 × 1920**，fps 24
- 每段必须有 **`narration`**（TTS + 字幕唯一来源）
- **不要**填写 `duration`（由 `vep article timeline` 从音频实测生成）

## visual_type 选用

| 类型 | 适用场景 | 必填字段 |
|------|----------|----------|
| `hero` | 封面、片尾 | `text`, `narration`；可选 `subtitle`, `badge` |
| `text-card` | 正文段落 | `heading` 或 `body`, `narration` |
| `quote-card` | Markdown `>` 引用 | `quote`, `narration` |
| `code-block` | Markdown 代码块 | `code`, `narration`；可选 `heading` |
| `comparison` | 对比、vs、之前/之后 | `left_title`, `right_title`, `left_items`, `right_items` |
| `step-diagram` | 有序列表 ≥3 项 | `steps`, `narration`；可选 `heading` |
| `ending` | 片尾 CTA | 同 `hero` 字段；**渲染使用 `hero.html` 模板**（非 `ending.html`） |

## 断句规则（竖屏）

- **text-card 正文**：每镜 **60–90 字**（约 2 句），在 `。` `；` `！` `？` 处断开
- **hero**：标题不超过 3 行，每行 ≤ 15 字
- **code-block**：整段代码不拆行
- **step-diagram**：步骤数 3–6 个，每步 ≤ 30 字
- **comparison**：左右各 ≤ 5 条，每条 ≤ 20 字

## 结构模板

1. 第 1 镜：`hero`（封面）
2. 中间：按文章结构交替 `text-card` / `code-block` / `quote-card` 等
3. 最后 1 镜：`ending`（收束/CTA；渲染走 hero 模板）

## --write-template 草稿约定

`vep article storyboard --write-template` 自动生成的草稿包含：

- 封面 `hero` + 最多 5 个正文镜 + 片尾 `ending`
- `code-block` 写 `code` 字段；`step-diagram` 写 `steps`；`comparison` 写左右列表占位

生成后务必人工校对 `narration` 与画面字段，再 `vep article validate`。

## 编辑决策字段

每段建议填写：

```json
{
  "reason": "为什么在这里切、为什么用这个画面",
  "candidates": [
    { "visual_type": "text-card", "reason_rejected": "信息密度太低" }
  ],
  "selected": "code-block"
}
```

## narration vs 画面文字

- `narration`：口语化完整旁白（可更长）
- `text` / `body` / `heading`：画面显示（可精简）
- 两者可以不同，但必须在同一 segment 对象内
