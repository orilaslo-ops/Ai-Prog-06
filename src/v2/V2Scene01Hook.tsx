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
import { C, clamp, FONT, HEIGHT, MONO, WIDTH } from "./kit";

// Scene 1 (version 2, "neon city") — the hook, 8 s.
// Narration: "One letter changed, somewhere in a million files. Could you find it in
// just twenty steps? A Merkle tree can."
//
// Word timings (silencedetect on public/scene01.wav, as in version 1):
//   0.00–1.17  "One letter changed"            dive from the stars; one window flickers red
//   1.34–2.95  "somewhere in a million files"  sweep across the endless city, the red
//                                              window goes dark again: lost. 1,000,000 counts up
//   3.48–5.07  "Could you find it in just      a searchlight halves the city 10 times down to
//               twenty steps?"                 one tower, then halves its facade 10 times down
//                                              to one window (32×32 towers × 16×64 windows ≈ 2²⁰)
//   5.34–6.36  "A Merkle tree can."            the camera rockets out, the title buzzes on
//                                              like a neon sign, a tiny tree with a gold root
//
// The city is drawn with a real perspective camera (written here, not the kit's iso()),
// so the shot can tilt from the stars down to the horizon and fly into a street canyon.

const F = 1150; // focal length in px
const NEAR = 4;
const sec = (s: number): number => s * 30;

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

type Cam = { P: V3; f: V3; r: V3; u: V3 };
const makeCam = (P: V3, T: V3): Cam => {
  const f = norm(sub(T, P));
  const r = norm([f[1], -f[0], 0]);
  const u: V3 = [
    r[1] * f[2] - r[2] * f[1],
    r[2] * f[0] - r[0] * f[2],
    r[0] * f[1] - r[1] * f[0],
  ];
  return { P, f, r, u };
};
type Pt = { x: number; y: number; z: number };
const toCam = (cam: Cam, q: V3): V3 => {
  const d = sub(q, cam.P);
  return [dot(d, cam.r), dot(d, cam.u), dot(d, cam.f)];
};
const projC = (c: V3): Pt => ({
  x: WIDTH / 2 + (F * c[0]) / c[2],
  y: HEIGHT / 2 - (F * c[1]) / c[2],
  z: c[2],
});
const proj = (cam: Cam, q: V3): Pt | null => {
  const c = toCam(cam, q);
  return c[2] < NEAR ? null : projC(c);
};
// A world segment clipped to the near plane, or null when it is all behind the camera.
const projSeg = (cam: Cam, a: V3, b: V3): [Pt, Pt] | null => {
  let ca = toCam(cam, a);
  let cb = toCam(cam, b);
  if (ca[2] < NEAR && cb[2] < NEAR) return null;
  const cut = (p: V3, q: V3): V3 => {
    const t = (NEAR - p[2]) / (q[2] - p[2]);
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, NEAR];
  };
  if (ca[2] < NEAR) ca = cut(ca, cb);
  if (cb[2] < NEAR) cb = cut(cb, ca);
  return [projC(ca), projC(cb)];
};
const poly = (p: Pt[]): string =>
  p.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");

// ---------------------------------------------------------------------------
// Camera path: cubic Hermite through keyframes (time in s, eye, look-at).
// ---------------------------------------------------------------------------
type Key = { t: number; P: V3; T: V3 };
const KEYS: Key[] = [
  { t: 0.0, P: [-300, -5600, 2300], T: [-100, -1500, 4700] }, // up into the stars
  { t: 0.95, P: [0, -4300, 1550], T: [250, -300, 0] }, // tilt down: the city appears
  { t: 1.35, P: [150, -3700, 1250], T: [420, -250, 120] }, // the red window flickers
  { t: 2.9, P: [-1400, -2500, 820], T: [700, 1100, 0] }, // sweep across the endless city
  { t: 3.5, P: [-150, -2500, 2350], T: [80, -80, 0] }, // up: the search overview
  { t: 3.95, P: [400, -1450, 1050], T: [450, -230, 60] }, // dive after the search
  { t: 4.42, P: [452, -720, 160], T: [455, -285, 135] }, // into the canyon, facing the facade
  { t: 5.1, P: [465, -415, 169], T: [465, -285, 168.6] }, // push in to the window
  { t: 5.35, P: [465, -470, 175], T: [465, -285, 170] },
  { t: 6.4, P: [250, -3500, 1250], T: [300, 400, 760] }, // rocket out for the title
  { t: 8.0, P: [200, -3900, 1330], T: [300, 400, 790] },
];

const hermite = (t: number, get: (k: Key) => V3): V3 => {
  const n = KEYS.length;
  if (t <= KEYS[0].t) return get(KEYS[0]);
  if (t >= KEYS[n - 1].t) return get(KEYS[n - 1]);
  let i = 0;
  while (KEYS[i + 1].t < t) i++;
  const k0 = KEYS[i];
  const k1 = KEYS[i + 1];
  const h = k1.t - k0.t;
  const s = (t - k0.t) / h;
  const tan = (j: number): V3 => {
    if (j === 0 || j === n - 1) return [0, 0, 0];
    const a = get(KEYS[j - 1]);
    const b = get(KEYS[j + 1]);
    const dt = KEYS[j + 1].t - KEYS[j - 1].t;
    // Damped Catmull-Rom tangent, so the path never swings wide between keys.
    return [
      ((b[0] - a[0]) / dt) * 0.8,
      ((b[1] - a[1]) / dt) * 0.8,
      ((b[2] - a[2]) / dt) * 0.8,
    ];
  };
  const p0 = get(k0);
  const p1 = get(k1);
  const m0 = tan(i);
  const m1 = tan(i + 1);
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  return [0, 1, 2].map(
    (c) => h00 * p0[c] + h10 * h * m0[c] + h01 * p1[c] + h11 * h * m1[c],
  ) as V3;
};

