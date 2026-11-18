import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  interpolateColors,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Beacon,
  Beam,
  buildTree,
  C,
  Cam,
  clamp,
  FONT,
  HEIGHT,
  Hub,
  iso,
  MONO,
  NeonBackground,
  NeonDefs,
  Tower,
  TOWER_H,
  TOWER_W,
  towerPos,
  WIDTH,
} from "./kit";

// Scene 4 (12 s): the city grows its Merkle tree.
// Narration (10.5 s, public/scene04.wav), word timings from silencedetect:
//   0.00–1.14 "Hash every file."
//   1.60–3.51 "Then hash each pair of hashes together,"
//   3.65–4.19 "and again,"   4.36–5.22 "level by level,"
//   5.34–6.77 "until one hash is left:"   7.28–7.73 "the root."
//   8.23–10.22 "The root depends on every single file."
// Towers rise out of the grid while the camera pulls back; a scan ring hashes each
// one. Light bridges shoot up from each pair and lock into a hub with a flash, level
// by level, as the camera cranes up. The last two bridges charge a gold spark that
// ignites into the beacon on "the root" (pillar, shockwave, shake). Then light from
// every tower surges up the bridges into the beacon. The scene ends on exactly the
// KitPreview picture at DEFAULT_CAM, which is where scene 5 starts.

const T = buildTree();
const ROOT = T[3][0];

const sec = (s: number) => Math.round(s * 30);

// Towers rise from the centre outwards, so the camera's pull-back reveals them.
const RISE_ORDER = [3, 4, 2, 5, 1, 6, 0, 7];
const riseAt = (i: number) => 0.05 + RISE_ORDER.indexOf(i) * 0.075;
const hashAt = (i: number) => 0.55 + RISE_ORDER.indexOf(i) * 0.05;

// Bridges into each node above the towers: [start, arrive] in seconds.
const BRIDGE: [number, number][][] = [
  [],
  [
    [1.7, 2.45],
    [2.55, 2.95],
    [2.7, 3.1],
    [2.85, 3.25],
  ],
  [
    [3.7, 4.15],
    [3.9, 4.35],
  ],
  [[5.0, 6.45]],
];
const LEVEL_BEAT = [0, 4.42, 4.9]; // "level … by level": the hubs of that level pulse
const IGNITE = 7.28; // "the root."
const SURGE = 8.25; // "The root depends on every single file."
const SURGE_DUR = 1.35;
const LABELS_OUT = [10.3, 10.9];

const HASH_NAME = [
  [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `h${n}`),
  ["h12", "h34", "h56", "h78"],
  ["h1234", "h5678"],
];

const CAPTIONS: { from: number; to: number; lines: string[]; color: string }[] =
  [
    { from: 0.1, to: 1.5, lines: ["HASH EVERY FILE"], color: C.file },
    { from: 1.6, to: 3.55, lines: ["HASH EACH PAIR"], color: C.hash },
    { from: 3.65, to: 5.3, lines: ["AGAIN,", "LEVEL BY LEVEL"], color: C.hash },
    {
      from: 5.35,
      to: 7.2,
      lines: ["UNTIL ONE", "HASH IS LEFT"],
      color: C.root,
    },
    { from: 7.28, to: 8.15, lines: ["THE ROOT"], color: C.root },
    {
      from: 8.2,
      to: 10.9,
      lines: ["THE ROOT DEPENDS", "ON EVERY FILE"],
      color: C.root,
    },
  ];

// Camera: start low and close, pull back as the towers rise, crane up level by
// level, punch in on the ignition, then settle exactly on DEFAULT_CAM.
const CAM_T = [0, 1.4, 3.4, 5.0, 7.0, IGNITE, 7.7, SURGE, 10.15];
const CAM_ZOOM = [1.6, 1.12, 1.04, 0.95, 0.88, 0.88, 0.93, 0.93, 1];
const CAM_Y = [90, 30, 50, 90, 105, 105, 95, 90, 0];

const ease = Easing.inOut(Easing.cubic);

const camAt = (frame: number): Cam => {
  const t = CAM_T.map(sec);
  const o = { ...clamp, easing: ease };
  const zoom = interpolate(frame, t, CAM_ZOOM, o);
  const y = interpolate(frame, t, CAM_Y, o);
  const sway = interpolate(frame, [sec(SURGE), sec(10.15)], [1, 0], {
    ...clamp,
    easing: ease,
  });
  const x = 46 * Math.sin(frame / 42) * sway;
  // Screen shake on the ignition.
  const k = frame - sec(IGNITE);
  const shake = k >= 0 ? 16 * Math.exp(-k / 4) : 0;
  return {
    x: x + shake * Math.sin(k * 2.9),
    y: y + shake * Math.cos(k * 2.3),
    zoom,
  };
};

