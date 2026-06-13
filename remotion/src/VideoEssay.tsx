import React from "react";
import {
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  staticFile,
} from "remotion";

/* ============================================================
   Video Essay: "Text-Driven Video Editing"
   Demo composition for js-video-edit-skill
   Duration: ~60s @ 30fps, 1920x1080
   ============================================================ */

// ─── Shared Styles ───────────────────────────────────────────
const COLORS = {
  bg: "#0a0a0a",
  yellow: "#FCD228",
  white: "#ffffff",
  gray: "#888888",
  darkGray: "#1a1a1a",
  red: "#ff4444",
  green: "#44ff44",
  code: "#00ff88",
};

const FONT = {
  title: "'Space Grotesk', 'Microsoft YaHei', 'PingFang SC', sans-serif",
  body: "'JetBrains Mono', 'Consolas', 'Microsoft YaHei', monospace",
};

// ─── Background Grid ─────────────────────────────────────────
const GridBackground: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      backgroundColor: COLORS.bg,
      backgroundImage: `
        linear-gradient(rgba(252,210,40,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(252,210,40,0.03) 1px, transparent 1px)
      `,
      backgroundSize: "50px 50px",
      position: "absolute",
    }}
  />
);

// ─── Fade-in Wrapper ─────────────────────────────────────────
const FadeIn: React.FC<{ delay?: number; duration?: number; children: React.ReactNode }> = ({
  delay = 0,
  duration = 15,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [delay, delay + duration], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ opacity, transform: `translateY(${translateY}px)` }}>
      {children}
    </div>
  );
};

// ─── Spring Scale ────────────────────────────────────────────
const SpringIn: React.FC<{ delay?: number; children: React.ReactNode }> = ({
  delay = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const config = { damping: 12, stiffness: 100, mass: 0.8 };
  const scale = spring({ frame: frame - delay, fps: 30, ...config });
  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      {children}
    </div>
  );
};

// ─── Title Card ──────────────────────────────────────────────
const TitleCard: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      border: `3px solid ${COLORS.yellow}`,
      boxShadow: "6px 6px 0px rgba(252,210,40,0.3)",
      backgroundColor: COLORS.bg,
    }}
  >
    <div
      style={{
        ...FONT.title,
        fontSize: 64,
        fontWeight: 900,
        color: COLORS.yellow,
        textAlign: "center",
        maxWidth: "80%",
        lineHeight: 1.2,
      }}
    >
      {title}
    </div>
    {subtitle && (
      <div
        style={{
          ...FONT.body,
          fontSize: 24,
          color: COLORS.gray,
          marginTop: 24,
          letterSpacing: 2,
        }}
      >
        {subtitle}
      </div>
    )}
  </div>
);

// ─── Text Slide ──────────────────────────────────────────────
const TextSlide: React.FC<{
  lines: string[];
  highlight?: number[];
  accent?: string;
}> = ({ lines, highlight = [], accent = COLORS.yellow }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "80px 120px",
      boxSizing: "border-box",
    }}
  >
    {lines.map((line, i) => (
      <div
        key={i}
        style={{
          fontFamily: highlight.includes(i) ? FONT.title : FONT.body,
          fontSize: highlight.includes(i) ? 48 : 32,
          fontWeight: highlight.includes(i) ? 900 : 400,
          color: highlight.includes(i) ? accent : COLORS.white,
          textAlign: "center",
          marginBottom: lines.length > 3 ? 16 : 24,
          lineHeight: 1.4,
        }}
      >
        {line}
      </div>
    ))}
  </div>
);

