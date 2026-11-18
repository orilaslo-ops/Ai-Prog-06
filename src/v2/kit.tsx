// Shared look for version 2 of the video: "neon city".
// Files are glowing isometric towers in a 3D neon city at night. Hashes are light
// bridges that join pairs of towers into floating hubs, level above level, and the
// Merkle root is a bright beacon at the top. The camera flies through the city.
// Scenes import from here; only the scaffold owner edits this file.
import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;

export const C = {
  skyTop: "#05010f",
  skyMid: "#1a0533",
  horizon: "#ff2bd6",
  grid: "#b026ff",
  file: "#00e5ff", // towers (files): cyan
  hash: "#ff2bd6", // bridges / hubs (hashes): magenta
  root: "#ffe14d", // beacon (root): gold
  changed: "#ff3355", // changed / mismatch: hot red
  match: "#39ff88", // match: green
  text: "#f5f0ff",
  muted: "#9a8bc2",
  faceTop: "#1b1440",
  faceLeft: "#0e0a26",
  faceRight: "#140f33",
};

export const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";
export const MONO = "ui-monospace, 'JetBrains Mono', Menlo, monospace";
export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// ---------------------------------------------------------------------------
// Isometric projection. World units: x to the right-back, y to the left-back, z up.
// `cam` moves and zooms the whole world (fly-throughs: animate cam over time).
// ---------------------------------------------------------------------------
export type Cam = { x: number; y: number; zoom: number }; // screen offset (px) + zoom
export const DEFAULT_CAM: Cam = { x: 0, y: 0, zoom: 1 };

const ISO_X = Math.cos(Math.PI / 6); // 0.866
const ISO_Y = Math.sin(Math.PI / 6); // 0.5

export const iso = (
  x: number,
  y: number,
  z: number,
  cam: Cam = DEFAULT_CAM,
) => ({
  sx: WIDTH / 2 + cam.x + (x - y) * ISO_X * cam.zoom,
  sy: HEIGHT * 0.74 + cam.y + ((x + y) * ISO_Y - z) * cam.zoom,
});

const pts = (p: { sx: number; sy: number }[]) =>
  p.map((q) => `${q.sx},${q.sy}`).join(" ");

// A neon tower (box) standing at world (x, y), footprint w×d, height h.
// `color` is the neon edge colour, `glow` 0…1 brightens the faces and windows,
// `rise` 0…1 grows it out of the ground.
export const Tower: React.FC<{
  x: number;
  y: number;
  w?: number;
  d?: number;
  h: number;
  color?: string;
  glow?: number;
  rise?: number;
  cam?: Cam;
  windows?: boolean;
  seed?: string;
}> = ({
  x,
  y,
  w = 60,
  d = 60,
  h,
  color = C.file,
  glow = 0.5,
  rise = 1,
  cam = DEFAULT_CAM,
  windows = true,
  seed = "t",
}) => {
  const frame = useCurrentFrame();
  const hh = h * rise;
  const P = (dx: number, dy: number, z: number) => iso(x + dx, y + dy, z, cam);
  const top = [P(0, 0, hh), P(w, 0, hh), P(w, d, hh), P(0, d, hh)];
  const left = [P(0, d, 0), P(w, d, 0), P(w, d, hh), P(0, d, hh)];
  const right = [P(w, 0, 0), P(w, d, 0), P(w, d, hh), P(w, 0, hh)];
  const rows = Math.max(1, Math.floor(hh / 26));
  return (
    <g>
      <polygon points={pts(left)} fill={C.faceLeft} />
      <polygon points={pts(right)} fill={C.faceRight} />
      <polygon points={pts(top)} fill={color} fillOpacity={0.18 + 0.5 * glow} />
      {windows
        ? Array.from({ length: rows }, (_, r) =>
            [0.25, 0.5, 0.75].map((f, k) => {
              const on = random(`${seed}${r}${k}`) > 0.45;
              const flick = 0.5 + 0.5 * Math.sin(frame / 9 + r * 1.7 + k);
              const a = P(w, d * f - 4, 14 + r * 26);
              const b = P(w, d * f + 4, 14 + r * 26);
              const a2 = P(w * f - 4, d, 14 + r * 26);
              const b2 = P(w * f + 4, d, 14 + r * 26);
              const o = on ? (0.25 + 0.6 * glow) * (0.7 + 0.3 * flick) : 0.06;
              return (
                <g key={`${r}-${k}`} opacity={o}>
                  <line
                    x1={a.sx}
                    y1={a.sy}
                    x2={b.sx}
                    y2={b.sy}
                    stroke={color}
                    strokeWidth={4 * cam.zoom}
                  />
                  <line
                    x1={a2.sx}
                    y1={a2.sy}
                    x2={b2.sx}
                    y2={b2.sy}
                    stroke={color}
                    strokeWidth={4 * cam.zoom}
                  />
                </g>
              );
            }),
          )
        : null}
      <g
        filter="url(#neon)"
        stroke={color}
        strokeWidth={2.2}
        fill="none"
        strokeLinejoin="round"
      >
        <polygon points={pts(top)} />
        <polyline points={pts([P(0, d, 0), P(0, d, hh)])} />
        <polyline points={pts([P(w, d, 0), P(w, d, hh)])} />
        <polyline points={pts([P(w, 0, 0), P(w, 0, hh)])} />
        <polyline points={pts([P(0, d, 0), P(w, d, 0), P(w, 0, 0)])} />
      </g>
    </g>
  );
};

