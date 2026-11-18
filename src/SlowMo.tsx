import { Freeze, getInputProps, Sequence, useCurrentFrame } from "remotion";

// Slow-motion factor for the final render (see scripts/render_slow.py), passed as the
// input prop `slow`. 1 (normal speed) in the Studio and in normal renders.
export const SLOW = Math.max(1, Number(getInputProps().slow ?? 1) || 1);

// Plays a scene SLOW times slower: the scene sees a frame that advances 1/SLOW per
// real frame (fractional frames keep motion smooth) and its normal duration.
export const SlowMo: React.FC<{
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  if (SLOW === 1) return <>{children}</>;
  return (
    <Freeze frame={frame / SLOW}>
      <Sequence durationInFrames={durationInFrames} layout="none">
        {children}
      </Sequence>
    </Freeze>
  );
};
