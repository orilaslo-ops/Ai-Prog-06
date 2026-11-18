import { Composition, Series } from "remotion";
import { SCENES } from "./scenes";
import { FPS, HEIGHT, WIDTH } from "./scenes/theme";
import { SLOW, SlowMo } from "./SlowMo";
import { TestClip } from "./TestClip";
import { SCENES_V2 } from "./v2";
import { KitPreview } from "./v2/KitPreview";

export { FPS };

const TOTAL = SCENES.reduce((sum, s) => sum + s.seconds, 0);
const TOTAL_V2 = SCENES_V2.reduce((sum, s) => sum + s.seconds, 0);

// Version 2, "the living tree": same script and narration, new visuals.
const ExplainerV2: React.FC = () => (
  <Series>
    {SCENES_V2.map((s) => (
      <Series.Sequence key={s.id} durationInFrames={s.seconds * FPS}>
        <s.component />
      </Series.Sequence>
    ))}
  </Series>
);

// The whole video: every scene one after another.
const Explainer: React.FC = () => (
  <Series>
    {SCENES.map((s) => (
      <Series.Sequence
        key={s.id}
        durationInFrames={Math.round(s.seconds * FPS * SLOW)}
      >
        <SlowMo durationInFrames={s.seconds * FPS}>
          <s.component />
        </SlowMo>
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
        durationInFrames={Math.round(TOTAL * FPS * SLOW)}
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
      <Composition
        id="ExplainerV2"
        component={ExplainerV2}
        durationInFrames={TOTAL_V2 * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="KitPreview"
        component={KitPreview}
        durationInFrames={FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      {SCENES_V2.map((s) => (
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
