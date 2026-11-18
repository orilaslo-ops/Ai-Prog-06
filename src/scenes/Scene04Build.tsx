import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, HEIGHT, MONO, WIDTH } from "./theme";

// Scene 4 (12 s): building the tree.
// Narration (10.5 s): "Hash every file. Then hash each pair of hashes together, and
// again, level by level, until one hash is left: the root. The root depends on every
// single file."
//
// Same 8-leaf layout as scenes 1, 5 and 6: files at y=880, hash levels at 680/480/280.
// Each file gets a small hash tag (h1…h8) sitting on its top edge; the first pair is
// combined slowly ("h1 + h2" → h12), the rest build quickly with light running up the
// edges, and at the end light from every file climbs to the root.

const LEAVES = 8;
const LEVEL_Y = [880, 680, 480, 280];
const NODE_W = [170, 200, 230, 280];
const NODE_H = 90;
const TAG_W = 96;
const TAG_H = 46;
const TAG_Y = LEVEL_Y[0] - NODE_H / 2 - 4; // the leaf hash tag straddles the card's top edge

// Narration beats, in seconds (measured from public/scene04.wav).
const T = {
  leafIn: 0.05,
  tagIn: 0.35, // "Hash every file."
  pairStart: 1.7, // "Then hash each pair…"
  plus: 2.25,
  merge: 2.75,
  h12: 3.0,
  level1: [3.0, 3.3, 3.45, 3.6],
  level2: [4.4, 4.6], // "level by level"
  rootPop: 6.3, // "until one hash is left"
  rootName: 7.3, // "the root."
  wave: 8.25, // "The root depends on every single file."
  waveTravel: 1.25,
};
const EDGE_GROW = 0.4; // seconds the light takes to run up an edge

type Node = { x: number; y: number; level: number; index: number };

const buildLevels = (): Node[][] => {
  const spacing = WIDTH / LEAVES;
  const levels: Node[][] = [
    Array.from({ length: LEAVES }, (_, i) => ({
      x: spacing * (i + 0.5),
      y: LEVEL_Y[0],
      level: 0,
      index: i,
    })),
  ];
  while (levels[levels.length - 1].length > 1) {
    const below = levels[levels.length - 1];
    const level = levels.length;
    levels.push(
      Array.from({ length: below.length / 2 }, (_, i) => ({
        x: (below[2 * i].x + below[2 * i + 1].x) / 2,
        y: LEVEL_Y[level],
        level,
        index: i,
      })),
    );
  }
  return levels;
};

const LEVELS = buildLevels();
const ROOT = LEVELS[3][0];

// "h12", "h1234", … : the leaves a node covers.
const label = (n: Node): string => {
  const span = 2 ** n.level;
  const first = n.index * span + 1;
  if (n.level === 3) return "root";
  return "h" + Array.from({ length: span }, (_, k) => first + k).join("");
};

const popTime = (n: Node): number =>
  n.level === 1 ? T.level1[n.index] : n.level === 2 ? T.level2[n.index] : T.rootPop;

// Where an edge leaves a child (top) and enters its parent (bottom).
const childTop = (n: Node): number => (n.level === 0 ? TAG_Y - TAG_H / 2 : n.y - NODE_H / 2);
const parentBottom = (n: Node): number => n.y + NODE_H / 2;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

// Deterministic pseudo-random numbers for the background dust.
const rand = (i: number): number => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const DUST = Array.from({ length: 46 }, (_, i) => ({
  x: rand(i) * WIDTH,
  y: rand(i + 100) * HEIGHT,
  r: 1 + rand(i + 200) * 2.4,
  speed: 6 + rand(i + 300) * 14,
  phase: rand(i + 400) * Math.PI * 2,
}));

