import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Beacon,
  Beam,
  C,
  Cam,
  clamp,
  FONT,
  HEIGHT,
  Hub,
  iso,
  NeonBackground,
  NeonDefs,
  Tower,
  WIDTH,
} from "./kit";

// Scene 7 (9 s): where Merkle trees are used. Three neon districts light up as they
// are named, each under its own hand-drawn neon sign (a branch for Git, a ₿ for
// Bitcoin, a cloud with sync arrows for file sync) and each with its own small
// Merkle tree and gold beacon. Light pulses climb every tree ("check a lot of data"),
// then the three beacons lift off and fuse into one giant beacon ("just one hash"),
// the "Merkle tree" sign buzzes on and the camera pulls back over the whole city.
// The last second is a held final frame.
// Narration: "Git, Bitcoin and file-sync apps all use Merkle trees, to check a lot
// of data by looking at just one hash."

// Narration beats in seconds (measured from public/scene07.wav, 6.8 s long).
const T = {
  git: 0.05,
  bitcoin: 0.6,
  sync: 1.3,
  trees: 2.3, // "all use Merkle trees"
  pulses: 4.0, // "to check a lot of data"
  merge: 5.35, // "by looking at just one hash"
  arrive: 6.25,
  title: 6.45,
  settle: 7.2, // camera at rest: held final frame from here
};
const sec = (s: number) => Math.round(s * 30);

// World helper: a point at screen offset `sx` (px at zoom 1) from the centre and
// depth `d` (positive = toward the viewer), height z. With iso(): screen x =
// centre + sx * zoom, screen y = ground + (d - z) * zoom.
const world = (sx: number, d: number) => {
  const u = sx / 0.866;
  return { x: (u + 2 * d) / 2, y: (2 * d - u) / 2 };
};

type District = {
  name: string;
  color: string;
  sx: number;
  start: number;
  heights: number[];
  icon: "git" | "btc" | "sync";
};

const DISTRICTS: District[] = [
  {
    name: "Git",
    color: "#c77dff",
    sx: -620,
    start: T.git,
    heights: [110, 150, 90, 130],
    icon: "git",
  },
  {
    name: "Bitcoin",
    color: "#ff9f1c",
    sx: 0,
    start: T.bitcoin,
    heights: [140, 95, 155, 115],
    icon: "btc",
  },
  {
    name: "File sync",
    color: C.file,
    sx: 620,
    start: T.sync,
    heights: [100, 145, 120, 160],
    icon: "sync",
  },
];

const LEAF_DX = [-165, -55, 55, 165];
const HUB_DX = [-110, 110];
const TW = 50; // district tower footprint
const HUB_Z = 235;
const BEACON_Z = 335;
const SIGN_Z = 505;
const GIANT = { x: 960, y: 132 };

// Dim background skyline, generated once.
const SKYLINE = Array.from({ length: 34 }, (_, i) => {
  const row = i % 2;
  return {
    sx: -1500 + (i / 34) * 3000 + (random(`bx${i}`) - 0.5) * 60,
    d: row === 0 ? -620 - random(`bd${i}`) * 80 : -330 - random(`bd${i}`) * 60,
    h: 180 + random(`bh${i}`) * (row === 0 ? 420 : 260),
    w: 60 + random(`bw${i}`) * 50,
    color: [C.hash, C.grid, C.file][Math.floor(random(`bc${i}`) * 3)],
    near: row === 1,
  };
}).sort((a, b) => a.d - b.d);

// Neon sign flicker: a stuttering switch-on, then steady with a rare dip.
const FLICK = [1, 0, 0, 0.8, 0, 1, 1, 0, 0.3, 1, 1, 1, 0, 1];
const flicker = (f: number, startFrame: number, seed: string) => {
  const t = f - startFrame;
  if (t < 0) return 0;
  if (t < FLICK.length) return FLICK[t];
  return random(`${seed}${f}`) > 0.97 ? 0.55 : 1;
};

