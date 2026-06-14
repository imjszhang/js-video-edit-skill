import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { ensureDir, log } from "../utils.js";
import { loadStoryboard } from "./storyboard.js";
import type { Storyboard, StoryboardSegment } from "./types.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTemplate(template: string, data: Record<string, unknown>): string {
  let html = template;
  html = html.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, key: string, block: string) => (data[key] ? block : "")
  );
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
    templates[path.parse(fname).name] = readFileSync(
      path.join(templatesDir, fname),
      "utf-8"
    );
  }
  return templates;
}

function buildSegmentData(
  seg: StoryboardSegment,
  script: Storyboard,
  templates: Record<string, string>
): { tname: string; html: string } {
  let tname = seg.visual_type;
  if (tname === "ending") tname = "hero";
  if (!(tname in templates)) tname = "text-card";
  const template = templates[tname]!;

  if (tname === "hero") {
    const lines = (seg.text ?? "").split("\n");
    const titleSize =
      lines.length > 2 ? 90 : lines.length > 1 ? 110 : 130;
    return {
      tname,
      html: renderTemplate(template, {
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
      html: renderTemplate(template, {
        heading: seg.heading ?? "",
        body: (seg.body ?? "").replace(/\n/g, "<br>"),
      }),
    };
  }

  if (tname === "quote-card") {
    return {
      tname,
      html: renderTemplate(template, {
        quote: (seg.quote ?? "").replace(/\n/g, "<br>"),
        author: seg.author ?? "",
      }),
    };
  }

  if (tname === "code-block") {
    return {
      tname,
      html: renderTemplate(template, {
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
      html: renderTemplate(template, {
        heading: seg.heading ?? "",
        left_title: seg.left_title ?? "之前",
        left_items: li,
        right_title: seg.right_title ?? "之后",
        right_items: ri,
      }),
    };
  }

  if (tname === "step-diagram") {
    const steps = (seg.steps ?? [])
      .map(
        (s, i) =>
          `<div class="step"><span class="step-num">${i + 1}</span><span class="step-text">${esc(s)}</span></div>`
      )
      .join("");
    return {
      tname,
      html: renderTemplate(template, {
        heading: seg.heading ?? "",
        steps,
      }),
    };
  }

  return {
    tname: "text-card",
    html: renderTemplate(templates["text-card"]!, {
      heading: seg.heading ?? seg.text ?? "",
      body: (seg.body ?? "").replace(/\n/g, "<br>"),
    }),
  };
}

export function runArticleRender(projectDir: string, storyboardFile?: string): void {
  const script = loadStoryboard(projectDir, storyboardFile);
  const templatesDir = path.join(projectDir, "templates");
  const scenesDir = path.join(projectDir, "scenes");
  ensureDir(scenesDir);

  const templates = loadTemplates(templatesDir);

  for (const seg of script.segments) {
    const { tname, html } = buildSegmentData(seg, script, templates);
    const out = path.join(scenesDir, `scene${String(seg.id).padStart(2, "0")}.html`);
    writeFileSync(out, html, "utf-8");
    log.text(`Rendered scene ${String(seg.id).padStart(2, "0")} (${tname})`);
  }

  log.scene(`Done! ${script.segments.length} scenes rendered`);
}