// ─── Data Comparison ─────────────────────────────────────────
const ComparisonCard: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 80px",
      boxSizing: "border-box",
    }}
  >
    <div
      style={{
        fontFamily: FONT.title,
        fontSize: 42,
        fontWeight: 900,
        color: COLORS.yellow,
        marginBottom: 48,
      }}
    >
      成本对比
    </div>

    {/* Proprietary side */}
    <div
      style={{
        display: "flex",
        gap: 80,
        marginBottom: 24,
      }}
    >
      <div style={{ textAlign: "center", minWidth: 300 }}>
        <div
          style={{
            fontFamily: FONT.body,
            fontSize: 18,
            color: COLORS.gray,
            marginBottom: 12,
            letterSpacing: 2,
          }}
        >
          PROPRIETARY
        </div>
        <div
          style={{
            fontFamily: FONT.title,
            fontSize: 72,
            fontWeight: 900,
            color: COLORS.red,
          }}
        >
          $100
        </div>
        <div
          style={{
            fontFamily: FONT.body,
            fontSize: 16,
            color: COLORS.gray,
            marginTop: 8,
          }}
        >
          4 天 · 100 美元
        </div>
      </div>

      {/* VS */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontFamily: FONT.title,
          fontSize: 28,
          color: COLORS.gray,
          fontWeight: 900,
        }}
      >
        VS
      </div>

      {/* Open source side */}
      <div style={{ textAlign: "center", minWidth: 300 }}>
        <div
          style={{
            fontFamily: FONT.body,
            fontSize: 18,
            color: COLORS.yellow,
            marginBottom: 12,
            letterSpacing: 2,
          }}
        >
          OPEN SOURCE
        </div>
        <div
          style={{
            fontFamily: FONT.title,
            fontSize: 72,
            fontWeight: 900,
            color: COLORS.green,
          }}
        >
          $1-5
        </div>
        <div
          style={{
            fontFamily: FONT.body,
            fontSize: 16,
            color: COLORS.gray,
            marginTop: 8,
          }}
        >
          4 天 · 1-5 美元
        </div>
      </div>
    </div>

    {/* Multiplier */}
    <div
      style={{
        fontFamily: FONT.title,
        fontSize: 36,
        fontWeight: 900,
        color: COLORS.yellow,
        marginTop: 24,
      }}
    >
      差了 20 倍
    </div>
  </div>
);

