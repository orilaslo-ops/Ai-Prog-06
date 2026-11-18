import { AbsoluteFill } from "remotion";
import {
  Beacon,
  Beam,
  buildTree,
  C,
  FONT,
  HEIGHT,
  Hub,
  NeonBackground,
  NeonDefs,
  Tower,
  TOWER_H,
  towerPos,
  WIDTH,
} from "./kit";

// A still of the shared neon city tree, to check the kit and to stand in for
// unbuilt scenes.
const T = buildTree();

export const KitPreview: React.FC<{ label?: string }> = ({ label }) => (
  <AbsoluteFill>
    <NeonBackground />
    <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute" }}>
      <NeonDefs />
      {T.slice(0, 3).flatMap((lvl) =>
        lvl.map((n) => {
          const p = T[n.level + 1][Math.floor(n.index / 2)];
          return (
            <Beam
              key={`b${n.level}${n.index}`}
              a={[n.x, n.y, n.z]}
              b={[p.x, p.y, p.z]}
            />
          );
        }),
      )}
      {TOWER_H.map((h, i) => (
        <Tower key={i} {...towerPos(i)} h={h} seed={`t${i}`} />
      ))}
      {T.slice(1, 3).flatMap((lvl) =>
        lvl.map((n) => (
          <Hub key={`h${n.level}${n.index}`} x={n.x} y={n.y} z={n.z} />
        )),
      )}
      <Beacon x={T[3][0].x} y={T[3][0].y} z={T[3][0].z} />
    </svg>
    {label ? (
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 40,
          color: C.muted,
          fontFamily: FONT,
          fontSize: 32,
        }}
      >
        {label}
      </div>
    ) : null}
  </AbsoluteFill>
);