// ---------------------------------------------------------------------------
// Neon sign icons, drawn in a 100×100 box.
// ---------------------------------------------------------------------------
const Icon: React.FC<{ kind: District["icon"]; color: string; f: number }> = ({
  kind,
  color,
  f,
}) => {
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth: 6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const core = { ...common, stroke: "#ffffff", strokeWidth: 2, opacity: 0.85 };
  let body: React.ReactNode;
  if (kind === "git") {
    const d = "M34 24 V76 M70 34 C70 58 34 52 34 70";
    body = (
      <>
        <path d={d} {...common} />
        <circle cx={34} cy={16} r={8} {...common} />
        <circle cx={34} cy={84} r={8} {...common} />
        <circle cx={70} cy={26} r={8} {...common} />
        <path d={d} {...core} />
      </>
    );
  } else if (kind === "btc") {
    const d =
      "M38 26 V74 M38 26 H58 A12 12 0 0 1 58 50 H38 M38 50 H61 A12 12 0 0 1 61 74 H38 M46 18 V26 M56 18 V26 M46 74 V82 M56 74 V82";
    body = (
      <>
        <circle cx={50} cy={50} r={44} {...common} />
        <path d={d} {...common} />
        <path d={d} {...core} />
      </>
    );
  } else {
    const spin = (f * 4) % 360;
    const cloud =
      "M26 78 A17 17 0 0 1 24 44 A24 24 0 0 1 70 36 A21 21 0 0 1 76 78 Z";
    const arrows =
      "M39 56 A13 13 0 0 1 63 52 M60 46 L63 52 L69 48 M63 64 A13 13 0 0 1 39 68 M42 74 L39 68 L33 72";
    body = (
      <>
        <path d={cloud} {...common} />
        <g transform={`rotate(${spin} 51 60)`}>
          <path d={arrows} {...common} strokeWidth={5} />
          <path d={arrows} {...core} />
        </g>
        <path d={cloud} {...core} />
      </>
    );
  }
  return <g filter="url(#neon)">{body}</g>;
};

// A floating neon billboard: icon + name, flickering on.
const Sign: React.FC<{
  d: District;
  cam: Cam;
  f: number;
  on: number;
}> = ({ d, cam, f, on }) => {
  const p = world(d.sx, 0);
  const c = iso(p.x, p.y, SIGN_Z, cam);
  const bob = Math.sin(f / 22 + d.sx) * 4 * cam.zoom;
  const appear = interpolate(f, [sec(d.start), sec(d.start) + 8], [0.6, 1], {
    ...clamp,
    easing: Easing.out(Easing.back(2)),
  });
  return (
    <g
      transform={`translate(${c.sx} ${c.sy + bob}) scale(${cam.zoom * appear})`}
      opacity={on > 0 ? 1 : 0.18}
    >
      <rect
        x={-200}
        y={-125}
        width={400}
        height={250}
        rx={26}
        fill={d.color}
        opacity={0.16 * on}
        filter="url(#neon-wide)"
      />
      <rect
        x={-200}
        y={-125}
        width={400}
        height={250}
        rx={26}
        fill="#0b0620"
        fillOpacity={0.88}
      />
      <g opacity={0.25 + 0.75 * on}>
        <rect
          x={-200}
          y={-125}
          width={400}
          height={250}
          rx={26}
          fill="none"
          stroke={d.color}
          strokeWidth={4}
          filter="url(#neon)"
        />
        <rect
          x={-188}
          y={-113}
          width={376}
          height={226}
          rx={18}
          fill="none"
          stroke={d.color}
          strokeWidth={1.5}
          opacity={0.5}
        />
        <g transform="translate(-55 -112) scale(1.1)">
          <Icon kind={d.icon} color={d.color} f={f} />
        </g>
        <text
          x={0}
          y={82}
          textAnchor="middle"
          fontFamily={FONT}
          fontWeight={800}
          fontSize={60}
          fill="#fff8ff"
          stroke={d.color}
          strokeWidth={2}
          filter="url(#neon)"
          letterSpacing={2}
        >
          {d.name}
        </text>
      </g>
    </g>
  );
};

type P2 = { x: number; y: number };
const quad = (a: P2, c: P2, b: P2, t: number): P2 => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});

