#!/usr/bin/env node
import { Command } from "commander";
import { runTranscribe } from "../src/commands/transcribe.js";
import { runAnalyze } from "../src/commands/analyze.js";
import { runCut } from "../src/commands/cut.js";
import { runGrade } from "../src/commands/grade.js";
import { runSubtitle } from "../src/commands/subtitle.js";
import { runEncode } from "../src/commands/encode.js";
import { runGenerateLuts } from "../src/commands/generate-luts.js";
import { runFootagePipeline } from "../src/commands/footage-pipeline.js";
import { runInfo } from "../src/commands/info.js";
import { runArticleInit, runArticleValidate } from "../src/article/init.js";
import { runArticleStoryboard } from "../src/article/storyboard-prompt.js";
import { runArticleRender } from "../src/article/render.js";
import { runArticleScreenshot } from "../src/article/screenshot.js";
import { runArticleTts } from "../src/article/tts.js";
import { runArticleTimeline } from "../src/article/timeline-builder.js";
import { runArticleAssemble } from "../src/article/assemble.js";
import { runArticlePipeline, ARTICLE_STEPS } from "../src/article/pipeline.js";
import { runArticleRecover } from "../src/article/recover.js";
import { log } from "../src/utils.js";
import { cliContext, setCliContext } from "../src/cli-context.js";

const program = new Command();

program
  .name("vep")
  .description("Text-driven video editing pipeline (footage + article-to-video)")
  .version("0.2.0")
  .option("-v, --verbose", "Print detailed command output")
  .option("--dry-run", "Print steps without writing files")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.optsWithGlobals();
    setCliContext({
      verbose: Boolean(opts.verbose),
      dryRun: Boolean(opts.dryRun),
    });
  });

// --- Mode A: Footage editing ---

program
  .command("pipeline")
  .description("Run full footage editing pipeline end-to-end")
  .argument("<inputDir>", "Directory containing raw video files")
  .argument("[outputDir]", "Base output directory", "./output")
  .option("-m, --model <model>", "Whisper model", "base")
  .option("-l, --language <lang>", "Language code")
  .option("--decision <file>", "Editing decision JSON path")
  .option("--fast-cuts", "Use stream copy for cutting")
  .option("--lut <file>", "Apply LUT color grading")
  .option("--subtitles", "Burn subtitles from transcript")
  .option("--final-encode", "Run final encode step")
  .option("--crf <n>", "CRF for final encode", "18")
  .action(async (inputDir, outputDir, opts) => {
    await runFootagePipeline(inputDir, outputDir, {
      model: opts.model,
      language: opts.language,
      decision: opts.decision,
      fastCuts: opts.fastCuts,
      lut: opts.lut,
      subtitles: opts.subtitles,
      finalEncode: opts.finalEncode,
      crf: parseInt(opts.crf),
    });
  });

program
  .command("transcribe")
  .description("Transcribe all videos in a directory using Whisper")
  .argument("<inputDir>", "Directory containing video files")
  .argument("[outputDir]", "Output directory for transcripts", "./transcripts")
  .option("-m, --model <model>", "Whisper model size", "base")
  .option("-l, --language <lang>", "Language code")
  .action(async (inputDir, outputDir, opts) => {
    await runTranscribe(inputDir, outputDir, {
      model: opts.model,
      language: opts.language,
    });
  });

program
  .command("analyze")
  .description("Read transcript JSONs and output analysis digest for LLM")
  .argument("<transcriptsDir>", "Directory containing transcript JSONs")
  .action((transcriptsDir) => {
    runAnalyze(transcriptsDir);
  });

program
  .command("cut")
  .description("Execute ffmpeg cuts from editing decision JSON")
  .argument("<decisionFile>", "Path to decision JSON")
  .argument("[outputDir]", "Output directory", "./cuts")
  .option("-f, --fast", "Use stream copy")
  .option("--source-dir <dir>", "Source video directory", "./raw")
  .action(async (decisionFile, outputDir, opts) => {
    await runCut(decisionFile, outputDir, {
      fast: opts.fast,
      sourceDir: opts.sourceDir,
    });
  });

program
  .command("grade")
  .description("Apply LUT color grading")
  .argument("<input>", "Input video")
  .argument("<lutFile>", "LUT .cube file")
  .argument("[output]", "Output path")
  .action(async (input, lutFile, output) => {
    try {
      await runGrade(input, lutFile, output);
    } catch (err) {
      log.error(`Failed: ${err}`);
      process.exit(1);
    }
  });

