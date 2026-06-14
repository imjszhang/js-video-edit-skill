import {
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  cpSync,
} from "fs";
import path from "path";
import { ensureDir, log } from "../utils.js";
import { BUNDLED_JS_LOGO, BUNDLED_TEMPLATES } from "../skill-root.js";
import { loadStoryboard } from "./storyboard.js";
import type { Storyboard, StoryboardSegment, VisualType } from "./types.js";
import { parseSegmentId, sceneHtmlName } from "./segment-files.js";

const GRID_ON_TYPES: VisualType[] = ["comparison", "code-block"];
const STAT_LINE_RE = /\d|%|★|\$|万|K|k|min|upvote|押注|播放/i;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTemplate(template: string, data: Record<string, unknown>): string {
  let html = template;
  for (let i = 0; i < 4; i++) {
    const next = html.replace(
      /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      (_, key: string, block: string) => (data[key] ? block : "")
    );
    if (next === html) break;
    html = next;
  }
  html = html.replace(/\{\{\{(\w+)\}\}\}/g, (_, key: string) =>
    String(data[key] ?? "")
  );
  html = html.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(data[key] ?? "")
  );
  return html;
}

function loadTemplates(templatesDir: string): Record<string, string> {
  const templates: Record<string, string> = {};
  if (!existsSync(templatesDir)) {
    throw new Error(`Templates directory not found: ${templatesDir}`);
  }
  for (const fname of readdirSync(templatesDir).sort()) {
    if (!fname.endsWith(".html")) continue;
    if (fname.startsWith("_")) continue;
    templates[path.parse(fname).name] = readFileSync(
      path.join(templatesDir, fname),
      "utf-8"
    );
  }
  return templates;
}

interface BundledAssets {
  designCss: string;
  jsLogoSvg: string;
}

function resolveBundledAssets(projectTemplatesDir: string): BundledAssets {
  const designPath = path.join(projectTemplatesDir, "_design-system.css");
  const logoPath = existsSync(path.join(projectTemplatesDir, "_js-logo.svg"))
    ? path.join(projectTemplatesDir, "_js-logo.svg")
    : BUNDLED_JS_LOGO;

  const bundledDesign = path.join(BUNDLED_TEMPLATES, "_design-system.css");

  return {
    designCss: existsSync(designPath)
      ? readFileSync(designPath, "utf-8")
      : readFileSync(bundledDesign, "utf-8"),
    jsLogoSvg: existsSync(logoPath)
      ? readFileSync(logoPath, "utf-8")
      : readFileSync(BUNDLED_JS_LOGO, "utf-8"),
  };
}

function syncFontsToScenes(
  projectTemplatesDir: string,
  scenesDir: string
): void {
  const fontsSrc = path.join(projectTemplatesDir, "fonts");
  const bundledFonts = path.join(BUNDLED_TEMPLATES, "fonts");
  const src = existsSync(fontsSrc) ? fontsSrc : bundledFonts;
  if (!existsSync(src)) return;

  const fontsDest = path.join(scenesDir, "fonts");
  ensureDir(fontsDest);
  cpSync(src, fontsDest, { recursive: true });
}

