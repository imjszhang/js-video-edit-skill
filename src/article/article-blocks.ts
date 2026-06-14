export interface ArticleBlock {
  type: "heading" | "paragraph" | "code" | "quote" | "list" | "comparison_hint";
  content: string;
  lines?: string[];
  level?: number;
}

export function parseArticle(md: string): ArticleBlock[] {
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

  if (inCode && codeBuf.length > 0) {
    blocks.push({ type: "code", content: codeBuf.join("\n") });
  }

  return blocks;
}
