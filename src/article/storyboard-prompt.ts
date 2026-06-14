import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import path from "path";
import { log } from "../utils.js";
import type { ArticleBlock } from "./article-blocks.js";

export { parseArticle, type ArticleBlock } from "./article-blocks.js";
import { parseArticle } from "./article-blocks.js";

function estimateSegments(blocks: ArticleBlock[]): number {
  let count = 2; // hero + ending
  for (const b of blocks) {
    if (b.type === "code") count += 1;
    else if (b.type === "quote") count += 1;
    else if (b.type === "list" && (b.lines?.length ?? 0) >= 3) count += 1;
    else if (b.type === "comparison_hint") count += 1;
    else if (b.type === "paragraph") {
      const chars = b.content.length;
      count += Math.max(1, Math.ceil(chars / 80));
    }
  }
  return count;
}

function suggestVisualType(block: ArticleBlock): string {
  switch (block.type) {
    case "code":
      return "code-block";
    case "quote":
      return "quote-card";
    case "list":
      return (block.lines?.length ?? 0) >= 3 ? "step-diagram" : "text-card";
    case "comparison_hint":
      return "comparison";
    case "heading":
      return "text-card";
    default:
      return "text-card";
  }
}

function buildDraftSegment(
  block: ArticleBlock,
  id: number
): Record<string, unknown> {
  const vt = suggestVisualType(block);
  const narration = block.content.slice(0, 200);
  const base = {
    id,
    visual_type: vt,
    narration,
    reason: `Auto-draft from ${block.type} block`,
    selected: vt,
  };

  switch (vt) {
    case "code-block":
      return { ...base, heading: "代码", code: block.content };
    case "quote-card":
      return { ...base, quote: block.content };
    case "step-diagram":
      return {
        ...base,
        heading: "步骤",
        steps: block.lines ?? [block.content],
      };
    case "comparison":
      return {
        ...base,
        heading: "对比",
        left_title: "之前",
        left_items: ["待填写"],
        right_title: "之后",
        right_items: ["待填写"],
      };
    case "text-card":
      return {
        ...base,
        heading: block.type === "heading" ? block.content : block.content.slice(0, 40),
        body: block.type === "heading" ? "" : block.content.slice(0, 200),
      };
    default:
      return { ...base, body: block.content.slice(0, 200) };
  }
}

export interface StoryboardPromptOptions {
  writeTemplate?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

export function runArticleStoryboard(
  projectDir: string,
  opts: StoryboardPromptOptions = {}
): void {
  const articlePath = path.join(projectDir, "article.md");
  if (!existsSync(articlePath)) {
    log.error(`article.md not found at ${articlePath}`);
    process.exit(1);
  }

  const md = readFileSync(articlePath, "utf-8");
  const blocks = parseArticle(md);
  const estimated = estimateSegments(blocks);

  const digest = {
    project_dir: projectDir,
    article_chars: md.length,
    block_count: blocks.length,
    estimated_segments: estimated,
    rules_doc: "docs/storyboard-rules.md",
    blocks: blocks.map((b, i) => ({
      index: i,
      type: b.type,
      preview: b.content.slice(0, 120),
      suggested_visual_type: suggestVisualType(b),
      char_count: b.content.length,
    })),
    instructions:
      "Use this digest to generate storyboard.json. Each segment needs: id, visual_type, narration (TTS+subs), visual fields, reason, selected. Do NOT include duration.",
  };

  console.log(JSON.stringify(digest, null, 2));
  log.scene("Digest printed to stdout — pipe to LLM/Agent to generate storyboard.json");

  if (!opts.writeTemplate) return;

  const title =
    blocks.find((b) => b.type === "heading")?.content ?? "视频标题";
  const bodyBlocks = blocks.filter((b) => b.type !== "heading").slice(0, 5);
  const contentSegments = bodyBlocks.map((b, i) => buildDraftSegment(b, i + 2));

  const template = {
    version: 1,
    title,
    badge: "",
    width: 1080,
    height: 1920,
    fps: 24,
    voice: "zh-CN-YunxiNeural",
    segments: [
      {
        id: 1,
        visual_type: "hero",
        narration: "TODO: 封面旁白",
        text: title,
        subtitle: "副标题",
        reason: "封面镜",
        selected: "hero",
      },
      ...contentSegments,
      {
        id: contentSegments.length + 2,
        visual_type: "ending",
        narration: "TODO: 片尾旁白",
        text: "感谢观看",
        subtitle: "",
        reason: "片尾镜",
        selected: "ending",
      },
    ],
  };

  const outPath = path.join(projectDir, "storyboard.json");

  if (existsSync(outPath) && !opts.force) {
    log.error(
      `storyboard.json already exists at ${outPath}. Use --force to overwrite.`
    );
    process.exit(1);
  }

  if (opts.dryRun) {
    log.text(`[dry-run] would write draft storyboard to ${outPath}`);
    log.text(`[dry-run] ${template.segments.length} segment(s)`);
    return;
  }

  if (existsSync(outPath) && opts.force) {
    copyFileSync(outPath, `${outPath}.bak`);
    log.text(`Backed up existing storyboard to ${outPath}.bak`);
  }

  writeFileSync(outPath, JSON.stringify(template, null, 2) + "\n", "utf-8");
  log.text(`Wrote draft template to ${outPath} (review before pipeline)`);
}
