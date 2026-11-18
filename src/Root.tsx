import { Composition, Series } from "remotion";
import { SCENES } from "./scenes";
import { FPS, HEIGHT, WIDTH } from "./scenes/theme";
import { TestClip } from "./TestClip";

export { FPS };

const TOTAL = SCENES.reduce((sum, s) => sum + s.seconds, 0);

// The whole video: every scene one after another.
const Explainer: React.FC = () => (
  <Series>
    {SCENES.map((s) => (
      <Series.Sequence key={s.id} durationInFrames={s.seconds * FPS}>
        <s.component />
      </Series.Sequence>
    ))}
  </Series>
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Pre-lab check: a five-second clip with one narrated sentence. */}
      <Composition
        id="TestClip"
        component={TestClip}
        durationInFrames={5 * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="Explainer"
        component={Explainer}
        durationInFrames={TOTAL * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* One composition per scene, to preview or render a scene on its own. */}
      {SCENES.map((s) => (
        <Composition
          key={s.id}
          id={s.id}
          component={s.component}
          durationInFrames={s.seconds * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      ))}
    </>
  );
};