// ─── Tool List ───────────────────────────────────────────────
const ToolList: React.FC = () => {
  const tools = [
    { name: "Whisper", desc: "转录 · 毫秒级时间戳", free: true },
    { name: "ffmpeg", desc: "切割 · 拼接 · 编码", free: true },
    { name: "Remotion", desc: "React 动效 · 字幕", free: true },
    { name: ".cube LUT", desc: "纯文本调色文件", free: true },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 100px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontFamily: FONT.title,
          fontSize: 42,
          fontWeight: 900,
          color: COLORS.yellow,
          marginBottom: 48,
        }}
      >
        每一个工具，都是免费的
      </div>

      {tools.map((tool, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 20,
            padding: "16px 32px",
            border: `2px solid ${COLORS.darkGray}`,
            borderRadius: 4,
            minWidth: 600,
            justifyContent: "space-between",
          }}
        >
          <div>
            <span
              style={{
                fontFamily: FONT.body,
                fontSize: 28,
                fontWeight: 700,
                color: COLORS.white,
              }}
            >
              {tool.name}
            </span>
            <span
              style={{
                fontFamily: FONT.body,
                fontSize: 18,
                color: COLORS.gray,
                marginLeft: 16,
              }}
            >
              {tool.desc}
            </span>
          </div>
          <span
            style={{
              fontFamily: FONT.body,
              fontSize: 20,
              fontWeight: 700,
              color: COLORS.green,
            }}
          >
            $0
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Code Block ──────────────────────────────────────────────
const CodeBlock: React.FC<{ lines: string[] }> = ({ lines }) => (
  <div
    style={{
      backgroundColor: COLORS.darkGray,
      border: `1px solid ${COLORS.gray}`,
      borderRadius: 4,
      padding: "24px 32px",
      fontFamily: "'JetBrains Mono', 'Consolas', monospace",
      fontSize: 18,
      lineHeight: 1.8,
      color: COLORS.code,
      maxWidth: 900,
    }}
  >
    {lines.map((line, i) => (
      <div key={i}>{line}</div>
    ))}
  </div>
);

// ─── Pipeline Card ───────────────────────────────────────────
const PipelineCard: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 80px",
      boxSizing: "border-box",
    }}
  >
    <div
      style={{
        fontFamily: FONT.title,
        fontSize: 36,
        fontWeight: 900,
        color: COLORS.yellow,
        marginBottom: 48,
      }}
    >
      一套可以复用的 Pipeline
    </div>

    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
      {[
        "素材入库",
        "Whisper 转录",
        "JSON 决策",
        "ffmpeg 拼接",
        "LUT 调色",
        "渲染出片",
      ].map((step, i) => (
        <React.Fragment key={i}>
          <div
            style={{
              padding: "12px 20px",
              border: `2px solid ${COLORS.yellow}`,
              borderRadius: 4,
              fontFamily: FONT.body,
              fontSize: 16,
              color: COLORS.white,
            }}
          >
            {step}
          </div>
          {i < 5 && (
            <div
              style={{
                fontFamily: FONT.body,
                fontSize: 24,
                color: COLORS.yellow,
              }}
            >
              →
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
);

// ─── CTA / Closing ───────────────────────────────────────────
const ClosingCard: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "80px 120px",
      boxSizing: "border-box",
    }}
  >
    <div
      style={{
        fontFamily: FONT.title,
        fontSize: 56,
        fontWeight: 900,
        color: COLORS.yellow,
        textAlign: "center",
        marginBottom: 32,
        lineHeight: 1.3,
      }}
    >
      剪辑不是操作。
      <br />
      是表达。
    </div>
    <div
      style={{
        fontFamily: FONT.body,
        fontSize: 24,
        color: COLORS.gray,
        textAlign: "center",
        marginBottom: 48,
      }}
    >
      表达应该用母语——文本。
    </div>
    <div
      style={{
        fontFamily: FONT.body,
        fontSize: 18,
        color: COLORS.gray,
      }}
    >
      js-video-edit-skill
    </div>
  </div>
);

// ─── Main Composition ────────────────────────────────────────
export const VideoEssay: React.FC = () => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: COLORS.bg,
        overflow: "hidden",
      }}
    >
      <GridBackground />

      {/* 0:00 - Title Card (0-60 frames = 0-2s) */}
      <Sequence from={0} durationInFrames={60}>
        <SpringIn delay={10}>
          <TitleCard
            title="Text-Driven Video Editing"
            subtitle="js-video-edit-skill · Code First"
          />
        </SpringIn>
      </Sequence>

      {/* 0:02 - Hook (60-150 frames = 2-5s) */}
      <Sequence from={60} durationInFrames={90}>
        <FadeIn delay={70}>
          <TextSlide
            lines={[
              "Edit video without opening",
              "Premiere or Final Cut",
              "Decisions live in JSON",
              "ffmpeg executes the cuts",
            ]}
            highlight={[0, 2]}
          />
        </FadeIn>
      </Sequence>

      {/* 0:05 - The Hidden Detail (150-240 frames = 5-8s) */}
      <Sequence from={150} durationInFrames={90}>
        <FadeIn delay={160}>
          <TextSlide
            lines={[
              "The real cost driver:",
              "Transcription + cutting ~ $10",
              "Most spend goes to UI iteration",
            ]}
            highlight={[1]}
          />
        </FadeIn>
      </Sequence>

      {/* 0:08 - Every Tool Is Free (240-360 frames = 8-12s) */}
      <Sequence from={240} durationInFrames={120}>
        <FadeIn delay={250}>
          <ToolList />
        </FadeIn>
      </Sequence>

      {/* 0:12 - Cost Comparison (360-480 frames = 12-16s) */}
      <Sequence from={360} durationInFrames={120}>
        <SpringIn delay={370}>
          <ComparisonCard />
        </SpringIn>
      </Sequence>

      {/* 0:16 - Core Insight (480-600 frames = 16-20s) */}
      <Sequence from={480} durationInFrames={120}>
        <FadeIn delay={490}>
          <TextSlide
            lines={[
              "真正的突破不是 AI",
              "是「剪辑决策可以文本化」",
              "",
              "一旦规则变成文本",
              "任何能读文本的 Agent 都能执行",
            ]}
            highlight={[0, 1]}
          />
        </FadeIn>
      </Sequence>

      {/* 0:20 - Pipeline (600-720 frames = 20-24s) */}
      <Sequence from={600} durationInFrames={120}>
        <FadeIn delay={610}>
          <PipelineCard />
        </FadeIn>
      </Sequence>

      {/* 0:24 - Code Proof (720-840 frames = 24-28s) */}
      <Sequence from={720} durationInFrames={120}>
        <FadeIn delay={730}>
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 80px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                fontFamily: FONT.title,
                fontSize: 36,
                fontWeight: 900,
                color: COLORS.yellow,
                marginBottom: 32,
              }}
            >
              一行命令，出片
            </div>
            <CodeBlock
              lines={[
                "$ vep pipeline ./raw ./output",
                '  --decision decision.json',
                '  --lut luts/warm-cinematic.cube',
                "  --subtitles",
                "  --final-encode --crf 18",
              ]}
            />
          </div>
        </FadeIn>
      </Sequence>

      {/* 0:28 - Closing (840-960 frames = 28-32s) */}
      <Sequence from={840} durationInFrames={120}>
        <FadeIn delay={850}>
          <ClosingCard />
        </FadeIn>
      </Sequence>
    </div>
  );
};