// A floating hub (glowing octahedron) at world (x, y, z): a hash node.
export const Hub: React.FC<{
  x: number;
  y: number;
  z: number;
  r?: number;
  color?: string;
  scale?: number;
  cam?: Cam;
}> = ({ x, y, z, r = 26, color = C.hash, scale = 1, cam = DEFAULT_CAM }) => {
  const frame = useCurrentFrame();
  const c = iso(x, y, z + Math.sin(frame / 20 + x) * 4, cam);
  const s = r * scale * cam.zoom;
  const spin = Math.sin(frame / 25 + y) * 0.35;
  const top = { sx: c.sx, sy: c.sy - s * 1.3 };
  const bot = { sx: c.sx, sy: c.sy + s * 1.3 };
  const l = { sx: c.sx - s * (1 - spin), sy: c.sy };
  const rr = { sx: c.sx + s * (1 + spin), sy: c.sy };
  const m = { sx: c.sx + s * spin * 2, sy: c.sy + s * 0.25 };
  return (
    <g opacity={Math.min(1, scale * 1.5)}>
      <circle
        cx={c.sx}
        cy={c.sy}
        r={s * 2.2}
        fill={color}
        opacity={0.12}
        filter="url(#neon-wide)"
      />
      <polygon points={pts([top, l, m])} fill={color} fillOpacity={0.55} />
      <polygon points={pts([top, m, rr])} fill={color} fillOpacity={0.3} />
      <polygon points={pts([bot, l, m])} fill={color} fillOpacity={0.35} />
      <polygon points={pts([bot, m, rr])} fill={color} fillOpacity={0.18} />
      <polygon
        points={pts([top, l, bot, rr])}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        filter="url(#neon)"
      />
    </g>
  );
};

// A neon light bridge between two world points; `progress` 0…1 draws it from a to b.
export const Beam: React.FC<{
  a: [number, number, number];
  b: [number, number, number];
  progress?: number;
  color?: string;
  width?: number;
  cam?: Cam;
}> = ({ a, b, progress = 1, color = C.hash, width = 4, cam = DEFAULT_CAM }) => {
  const p = iso(a[0], a[1], a[2], cam);
  const q = iso(
    a[0] + (b[0] - a[0]) * progress,
    a[1] + (b[1] - a[1]) * progress,
    a[2] + (b[2] - a[2]) * progress,
    cam,
  );
  return (
    <g>
      <line
        x1={p.sx}
        y1={p.sy}
        x2={q.sx}
        y2={q.sy}
        stroke={color}
        strokeWidth={width * 3}
        opacity={0.25}
        filter="url(#neon-wide)"
      />
      <line
        x1={p.sx}
        y1={p.sy}
        x2={q.sx}
        y2={q.sy}
        stroke={color}
        strokeWidth={width}
        filter="url(#neon)"
      />
      <line
        x1={p.sx}
        y1={p.sy}
        x2={q.sx}
        y2={q.sy}
        stroke="#ffffff"
        strokeWidth={width * 0.35}
        opacity={0.8}
      />
    </g>
  );
};

// ---------------------------------------------------------------------------
// The city's Merkle tree, in world units. 8 file towers in a row along x (y = 0),
// hubs float above the midpoints of each pair, the root beacon at the top.
// ---------------------------------------------------------------------------
export const TOWER_GAP = 210; // screen distance between neighbouring towers (px)
export const TOWER_W = 64;
// Towers stand in a row that runs straight across the screen: along the iso axis
// x = -y, so each step moves right on screen and stays at the same depth.
export const towerPos = (i: number) => {
  const t = ((i - 3.5) * TOWER_GAP) / (2 * 0.866);
  return { x: t - TOWER_W / 2, y: -t - TOWER_W / 2 }; // the tower's corner, for <Tower>
};
export const TOWER_H = [150, 210, 120, 250, 180, 140, 230, 170];
export const HUB_Z = [0, 360, 470, 580]; // z of each hub level (level 0 = tower tops)

export type TreeNode = {
  x: number;
  y: number;
  z: number;
  level: number;
  index: number;
};