// ---------------------------------------------------------------------------
// The city: 32 × 32 towers (one avenue left open so the camera can fly in), plus
// sparser towers out to the horizon. The changed file is one window on tower (20, 13).
// ---------------------------------------------------------------------------
const N = 32;
const PITCH = 100;
const TI = 20;
const TJ = 13;
const cellX = (i: number): number => (i - 15.5) * PITCH;
const cellY = (j: number): number => (j - 15.5) * PITCH;

type TowerData = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  h: number;
  color: string;
  lit: number;
  seed: number;
  i: number;
  j: number;
  filler: boolean;
};

const PALETTE = [C.file, C.file, C.file, "#7df9ff", "#3d8bff", "#b98cff"];

const TOWERS: TowerData[] = (() => {
  const out: TowerData[] = [];
  let seed = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === TI && j < TJ) continue; // the avenue
      const target = i === TI && j === TJ;
      const w = target ? 70 : 54 + random(`w${i}-${j}`) * 18;
      const d = target ? 70 : 54 + random(`d${i}-${j}`) * 18;
      const r = random(`h${i}-${j}`);
      const h = target ? 260 : 60 + r * r * 300 + random(`k${i}-${j}`) * 40;
      out.push({
        x0: cellX(i) - w / 2,
        x1: cellX(i) + w / 2,
        y0: cellY(j) - d / 2,
        y1: cellY(j) + d / 2,
        h,
        color: target
          ? C.file
          : PALETTE[Math.floor(random(`c${i}-${j}`) * PALETTE.length)],
        lit: 0.45 + random(`l${i}-${j}`) * 0.55,
        seed: seed++,
        i,
        j,
        filler: false,
      });
    }
  }
  for (let gx = -40; gx <= 40; gx++) {
    for (let gy = -24; gy <= 40; gy++) {
      const x = gx * 170 + (random(`fx${gx}-${gy}`) - 0.5) * 60;
      const y = gy * 170 + (random(`fy${gx}-${gy}`) - 0.5) * 60;
      if (Math.abs(x) < 1800 && Math.abs(y) < 1800) continue;
      if (random(`fp${gx}-${gy}`) > 0.5) continue;
      const w = 60 + random(`fw${gx}-${gy}`) * 50;
      const r = random(`fh${gx}-${gy}`);
      out.push({
        x0: x - w / 2,
        x1: x + w / 2,
        y0: y - w / 2,
        y1: y + w / 2,
        h: 60 + r * r * 420,
        color: PALETTE[Math.floor(random(`fc${gx}-${gy}`) * PALETTE.length)],
        lit: 0.3 + random(`fl${gx}-${gy}`) * 0.5,
        seed: seed++,
        i: -1,
        j: -1,
        filler: true,
      });
    }
  }
  return out;
})();

// The target tower's front facade (y = FACE_Y) holds 16 × 64 windows.
const T_X0 = cellX(TI) - 35;
const FACE_Y = cellY(TJ) - 35;
const T_H = 260;
const WCOLS = 16;
const WROWS = 64;
const CW = 70 / WCOLS;
const RH = T_H / WROWS;
const RED_C = 11;
const RED_R = 41;
const RED_POS: V3 = [
  T_X0 + (RED_C + 0.5) * CW,
  FACE_Y - 0.5,
  (RED_R + 0.5) * RH,
];

// ---------------------------------------------------------------------------
// The search: 20 halvings. Steps 1–10 halve the 32 × 32 grid of towers, steps 11–20
// halve the 16 × 64 grid of windows, always keeping the half with the changed file.
// ---------------------------------------------------------------------------
type Region = { a0: number; a1: number; b0: number; b1: number };
const STEP_FRAMES = [
  104, 109, 113, 117, 120, 123, 126, 128, 130, 132, 137, 140, 143, 145, 147,
  149, 151, 152, 153, 154,
];
const FOUND = 154;
const REGIONS: Region[] = (() => {
  const rs: Region[] = [{ a0: 0, a1: N, b0: 0, b1: N }];
  for (let s = 1; s <= 10; s++) {
    const p = rs[rs.length - 1];
    if (s % 2 === 1) {
      const m = (p.a0 + p.a1) / 2;
      rs.push(TI < m ? { ...p, a1: m } : { ...p, a0: m });
    } else {
      const m = (p.b0 + p.b1) / 2;
      rs.push(TJ < m ? { ...p, b1: m } : { ...p, b0: m });
    }
  }
  rs.push({ a0: 0, a1: WCOLS, b0: 0, b1: WROWS });
  for (let s = 11; s <= 20; s++) {
    const p = rs[rs.length - 1];
    if ((p.a1 - p.a0) * CW >= (p.b1 - p.b0) * RH) {
      const m = (p.a0 + p.a1) / 2;
      rs.push(RED_C < m ? { ...p, a1: m } : { ...p, a0: m });
    } else {
      const m = (p.b0 + p.b1) / 2;
      rs.push(RED_R < m ? { ...p, b1: m } : { ...p, b0: m });
    }
  }
  return rs;
})();
// REGIONS[0..10]: towers after step s; REGIONS[11 + k]: windows after step 10 + k.
const regionAfter = (s: number): Region =>
  s <= 10 ? REGIONS[s] : REGIONS[s + 1];