program
  .command("subtitle")
  .description("Generate and burn subtitles from transcript JSON")
  .argument("<input>", "Input video")
  .argument("<transcriptJson>", "Transcript JSON path")
  .argument("[output]", "Output path")
  .option("--font-size <n>", "Font size", "24")
  .option("--font-name <name>", "Font name", "Arial")
  .option("--color <color>", "ASS color", "&H00FFFFFF")
  .option("--srt-only", "Only generate SRT")
  .action(async (input, transcriptJson, output, opts) => {
    try {
      await runSubtitle(input, transcriptJson, output, {
        fontSize: parseInt(opts.fontSize),
        fontName: opts.fontName,
        primaryColor: opts.color,
        srtOnly: opts.srtOnly,
      });
    } catch (err) {
      log.error(`Failed: ${err}`);
      process.exit(1);
    }
  });

program
  .command("encode")
  .description("Final encode with quality options")
  .argument("<input>", "Input video")
  .argument("[output]", "Output path")
  .option("--codec <codec>", "Video codec", "libx264")
  .option("--preset <preset>", "Encoding preset", "medium")
  .option("--crf <n>", "CRF quality", "18")
  .option("--resolution <res>", "Resolution W:H", "1920:1080")
  .option("--fps <n>", "Frame rate", "30")
  .action(async (input, output, opts) => {
    try {
      await runEncode(input, output, {
        codec: opts.codec,
        preset: opts.preset,
        crf: parseInt(opts.crf),
        resolution: opts.resolution,
        fps: parseInt(opts.fps),
      });
    } catch (err) {
      log.error(`Failed: ${err}`);
      process.exit(1);
    }
  });

program
  .command("render")
  .description("[deprecated] Use 'vep encode' instead")
  .argument("<input>", "Input video")
  .argument("[output]", "Output path")
  .option("--codec <codec>", "Video codec", "libx264")
  .option("--preset <preset>", "Encoding preset", "medium")
  .option("--crf <n>", "CRF quality", "18")
  .option("--resolution <res>", "Resolution W:H", "1920:1080")
  .option("--fps <n>", "Frame rate", "30")
  .action(async (input, output, opts) => {
    log.text("Warning: 'vep render' is deprecated — use 'vep encode' instead");
    try {
      await runEncode(input, output, {
        codec: opts.codec,
        preset: opts.preset,
        crf: parseInt(opts.crf),
        resolution: opts.resolution,
        fps: parseInt(opts.fps),
      });
    } catch (err) {
      log.error(`Failed: ${err}`);
      process.exit(1);
    }
  });

program
  .command("generate-luts")
  .description("Generate preset LUT .cube files")
  .argument("[outputDir]", "Output directory", "./luts")
  .action((outputDir) => {
    runGenerateLuts(outputDir);
  });

program
  .command("info")
  .description("Show media info via ffprobe")
  .argument("<file>", "Media file path")
  .action(async (file) => {
    try {
      await runInfo(file);
    } catch (err) {
      log.error(`Failed: ${err}`);
      process.exit(1);
    }
  });

// --- Mode B: Article-to-video ---

const article = program
  .command("article")
  .description("Article-to-video pipeline (全文视频化)");

article
  .command("init")
  .description("Initialize article project directory structure")
  .argument("<projectDir>", "Project directory")
  .option("-f, --force", "Overwrite existing files")
  .action((projectDir, opts) => {
    runArticleInit(projectDir, opts.force);
  });

article
  .command("storyboard")
  .description("Analyze article.md and output storyboard digest for LLM")
  .argument("<projectDir>", "Project directory")
  .option("--write-template", "Write draft storyboard.json")
  .option("-f, --force", "Overwrite existing storyboard.json when using --write-template")
  .action((projectDir, opts) => {
    runArticleStoryboard(projectDir, {
      writeTemplate: opts.writeTemplate,
      force: opts.force,
      dryRun: cliContext.dryRun,
    });
  });

article
  .command("validate")
  .description("Validate storyboard.json schema and fields")
  .argument("<projectDir>", "Project directory")
  .option("--storyboard <file>", "Custom storyboard path")
  .option("--strict", "Exit with error if field warnings exist")
  .action((projectDir, opts) => {
    try {
      runArticleValidate(projectDir, {
        storyboardFile: opts.storyboard,
        strict: opts.strict,
      });
    } catch (err) {
      log.error(`${err}`);
      process.exit(1);
    }
  });

article
  .command("render")
  .description("Render HTML scenes from storyboard.json")
  .argument("<projectDir>", "Project directory")
  .option("--storyboard <file>", "Custom storyboard path")
  .action((projectDir, opts) => {
    try {
      runArticleRender(projectDir, opts.storyboard, { dryRun: cliContext.dryRun });
    } catch (err) {
      log.error(`${err}`);
      process.exit(1);
    }
  });