const CAPTIONS: { from: number; to: number; text: React.ReactNode }[] = [
  {
    from: 0.15,
    to: 1.55,
    text: (
      <>
        Hash <span style={{ color: COLORS.hash }}>every file</span>
      </>
    ),
  },
  {
    from: 1.6,
    to: 3.95,
    text: (
      <>
        Hash each <span style={{ color: COLORS.hash }}>pair</span> together
      </>
    ),
  },
  {
    from: 4.0,
    to: 7.1,
    text: (
      <>
        Level by level<span style={{ color: COLORS.muted }}>…</span>
      </>
    ),
  },
  {
    from: 7.15,
    to: 8.15,
    text: (
      <>
        …until one is left: <span style={{ color: COLORS.root }}>the root</span>
      </>
    ),
  },
  {
    from: 8.2,
    to: 12.5,
    text: (
      <>
        The <span style={{ color: COLORS.root }}>root</span> depends on{" "}
        <span style={{ color: COLORS.text }}>every</span> file
      </>
    ),
  },
];

const FileIcon: React.FC<{ x: number; y: number; color: string }> = ({ x, y, color }) => (
  <g transform={`translate(${x} ${y})`}>
    <path
      d="M -11 -15 L 5 -15 L 12 -8 L 12 15 L -11 15 Z"
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinejoin="round"
    />
    <path d="M 5 -15 L 5 -8 L 12 -8" fill="none" stroke={color} strokeWidth={3} />
    <line x1={-5} y1={0} x2={6} y2={0} stroke={color} strokeWidth={2.5} />
    <line x1={-5} y1={7} x2={6} y2={7} stroke={color} strokeWidth={2.5} />
  </g>
);