const pts = (p: { sx: number; sy: number }[]) =>
  p.map((q) => `${q.sx},${q.sy}`).join(" ");

const decay = (frame: number, at: number, tau: number) =>
  frame < at ? 0 : Math.exp(-(frame - at) / tau);

// --- ground: footprints flash and rings ripple out as each tower breaks the grid
const RiseBurst: React.FC<{ i: number; cam: Cam }> = ({ i, cam }) => {
  const frame = useCurrentFrame();
  const k = frame - sec(riseAt(i));
  if (k < -4 || k > 30) return null;
  const p = towerPos(i);
  const cx = p.x + TOWER_W / 2;
  const cy = p.y + TOWER_W / 2;
  const fp = (s: number) =>
    [
      [-s, -s],
      [s, -s],
      [s, s],
      [-s, s],
    ].map(([dx, dy]) => iso(cx + dx, cy + dy, 0, cam));
  const pre = interpolate(k, [-4, 0], [0, 1], clamp);
  const fade = interpolate(k, [0, 30], [1, 0], clamp);
  const ring = interpolate(k, [0, 24], [36, 200], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const base = iso(cx, cy, 0, cam);
  return (
    <g>
      <polygon
        points={pts(fp(40))}
        fill={C.file}
        opacity={0.7 * pre * fade}
        filter="url(#neon-wide)"
      />
      <polygon
        points={pts(fp(ring))}
        fill="none"
        stroke={C.file}
        strokeWidth={3}
        opacity={0.9 * fade}
        filter="url(#neon)"
      />
      <rect
        x={base.sx - 30 * cam.zoom}
        y={base.sy - 520 * cam.zoom}
        width={60 * cam.zoom}
        height={520 * cam.zoom}
        fill={C.file}
        opacity={0.35 * pre * fade}
        filter="url(#neon-wide)"
      />
    </g>
  );
};

// A magenta ring sweeps up a tower (the hash being computed) and its top flares.
const HashScan: React.FC<{ i: number; cam: Cam }> = ({ i, cam }) => {
  const frame = useCurrentFrame();
  const k = frame - sec(hashAt(i));
  if (k < 0 || k > 22) return null;
  const p = towerPos(i);
  const z = interpolate(k, [0, 10], [0, TOWER_H[i]], {
    ...clamp,
    easing: Easing.in(Easing.quad),
  });
  const o = interpolate(k, [0, 2, 10, 13], [0, 1, 1, 0], clamp);
  const w = TOWER_W + 8;
  const ring = [
    [-4, -4],
    [w - 4, -4],
    [w - 4, w - 4],
    [-4, w - 4],
  ].map(([dx, dy]) => iso(p.x + dx, p.y + dy, z, cam));
  const top = iso(p.x + TOWER_W / 2, p.y + TOWER_W / 2, TOWER_H[i], cam);
  const flare = interpolate(k, [9, 12, 22], [0, 1, 0], clamp);
  return (
    <g>
      <polygon
        points={pts(ring)}
        fill={C.hash}
        fillOpacity={0.25 * o}
        stroke={C.hash}
        strokeWidth={4}
        opacity={o}
        filter="url(#neon)"
      />
      <circle
        cx={top.sx}
        cy={top.sy}
        r={60 * cam.zoom * (0.4 + flare)}
        fill={C.hash}
        opacity={0.8 * flare}
        filter="url(#neon-wide)"
      />
      <circle
        cx={top.sx}
        cy={top.sy}
        r={9 * cam.zoom * flare}
        fill="#ffffff"
        opacity={flare}
      />
    </g>
  );
};

// White-hot head on the front of a bridge while it is shooting up.
const BeamHead: React.FC<{
  a: [number, number, number];
  b: [number, number, number];
  progress: number;
  cam: Cam;
}> = ({ a, b, progress, cam }) => {
  if (progress <= 0 || progress >= 1) return null;
  const q = iso(
    a[0] + (b[0] - a[0]) * progress,
    a[1] + (b[1] - a[1]) * progress,
    a[2] + (b[2] - a[2]) * progress,
    cam,
  );
  return (
    <g>
      <circle cx={q.sx} cy={q.sy} r={22} fill={C.hash} opacity={0.6} />
      <circle cx={q.sx} cy={q.sy} r={8} fill="#ffffff" />
    </g>
  );
};

// Flash ring + sparks when a pair's bridges lock into a hub.
const Burst: React.FC<{
  sx: number;
  sy: number;
  at: number;
  color: string;
  size?: number;
  seed: string;
}> = ({ sx, sy, at, color, size = 1, seed }) => {
  const frame = useCurrentFrame();
  const k = frame - at;
  if (k < 0 || k > 24) return null;
  const grow = Easing.out(Easing.cubic)(k / 24);
  const o = 1 - k / 24;
  return (
    <g>
      <circle
        cx={sx}
        cy={sy}
        r={size * (20 + 110 * grow)}
        fill="none"
        stroke={color}
        strokeWidth={6 * o + 1}
        opacity={o}
      />
      <circle
        cx={sx}
        cy={sy}
        r={size * 70 * (1 - grow * 0.5)}
        fill="#ffffff"
        opacity={0.55 * o * o}
      />
      {Array.from({ length: 12 }, (_, j) => {
        const ang = (j / 12) * Math.PI * 2 + random(`${seed}a${j}`) * 0.5;
        const dist = size * (50 + 90 * random(`${seed}d${j}`)) * grow;
        return (
          <circle
            key={j}
            cx={sx + Math.cos(ang) * dist}
            cy={sy + Math.sin(ang) * dist + k * k * 0.08}
            r={3.2 * o + 0.6}
            fill={j % 3 === 0 ? "#ffffff" : color}
            opacity={o}
          />
        );
      })}
    </g>
  );
};

// A hash label that decodes from random hex into its name.
const HEX = "0123456789abcdef";
const DecodeLabel: React.FC<{
  x: number;
  y: number;
  text: string;
  at: number;
  color: string;
  anchor?: "start" | "middle" | "end";
  size?: number;
  opacity?: number;
}> = ({ x, y, text, at, color, anchor = "middle", size = 38, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const k = frame - at;
  if (k < 0) return null;
  const settled = Math.floor(k / 2);
  const shown = text
    .split("")
    .map((ch, j) =>
      j < settled
        ? ch
        : HEX[Math.floor(random(`${text}${j}${frame}`) * HEX.length)],
    )
    .join("");
  const o = interpolate(k, [0, 4], [0, 1], clamp) * opacity;
  const out = interpolate(frame, LABELS_OUT.map(sec), [1, 0], clamp);
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="middle"
      fontFamily={MONO}
      fontWeight={700}
      fontSize={size}
      fill={color}
      opacity={o * out}
      style={{
        filter: `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 2px ${color})`,
      }}
    >
      {shown}
    </text>
  );
};

// Light surging from a tower up the bridges into the beacon.
const Surge: React.FC<{ i: number; cam: Cam }> = ({ i, cam }) => {
  const frame = useCurrentFrame();
  const start = sec(SURGE) + i * 2;
  const dur = sec(SURGE_DUR);
  const path = [0, 1, 2, 3].map((l) => T[l][i >> l]);
  const at = (p: number) => {
    const seg = Math.min(2, Math.floor(p * 3));
    const f = p * 3 - seg;
    const a = path[seg];
    const b = path[seg + 1];
    return iso(
      a.x + (b.x - a.x) * f,
      a.y + (b.y - a.y) * f,
      a.z + (b.z - a.z) * f,
      cam,
    );
  };
  const p = (frame - start) / dur;
  if (p <= 0 || p >= 1.04) return null;
  const head = Easing.inOut(Easing.quad)(Math.min(1, p));
  const color = interpolateColors(
    head,
    [0, 0.6, 1],
    [C.file, "#ffffff", C.root],
  );
  return (
    <g>
      {Array.from({ length: 7 }, (_, j) => {
        const q = head - j * 0.016;
        if (q < 0 || q > 1) return null;
        const s = at(q);
        return (
          <circle
            key={j}
            cx={s.sx}
            cy={s.sy}
            r={(9 - j * 1.1) * cam.zoom}
            fill={j === 0 ? "#ffffff" : color}
            opacity={(1 - j / 7) * (p > 1 ? 0 : 1)}
          />
        );
      })}
      {(() => {
        const s = at(head);
        return (
          <circle
            cx={s.sx}
            cy={s.sy}
            r={20 * cam.zoom}
            fill={color}
            opacity={0.35}
          />
        );
      })()}
    </g>
  );
};

const Caption: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const c = CAPTIONS.find((x) => t >= x.from && t < x.to);
  if (!c) return null;
  const k = frame - sec(c.from);
  const left = sec(c.to) - frame;
  // Neon flicker-on, then a quick fade at the end.
  const flick = k < 8 ? (random(`cap${c.from}${k}`) > 0.35 ? 1 : 0.15) : 1;
  const o = Math.min(1, k / 3) * Math.min(1, left / 6) * flick;
  const split = k < 8 ? 6 * (1 - k / 8) : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        top: 64,
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 56,
        lineHeight: 1.08,
        letterSpacing: 4,
        whiteSpace: "nowrap",
        opacity: o,
      }}
    >
      {c.lines.map((line, j) => (
        <div key={j} style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: -split,
              color: "#00e5ff",
              opacity: 0.6,
              mixBlendMode: "screen",
            }}
          >
            {line}
          </span>
          <span
            style={{
              position: "absolute",
              left: split,
              color: "#ff2bd6",
              opacity: 0.6,
              mixBlendMode: "screen",
            }}
          >
            {line}
          </span>
          <span
            style={{
              position: "relative",
              color: C.text,
              textShadow: `0 0 10px ${c.color}, 0 0 24px ${c.color}, 0 0 48px ${c.color}`,
            }}
          >
            {line}
          </span>
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, rgba(5,1,15,0.35) 0px, rgba(5,1,15,0.35) 2px, transparent 2px, transparent 5px)",
        }}
      />
    </div>
  );
};

