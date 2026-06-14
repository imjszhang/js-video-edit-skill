import { log } from "../utils.js";
import { runArticleInit } from "./init.js";
import { runArticleStoryboard } from "./storyboard-prompt.js";
import { runArticleRender } from "./render.js";
import { runArticleScreenshot } from "./screenshot.js";
import { runArticleTts } from "./tts.js";
import { runArticleTimeline } from "./timeline-builder.js";
import { runArticleAssemble } from "./assemble.js";

export const ARTICLE_STEPS = [
  "init",
  "storyboard",
  "render",
  "screenshot",
  "tts",
  "timeline",
  "assemble",
] as const;

export type ArticleStep = (typeof ARTICLE_STEPS)[number];

export interface ArticlePipelineOptions {
  from?: ArticleStep;
  to?: ArticleStep;
  skipTts?: boolean;
  skipScreenshot?: boolean;
  storyboardFile?: string;
  verbose?: boolean;
  dryRun?: boolean;
  writeTemplate?: boolean;
  force?: boolean;
}

function stepIndex(step: ArticleStep): number {
  return ARTICLE_STEPS.indexOf(step);
}

export async function runArticlePipeline(
  projectDir: string,
  opts: ArticlePipelineOptions = {}
): Promise<void> {
  const from = opts.from ?? "render";
  const to = opts.to ?? "assemble";
  const fromIdx = stepIndex(from);
  const toIdx = stepIndex(to);

  if (fromIdx < 0 || toIdx < 0 || fromIdx > toIdx) {
    log.error(`Invalid step range: --from ${from} --to ${to}`);
    process.exit(1);
  }

  const shouldRun = (step: ArticleStep) => {
    const idx = stepIndex(step);
    return idx >= fromIdx && idx <= toIdx;
  };

  log.scene(`=== Article Pipeline: ${from} → ${to} ===`);

  try {
    if (shouldRun("init")) {
      runArticleInit(projectDir, Boolean(opts.force), Boolean(opts.dryRun));
    }

    if (shouldRun("storyboard")) {
      runArticleStoryboard(projectDir, {
        writeTemplate: opts.writeTemplate,
        force: opts.force,
        dryRun: opts.dryRun,
      });
      if (!opts.writeTemplate && toIdx > stepIndex("storyboard")) {
        log.error(
          "storyboard step only outputs digest. Use --write-template to generate draft, or run with --from render after updating storyboard.json"
        );
        process.exit(1);
      }
      if (to === "storyboard") return;
    }

    if (shouldRun("render")) {
      runArticleRender(projectDir, opts.storyboardFile, { dryRun: opts.dryRun });
    }

    if (shouldRun("screenshot") && !opts.skipScreenshot) {
      await runArticleScreenshot(projectDir, {
        verbose: opts.verbose,
        dryRun: opts.dryRun,
      });
    }

    if (shouldRun("tts") && !opts.skipTts) {
      await runArticleTts(projectDir, {
        storyboardFile: opts.storyboardFile,
        verbose: opts.verbose,
        dryRun: opts.dryRun,
      });
    }

    if (shouldRun("timeline")) {
      await runArticleTimeline(projectDir, {
        storyboardFile: opts.storyboardFile,
        verbose: opts.verbose,
        dryRun: opts.dryRun,
      });
    }

    if (shouldRun("assemble")) {
      await runArticleAssemble(projectDir, {
        verbose: opts.verbose,
        dryRun: opts.dryRun,
      });
    }

    log.scene("=== Article Pipeline complete ===");
  } catch (err) {
    log.error(`Pipeline failed: ${err}`);
    log.scene(`Resume with: vep article pipeline ${projectDir} --from <step>`);
    process.exit(1);
  }
}