export const Scene04Build: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const pop = (start: number, damping = 13) =>
    spring({ frame: frame - start * fps, fps, config: { damping, stiffness: 140, mass: 0.8 } });
  const smooth = (start: number, end: number) =>
    interpolate(t, [start, end], [0, 1], { ...clamp, easing: easeInOut });

  // Camera: start low on the files, tilt up as the tree grows, settle on the shared
  // layout (identity transform) so scene 5 continues seamlessly.
  const focusY = interpolate(t, [0, 1.6, 3.4, 5.0, 6.6], [770, 770, 680, 610, 540], {
    ...clamp,
    easing: easeInOut,
  });
  const zoom =
    interpolate(t, [0, 2.2], [1.03, 1], { ...clamp, easing: easeInOut }) +
    0.012 * Math.sin(Math.PI * smooth(7.2, 8.6)) +
    0.01 * Math.sin(Math.PI * smooth(9.4, 11.2));
  const cam = `translate(${WIDTH / 2}px, ${HEIGHT / 2}px) scale(${zoom}) translate(${-WIDTH / 2}px, ${-focusY}px)`;

  // ---- First pair: copies of h1 and h2 fly up and form "h1 + h2", then merge. ----
  const [leaf1, leaf2] = LEVELS[0];
  const h12 = LEVELS[1][0];
  const fly = smooth(T.pairStart, T.plus);
  const merge = smooth(T.merge, T.h12);
  const plusIn = pop(T.plus, 10);
  const chipOpacity =
    interpolate(t, [T.pairStart, T.pairStart + 0.1], [0, 1], clamp) * (1 - merge);
  const chipPos = (leaf: Node, side: -1 | 1) => {
    const tx = h12.x + side * 82 * (1 - merge);
    return {
      x: interpolate(fly, [0, 1], [leaf.x, tx]),
      y: interpolate(fly, [0, 1], [TAG_Y, h12.y]) - Math.sin(Math.PI * fly) * 40,
    };
  };

  // ---- Final wave: light from every file climbs to the root. ----
  const waveAt = (leafIndex: number) => (t - T.wave - leafIndex * 0.06) / T.waveTravel;
  const rootHit = pop(T.wave + T.waveTravel + 0.25, 9);
  const rootHitPulse = Math.sin(
    Math.PI * interpolate(t, [T.wave + T.waveTravel, T.wave + T.waveTravel + 0.9], [0, 1], clamp),
  );

  const rootYellow = smooth(T.rootName - 0.15, T.rootName + 0.35);

  // Points along the path from a leaf to the root.
  const pathFor = (leafIndex: number) => {
    const pts: { x: number; y: number }[] = [];
    let n = LEVELS[0][leafIndex];
    pts.push({ x: n.x, y: childTop(n) });
    for (let l = 1; l < LEVELS.length; l++) {
      const p = LEVELS[l][Math.floor(n.index / 2)];
      pts.push({ x: p.x, y: parentBottom(p) });
      if (l < LEVELS.length - 1) pts.push({ x: p.x, y: childTop(p) });
      n = p;
    }
    return pts;
  };
  const along = (pts: { x: number; y: number }[], u: number) => {
    const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
    const total = segs.reduce((a, b) => a + b, 0);
    let d = Math.max(0, Math.min(1, u)) * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i] || i === segs.length - 1) {
        const k = segs[i] === 0 ? 0 : Math.min(1, d / segs[i]);
        return {
          x: pts[i].x + (pts[i + 1].x - pts[i].x) * k,
          y: pts[i].y + (pts[i + 1].y - pts[i].y) * k,
        };
      }
      d -= segs[i];
    }
    return pts[pts.length - 1];
  };

  // Yellow wash on an edge while the wave passes through it.
  const edgeWave = (parent: Node) => {
    const u = (parent.level - 0.5) / 3;
    const peaks = Array.from({ length: LEAVES }, (_, i) => waveAt(i));
    const best = Math.max(...peaks.map((p) => 1 - Math.min(1, Math.abs(p - u) * 3.2)));
    const settled = interpolate(
      t,
      [T.wave + T.waveTravel, T.wave + T.waveTravel + 0.8, 11, 11.8],
      [0, 0.35, 0.35, 0],
      clamp,
    );
    return Math.max(best, t > T.wave + T.waveTravel ? settled : 0);
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, fontFamily: FONT, overflow: "hidden" }}>
      <Audio src={staticFile("scene04.wav")} />

      {/* Backdrop: soft vignette, a parallax dot grid and drifting dust. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% ${40 + (focusY - 540) / 30}%, #1b2a4a 0%, ${COLORS.bg} 70%)`,
        }}
      />
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern
            id="s4dots"
            width={48}
            height={48}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(0 ${-(focusY - 540) * 0.35})`}
          >
            <circle cx={24} cy={24} r={1.6} fill="#334155" />
          </pattern>
          <radialGradient id="s4fade" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity={0.55} />
            <stop offset="100%" stopColor="white" stopOpacity={0} />
          </radialGradient>
          <mask id="s4mask">
            <rect width={WIDTH} height={HEIGHT} fill="url(#s4fade)" />
          </mask>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#s4dots)" mask="url(#s4mask)" />
        {DUST.map((d, i) => {
          const y = (((d.y - t * d.speed - (focusY - 540) * 0.6) % HEIGHT) + HEIGHT) % HEIGHT;
          return (
            <circle
              key={i}
              cx={d.x + Math.sin(t * 0.8 + d.phase) * 14}
              cy={y}
              r={d.r}
              fill={COLORS.hash}
              opacity={0.12 + 0.12 * Math.sin(t * 2 + d.phase)}
            />
          );
        })}
      </svg>

      {/* Caption, outside the camera so it never moves. */}
      {CAPTIONS.map((c, i) => {
        const inP = smooth(c.from, c.from + 0.35);
        const outP = smooth(c.to - 0.25, c.to);
        const o = inP * (1 - outP);
        if (o <= 0) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 78,
              width: "100%",
              textAlign: "center",
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: -1,
              color: COLORS.text,
              opacity: o,
              transform: `translateY(${(1 - inP) * 24 - outP * 18}px)`,
              filter: `blur(${(1 - inP) * 6 + outP * 6}px)`,
              textShadow: "0 4px 30px rgba(0,0,0,0.6)",
            }}
          >
            {c.text}
          </div>
        );
      })}

      {/* The stage: everything in tree coordinates, moved by the camera. */}
      <div style={{ position: "absolute", inset: 0, transform: cam, transformOrigin: "0 0" }}>
        <svg width={WIDTH} height={HEIGHT} style={{ overflow: "visible" }}>
          <defs>
            <filter id="s4glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={9} result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="s4soft" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation={5} />
            </filter>
            <radialGradient id="s4rootHalo">
              <stop offset="0%" stopColor={COLORS.root} stopOpacity={0.55} />
              <stop offset="45%" stopColor={COLORS.root} stopOpacity={0.15} />
              <stop offset="100%" stopColor={COLORS.root} stopOpacity={0} />
            </radialGradient>
            <linearGradient id="s4node" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1f3350" />
              <stop offset="100%" stopColor="#14223a" />
            </linearGradient>
            <linearGradient id="s4file" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#273449" />
              <stop offset="100%" stopColor={COLORS.file} />
            </linearGradient>
          </defs>

          {/* Root halo, behind everything. */}
          <circle
            cx={ROOT.x}
            cy={ROOT.y}
            r={260 + 70 * rootHitPulse}
            fill="url(#s4rootHalo)"
            opacity={rootYellow * (0.75 + 0.25 * rootHitPulse)}
          />

          {/* Edges: a dim base line, plus a bright line that grows as light runs up. */}
          {LEVELS.slice(1).flatMap((level) =>
            level.flatMap((parent) => {
              const start = parent.level === 1 && parent.index === 0 ? T.pairStart : popTime(parent) - EDGE_GROW;
              const end = parent.level === 1 && parent.index === 0 ? T.plus : popTime(parent);
              const grow = smooth(start, end);
              const wash = edgeWave(parent);
              return [0, 1].map((side) => {
                const child = LEVELS[parent.level - 1][2 * parent.index + side];
                const x1 = child.x;
                const y1 = childTop(child);
                const x2 = parent.x;
                const y2 = parentBottom(parent);
                const gx = x1 + (x2 - x1) * grow;
                const gy = y1 + (y2 - y1) * grow;
                const head = grow > 0 && grow < 1;
                const glowColor = wash > 0.02 ? COLORS.root : COLORS.hash;
                return (
                  <g key={`${parent.level}-${parent.index}-${side}`}>
                    <line x1={x1} y1={y1} x2={gx} y2={gy} stroke={COLORS.edge} strokeWidth={5} strokeLinecap="round" />
                    <line
                      x1={x1}
                      y1={y1}
                      x2={gx}
                      y2={gy}
                      stroke={glowColor}
                      strokeWidth={4}
                      strokeLinecap="round"
                      opacity={grow > 0 ? Math.max(head ? 0.9 : 0.35 * (1 - smooth(end, end + 0.8)), wash * 0.9) : 0}
                      filter="url(#s4glow)"
                    />
                    {head ? (
                      <g>
                        <circle cx={gx} cy={gy} r={16} fill={COLORS.hash} opacity={0.6} filter="url(#s4soft)" />
                        <circle cx={gx} cy={gy} r={6} fill="#e0f2fe" />
                      </g>
                    ) : null}
                  </g>
                );
              });
            }),
          )}

          {/* Final wave: one spark per file, with a short trail, climbing to the root. */}
          {t > T.wave && t < T.wave + T.waveTravel + 0.8
            ? Array.from({ length: LEAVES }, (_, i) => {
                const pts = pathFor(i);
                const u = waveAt(i);
                if (u <= 0 || u >= 1.02) return null;
                return (
                  <g key={`spark-${i}`}>
                    {[0.12, 0.08, 0.04, 0].map((lag, k) => {
                      const p = along(pts, easeInOut(Math.max(0, Math.min(1, u - lag))));
                      return (
                        <circle
                          key={k}
                          cx={p.x}
                          cy={p.y}
                          r={k === 3 ? 10 : 10 + k * 7}
                          fill={k === 3 ? "#fef9c3" : COLORS.root}
                          opacity={k === 3 ? 1 : 0.22 + k * 0.18}
                          filter={k === 3 ? undefined : "url(#s4soft)"}
                        />
                      );
                    })}
                  </g>
                );
              })
            : null}

          {/* Hash nodes (levels 1–3). */}
          {LEVELS.slice(1)
            .flat()
            .map((node) => {
              const p0 = popTime(node);
              const s = pop(p0);
              if (s <= 0.001) return null;
              const w = NODE_W[node.level];
              const isRoot = node.level === 3;
              const ring = interpolate(t, [p0, p0 + 0.6], [0, 1], {
                ...clamp,
                easing: Easing.out(Easing.cubic),
              });
              const flash = 1 - smooth(p0, p0 + 0.6);
              const y = isRoot ? rootYellow : 0;
              const stroke = isRoot
                ? interpolateColor(COLORS.hash, COLORS.root, y)
                : COLORS.hash;
              const wavePulse = isRoot ? rootHit * rootHitPulse : 0;
              return (
                <g key={`n-${node.level}-${node.index}`} transform={`translate(${node.x} ${node.y})`}>
                  {ring > 0 && ring < 1 ? (
                    <rect
                      x={(-w / 2) * (1 + ring * 0.5)}
                      y={(-NODE_H / 2) * (1 + ring * 0.9)}
                      width={w * (1 + ring * 0.5)}
                      height={NODE_H * (1 + ring * 0.9)}
                      rx={22 + ring * 20}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={4 * (1 - ring)}
                      opacity={1 - ring}
                    />
                  ) : null}
                  {isRoot && rootYellow > 0 ? (
                    <circle
                      r={60 + 180 * smooth(T.rootName - 0.1, T.rootName + 0.6)}
                      fill="none"
                      stroke={COLORS.root}
                      strokeWidth={6 * (1 - smooth(T.rootName, T.rootName + 0.6))}
                      opacity={1 - smooth(T.rootName, T.rootName + 0.6)}
                    />
                  ) : null}
                  <g transform={`scale(${(0.4 + 0.6 * s) * (1 + 0.08 * wavePulse)})`} opacity={Math.min(1, s * 1.5)}>
                    <rect
                      x={-w / 2}
                      y={-NODE_H / 2}
                      width={w}
                      height={NODE_H}
                      rx={20}
                      fill={isRoot ? interpolateColor("#14223a", "#3a3010", y) : "url(#s4node)"}
                      stroke={stroke}
                      strokeWidth={isRoot ? 5 : 4}
                      filter={flash > 0.05 || isRoot ? "url(#s4glow)" : undefined}
                    />
                    <rect
                      x={-w / 2}
                      y={-NODE_H / 2}
                      width={w}
                      height={NODE_H}
                      rx={20}
                      fill="white"
                      opacity={flash * 0.35}
                    />
                    {isRoot ? (
                      <>
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={36}
                          fontFamily={MONO}
                          fill={COLORS.hash}
                          opacity={1 - y}
                        >
                          h1…8
                        </text>
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={42}
                          fontWeight={700}
                          fontFamily={FONT}
                          fill={COLORS.root}
                          opacity={y}
                          transform={`scale(${0.7 + 0.3 * y})`}
                        >
                          root
                        </text>
                      </>
                    ) : (
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={36}
                        fontFamily={MONO}
                        fill={COLORS.hash}
                      >
                        {label(node)}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}

          {/* Files with their hash tags. */}
          {LEVELS[0].map((leaf) => {
            const s = pop(T.leafIn + leaf.index * 0.06, 14);
            const tagStart = T.tagIn + leaf.index * 0.09;
            const tg = pop(tagStart, 11);
            const scan = interpolate(t, [tagStart - 0.2, tagStart + 0.15], [0, 1], clamp);
            const wave = waveAt(leaf.index);
            const emit = wave > 0 && wave < 0.4 ? Math.sin((Math.PI * wave) / 0.4) : 0;
            const w = NODE_W[0];
            return (
              <g key={`leaf-${leaf.index}`}>
                <g
                  transform={`translate(${leaf.x} ${leaf.y + (1 - s) * 60}) scale(${0.7 + 0.3 * s})`}
                  opacity={Math.min(1, s * 1.4)}
                >
                  <rect
                    x={-w / 2}
                    y={-NODE_H / 2}
                    width={w}
                    height={NODE_H}
                    rx={16}
                    fill="url(#s4file)"
                    stroke={interpolateColor(COLORS.border, COLORS.root, emit)}
                    strokeWidth={4}
                  />
                  {/* scanner light sweeping up the file as it is hashed */}
                  {scan > 0 && scan < 1 ? (
                    <rect
                      x={-w / 2 + 6}
                      y={NODE_H / 2 - 8 - scan * (NODE_H - 16)}
                      width={w - 12}
                      height={6}
                      rx={3}
                      fill={COLORS.hash}
                      opacity={0.9}
                      filter="url(#s4glow)"
                    />
                  ) : null}
                  <FileIcon x={-46} y={8} color={COLORS.muted} />
                  <text
                    x={14}
                    y={10}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={32}
                    fontFamily={FONT}
                    fill={COLORS.text}
                  >
                    file {leaf.index + 1}
                  </text>
                </g>
                {tg > 0.001 ? (
                  <g
                    transform={`translate(${leaf.x} ${TAG_Y + (1 - tg) * 40}) scale(${0.3 + 0.7 * tg})`}
                    opacity={Math.min(1, tg * 1.5)}
                  >
                    <rect
                      x={-TAG_W / 2}
                      y={-TAG_H / 2}
                      width={TAG_W}
                      height={TAG_H}
                      rx={TAG_H / 2}
                      fill="#0c1a2e"
                      stroke={emit > 0.05 ? COLORS.root : COLORS.hash}
                      strokeWidth={3.5}
                      filter={emit > 0.05 || 1 - smooth(tagStart, tagStart + 0.5) > 0.05 ? "url(#s4glow)" : undefined}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={28}
                      fontWeight={600}
                      fontFamily={MONO}
                      fill={COLORS.hash}
                    >
                      h{leaf.index + 1}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}

          {/* First pair: flying copies of h1 and h2, the "+" and the merge. */}
          {chipOpacity > 0.001
            ? ([
                [leaf1, -1],
                [leaf2, 1],
              ] as const).map(([leaf, side]) => {
                const p = chipPos(leaf, side);
                return (
                  <g
                    key={`chip-${side}`}
                    transform={`translate(${p.x} ${p.y}) scale(${1 + 0.25 * fly * (1 - merge)})`}
                    opacity={chipOpacity}
                  >
                    <rect
                      x={-TAG_W / 2}
                      y={-TAG_H / 2}
                      width={TAG_W}
                      height={TAG_H}
                      rx={TAG_H / 2}
                      fill="#0c1a2e"
                      stroke={COLORS.hash}
                      strokeWidth={3.5}
                      filter="url(#s4glow)"
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={28}
                      fontWeight={600}
                      fontFamily={MONO}
                      fill={COLORS.hash}
                    >
                      h{leaf.index + 1}
                    </text>
                  </g>
                );
              })
            : null}
          {plusIn > 0.001 && merge < 1 ? (
            <text
              x={h12.x}
              y={h12.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={60}
              fontWeight={700}
              fontFamily={FONT}
              fill={COLORS.text}
              opacity={Math.min(1, plusIn) * (1 - merge)}
              transform={`translate(${h12.x} ${h12.y}) scale(${plusIn * (1 - 0.6 * merge)}) translate(${-h12.x} ${-h12.y})`}
              filter="url(#s4glow)"
            >
              +
            </text>
          ) : null}
          {/* Little "hash()" tag that appears under the merge. */}
          {merge > 0 ? (
            <text
              x={h12.x}
              y={h12.y - NODE_H / 2 - 26}
              textAnchor="middle"
              fontSize={26}
              fontFamily={MONO}
              fill={COLORS.muted}
              opacity={Math.sin(Math.PI * smooth(T.merge, T.level1[2]))}
            >
              hash(h1 + h2)
            </text>
          ) : null}
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// Linear blend between two #rrggbb colours.
function interpolateColor(a: string, b: string, k: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
