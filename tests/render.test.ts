import assert from "node:assert";
import { mkdtempSync, readFileSync, existsSync, rmSync, cpSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { runArticleRender } from "../src/article/render.js";
import { BUNDLED_JS_LOGO, BUNDLED_TEMPLATES } from "../src/skill-root.js";

function test(name: string, fn: () => void | Promise<void>) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`✅ ${name}`))
    .catch((err) => {
      console.error(`❌ ${name}`);
      console.error(err);
      process.exit(1);
    });
}

test("render injects inline JS logo on hero cover only", () => {
  const projectDir = mkdtempSync(path.join(tmpdir(), "vep-render-"));
  try {
    cpSync(BUNDLED_TEMPLATES, path.join(projectDir, "templates"), {
      recursive: true,
    });

    const storyboard = {
      version: 1,
      title: "Test",
      width: 1080,
      height: 1920,
      fps: 24,
      voice: "zh-CN-YunxiNeural",
      segments: [
        {
          id: 1,
          visual_type: "hero",
          narration: "旁白",
          text: "标题",
          subtitle: "副标题",
          selected: "hero",
        },
        {
          id: 2,
          visual_type: "text-card",
          narration: "旁白二",
          heading: "说明",
          body: "一行",
          selected: "text-card",
        },
      ],
    };
    const sbPath = path.join(projectDir, "storyboard.json");
    writeFileSync(sbPath, JSON.stringify(storyboard));

    runArticleRender(projectDir, sbPath);

    const heroHtml = readFileSync(path.join(projectDir, "scenes", "scene01.html"), "utf-8");
    const cardHtml = readFileSync(path.join(projectDir, "scenes", "scene02.html"), "utf-8");
    assert.ok(heroHtml.includes('class="vep-hero-logo"'), "hero missing inline logo");
    assert.ok(heroHtml.includes("<svg"), "hero missing logo svg");
    assert.ok(!cardHtml.includes('class="vep-hero-logo"'), "non-hero should not have logo");
    assert.ok(!cardHtml.includes("<circle cx=\"54\""), "non-hero should not embed logo svg");
    assert.ok(heroHtml.includes("vep-body"), "missing vep-body");
    assert.ok(!heroHtml.includes("vep-footer"), "should not have footer");
    assert.ok(existsSync(path.join(projectDir, "scenes", "fonts", "space-grotesk-600.woff2")));
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("ending uses ending template not hero", () => {
  const projectDir = mkdtempSync(path.join(tmpdir(), "vep-render-ending-"));
  try {
    cpSync(BUNDLED_TEMPLATES, path.join(projectDir, "templates"), {
      recursive: true,
    });

    const storyboard = {
      version: 1,
      title: "Test",
      width: 1080,
      height: 1920,
      fps: 24,
      voice: "zh-CN-YunxiNeural",
      segments: [
        {
          id: 1,
          visual_type: "hero",
          narration: "封面旁白",
          text: "HERO",
          selected: "hero",
        },
        {
          id: 2,
          visual_type: "ending",
          narration: "片尾旁白",
          text: "END CTA",
          subtitle: "关注",
          selected: "ending",
        },
      ],
    };
    const sbPath = path.join(projectDir, "storyboard.json");
    writeFileSync(sbPath, JSON.stringify(storyboard));

    runArticleRender(projectDir, sbPath);

    const heroHtml = readFileSync(
      path.join(projectDir, "scenes", "scene01.html"),
      "utf-8"
    );
    const endingHtml = readFileSync(
      path.join(projectDir, "scenes", "scene02.html"),
      "utf-8"
    );
    assert.ok(heroHtml.includes("<div class=\"vep-hero-wrap\">"), "hero should use hero wrap");
    assert.ok(endingHtml.includes("vep-ending-wrap"), "ending should use ending wrap");
    assert.ok(
      !endingHtml.includes("<div class=\"vep-hero-wrap\">"),
      "ending should not use hero wrap div"
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("hero subtitle with stat splits vep-hero-stat", () => {
  const projectDir = mkdtempSync(path.join(tmpdir(), "vep-render-stat-"));
  try {
    cpSync(BUNDLED_TEMPLATES, path.join(projectDir, "templates"), {
      recursive: true,
    });
    const storyboard = {
      version: 1,
      title: "Test",
      width: 1080,
      height: 1920,
      fps: 24,
      voice: "zh-CN-YunxiNeural",
      segments: [
        {
          id: 1,
          visual_type: "hero",
          narration: "旁白",
          text: "Google 过时了",
          subtitle: "40602 ★ Trending",
          selected: "hero",
        },
      ],
    };
    const sbPath = path.join(projectDir, "storyboard.json");
    writeFileSync(sbPath, JSON.stringify(storyboard));
    runArticleRender(projectDir, sbPath);
    const html = readFileSync(path.join(projectDir, "scenes", "scene01.html"), "utf-8");
    assert.ok(html.includes("vep-hero-stat"), "missing hero stat");
    assert.ok(html.includes("40602"), "missing stat number");
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("text-card body lines use vep-stat-line", () => {
  const projectDir = mkdtempSync(path.join(tmpdir(), "vep-render-tc-"));
  try {
    cpSync(BUNDLED_TEMPLATES, path.join(projectDir, "templates"), {
      recursive: true,
    });
    const storyboard = {
      version: 1,
      title: "Test",
      width: 1080,
      height: 1920,
      fps: 24,
      voice: "zh-CN-YunxiNeural",
      segments: [
        {
          id: 1,
          visual_type: "text-card",
          narration: "旁白",
          heading: "标题",
          body: "Reddit 1500↑\n短句说明",
          selected: "text-card",
        },
      ],
    };
    const sbPath = path.join(projectDir, "storyboard.json");
    writeFileSync(sbPath, JSON.stringify(storyboard));
    runArticleRender(projectDir, sbPath);
    const html = readFileSync(path.join(projectDir, "scenes", "scene01.html"), "utf-8");
    assert.ok(html.includes("vep-stat-line"), "missing stat line");
    assert.ok(html.includes("vep-stat-num"), "missing stat num class");
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("step-diagram truncates to 3 steps", () => {
  const projectDir = mkdtempSync(path.join(tmpdir(), "vep-render-step-"));
  try {
    cpSync(BUNDLED_TEMPLATES, path.join(projectDir, "templates"), {
      recursive: true,
    });
    const storyboard = {
      version: 1,
      title: "Test",
      width: 1080,
      height: 1920,
      fps: 24,
      voice: "zh-CN-YunxiNeural",
      segments: [
        {
          id: 1,
          visual_type: "step-diagram",
          narration: "旁白",
          steps: ["一", "二", "三", "四"],
          selected: "step-diagram",
        },
      ],
    };
    const sbPath = path.join(projectDir, "storyboard.json");
    writeFileSync(sbPath, JSON.stringify(storyboard));
    runArticleRender(projectDir, sbPath);
    const html = readFileSync(path.join(projectDir, "scenes", "scene01.html"), "utf-8");
    const stepCount = (html.match(/class="vep-step-index"/g) ?? []).length;
    assert.strictEqual(stepCount, 3);
    assert.ok(html.includes("vep-step-index"), "missing step index");
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("quote and ending use vep-invert", () => {
  const projectDir = mkdtempSync(path.join(tmpdir(), "vep-render-invert-"));
  try {
    cpSync(BUNDLED_TEMPLATES, path.join(projectDir, "templates"), {
      recursive: true,
    });
    const storyboard = {
      version: 1,
      title: "Test",
      width: 1080,
      height: 1920,
      fps: 24,
      voice: "zh-CN-YunxiNeural",
      segments: [
        {
          id: 1,
          visual_type: "quote-card",
          narration: "旁白",
          quote: "金句",
          selected: "quote-card",
        },
        {
          id: 2,
          visual_type: "ending",
          narration: "片尾",
          text: "CTA",
          selected: "ending",
        },
      ],
    };
    const sbPath = path.join(projectDir, "storyboard.json");
    writeFileSync(sbPath, JSON.stringify(storyboard));
    runArticleRender(projectDir, sbPath);
    const quoteHtml = readFileSync(
      path.join(projectDir, "scenes", "scene01.html"),
      "utf-8"
    );
    const endingHtml = readFileSync(
      path.join(projectDir, "scenes", "scene02.html"),
      "utf-8"
    );
    assert.ok(quoteHtml.includes("vep-invert"));
    assert.ok(endingHtml.includes("vep-invert"));
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("comparison enables vep-grid-on on wrapper", () => {
  const projectDir = mkdtempSync(path.join(tmpdir(), "vep-render-grid-"));
  try {
    cpSync(BUNDLED_TEMPLATES, path.join(projectDir, "templates"), {
      recursive: true,
    });
    const storyboard = {
      version: 1,
      title: "Test",
      width: 1080,
      height: 1920,
      fps: 24,
      voice: "zh-CN-YunxiNeural",
      segments: [
        {
          id: 1,
          visual_type: "comparison",
          narration: "旁白",
          left_title: "A",
          right_title: "B",
          left_items: ["1"],
          right_items: ["2"],
          selected: "comparison",
        },
      ],
    };
    const sbPath = path.join(projectDir, "storyboard.json");
    writeFileSync(sbPath, JSON.stringify(storyboard));
    runArticleRender(projectDir, sbPath);
    const html = readFileSync(path.join(projectDir, "scenes", "scene01.html"), "utf-8");
    assert.ok(html.includes("vep-grid-on"));
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("BUNDLED_JS_LOGO exists", () => {
  assert.ok(existsSync(BUNDLED_JS_LOGO), `logo missing at ${BUNDLED_JS_LOGO}`);
});

console.log("\n✅ All render tests passed.");