const inRegion = (r: Region, a: number, b: number): boolean =>
  a >= r.a0 && a < r.a1 && b >= r.b0 && b < r.b1;
// The step at which a tower / window is ruled out (99 = never).
const outStep = (a: number, b: number, from: number, to: number): number => {
  for (let s = from; s <= to; s++) {
    if (!inRegion(regionAfter(s), a, b)) return s;
  }
  return 99;
};
const TOWER_OUT = TOWERS.map((t) => (t.filler ? 1 : outStep(t.i, t.j, 1, 10)));
const WINDOW_OUT = Array.from({ length: WCOLS * WROWS }, (_, k) =>
  outStep(k % WCOLS, Math.floor(k / WCOLS), 11, 20),
);
const WINDOW_LIT = Array.from(
  { length: WCOLS * WROWS },
  (_, k) => random(`win${k}`) > 0.42,
);

const lerpRegion = (a: Region, b: Region, t: number): Region => ({
  a0: a.a0 + (b.a0 - a.a0) * t,
  a1: a.a1 + (b.a1 - a.a1) * t,
  b0: a.b0 + (b.b0 - a.b0) * t,
  b1: a.b1 + (b.b1 - a.b1) * t,
});

// Hex colour helpers for distance fog.
const hex = (c: string): V3 => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
];
const mix = (a: string, b: string, t: number): string => {
  const p = hex(a);
  const q = hex(b);
  return `rgb(${[0, 1, 2].map((k) => Math.round(p[k] + (q[k] - p[k]) * t)).join(",")})`;
};
const FOG = "#2b0b46";

// The red window's neon flicker while "One letter changed" is spoken.
const RED_FLICKER = [
  [17, 19],
  [21, 22],
  [24, 31],
  [33, 34],
  [36, 44],
] as const;
const redFlickerOn = (f: number): boolean =>
  RED_FLICKER.some(([a, b]) => f >= a && f <= b);

// The title sign buzzes on: lit frames for "Merkle" and for "tree".
const SIGN_A = [
  [163, 165],
  [168, 169],
  [172, 999],
] as const;
const SIGN_B = [
  [170, 171],
  [175, 176],
  [178, 181],
  [184, 999],
] as const;
const signOn = (spans: readonly (readonly [number, number])[], f: number) =>
  spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;

// ---------------------------------------------------------------------------

