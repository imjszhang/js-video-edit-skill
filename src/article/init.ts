import { cpSync, existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ensureDir, log } from "../utils.js";
import { writeDefaultVepConfig, PROJECT_DIRS } from "./config.js";
import { loadStoryboard, validateSegmentFields } from "./storyboard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "../..");
const BUNDLED_TEMPLATES = path.join(SKILL_ROOT, "templates", "article");

const DEFAULT_STORYBOARD = {
  version: 1,
  title: "视频标题",
  badge: "",
  width: 1080,
  height: 1920,
  fps: 24,
  voice: "zh-CN-YunxiNeural",
  segments: [
    {
      id: 1,
      visual_type: "hero",
      narration: "在这里填写旁白全文，用于 TTS 和字幕。",
      text: "主标题\n副标题",
      subtitle: "副标题文字",
      reason: "封面镜，建立话题",
      selected: "hero",
    },
  ],
};

const DEFAULT_ARTICLE = `# 文章标题

在这里撰写文章内容。完成后运行：

\`\`\`bash
vep article storyboard ./project
# Agent 根据输出生成 storyboard.json
vep article validate ./project
vep article pipeline ./project
\`\`\`
`;

export function runArticleInit(projectDir: string, force = false): void {
  ensureDir(projectDir);

  for (const dir of PROJECT_DIRS) {
    ensureDir(path.join(projectDir, dir));
  }

  const articlePath = path.join(projectDir, "article.md");
  if (!existsSync(articlePath) || force) {
    writeFileSync(articlePath, DEFAULT_ARTICLE, "utf-8");
    log.text(`Created ${articlePath}`);
  }

  const storyboardPath = path.join(projectDir, "storyboard.json");
  if (!existsSync(storyboardPath) || force) {
    writeFileSync(storyboardPath, JSON.stringify(DEFAULT_STORYBOARD, null, 2) + "\n", "utf-8");
    log.text(`Created ${storyboardPath}`);
  }

  const templatesDest = path.join(projectDir, "templates");
  if (!existsSync(templatesDest) || force) {
    if (!existsSync(BUNDLED_TEMPLATES)) {
      log.error(`Bundled templates not found at ${BUNDLED_TEMPLATES}`);
      process.exit(1);
    }
    mkdirSync(templatesDest, { recursive: true });
    cpSync(BUNDLED_TEMPLATES, templatesDest, { recursive: true });
    log.text(`Copied templates to ${templatesDest}`);
  }

  writeDefaultVepConfig(projectDir);
  log.scene(`Article project initialized at ${projectDir}`);
}

export interface ValidateOptions {
  storyboardFile?: string;
  strict?: boolean;
}

export function runArticleValidate(
  projectDir: string,
  opts: ValidateOptions = {}
): void {
  const sbPath = opts.storyboardFile ?? path.join(projectDir, "storyboard.json");

  const sb = loadStoryboard(projectDir, sbPath);
  const warnings: string[] = [];

  for (const seg of sb.segments) {
    warnings.push(...validateSegmentFields(seg));
  }

  if (warnings.length > 0) {
    for (const w of warnings) log.text(`Warning: ${w}`);
    if (opts.strict) {
      log.error(`Validation failed with ${warnings.length} warning(s) (--strict)`);
      process.exit(1);
    }
  }

  log.scene(`storyboard.json valid — ${sb.segments.length} segment(s)`);
}
