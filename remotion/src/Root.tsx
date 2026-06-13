import { Composition } from "remotion";
import { VideoEssay } from "./VideoEssay.js";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoEssay"
        component={VideoEssay}
        durationInFrames={1800} // 60 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Short"
        component={VideoEssay}
        durationInFrames={900} // 30 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
    </>
  );
};