export const V2Scene01Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  // Shake on the find and when the sign slams on.
  const shakeAmp =
    interpolate(frame, [FOUND, FOUND + 10], [9, 0], clamp) +
    interpolate(frame, [172, 180], [5, 0], clamp);
  const shake: V3 = [
    Math.sin(frame * 2.7) * shakeAmp,
    0,
    Math.cos(frame * 3.1) * shakeAmp,
  ];
  const P = hermite(t, (k) => k.P);
  const Tg = hermite(t, (k) => k.T);
  const facadeNear = frame > 128 && frame < 175;
  const s = facadeNear ? 0.15 : 1;
  const cam = makeCam(
    [P[0] + shake[0] * s, P[1], P[2] + shake[2] * s],
    [Tg[0] + shake[0], Tg[1], Tg[2] + shake[2]],
  );

  // ---- Search state.
  const stepDone = STEP_FRAMES.filter((f) => frame >= f).length; // 0..20
  const searchOn =
    interpolate(frame, [100, 104], [0, 1], clamp) *
    interpolate(frame, [FOUND + 8, FOUND + 16], [1, 0], clamp);
  const dimOf = (out: number): number => {
    if (out > 20 || frame < STEP_FRAMES[out - 1]) return 0;
    const since = frame - STEP_FRAMES[out - 1];
    const fade = interpolate(frame, [FOUND + 20, 200], [1, 0.25], clamp);
    return interpolate(since, [0, 4], [0, 0.82], clamp) * fade;
  };
  // The region frame animates from the previous region to the current one.
  const animRegion = (lo: number, hi: number): Region | null => {
    if (stepDone < lo - 1 || stepDone > hi) return null;
    const cur = Math.max(stepDone, lo - 1);
    const prev = cur === lo - 1 ? cur : cur - 1;
    const base =
      cur === lo - 1 ? (lo === 1 ? REGIONS[0] : REGIONS[11]) : regionAfter(cur);
    if (cur === lo - 1) return base;
    const from =
      prev === lo - 1
        ? lo === 1
          ? REGIONS[0]
          : REGIONS[11]
        : regionAfter(prev);
    const k = Easing.out(Easing.cubic)(
      interpolate(
        frame,
        [STEP_FRAMES[cur - 1], STEP_FRAMES[cur - 1] + 2],
        [0, 1],
        clamp,
      ),
    );
    return lerpRegion(from, base, k);
  };
  const cityRegion = frame >= 100 && frame < 136 ? animRegion(1, 10) : null;
  const faceRegion =
    frame >= 132 && frame < FOUND + 16 ? animRegion(11, 20) : null;
  // The half thrown away at the latest step flashes and fades.
  const lastStep = stepDone;
  const cutFlash =
    lastStep > 0 && lastStep <= 20
      ? interpolate(frame - STEP_FRAMES[lastStep - 1], [0, 5], [0.55, 0], clamp)
      : 0;
  const cutRegion = ((): Region | null => {
    if (lastStep === 0 || cutFlash <= 0) return null;
    const prev =
      lastStep === 1
        ? REGIONS[0]
        : lastStep === 11
          ? REGIONS[11]
          : regionAfter(lastStep - 1);
    const cur = regionAfter(lastStep);
    if (cur.a0 > prev.a0) return { ...prev, a1: cur.a0 };
    if (cur.a1 < prev.a1) return { ...prev, a0: cur.a1 };
    if (cur.b0 > prev.b0) return { ...prev, b1: cur.b0 };
    return { ...prev, b0: cur.b1 };
  })();

  // ---- Sky, stars, horizon.
  const hz = norm([cam.f[0], cam.f[1], 0]);
  const hzC = [dot(hz, cam.r), dot(hz, cam.u), dot(hz, cam.f)];
  const horizonY = HEIGHT / 2 - (F * hzC[1]) / Math.max(0.05, hzC[2]);
  const stars = Array.from({ length: 520 }, (_, i) => {
    const az = random(`az${i}`) * Math.PI * 2;
    const el = Math.asin(0.04 + random(`el${i}`) * 0.96);
    const dir: V3 = [
      Math.cos(el) * Math.sin(az),
      Math.cos(el) * Math.cos(az),
      Math.sin(el),
    ];
    const c: V3 = [dot(dir, cam.r), dot(dir, cam.u), dot(dir, cam.f)];
    if (c[2] < 0.05) return null;
    const p = projC(c);
    if (p.x < -10 || p.x > WIDTH + 10 || p.y < -10 || p.y > horizonY)
      return null;
    const tw = 0.55 + 0.45 * Math.sin(frame / 7 + i * 1.3) ** 2;
    const r = 0.9 + random(`sr${i}`) ** 3 * 2.8;
    return (
      <circle
        key={i}
        cx={p.x}
        cy={p.y}
        r={r}
        fill={i % 11 === 0 ? "#ffd6fb" : "#ffffff"}
        opacity={tw}
      />
    );
  });

  // ---- Ground grid (streets), clipped to the near plane.
  const grid: React.ReactNode[] = [];
  for (let k = -60; k <= 60; k++) {
    const v = k * PITCH;
    const segs: [V3, V3][] = [
      [
        [v, -6200, 0],
        [v, 9000, 0],
      ],
      [
        [-6200, v, 0],
        [6200, v, 0],
      ],
    ];
    segs.forEach(([a, b], n) => {
      const sg = projSeg(cam, a, b);
      if (!sg) return;
      grid.push(
        <line
          key={`g${k}-${n}`}
          x1={sg[0].x}
          y1={sg[0].y}
          x2={sg[1].x}
          y2={sg[1].y}
        />,
      );
    });
  }
  // The open avenue glows like a runway.
  const avenue = [
    [T_X0 + 5, -1700, 0.5],
    [T_X0 + 65, -1700, 0.5],
    [T_X0 + 65, FACE_Y, 0.5],
    [T_X0 + 5, FACE_Y, 0.5],
  ] as V3[];
  const avenueP = avenue.map((q) => proj(cam, q));

  // ---- Towers, back to front.
  type Drawn = { depth: number; node: React.ReactNode };
  const drawn: Drawn[] = [];
  const glowTops: string[] = [];
  const redLit = redFlickerOn(frame);
  const foundGlow = frame >= FOUND ? 1 : 0;

  TOWERS.forEach((tw, idx) => {
    const { x0, x1, y0, y1, h } = tw;
    const corners: V3[] = [
      [x0, y0, 0],
      [x1, y0, 0],
      [x1, y1, 0],
      [x0, y1, 0],
      [x0, y0, h],
      [x1, y0, h],
      [x1, y1, h],
      [x0, y1, h],
    ];
    const pc: Pt[] = [];
    for (const q of corners) {
      const p = proj(cam, q);
      if (!p) return;
      pc.push(p);
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pc) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    if (maxX < -20 || minX > WIDTH + 20 || maxY < -20 || minY > HEIGHT + 20)
      return;
    const cc = toCam(cam, [(x0 + x1) / 2, (y0 + y1) / 2, h / 2]);
    const depth = cc[2];
    const fog = interpolate(depth, [2200, 9500], [0, 0.95], clamp);
    const dim = dimOf(TOWER_OUT[idx]) * searchOn;
    const bright = (1 - fog) * (1 - dim);
    const isTarget = tw.i === TI && tw.j === TJ;

    // Visible faces: [corner indices, base colour, face id].
    const faces: [number[], string, string][] = [];
    if (cam.P[1] < y0) faces.push([[0, 1, 5, 4], C.faceRight, "f"]);
    if (cam.P[1] > y1) faces.push([[3, 2, 6, 7], C.faceRight, "b"]);
    if (cam.P[0] < x0) faces.push([[0, 3, 7, 4], C.faceLeft, "l"]);
    if (cam.P[0] > x1) faces.push([[1, 2, 6, 5], C.faceLeft, "r"]);
    const top = [4, 5, 6, 7].map((k) => pc[k]);

    const parts: React.ReactNode[] = [];
    faces.forEach(([ids, col, fid]) => {
      parts.push(
        <polygon
          key={fid}
          points={poly(ids.map((k) => pc[k]))}
          fill={mix(col, FOG, fog)}
          stroke={tw.color}
          strokeOpacity={0.55 * bright}
          strokeWidth={1}
        />,
      );
      const faceH = Math.abs(pc[ids[0]].y - pc[ids[3]].y);
      // The changed tower's front facade: its 16 × 64 windows, when close enough.
      if (isTarget && fid === "f" && faceH > 140) {
        const ws: React.ReactNode[] = [];
        for (let k = 0; k < WCOLS * WROWS; k++) {
          const c = k % WCOLS;
          const r = Math.floor(k / WCOLS);
          if (c === RED_C && r === RED_R) continue;
          const lit = WINDOW_LIT[k];
          const wd = dimOf(WINDOW_OUT[k]) * searchOn;
          const op = (lit ? 0.85 : 0.14) * (1 - wd * 1.05);
          if (op < 0.03) continue;
          const xa = T_X0 + (c + 0.2) * CW;
          const xb = T_X0 + (c + 0.8) * CW;
          const za = (r + 0.22) * RH;
          const zb = (r + 0.78) * RH;
          const q = [
            proj(cam, [xa, FACE_Y - 0.3, za]),
            proj(cam, [xb, FACE_Y - 0.3, za]),
            proj(cam, [xb, FACE_Y - 0.3, zb]),
            proj(cam, [xa, FACE_Y - 0.3, zb]),
          ];
          if (q.some((p) => !p)) continue;
          ws.push(
            <polygon
              key={k}
              points={poly(q as Pt[])}
              fill={
                lit ? (random(`wc${k}`) > 0.85 ? "#ffffff" : C.file) : "#2a2f66"
              }
              opacity={op}
            />,
          );
        }
        parts.push(<g key="wins">{ws}</g>);
        return;
      }
      // Ordinary towers: rows of dashed window lights.
      const rowsMax = Math.floor((h - 10) / 22);
      const rows = Math.min(rowsMax, Math.floor(faceH / 7));
      if (rows < 1 || bright < 0.08) return;
      const A = corners[ids[0]];
      const B = corners[ids[1]];
      const lines: React.ReactNode[] = [];
      const step = rowsMax / rows;
      for (let rr = 0; rr < rows; rr++) {
        const row = Math.floor(rr * step);
        const rv = random(`r${tw.seed}${fid}${row}`);
        if (rv > tw.lit) continue;
        const z = 14 + row * 22;
        const a = proj(cam, [
          A[0] + (B[0] - A[0]) * 0.1,
          A[1] + (B[1] - A[1]) * 0.1,
          z,
        ]);
        const b = proj(cam, [
          A[0] + (B[0] - A[0]) * 0.9,
          A[1] + (B[1] - A[1]) * 0.9,
          z,
        ]);
        if (!a || !b) continue;
        const L = Math.hypot(b.x - a.x, b.y - a.y);
        const dash = L / 7;
        const flick = 0.75 + 0.25 * Math.sin(frame / 5 + tw.seed + row);
        lines.push(
          <line
            key={rr}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            strokeDasharray={`${dash.toFixed(2)} ${dash.toFixed(2)}`}
            strokeWidth={Math.max(0.8, Math.min(5, (F * 7) / depth))}
            opacity={(0.35 + 0.5 * rv) * flick}
          />,
        );
      }
      parts.push(
        <g
          key={`w${fid}`}
          stroke={rv2color(tw.seed, tw.color)}
          opacity={bright}
        >
          {lines}
        </g>,
      );
    });
    if (cam.P[2] > h) {
      parts.push(
        <polygon
          key="top"
          points={poly(top)}
          fill={mix(C.faceTop, FOG, fog)}
          stroke={tw.color}
          strokeOpacity={0.9 * bright}
          strokeWidth={1.4}
        />,
      );
      if (bright > 0.25 && depth < 7000) glowTops.push(poly(top));
    }
    // The changed window, drawn last on its tower so it is never hidden by it.
    if (isTarget && (redLit || foundGlow) && cam.P[1] < y0) {
      const p = proj(cam, RED_POS);
      if (p) {
        const sz = Math.max(5.5, (F * CW * 0.6) / p.z / 2);
        parts.push(
          <g key="red">
            <circle
              cx={p.x}
              cy={p.y}
              r={sz * 7}
              fill={C.changed}
              opacity={0.75}
              filter="url(#s1-blur)"
            />
            <rect
              x={p.x - sz}
              y={p.y - sz * 0.95}
              width={sz * 2}
              height={sz * 1.9}
              fill={C.changed}
            />
            <rect
              x={p.x - sz * 0.45}
              y={p.y - sz * 0.45}
              width={sz * 0.9}
              height={sz * 0.9}
              fill="#ffd0d8"
            />
          </g>,
        );
      }
    }
    drawn.push({ depth, node: <g key={idx}>{parts}</g> });
  });
  drawn.sort((a, b) => b.depth - a.depth);

  // ---- Search overlays in world space.
  const groundRect = (r: Region, z: number): Pt[] | null => {
    const q: V3[] = [
      [cellX(r.a0) - PITCH / 2, cellY(r.b0) - PITCH / 2, z],
      [cellX(r.a1) - PITCH / 2, cellY(r.b0) - PITCH / 2, z],
      [cellX(r.a1) - PITCH / 2, cellY(r.b1) - PITCH / 2, z],
      [cellX(r.a0) - PITCH / 2, cellY(r.b1) - PITCH / 2, z],
    ];
    const p = q.map((v) => proj(cam, v));
    return p.some((x) => !x) ? null : (p as Pt[]);
  };
  const faceRect = (r: Region): Pt[] | null => {
    const q: V3[] = [
      [T_X0 + r.a0 * CW, FACE_Y - 0.8, r.b0 * RH],
      [T_X0 + r.a1 * CW, FACE_Y - 0.8, r.b0 * RH],
      [T_X0 + r.a1 * CW, FACE_Y - 0.8, r.b1 * RH],
      [T_X0 + r.a0 * CW, FACE_Y - 0.8, r.b1 * RH],
    ];
    const p = q.map((v) => proj(cam, v));
    return p.some((x) => !x) ? null : (p as Pt[]);
  };
  const cityRect = cityRegion ? groundRect(cityRegion, 1) : null;
  const cityRectHi = cityRegion ? groundRect(cityRegion, 420) : null;
  const faceR = faceRegion ? faceRect(faceRegion) : null;
  const cutPoly =
    cutRegion && lastStep <= 10
      ? groundRect(cutRegion, 1)
      : cutRegion
        ? faceRect(cutRegion)
        : null;
  // Searchlight cone from high above onto the current region.
  const apex =
    cityRegion && frame < 133
      ? proj(cam, [
          (cellX(cityRegion.a0) + cellX(cityRegion.a1)) / 2 - PITCH / 2,
          (cellY(cityRegion.b0) + cellY(cityRegion.b1)) / 2 - PITCH / 2 - 400,
          2600,
        ])
      : null;

  // ---- Red window: rings when it first lights up, and the burst when it is found.
  const redP = proj(cam, RED_POS);
  const ring = (start: number, len: number, maxR: number, w: number) => {
    const k = interpolate(frame, [start, start + len], [0, 1], clamp);
    if (!redP || k <= 0 || k >= 1) return null;
    return (
      <circle
        key={start}
        cx={redP.x}
        cy={redP.y}
        r={8 + k * maxR}
        fill="none"
        stroke={C.changed}
        strokeWidth={w * (1 - k)}
        opacity={1 - k}
      />
    );
  };

  // ---- HUD text.
  const countT = interpolate(frame, [sec(1.35), sec(2.6)], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const count = Math.round(1_000_000 * countT);
  const countIn = spring({
    frame: frame - sec(1.3),
    fps,
    config: { damping: 14 },
  });
  const countOut = interpolate(frame, [sec(3.05), sec(3.35)], [1, 0], clamp);
  const hudIn = interpolate(frame, [98, 104], [0, 1], clamp);
  const hudOut = interpolate(frame, [FOUND + 6, FOUND + 12], [1, 0], clamp);
  const left = Math.ceil(1_000_000 / 2 ** stepDone);
  const stepPop =
    stepDone > 0
      ? interpolate(frame - STEP_FRAMES[stepDone - 1], [0, 3], [1.18, 1], clamp)
      : 1;

  // ---- Title.
  const aOn = signOn(SIGN_A, frame);
  const bOn = signOn(SIGN_B, frame);
  const hum = 0.93 + 0.07 * Math.sin(frame * 1.9) * Math.sin(frame * 0.37);
  const cityDim = interpolate(frame, [168, 190], [0, 0.45], clamp);
  const treeK = (d: number) =>
    spring({
      frame: frame - 186 - d,
      fps,
      config: { damping: 15, stiffness: 140 },
    });

  const fadeIn = interpolate(frame, [0, 9], [1, 0], clamp);
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 9, durationInFrames - 1],
    [0, 1],
    clamp,
  );
  const redFlash = redLit && frame < 26 ? 0.1 : 0;
  const foundFlash = interpolate(frame, [FOUND, FOUND + 6], [0.35, 0], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: C.skyTop, fontFamily: FONT }}>
      <Audio src={staticFile("scene01.wav")} />
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute" }}>
        <defs>
          <filter id="s1-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id="s1-blur" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="s1-neon" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient
            id="s1-sky"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={horizonY - 1300}
            x2="0"
            y2={horizonY}
          >
            <stop offset="0" stopColor={C.skyTop} />
            <stop offset="0.7" stopColor={C.skyMid} />
            <stop offset="1" stopColor="#4a0d5c" />
          </linearGradient>
          <linearGradient
            id="s1-haze"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={horizonY - 140}
            x2="0"
            y2={horizonY + 260}
          >
            <stop offset="0" stopColor={C.horizon} stopOpacity="0" />
            <stop offset="0.35" stopColor={C.horizon} stopOpacity="0.28" />
            <stop offset="0.5" stopColor="#3a0a4a" stopOpacity="0.9" />
            <stop offset="1" stopColor="#0a0218" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="s1-cone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.hash} stopOpacity="0" />
            <stop offset="1" stopColor={C.hash} stopOpacity="0.22" />
          </linearGradient>
          <radialGradient id="s1-vig" cx="50%" cy="50%" r="72%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.7" />
          </radialGradient>
          <radialGradient id="s1-root">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.35" stopColor={C.root} />
            <stop offset="1" stopColor={C.root} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sky and ground. */}
        <rect width={WIDTH} height={HEIGHT} fill="url(#s1-sky)" />
        {stars}
        {horizonY < HEIGHT + 300 ? (
          <rect
            x={0}
            y={Math.max(-10, horizonY)}
            width={WIDTH}
            height={Math.max(0, HEIGHT + 20 - horizonY)}
            fill="#0a0218"
          />
        ) : null}
        <g
          stroke={C.grid}
          strokeWidth={1.3}
          opacity={0.6}
          filter="url(#s1-neon)"
        >
          {grid}
        </g>
        {avenueP.every((p) => p) ? (
          <polygon
            points={poly(avenueP as Pt[])}
            fill={C.hash}
            opacity={0.1 + 0.05 * Math.sin(frame / 4)}
          />
        ) : null}
        <rect
          x={0}
          y={horizonY - 140}
          width={WIDTH}
          height={400}
          fill="url(#s1-haze)"
        />
        <line
          x1={0}
          y1={horizonY}
          x2={WIDTH}
          y2={horizonY}
          stroke={C.horizon}
          strokeWidth={2.5}
          opacity={0.8}
          filter="url(#s1-neon)"
        />

        {/* Searchlight cone, behind the towers. */}
        {apex && cityRect ? (
          <polygon
            points={poly([
              apex,
              cityRect[0],
              cityRect[1],
              cityRect[2],
              cityRect[3],
            ])}
            fill="url(#s1-cone)"
            opacity={searchOn}
          />
        ) : null}
        {cityRect ? (
          <polygon
            points={poly(cityRect)}
            fill={C.hash}
            opacity={0.12 * searchOn}
          />
        ) : null}

        {/* The city. */}
        <g opacity={1 - cityDim}>
          {drawn.map((d) => d.node)}
          {/* One cheap glow pass over all roof outlines. */}
          <g
            fill="none"
            stroke={C.file}
            strokeWidth={3}
            opacity={0.55}
            filter="url(#s1-glow)"
          >
            {glowTops.map((p, i) => (
              <polygon key={i} points={p} />
            ))}
          </g>
        </g>

        {/* Search frames. */}
        {cutPoly ? (
          <polygon points={poly(cutPoly)} fill={C.hash} opacity={cutFlash} />
        ) : null}
        {cityRect && cityRectHi ? (
          <g opacity={searchOn} filter="url(#s1-neon)" fill="none">
            <polygon points={poly(cityRect)} stroke={C.hash} strokeWidth={4} />
            <polygon
              points={poly(cityRect)}
              stroke="#ffffff"
              strokeWidth={1.4}
            />
            {[0, 1, 2, 3].map((k) => (
              <line
                key={k}
                x1={cityRect[k].x}
                y1={cityRect[k].y}
                x2={cityRectHi[k].x}
                y2={cityRectHi[k].y}
                stroke={C.hash}
                strokeWidth={2}
                opacity={0.6}
              />
            ))}
          </g>
        ) : null}
        {faceR ? (
          <g opacity={searchOn} filter="url(#s1-neon)" fill="none">
            <polygon points={poly(faceR)} stroke={C.hash} strokeWidth={5} />
            <polygon points={poly(faceR)} stroke="#ffffff" strokeWidth={1.6} />
          </g>
        ) : null}

        {/* The changed window: rings at "One letter changed", burst when found. */}
        <g filter="url(#s1-neon)">
          {ring(17, 18, 170, 5)}
          {ring(24, 20, 260, 4)}
          {ring(36, 18, 200, 3)}
          {ring(FOUND, 14, 420, 10)}
          {ring(FOUND + 4, 16, 700, 7)}
        </g>
        {frame >= FOUND && frame < 176 && redP ? (
          <circle
            cx={redP.x}
            cy={redP.y}
            r={interpolate(
              frame,
              [FOUND, FOUND + 6, 176],
              [40, 150, 30],
              clamp,
            )}
            fill={C.changed}
            opacity={interpolate(frame, [FOUND, 176], [0.7, 0.1], clamp)}
            filter="url(#s1-blur)"
          />
        ) : null}
        <rect width={WIDTH} height={HEIGHT} fill="url(#s1-vig)" />
      </svg>

      {/* "A million files" counter. */}
      {countOut > 0 && frame >= sec(1.3) ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 86,
            textAlign: "center",
            opacity: countIn * countOut,
            transform: `scale(${0.85 + 0.15 * countIn})`,
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontWeight: 800,
              fontSize: 130,
              letterSpacing: 4,
              color: "#eaffff",
              textShadow: `0 0 10px ${C.file}, 0 0 30px ${C.file}, 0 0 70px ${C.file}`,
            }}
          >
            {count.toLocaleString("en-US")}
          </div>
          <div
            style={{
              fontSize: 50,
              fontWeight: 700,
              letterSpacing: 18,
              color: C.text,
              marginTop: -6,
              textShadow: `0 0 18px ${C.hash}`,
            }}
          >
            FILES
          </div>
        </div>
      ) : null}

      {/* Search HUD. */}
      {hudIn * hudOut > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 70,
            top: 60,
            opacity: hudIn * hudOut,
            fontFamily: MONO,
          }}
        >
          <div
            style={{
              fontSize: 40,
              letterSpacing: 10,
              color: C.hash,
              fontWeight: 700,
              textShadow: `0 0 14px ${C.hash}`,
            }}
          >
            STEP
          </div>
          <div
            style={{
              fontSize: 150,
              lineHeight: 1,
              fontWeight: 800,
              color: "#ffffff",
              transform: `scale(${stepPop})`,
              transformOrigin: "left center",
              textShadow: `0 0 12px ${C.hash}, 0 0 40px ${C.hash}`,
            }}
          >
            {String(stepDone).padStart(2, "0")}
            <span style={{ fontSize: 64, color: C.muted, textShadow: "none" }}>
              {" "}
              / 20
            </span>
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 44,
              color: stepDone === 20 ? C.changed : C.file,
              textShadow: `0 0 14px ${stepDone === 20 ? C.changed : C.file}`,
            }}
          >
            {left.toLocaleString("en-US")} {left === 1 ? "file" : "files"} left
          </div>
        </div>
      ) : null}

      {/* City dims behind the title. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 62% 58% at 50% 46%, rgba(5,1,15,${cityDim * 1.3}) 0%, rgba(5,1,15,0) 100%)`,
        }}
      />

      {/* The title: a neon sign that buzzes on. */}
      {frame >= 160 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 250,
            textAlign: "center",
            fontWeight: 800,
            fontSize: 200,
            letterSpacing: 6,
            lineHeight: 1,
          }}
        >
          <span
            style={{
              color: aOn ? "#fff2fd" : "#3a1c4a",
              opacity: aOn ? hum : 0.55,
              textShadow: aOn
                ? `0 0 6px #fff, 0 0 18px ${C.hash}, 0 0 44px ${C.hash}, 0 0 100px ${C.hash}`
                : "none",
              WebkitTextStroke: aOn ? "0px" : `2px ${C.hash}55`,
            }}
          >
            Merkle
          </span>{" "}
          <span
            style={{
              color: bOn ? "#f2feff" : "#1c3a4a",
              opacity: bOn ? hum : 0.55,
              textShadow: bOn
                ? `0 0 6px #fff, 0 0 18px ${C.file}, 0 0 44px ${C.file}, 0 0 100px ${C.file}`
                : "none",
              WebkitTextStroke: bOn ? "0px" : `2px ${C.file}55`,
            }}
          >
            tree
          </span>
        </div>
      ) : null}

      {/* A tiny tree under the title: files feed hashes feed the gold root. */}
      {frame >= 186 ? (
        <svg
          width={WIDTH}
          height={HEIGHT}
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <MiniTree k={treeK} frame={frame} />
        </svg>
      ) : null}

      <AbsoluteFill
        style={{
          backgroundColor: C.changed,
          opacity: redFlash + foundFlash * 0.4,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: C.skyTop,
          opacity: Math.max(fadeIn, fadeOut),
        }}
      />
    </AbsoluteFill>
  );
};