export const V2Scene04Grow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const cam = camAt(frame);
  const ig = sec(IGNITE);

  // Beam progress for the bridges into node (level, index).
  const beamP = (level: number, index: number) => {
    const [s, e] = BRIDGE[level][index];
    return interpolate(frame, [sec(s), sec(e)], [0, 1], {
      ...clamp,
      easing:
        level === 3 ? Easing.inOut(Easing.cubic) : Easing.out(Easing.quad),
    });
  };
  const hubScale = (level: number, index: number) => {
    const at = sec(BRIDGE[level][index][1]);
    const s = spring({
      frame: frame - at,
      fps,
      config: { damping: 9, stiffness: 160 },
    });
    const beat = LEVEL_BEAT[level];
    const bump = 0.35 * decay(frame, sec(beat), 5);
    return frame >= sec(10.5) ? 1 : s + bump;
  };

  // Tower glow: flares when hashed and when its light surges to the root.
  const towerGlow = (i: number) =>
    0.5 +
    0.5 * decay(frame, sec(hashAt(i)) + 10, 8) +
    0.5 * decay(frame, sec(SURGE) + i * 2, 10);

  // Root: a gold spark charges where the last bridges meet, then ignites.
  const rootS = iso(ROOT.x, ROOT.y, ROOT.z, cam);
  const charge = interpolate(frame, [sec(6.4), ig], [0, 1], clamp);
  const arrivals = Array.from({ length: 8 }, (_, i) =>
    decay(frame, sec(SURGE) + i * 2 + sec(SURGE_DUR), 6),
  ).reduce((a, b) => a + b, 0);
  const tail = interpolate(frame, [sec(10.4), sec(11.1)], [1, 0], clamp);
  const power =
    frame < ig
      ? 0
      : frame >= sec(11.1)
        ? 1
        : spring({
            frame: frame - ig,
            fps,
            config: { damping: 8, stiffness: 140 },
          }) +
          (1.3 * decay(frame, ig, 6) + 0.12 * arrivals) * tail;

  const k = frame - ig;
  const pillarUp = interpolate(k, [0, 6], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const pillarFade = interpolate(frame, [ig + 8, sec(10.6)], [1, 0], clamp);
  const groundC = iso(ROOT.x, ROOT.y, 0, cam);

  const fade = interpolate(
    frame,
    [0, 9, durationInFrames - 9, durationInFrames],
    [1, 0, 0, 1],
    clamp,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: C.skyTop }}>
      <Audio src={staticFile("scene04.wav")} />
      <NeonBackground cam={cam} />
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute" }}>
        <NeonDefs />

        {/* ground bursts and the ground shockwave of the ignition */}
        {TOWER_H.map((_, i) => (
          <RiseBurst key={`rb${i}`} i={i} cam={cam} />
        ))}
        {k >= 0 && k < 40 ? (
          <ellipse
            cx={groundC.sx}
            cy={groundC.sy}
            rx={interpolate(k, [0, 40], [60, 1700], {
              easing: Easing.out(Easing.cubic),
            })}
            ry={
              0.577 *
              interpolate(k, [0, 40], [60, 1700], {
                easing: Easing.out(Easing.cubic),
              })
            }
            fill="none"
            stroke={C.root}
            strokeWidth={10 * (1 - k / 40) + 1}
            opacity={1 - k / 40}
            filter="url(#neon)"
          />
        ) : null}

        {/* light bridges */}
        {T.slice(0, 3).flatMap((lvl) =>
          lvl.map((n) => {
            const p = T[n.level + 1][n.index >> 1];
            const prog = beamP(p.level, p.index);
            if (prog <= 0) return null;
            const a: [number, number, number] = [n.x, n.y, n.z];
            const b: [number, number, number] = [p.x, p.y, p.z];
            return (
              <g key={`b${n.level}${n.index}`}>
                <Beam a={a} b={b} progress={prog} cam={cam} />
                <BeamHead a={a} b={b} progress={prog} cam={cam} />
              </g>
            );
          }),
        )}

        {/* towers */}
        {TOWER_H.map((h, i) => {
          const s = spring({
            frame: frame - sec(riseAt(i)),
            fps,
            config: { damping: 11, stiffness: 110 },
          });
          const rise = frame >= sec(10.5) ? 1 : s;
          if (rise <= 0.001) return null;
          return (
            <Tower
              key={i}
              {...towerPos(i)}
              h={h}
              seed={`t${i}`}
              rise={rise}
              glow={Math.min(1, towerGlow(i))}
              cam={cam}
            />
          );
        })}
        {TOWER_H.map((_, i) => (
          <HashScan key={`hs${i}`} i={i} cam={cam} />
        ))}

        {/* hubs, and their lock-in bursts */}
        {T.slice(1, 3).flatMap((lvl) =>
          lvl.map((n) => {
            const sc = hubScale(n.level, n.index);
            if (sc <= 0.001) return null;
            return (
              <Hub
                key={`h${n.level}${n.index}`}
                x={n.x}
                y={n.y}
                z={n.z}
                scale={sc}
                cam={cam}
              />
            );
          }),
        )}
        {T.slice(1, 3).flatMap((lvl) =>
          lvl.map((n) => {
            const s = iso(n.x, n.y, n.z, cam);
            return (
              <g key={`hb${n.level}${n.index}`}>
                <Burst
                  sx={s.sx}
                  sy={s.sy}
                  at={sec(BRIDGE[n.level][n.index][1])}
                  color={C.hash}
                  size={n.level === 1 ? 1 : 1.3}
                  seed={`hb${n.level}${n.index}`}
                />
                <Burst
                  sx={s.sx}
                  sy={s.sy}
                  at={sec(LEVEL_BEAT[n.level])}
                  color={C.hash}
                  size={0.7}
                  seed={`lb${n.level}${n.index}`}
                />
              </g>
            );
          }),
        )}

        {/* root: charging spark, then the beacon ignites */}
        {frame >= sec(6.4) && frame < ig + 4 ? (
          <g>
            {Array.from({ length: 18 }, (_, j) => {
              const ang = (j / 18) * Math.PI * 2 + random(`ca${j}`);
              const ph = (frame / 14 + random(`cp${j}`)) % 1;
              const d = 260 * (1 - ph) * (1 - 0.5 * charge);
              return (
                <line
                  key={j}
                  x1={rootS.sx + Math.cos(ang) * d}
                  y1={rootS.sy + Math.sin(ang) * d}
                  x2={rootS.sx + Math.cos(ang) * (d + 40)}
                  y2={rootS.sy + Math.sin(ang) * (d + 40)}
                  stroke={j % 2 ? C.root : "#ffffff"}
                  strokeWidth={3}
                  opacity={ph * (0.3 + 0.7 * charge)}
                />
              );
            })}
            <circle
              cx={rootS.sx}
              cy={rootS.sy}
              r={(30 + 110 * charge) * cam.zoom}
              fill={C.root}
              opacity={0.35 + 0.3 * random(`ch${frame}`)}
              filter="url(#neon-wide)"
            />
            <circle
              cx={rootS.sx}
              cy={rootS.sy}
              r={(6 + 22 * charge) * (0.8 + 0.4 * random(`cr${frame}`))}
              fill="#ffffff"
            />
          </g>
        ) : null}
        {k >= 0 && pillarFade > 0 ? (
          <g opacity={pillarFade}>
            <rect
              x={rootS.sx - (40 + 60 * decay(frame, ig, 8))}
              y={rootS.sy * (1 - pillarUp)}
              width={2 * (40 + 60 * decay(frame, ig, 8))}
              height={rootS.sy * pillarUp}
              fill={C.root}
              opacity={0.45}
              filter="url(#neon-wide)"
            />
            <rect
              x={rootS.sx - 5}
              y={rootS.sy * (1 - pillarUp)}
              width={10}
              height={rootS.sy * pillarUp}
              fill="#fff8d6"
              opacity={0.9}
            />
          </g>
        ) : null}
        {power > 0 ? (
          <Beacon x={ROOT.x} y={ROOT.y} z={ROOT.z} power={power} cam={cam} />
        ) : null}
        {[0, 7].map((d) => {
          const kk = k - d;
          if (kk < 0 || kk > 32) return null;
          const r = interpolate(kk, [0, 32], [40, 1300], {
            easing: Easing.out(Easing.cubic),
          });
          return (
            <circle
              key={`sw${d}`}
              cx={rootS.sx}
              cy={rootS.sy}
              r={r}
              fill="none"
              stroke={d === 0 ? "#fff3b0" : C.root}
              strokeWidth={14 * (1 - kk / 32) + 1}
              opacity={1 - kk / 32}
            />
          );
        })}

        {/* every tower's light surges into the root */}
        <g filter="url(#neon)">
          {TOWER_H.map((_, i) => (
            <Surge key={`sg${i}`} i={i} cam={cam} />
          ))}
        </g>

        {/* hash labels */}
        {TOWER_H.map((_, i) => {
          const p = towerPos(i);
          const base = iso(p.x + TOWER_W, p.y + TOWER_W, 0, cam);
          const hot = frame >= sec(1.7) && frame < sec(2.6) && i < 2 ? 1 : 0.85;
          return (
            <DecodeLabel
              key={`l0${i}`}
              x={base.sx}
              y={base.sy + 46}
              text={HASH_NAME[0][i]}
              at={sec(hashAt(i)) + 10}
              color={hot === 1 ? "#ffffff" : C.hash}
              opacity={hot}
            />
          );
        })}
        {T.slice(1, 3).flatMap((lvl) =>
          lvl.map((n) => {
            const s = iso(n.x, n.y, n.z, cam);
            const left = n.index % 2 === 0;
            const at = sec(BRIDGE[n.level][n.index][1]) + 2;
            return (
              <DecodeLabel
                key={`l${n.level}${n.index}`}
                x={s.sx + (left ? -46 : 46)}
                y={s.sy}
                text={HASH_NAME[n.level][n.index]}
                at={at}
                color={C.text}
                anchor={left ? "end" : "start"}
              />
            );
          }),
        )}
        {(() => {
          // The first pair, spelled out: "h1 + h2" until the hub locks in.
          const n = T[1][0];
          const s = iso(n.x, n.y, n.z, cam);
          const a = sec(1.8);
          const b = sec(BRIDGE[1][0][1]);
          if (frame < a || frame > b + 6) return null;
          const o =
            interpolate(frame, [a, a + 5], [0, 1], clamp) *
            interpolate(frame, [b, b + 6], [1, 0], clamp);
          const y = s.sy - 150 + interpolate(frame, [b, b + 6], [0, 60], clamp);
          return (
            <text
              x={s.sx}
              y={y}
              textAnchor="middle"
              fontFamily={MONO}
              fontWeight={700}
              fontSize={50}
              fill={C.text}
              opacity={o}
              style={{ filter: `drop-shadow(0 0 8px ${C.hash})` }}
            >
              h1 <tspan fill={C.hash}>+</tspan> h2
            </text>
          );
        })()}
        {power > 0 ? (
          <DecodeLabel
            x={rootS.sx + 70}
            y={rootS.sy - 46}
            text="ROOT"
            at={ig + 3}
            color={C.root}
            anchor="start"
            size={60}
          />
        ) : null}
      </svg>

      <Caption />

      {/* ignition flash */}
      <AbsoluteFill
        style={{
          backgroundColor: "#fff3c4",
          opacity: 0.75 * decay(frame, ig, 4),
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill style={{ backgroundColor: C.skyTop, opacity: fade }} />
    </AbsoluteFill>
  );
};