export const V2Scene07Uses: React.FC = () => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Camera: slow push-in while the districts are named, then a long crane/pull-back
  // that reveals the whole city and comes to rest for the held final frame.
  const pull = interpolate(f, [sec(T.merge), sec(T.settle)], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const push = interpolate(f, [0, sec(T.merge)], [0, 1], clamp);
  const cam: Cam = {
    x: interpolate(push, [0, 1], [30, -10]) * (1 - pull),
    y: 60 + 140 * pull,
    zoom: 1.08 + 0.06 * push - (1.14 - 0.64) * pull,
  };

  // Impact of the merge: screen shake.
  const tHit = f - sec(T.arrive);
  const shakeAmp = tHit >= 0 ? 16 * Math.exp(-tHit / 4) : 0;
  const shakeX = (random(`shx${f}`) - 0.5) * 2 * shakeAmp;
  const shakeY = (random(`shy${f}`) - 0.5) * 2 * shakeAmp;

  const giant =
    tHit < 0
      ? 0
      : spring({
          frame: tHit,
          fps,
          config: { damping: 11, stiffness: 120 },
        });

  // Per-district state.
  const districts = DISTRICTS.map((d, di) => {
    const s0 = sec(d.start);
    const on = flicker(f, s0, d.name);
    const leaves = LEAF_DX.map((dx, i) => {
      const w = world(d.sx + dx, 0);
      const rise = spring({
        frame: f - s0 - 3 - i * 3,
        fps,
        config: { damping: 14, stiffness: 110 },
      });
      return { ...w, h: d.heights[i], rise, top: d.heights[i] * rise };
    });
    const hubs = HUB_DX.map((dx) => world(d.sx + dx, 0));
    const root = world(d.sx, 0);
    const tTree = sec(T.trees) + di * 4;
    const beamA = interpolate(f, [tTree, tTree + 10], [0, 1], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    });
    const beamB = interpolate(f, [tTree + 8, tTree + 18], [0, 1], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    });
    const tPulse = sec(T.pulses) + di * 4;
    const pa = interpolate(f, [tPulse, tPulse + 14], [0, 1], clamp);
    const pb = interpolate(f, [tPulse + 14, tPulse + 26], [0, 1], clamp);
    const flare = interpolate(
      f,
      [tPulse + 24, tPulse + 28, tPulse + 44],
      [0, 1, 0],
      clamp,
    );
    const beaconPow =
      interpolate(f, [tTree + 14, tTree + 24], [0, 0.75], clamp) +
      0.6 * flare -
      0.15 * pull;
    return {
      d,
      di,
      on,
      leaves,
      hubs,
      root,
      beamA,
      beamB,
      pa,
      pb,
      beaconPow,
    };
  });

  // Rising orbs: each district's beacon light flies up into the giant beacon.
  const tFly = interpolate(f, [sec(T.merge), sec(T.arrive)], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });
  const flying = f >= sec(T.merge) && f < sec(T.arrive) + 2;

  // Title.
  const tTitle = sec(T.title);
  const titleOn = flicker(f, tTitle, "title");
  const titleGlitch = f >= tTitle && f < tTitle + FLICK.length;
  const titleIn = interpolate(f, [tTitle, tTitle + 14], [0.92, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const captionIn = interpolate(f, [tTitle + 18, tTitle + 32], [0, 1], clamp);

  const fade = interpolate(
    f,
    [0, 9, durationInFrames - 9, durationInFrames],
    [1, 0, 0, 1],
    clamp,
  );

  const rayRot = f * 0.25;
  const rayLen = 1500;

  return (
    <AbsoluteFill style={{ backgroundColor: C.skyTop, overflow: "hidden" }}>
      <Audio src={staticFile("scene07.wav")} />
      <AbsoluteFill
        style={{ transform: `translate(${shakeX}px, ${shakeY}px) scale(1.02)` }}
      >
        <NeonBackground cam={cam} speed={0.3} />
        <svg
          width={WIDTH}
          height={HEIGHT}
          style={{ position: "absolute", inset: 0 }}
        >
          <NeonDefs />
          <defs>
            <radialGradient
              id="s7rays"
              cx={GIANT.x}
              cy={GIANT.y}
              r={rayLen}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor={C.root} stopOpacity={0.55} />
              <stop offset="0.5" stopColor={C.root} stopOpacity={0.12} />
              <stop offset="1" stopColor={C.root} stopOpacity={0} />
            </radialGradient>
          </defs>

          {/* Light rays from the giant beacon (behind the city). */}
          {giant > 0 ? (
            <g
              transform={`rotate(${rayRot} ${GIANT.x} ${GIANT.y})`}
              opacity={Math.min(1, giant) * 0.9}
            >
              {Array.from({ length: 18 }, (_, i) => {
                const a = (i / 18) * Math.PI * 2;
                const half = 0.035 + 0.025 * (i % 2);
                const p1 = {
                  x: GIANT.x + Math.cos(a - half) * rayLen,
                  y: GIANT.y + Math.sin(a - half) * rayLen,
                };
                const p2 = {
                  x: GIANT.x + Math.cos(a + half) * rayLen,
                  y: GIANT.y + Math.sin(a + half) * rayLen,
                };
                return (
                  <polygon
                    key={i}
                    points={`${GIANT.x},${GIANT.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
                    fill="url(#s7rays)"
                  />
                );
              })}
            </g>
          ) : null}

          {/* Background skyline. */}
          {SKYLINE.map((b, i) => {
            const w = world(b.sx, b.d);
            return (
              <g key={`sky${i}`} opacity={b.near ? 0.62 : 0.36}>
                <Tower
                  x={w.x - b.w / 2}
                  y={w.y - b.w / 2}
                  w={b.w}
                  d={b.w}
                  h={b.h}
                  color={b.color}
                  glow={0.15 + 0.25 * giant}
                  cam={cam}
                  windows={b.near}
                  seed={`sk${i}`}
                />
              </g>
            );
          })}

          {/* District trees: beams, towers, hubs, beacons, pulses. */}
          {districts.map(
            ({
              d,
              di,
              leaves,
              hubs,
              root,
              beamA,
              beamB,
              pa,
              pb,
              beaconPow,
            }) => (
              <g key={`dist${di}`}>
                {/* Ground glow of the district. */}
                {(() => {
                  const g = iso(root.x, root.y, 0, cam);
                  const on = leaves[0].rise;
                  return (
                    <ellipse
                      cx={g.sx}
                      cy={g.sy}
                      rx={260 * cam.zoom}
                      ry={70 * cam.zoom}
                      fill={d.color}
                      opacity={0.22 * Math.min(1, on)}
                      filter="url(#neon-wide)"
                    />
                  );
                })()}
                {leaves.map((l, i) => {
                  const hb = hubs[Math.floor(i / 2)];
                  return (
                    <Beam
                      key={`ba${i}`}
                      a={[l.x, l.y, l.top]}
                      b={[hb.x, hb.y, HUB_Z]}
                      progress={beamA}
                      width={3}
                      cam={cam}
                    />
                  );
                })}
                {hubs.map((hb, i) => (
                  <Beam
                    key={`bb${i}`}
                    a={[hb.x, hb.y, HUB_Z]}
                    b={[root.x, root.y, BEACON_Z]}
                    progress={beamB}
                    width={3}
                    cam={cam}
                  />
                ))}
                {leaves.map((l, i) => (
                  <Tower
                    key={`t${i}`}
                    x={l.x - TW / 2}
                    y={l.y - TW / 2}
                    w={TW}
                    d={TW}
                    h={l.h}
                    rise={Math.max(0.001, l.rise)}
                    color={d.color}
                    glow={0.45 + 0.4 * pa * (1 - pb)}
                    cam={cam}
                    seed={`d${di}t${i}`}
                  />
                ))}
                {hubs.map((hb, i) =>
                  beamA > 0.6 ? (
                    <Hub
                      key={`h${i}`}
                      x={hb.x}
                      y={hb.y}
                      z={HUB_Z}
                      r={16}
                      scale={interpolate(beamA, [0.6, 1], [0, 1])}
                      cam={cam}
                    />
                  ) : null,
                )}
                {beaconPow > 0 ? (
                  <Beacon
                    x={root.x}
                    y={root.y}
                    z={BEACON_Z}
                    power={beaconPow}
                    cam={cam}
                  />
                ) : null}
                {/* Light pulses climbing the tree. */}
                <g>
                  {pa > 0 && pa < 1
                    ? leaves.map((l, i) => {
                        const hb = hubs[Math.floor(i / 2)];
                        const q = iso(
                          l.x + (hb.x - l.x) * pa,
                          l.y + (hb.y - l.y) * pa,
                          l.top + (HUB_Z - l.top) * pa,
                          cam,
                        );
                        return (
                          <g key={`pa${i}`}>
                            <circle
                              cx={q.sx}
                              cy={q.sy}
                              r={16 * cam.zoom}
                              fill={C.text}
                              opacity={0.35}
                              filter="url(#neon-wide)"
                            />
                            <circle
                              cx={q.sx}
                              cy={q.sy}
                              r={6 * cam.zoom}
                              fill="#ffffff"
                            />
                          </g>
                        );
                      })
                    : null}
                  {pb > 0 && pb < 1
                    ? hubs.map((hb, i) => {
                        const q = iso(
                          hb.x + (root.x - hb.x) * pb,
                          hb.y + (root.y - hb.y) * pb,
                          HUB_Z + (BEACON_Z - HUB_Z) * pb,
                          cam,
                        );
                        return (
                          <g key={`pb${i}`}>
                            <circle
                              cx={q.sx}
                              cy={q.sy}
                              r={20 * cam.zoom}
                              fill={C.root}
                              opacity={0.45}
                              filter="url(#neon-wide)"
                            />
                            <circle
                              cx={q.sx}
                              cy={q.sy}
                              r={7 * cam.zoom}
                              fill="#ffffff"
                            />
                          </g>
                        );
                      })
                    : null}
                </g>
              </g>
            ),
          )}

          {/* Neon signs. */}
          {districts.map(({ d, di, on }) => (
            <Sign key={`sign${di}`} d={d} cam={cam} f={f} on={on} />
          ))}

          {/* The three beacon lights fly up and fuse. */}
          {flying
            ? districts.map(({ root, di }) => {
                const a0 = iso(root.x, root.y, BEACON_Z, cam);
                const ctrl = {
                  x: a0.sx + (a0.sx - GIANT.x) * 0.35,
                  y: GIANT.y + 40,
                };
                const pos = (t: number) =>
                  quad({ x: a0.sx, y: a0.sy }, ctrl, GIANT, t);
                const trail = Array.from({ length: 12 }, (_, k) =>
                  pos(Math.max(0, tFly - k * 0.03)),
                );
                const head = pos(tFly);
                return (
                  <g key={`orb${di}`}>
                    <polyline
                      points={trail.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke={C.root}
                      strokeWidth={14}
                      strokeLinecap="round"
                      opacity={0.35}
                      filter="url(#neon-wide)"
                    />
                    <polyline
                      points={trail.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke="#fff3b0"
                      strokeWidth={4}
                      strokeLinecap="round"
                      filter="url(#neon)"
                    />
                    <circle
                      cx={head.x}
                      cy={head.y}
                      r={34}
                      fill="url(#beacon)"
                    />
                    <circle cx={head.x} cy={head.y} r={10} fill="#ffffff" />
                  </g>
                );
              })
            : null}

          {/* The giant beacon. */}
          {giant > 0 ? (
            <g>
              <rect
                x={GIANT.x - 26 * giant}
                y={0}
                width={52 * giant}
                height={GIANT.y}
                fill={C.root}
                opacity={0.35}
                filter="url(#neon-wide)"
              />
              <rect
                x={GIANT.x - 5}
                y={0}
                width={10}
                height={GIANT.y}
                fill="#fff6c8"
                opacity={0.8 * Math.min(1, giant)}
              />
              <circle
                cx={GIANT.x}
                cy={GIANT.y}
                r={190 * giant * (1 + 0.05 * Math.sin(f / 6))}
                fill="url(#beacon)"
                opacity={0.55}
              />
              <circle
                cx={GIANT.x}
                cy={GIANT.y}
                r={80 * giant}
                fill="url(#beacon)"
              />
              <circle cx={GIANT.x} cy={GIANT.y} r={32 * giant} fill="#ffffff" />
              {/* Anamorphic flare streak. */}
              <ellipse
                cx={GIANT.x}
                cy={GIANT.y}
                rx={620 * giant}
                ry={5}
                fill="#fff6c8"
                opacity={0.6}
                filter="url(#neon)"
              />
            </g>
          ) : null}

          {/* Shockwave and sparks on impact. */}
          {tHit >= 0 && tHit < 26 ? (
            <g>
              <circle
                cx={GIANT.x}
                cy={GIANT.y}
                r={40 + tHit * 45}
                fill="none"
                stroke={C.root}
                strokeWidth={10 * (1 - tHit / 26)}
                opacity={1 - tHit / 26}
                filter="url(#neon)"
              />
              <circle
                cx={GIANT.x}
                cy={GIANT.y}
                r={20 + tHit * 28}
                fill="none"
                stroke={C.hash}
                strokeWidth={6 * (1 - tHit / 26)}
                opacity={0.8 * (1 - tHit / 26)}
              />
            </g>
          ) : null}
          {tHit >= 0 && tHit < 40 ? (
            <g>
              {Array.from({ length: 40 }, (_, i) => {
                const a = random(`spa${i}`) * Math.PI * 2;
                const v = 8 + random(`spv${i}`) * 16;
                const x = GIANT.x + Math.cos(a) * v * tHit;
                const y = GIANT.y + Math.sin(a) * v * tHit + 0.35 * tHit * tHit;
                const life = 1 - tHit / 40;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={2 + 3 * life}
                    fill={i % 3 === 0 ? C.hash : "#fff3b0"}
                    opacity={life}
                  />
                );
              })}
            </g>
          ) : null}
          {/* Impact flash. */}
          {tHit >= 0 && tHit < 10 ? (
            <rect
              width={WIDTH}
              height={HEIGHT}
              fill="#fff3d0"
              opacity={0.28 * (1 - tHit / 10)}
            />
          ) : null}
        </svg>

        {/* The "Merkle tree" neon title. */}
        {f >= tTitle ? (
          <AbsoluteFill
            style={{
              alignItems: "center",
              justifyContent: "flex-start",
              paddingTop: 236,
            }}
          >
            <div
              style={{
                transform: `scale(${titleIn})`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  position: "relative",
                  padding: "10px 56px 22px",
                  borderRadius: 28,
                  background: "rgba(10, 4, 26, 0.72)",
                  border: `4px solid ${C.hash}`,
                  boxShadow: `0 0 ${18 * titleOn}px ${C.hash}, 0 0 ${60 * titleOn}px ${C.hash}88, inset 0 0 ${24 * titleOn}px ${C.hash}66`,
                  opacity: 0.35 + 0.65 * titleOn,
                }}
              >
                {titleGlitch ? (
                  <>
                    <TitleText
                      color="#ff2b5c"
                      dx={-8 * (1 - titleOn + 0.4)}
                      opacity={0.6}
                    />
                    <TitleText
                      color="#00e5ff"
                      dx={8 * (1 - titleOn + 0.4)}
                      opacity={0.6}
                    />
                  </>
                ) : null}
                <TitleText
                  color="#fff8d6"
                  glow={titleOn}
                  opacity={0.15 + 0.85 * titleOn}
                />
              </div>
              <div
                style={{
                  marginTop: 20,
                  fontFamily: FONT,
                  fontSize: 44,
                  fontWeight: 600,
                  letterSpacing: 3,
                  color: C.text,
                  opacity: captionIn,
                  transform: `translateY(${(1 - captionIn) * 14}px)`,
                  textShadow: `0 0 12px ${C.root}, 0 0 30px ${C.root}88`,
                }}
              >
                One hash checks it all
              </div>
            </div>
          </AbsoluteFill>
        ) : null}
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          backgroundColor: C.skyTop,
          opacity: fade,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

const TitleText: React.FC<{
  color: string;
  dx?: number;
  opacity: number;
  glow?: number;
}> = ({ color, dx = 0, opacity, glow }) => (
  <div
    style={{
      position: glow === undefined ? "absolute" : "relative",
      inset: glow === undefined ? "10px 56px 22px" : undefined,
      transform: `translateX(${dx}px)`,
      fontFamily: FONT,
      fontWeight: 900,
      fontSize: 150,
      lineHeight: 1.1,
      letterSpacing: 4,
      whiteSpace: "nowrap",
      color,
      opacity,
      mixBlendMode: glow === undefined ? "screen" : undefined,
      textShadow:
        glow === undefined
          ? undefined
          : `0 0 ${6 * glow}px #fff, 0 0 ${18 * glow}px ${C.root}, 0 0 ${40 * glow}px ${C.root}, 0 0 ${90 * glow}px ${C.hash}`,
    }}
  >
    Merkle tree
  </div>
);
