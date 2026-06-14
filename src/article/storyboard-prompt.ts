import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { log } from "../utils.js";

interface ArticleBlock {
  type: "heading" | "paragraph" | "code" | "quote" | "list" | "comparison_hint";
  content: string;
  lines?: string[];
  level?: number;
}

function parseArticle(md: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const lines = md.split("\n");
  let i = 0;
  let inCode = false;
  let codeBuf: string[] = [];

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.startsWith("```")) {
      if (inCode) {
        blocks.push({ type: "code", content: codeBuf.join("\n") });
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      i++;
      continue;
    }

    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }

    if (line.startsWith("#")) {
      const level = line.match(/^#+/)![0].length;
      blocks.push({
        type: "heading",
        content: line.replace(/^#+\s*/, ""),
        level,
      });
      i++;
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) {
        quoteLines.push(lines[i]!.replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", content: quoteLines.join("\n"), lines: quoteLines });
      continue;
    }

    if (/^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && (/^[-*]\s/.test(lines[i]!) || /^\d+\.\s/.test(lines[i]!))) {
        listLines.push(lines[i]!.replace(/^[-*]\s|^\d+\.\s/, ""));
        i++;
      }
      blocks.push({ type: "list", content: listLines.join("\n"), lines: listLines });
      continue;
    }

    if (/vs|对比|之前|之后/i.test(line)) {
      blocks.push({ type: "comparison_hint", content: line });
      i++;
      continue;
    }

    if (line.trim()) {
      blocks.push({ type: "paragraph", content: line.trim() });
    }
    i++;
  }

  return blocks;
}

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

export interface StoryboardPromptOptions {
  writeTemplate?: boolean;
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

  if (opts.writeTemplate) {
    const title =
      blocks.find((b) => b.type === "heading")?.content ?? "视频标题";
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
        ...blocks
          .filter((b) => b.type !== "heading")
          .slice(0, 5)
          .map((b, i) => ({
            id: i + 2,
            visual_type: suggestVisualType(b),
            narration: b.content.slice(0, 200),
            body: b.content.slice(0, 200),
            reason: `Auto-draft from ${b.type} block`,
            selected: suggestVisualType(b),
          })),
      ],
    };

    const outPath = path.join(projectDir, "storyboard.json");
    writeFileSync(outPath, JSON.stringify(template, null, 2) + "\n", "utf-8");
    log.text(`Wrote draft template to ${outPath} (review before pipeline)`);
  }
}
