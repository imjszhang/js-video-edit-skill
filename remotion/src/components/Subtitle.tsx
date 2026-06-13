import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

interface SubtitleProps {
  text: string;
}

export const Subtitle: React.FC<SubtitleProps> = ({ text }) => {
  const frame = useCurrentFrame();

  // Fade in over first 5 frames
  const opacity = interpolate(frame, [0, 5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Slide up over first 8 frames
  const translateY = interpolate(frame, [0, 8], [20, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: "8%",
        left: "50%",
        transform: `translateX(-50%) translateY(${translateY}px)`,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        color: "#ffffff",
        fontSize: 32,
        fontWeight: 500,
        padding: "12px 24px",
        borderRadius: 4,
        textAlign: "center",
        maxWidth: "80%",
        opacity,
        lineHeight: 1.4,
        textShadow: "0 1px 3px rgba(0,0,0,0.8)",
      }}
    >
      {text}
    </div>
  );
};