function wrapRenderedHtml(
  bodyInner: string,
  assets: BundledAssets,
  gridOn = false
): string {
  const wrapperClass = gridOn ? "wrapper vep-grid-on" : "wrapper";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>${assets.designCss}</style>
</head>
<body>
<div class="${wrapperClass}">
<div class="grid"></div>
<div class="vep-body">${bodyInner}</div>
</div>
</body>
</html>`;
}

function heroTitleSize(primaryLine: string, totalLines: number): number {
  if (totalLines > 2) return 90;
  if (totalLines > 1) return 110;
  const len = primaryLine.trim().length;
  if (len > 12) return 100;
  if (len > 8) return 110;
  return 130;
}

function splitHeroSubtitle(subtitle: string): {
  stat?: string;
  statLabel?: string;
  subtitlePlain?: string;
} {
  const t = subtitle.trim();
  if (!t) return {};
  if (!/\d/.test(t)) return { subtitlePlain: t };

  const dotParts = t.split(/\s*·\s*/);
  if (dotParts.length > 1 && /\d/.test(dotParts[0])) {
    const stat = dotParts[0].trim();
    const statLabel = dotParts.slice(1).join(" · ").trim();
    return statLabel ? { stat, statLabel } : { stat };
  }

  const m = t.match(/^([\d][\d\s★%,万K$%+\-#]*★?\s*\S+(?:\s+\S+){0,2})\s*(.*)$/u);
  if (m && m[1].trim()) {
    const stat = m[1].trim();
    const statLabel = m[2]?.trim() ?? "";
    return statLabel ? { stat, statLabel } : { stat };
  }
  return { subtitlePlain: t };
}

function formatBodyLines(body: string): string {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines
    .map((line) => {
      const isStat = STAT_LINE_RE.test(line);
      const cls = isStat
        ? "vep-stat-line vep-stat-num"
        : "vep-stat-line vep-stat-label";
      return `<div class="${cls}">${esc(line)}</div>`;
    })
    .join("");
}

function codeSessionName(heading: string): string {
  if (!heading) return "terminal";
  const en = heading.match(/[a-zA-Z][a-zA-Z0-9_-]*/);
  if (en) return en[0].toLowerCase().slice(0, 14);
  if (heading.includes("安装")) return "install";
  if (heading.includes("命令")) return "shell";
  return heading.slice(0, 10);
}

function buildStepHtml(steps: string[], segId: number): string {
  const toShow = steps.slice(0, 3);
  if (steps.length > 3) {
    log.text(
      `Warning: segment ${segId} has ${steps.length} steps — showing first 3 on screen`
    );
  }
  return toShow
    .map((s, i) => {
      const isLast = i === toShow.length - 1;
      const idx = String(i + 1).padStart(2, "0");
      return `<div class="vep-step${isLast ? " vep-step-last" : ""}"><span class="vep-step-index">${idx}</span><div class="vep-step-rail"><div class="vep-step-dot"></div><div class="vep-step-line"></div></div><div class="vep-step-content"><div class="vep-step-text">${esc(s)}</div></div></div>`;
    })
    .join("");
}

function buildSegmentBody(
  seg: StoryboardSegment,
  script: Storyboard,
  templates: Record<string, string>,
  jsLogoSvg: string
): { tname: string; body: string; gridOn: boolean } {
  let tname = seg.visual_type;
  if (!(tname in templates)) tname = "text-card";
  const template = templates[tname]!;
  const gridOn = GRID_ON_TYPES.includes(tname as VisualType);

  if (tname === "hero") {
    const textLines = (seg.text ?? "").split("\n").map((l) => l.trim());
    const titleLine = textLines[0] ?? "";
    const highlightLine = textLines.slice(1).join(" ").trim();
    const sub = splitHeroSubtitle(seg.subtitle ?? "");
    return {
      tname,
      gridOn,
      body: renderTemplate(template, {
        badge: seg.badge ?? script.badge ?? "",
        jsLogo: jsLogoSvg,
        title: esc(titleLine),
        titleSize: heroTitleSize(titleLine, textLines.filter(Boolean).length),
        highlightLine,
        stat: sub.stat ?? "",
        statLabel: sub.statLabel ?? "",
        subtitlePlain: sub.subtitlePlain ?? "",
      }),
    };
  }

  if (tname === "ending") {
    const titleSize =
      heroTitleSize((seg.text ?? "").split("\n")[0] ?? "", 1) > 100
        ? 88
        : heroTitleSize((seg.text ?? "").split("\n")[0] ?? "", 1);
    return {
      tname,
      gridOn,
      body: renderTemplate(template, {
        badge: seg.badge ?? script.badge ?? "",
        title: (seg.text ?? "").replace(/\n/g, "<br>"),
        titleSize,
        subtitle: seg.subtitle ?? "",
      }),
    };
  }

  if (tname === "text-card") {
    return {
      tname,
      gridOn,
      body: renderTemplate(template, {
        heading: seg.heading ?? seg.text ?? "",
        bodyLines: formatBodyLines(seg.body ?? ""),
      }),
    };
  }

  if (tname === "quote-card") {
    return {
      tname,
      gridOn,
      body: renderTemplate(template, {
        quote: (seg.quote ?? "").replace(/\n/g, "<br>"),
        author: seg.author ?? "",
      }),
    };
  }

  if (tname === "code-block") {
    return {
      tname,
      gridOn,
      body: renderTemplate(template, {
        session: codeSessionName(seg.heading ?? ""),
        heading: seg.heading ?? "",
        code: esc(seg.code ?? "").replace(/\n/g, "<br>"),
      }),
    };
  }

  if (tname === "comparison") {
    const li = (seg.left_items ?? [])
      .map((i) => `<li>${esc(i)}</li>`)
      .join("");
    const ri = (seg.right_items ?? [])
      .map((i) => `<li>${esc(i)}</li>`)
      .join("");
    return {
      tname,
      gridOn,
      body: renderTemplate(template, {
        heading: seg.heading ?? "",
        left_title: seg.left_title ?? "之前",
        left_items: li,
        right_title: seg.right_title ?? "之后",
        right_items: ri,
      }),
    };
  }

  if (tname === "step-diagram") {
    const steps = buildStepHtml(seg.steps ?? [], seg.id);
    return {
      tname,
      gridOn,
      body: renderTemplate(template, {
        heading: seg.heading ?? "",
        steps,
      }),
    };
  }

  return {
    tname: "text-card",
    gridOn: false,
    body: renderTemplate(templates["text-card"]!, {
      heading: seg.heading ?? seg.text ?? "",
      bodyLines: formatBodyLines(seg.body ?? seg.text ?? ""),
    }),
  };
}

function removeOrphanScenes(scenesDir: string, activeIds: Set<number>): void {
  if (!existsSync(scenesDir)) return;

  for (const fname of readdirSync(scenesDir)) {
    const id = parseSegmentId(fname, "scene");
    if (id === null) continue;
    if (!activeIds.has(id)) {
      const filePath = path.join(scenesDir, fname);
      unlinkSync(filePath);
      log.text(`Removed orphan ${fname}`);
    }
  }
}

export interface RenderOptions {
  dryRun?: boolean;
}

export function runArticleRender(
  projectDir: string,
  storyboardFile?: string,
  opts: RenderOptions = {}
): void {
  const script = loadStoryboard(projectDir, storyboardFile);
  const templatesDir = path.join(projectDir, "templates");
  const scenesDir = path.join(projectDir, "scenes");
  const activeIds = new Set(script.segments.map((s) => s.id));

  if (opts.dryRun) {
    for (const seg of script.segments) {
      log.text(
        `[dry-run] would render ${sceneHtmlName(seg.id)} (${seg.visual_type})`
      );
    }
    log.scene(`[dry-run] would render ${script.segments.length} scene(s)`);
    return;
  }

  ensureDir(scenesDir);
  const templates = loadTemplates(templatesDir);
  const assets = resolveBundledAssets(templatesDir);
  syncFontsToScenes(templatesDir, scenesDir);

  for (const seg of script.segments) {
    const { tname, body, gridOn } = buildSegmentBody(
      seg,
      script,
      templates,
      assets.jsLogoSvg
    );
    const html = wrapRenderedHtml(body, assets, gridOn);
    const out = path.join(scenesDir, sceneHtmlName(seg.id));
    writeFileSync(out, html, "utf-8");
    log.text(`Rendered ${sceneHtmlName(seg.id)} (${tname})`);
  }

  removeOrphanScenes(scenesDir, activeIds);
  log.scene(`Done! ${script.segments.length} scenes rendered`);
}
