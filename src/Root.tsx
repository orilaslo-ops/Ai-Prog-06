import { Composition } from "remotion";
import { Scene01Intro } from "./scenes/Scene01Intro";
import { TestClip } from "./TestClip";

export const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Pre-lab check: a five-second clip with one narrated sentence. */}
      <Composition
        id="TestClip"
        component={TestClip}
        durationInFrames={5 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* Lab: Merkle tree explainer, one file per scene in src/scenes/. */}
      <Composition
        id="Scene01Intro"
        component={Scene01Intro}
        durationInFrames={5 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