// Node centres in world units: level 0 = top centre of each tower, then hubs, root.
export const buildTree = (): TreeNode[][] => {
  const levels: TreeNode[][] = [
    Array.from({ length: 8 }, (_, i) => {
      const p = towerPos(i);
      return {
        x: p.x + TOWER_W / 2,
        y: p.y + TOWER_W / 2,
        z: TOWER_H[i],
        level: 0,
        index: i,
      };
    }),
  ];
  for (let level = 1; level < 4; level++) {
    const below = levels[level - 1];
    levels.push(
      Array.from({ length: below.length / 2 }, (_, i) => ({
        x: (below[2 * i].x + below[2 * i + 1].x) / 2,
        y: (below[2 * i].y + below[2 * i + 1].y) / 2,
        z: HUB_Z[level],
        level,
        index: i,
      })),
    );
  }
  return levels;
};

// Neon filters. Put <NeonDefs /> once inside every <svg> that uses Tower/Hub/Beam.
export const NeonDefs: React.FC = () => (
  <defs>
    <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="neon-wide" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="16" />
    </filter>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={C.skyTop} />
      <stop offset="0.6" stopColor={C.skyMid} />
      <stop offset="1" stopColor="#3a0a4a" />
    </linearGradient>
    <radialGradient id="beacon" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="0.35" stopColor={C.root} />
      <stop offset="1" stopColor={C.root} stopOpacity="0" />
    </radialGradient>
  </defs>
);

// Synthwave night: gradient sky, stars, a glowing horizon and an endless neon grid
// floor that scrolls toward the viewer. `speed` = how fast the grid flows (0 = still);
// `cam` shifts it for parallax. Use as the bottom layer of every scene.
export const NeonBackground: React.FC<{
  cam?: Cam;
  speed?: number;
  horizonY?: number;
}> = ({ cam = DEFAULT_CAM, speed = 1, horizonY = 470 }) => {
  const frame = useCurrentFrame();
  const hy = horizonY + cam.y * 0.3;
  const stars = Array.from({ length: 120 }, (_, i) => ({
    x: random(`sx${i}`) * WIDTH,
    y: random(`sy${i}`) * hy,
    r: 0.5 + random(`sr${i}`) * 1.4,
    p: random(`sp${i}`) * 6.28,
  }));
  const scroll = ((frame * speed * 2) % 60) / 60;
  const rows = Array.from({ length: 14 }, (_, i) => {
    const t = (i + scroll) / 14;
    return hy + (HEIGHT - hy) * t * t * 1.15;
  });
  const cols = Array.from({ length: 41 }, (_, i) => (i - 20) * 140);
  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute" }}>
        <NeonDefs />
        <rect width={WIDTH} height={HEIGHT} fill="url(#sky)" />
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={(s.x + cam.x * 0.1 + WIDTH) % WIDTH}
            cy={s.y}
            r={s.r}
            fill="#ffffff"
            opacity={0.25 + 0.5 * Math.sin(frame / 15 + s.p) ** 2}
          />
        ))}
        <rect
          x={0}
          y={hy - 60}
          width={WIDTH}
          height={120}
          fill={C.horizon}
          opacity={0.18}
          filter="url(#neon-wide)"
        />
        <rect x={0} y={hy} width={WIDTH} height={HEIGHT - hy} fill="#0a0218" />
        <g stroke={C.grid} strokeWidth={1.6} filter="url(#neon)">
          {rows.map((y, i) => (
            <line
              key={`r${i}`}
              x1={0}
              y1={y}
              x2={WIDTH}
              y2={y}
              opacity={0.15 + 0.7 * ((y - hy) / (HEIGHT - hy))}
            />
          ))}
          {cols.map((x, i) => (
            <line
              key={`c${i}`}
              x1={WIDTH / 2 + cam.x * 0.4 + x * 0.03}
              y1={hy}
              x2={WIDTH / 2 + cam.x * 0.4 + x * 1.6}
              y2={HEIGHT}
              opacity={0.45}
            />
          ))}
        </g>
        <line
          x1={0}
          y1={hy}
          x2={WIDTH}
          y2={hy}
          stroke={C.horizon}
          strokeWidth={3}
          filter="url(#neon)"
        />
      </svg>
    </AbsoluteFill>
  );
};

// Gold beacon (the Merkle root) at world (x, y, z), with a light pillar to the sky.
export const Beacon: React.FC<{
  x: number;
  y: number;
  z: number;
  power?: number;
  color?: string;
  cam?: Cam;
}> = ({ x, y, z, power = 1, color = C.root, cam = DEFAULT_CAM }) => {
  const frame = useCurrentFrame();
  const c = iso(x, y, z, cam);
  const pulse = 1 + 0.08 * Math.sin(frame / 6);
  const r = 34 * cam.zoom * power * pulse;
  return (
    <g opacity={Math.min(1, power * 1.4)}>
      <rect
        x={c.sx - 6 * power}
        y={0}
        width={12 * power}
        height={c.sy}
        fill={color}
        opacity={0.25 * power}
        filter="url(#neon-wide)"
      />
      <circle cx={c.sx} cy={c.sy} r={r * 3} fill="url(#beacon)" opacity={0.6} />
      <circle cx={c.sx} cy={c.sy} r={r} fill="url(#beacon)" />
      <circle cx={c.sx} cy={c.sy} r={r * 0.45} fill="#ffffff" />
    </g>
  );
};