const rv2color = (seed: number, base: string): string =>
  random(`wcol${seed}`) > 0.8 ? "#ffffff" : base;

// Root (gold), two hashes (magenta), four files (cyan), with light flowing upward.
const MiniTree: React.FC<{ k: (d: number) => number; frame: number }> = ({
  k,
  frame,
}) => {
  const cx = WIDTH / 2;
  const root = { x: cx, y: 530 };
  const mids = [
    { x: cx - 150, y: 640 },
    { x: cx + 150, y: 640 },
  ];
  const leaves = [-225, -75, 75, 225].map((dx) => ({ x: cx + dx, y: 745 }));
  const kl = k(0);
  const km = k(5);
  const kr = k(10);
  const edge = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    p: number,
    key: string,
  ) => (
    <line
      key={key}
      x1={a.x}
      y1={a.y}
      x2={a.x + (b.x - a.x) * p}
      y2={a.y + (b.y - a.y) * p}
      stroke={C.hash}
      strokeWidth={4}
      filter="url(#s1t-neon)"
    />
  );
  const flow = (frame % 20) / 20;
  return (
    <g>
      <defs>
        <filter id="s1t-neon" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="s1t-root">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor={C.root} />
          <stop offset="1" stopColor={C.root} stopOpacity="0" />
        </radialGradient>
      </defs>
      {leaves.map((l, i) => edge(l, mids[i >> 1], km, `e${i}`))}
      {mids.map((m, i) => edge(m, root, kr, `m${i}`))}
      {kr > 0.95
        ? [
            ...leaves.map((l, i) => [l, mids[i >> 1]] as const),
            ...mids.map((m) => [m, root] as const),
          ].map(([a, b], i) => (
            <circle
              key={`p${i}`}
              cx={a.x + (b.x - a.x) * flow}
              cy={a.y + (b.y - a.y) * flow}
              r={5}
              fill="#ffffff"
              opacity={0.9}
            />
          ))
        : null}
      {leaves.map((l, i) => (
        <rect
          key={`l${i}`}
          x={l.x - 18 * kl}
          y={l.y - 22 * kl}
          width={36 * kl}
          height={44 * kl}
          fill={C.faceTop}
          stroke={C.file}
          strokeWidth={3}
          filter="url(#s1t-neon)"
        />
      ))}
      {mids.map((m, i) => (
        <polygon
          key={`h${i}`}
          points={`${m.x},${m.y - 24 * km} ${m.x + 18 * km},${m.y} ${m.x},${m.y + 24 * km} ${m.x - 18 * km},${m.y}`}
          fill={C.hash}
          fillOpacity={0.5}
          stroke={C.hash}
          strokeWidth={3}
          filter="url(#s1t-neon)"
        />
      ))}
      <circle
        cx={root.x}
        cy={root.y}
        r={70 * kr * (1 + 0.08 * Math.sin(frame / 5))}
        fill="url(#s1t-root)"
      />
      <circle cx={root.x} cy={root.y} r={13 * kr} fill="#ffffff" />
    </g>
  );
};