article
  .command("screenshot")
  .description("Capture PNG screenshots via JS-Eyes")
  .argument("<projectDir>", "Project directory")
  .option("--port <n>", "HTTP server port", "18998")
  .option("--tab-delay <ms>", "Delay before screenshot", "3000")
  .option("--retries <n>", "Retry count per scene", "1")
  .option("--skip-validate", "Skip centering validation")
  .action(async (projectDir, opts) => {
    try {
      await runArticleScreenshot(projectDir, {
        port: parseInt(opts.port),
        tabDelay: parseInt(opts.tabDelay),
        retries: parseInt(opts.retries),
        skipValidate: opts.skipValidate,
        verbose: cliContext.verbose,
        dryRun: cliContext.dryRun,
      });
    } catch (err) {
      log.error(`${err}`);
      process.exit(1);
    }
  });

function parseSegmentIdOption(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) {
    log.error(`Invalid ${label}: ${value}`);
    process.exit(1);
  }
  return n;
}

article
  .command("tts")
  .description("Generate TTS audio via edge-tts")
  .argument("<projectDir>", "Project directory")
  .option("--voice <voice>", "TTS voice")
  .option("--from-id <n>", "Start segment id")
  .option("--to-id <n>", "End segment id")
  .option("--storyboard <file>", "Custom storyboard path")
  .action(async (projectDir, opts) => {
    try {
      await runArticleTts(projectDir, {
        voice: opts.voice,
        fromId: parseSegmentIdOption(opts.fromId, "--from-id"),
        toId: parseSegmentIdOption(opts.toId, "--to-id"),
        storyboardFile: opts.storyboard,
        verbose: cliContext.verbose,
        dryRun: cliContext.dryRun,
      });
    } catch (err) {
      log.error(`${err}`);
      process.exit(1);
    }
  });

article
  .command("timeline")
  .description("Build timeline.json, subs.ass, shot-list.json from audio")
  .argument("<projectDir>", "Project directory")
  .option("--storyboard <file>", "Custom storyboard path")
  .option("--skip-trim", "Skip silenceremove (use existing trimmed/)")
  .action(async (projectDir, opts) => {
    try {
      await runArticleTimeline(projectDir, {
        storyboardFile: opts.storyboard,
        skipTrim: opts.skipTrim,
        verbose: cliContext.verbose,
        dryRun: cliContext.dryRun,
      });
    } catch (err) {
      log.error(`${err}`);
      process.exit(1);
    }
  });

article
  .command("assemble")
  .description("Assemble final video from timeline + scenes")
  .argument("<projectDir>", "Project directory")
  .action(async (projectDir) => {
    try {
      await runArticleAssemble(projectDir, {
        verbose: cliContext.verbose,
        dryRun: cliContext.dryRun,
      });
    } catch (err) {
      log.error(`${err}`);
      process.exit(1);
    }
  });

article
  .command("recover")
  .description("Recover storyboard + timeline from existing audio/scenes")
  .argument("<projectDir>", "Project directory")
  .option("-f, --force", "Overwrite existing storyboard.json and timeline.json")
  .action(async (projectDir, opts) => {
    try {
      await runArticleRecover(projectDir, {
        dryRun: cliContext.dryRun,
        force: opts.force,
      });
    } catch (err) {
      log.error(`${err}`);
      process.exit(1);
    }
  });

article
  .command("pipeline")
  .description(
    "Run article-to-video pipeline end-to-end (storyboard step stops unless --write-template)"
  )
  .argument("<projectDir>", "Project directory")
  .option("--from <step>", `Start step (${ARTICLE_STEPS.join("|")})`, "render")
  .option("--to <step>", `End step (${ARTICLE_STEPS.join("|")})`, "assemble")
  .option("--skip-tts", "Skip TTS generation")
  .option("--skip-screenshot", "Skip screenshot step")
  .option("--storyboard <file>", "Custom storyboard path")
  .option("--write-template", "Write draft storyboard.json (required to continue past storyboard step)")
  .option("-f, --force", "Overwrite existing files in init/storyboard/recover steps")
  .action(async (projectDir, opts) => {
    await runArticlePipeline(projectDir, {
      from: opts.from,
      to: opts.to,
      skipTts: opts.skipTts,
      skipScreenshot: opts.skipScreenshot,
      storyboardFile: opts.storyboard,
      writeTemplate: opts.writeTemplate,
      force: opts.force,
      verbose: cliContext.verbose,
      dryRun: cliContext.dryRun,
    });
  });

program.parse();
