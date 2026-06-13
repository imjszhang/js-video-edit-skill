import React from "react";
import { Sequence, useCurrentFrame } from "remotion";
import { Subtitle } from "./components/Subtitle.js";
import { TitleCard } from "./components/TitleCard.js";

export interface SubtitleData {
  text: string;
  startTime: number;
  endTime: number;
}

export interface TitleCardData {
  text: string;
  startFrame: number;
  durationFrames: number;
}

export interface CompositionProps {
  subtitles: SubtitleData[];
  titleCards: TitleCardData[];
}

export const MainComposition: React.FC<CompositionProps> = ({
  subtitles,
  titleCards,
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#000",
        position: "relative",
        fontFamily: "'Inter', 'Arial', sans-serif",
      }}
    >
      {titleCards.map((card, index) => (
        <Sequence
          key={`title-${index}`}
          from={card.startFrame}
          durationInFrames={card.durationFrames}
        >
          <TitleCard text={card.text} />
        </Sequence>
      ))}

      {subtitles.map((sub, index) => {
        const startFrame = Math.round(sub.startTime * 30);
        const durationFrames = Math.round((sub.endTime - sub.startTime) * 30);
        return (
          <Sequence
            key={`sub-${index}`}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <Subtitle text={sub.text} />
          </Sequence>
        );
      })}
    </div>
  );
};
