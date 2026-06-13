import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface TitleCardProps {
  title: string;
}

export const TitleCard: React.FC<TitleCardProps> = ({ title }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 10, 20], [0, 1, 1], {
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [0, 10], [0.8, 1], {
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(frame, [0, 10], [40, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale}) translateY(${translateY}px)`,
          textAlign: 'center',
          padding: '40px 60px',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '8px',
        }}
      >
        <h1
          style={{
            color: '#FFFFFF',
            fontSize: '64px',
            fontWeight: 'bold',
            margin: 0,
            fontFamily: 'Arial, sans-serif',
            textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
          }}
        >
          {title}
        </h1>
      </div>
    </div>
  );
};
