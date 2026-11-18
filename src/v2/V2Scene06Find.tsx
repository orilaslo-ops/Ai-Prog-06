import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  random,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  Beacon,
  Beam,
  buildTree,
  C,
  Cam,
  clamp,
  FONT,
  FPS,
  HEIGHT,
  Hub,
  MONO,
  NeonBackground,
  NeonDefs,
  Tower,
  TOWER_H,
  towerPos,
  TreeNode,
  WIDTH,
} from "./kit";

// Scene 6 (11 s), the key idea: finding the change fast.
// Split screen: your neon city on the left, your friend's on the right (tower 6,
// index 5, changed). A scanner drone hovers over each city and reads the gold
// beacons: their codes differ (red). Then it reads each pair of hubs: the matching
// half flashes green and goes dark, the camera dives into the half that differs,
// level by level, until the one red tower is found. Then the neon sign:
// "1,000,000 files → about 20 steps", with a bar of a million files halved 20 times.
// Narration (public/scene06.wav, played 0.3 s in), measured with silencedetect:
// "To compare," 0.3–1.0 | "check the roots." 1.1–1.9 | "If they differ," 2.36–3.06 |
// "check the two children and follow the one that doesn't match." 3.28–6.0 |
// "With a million files," 6.56–7.7 | "that's about twenty steps." 7.84–9.07

const AUDIO_DELAY = 0.3;
const T = buildTree();
const CHANGED = 5; // friend's changed tower (file 6)
const HALF = WIDTH / 2;
const HX = [HALF / 2, HALF + HALF / 2]; // screen centre of each half
const ISO_X = Math.cos(Math.PI / 6);

type Verdict = "match" | "diff";
type Ref = [number, number]; // [level, index]

// One comparison stage: the drone scans `nodes` from `start`, verdict at `verdict`.
type Stage = {
  start: number;
  verdict: number;
  end: number;
  nodes: Ref[];
  results: Verdict[];
};
const STAGES: Stage[] = [
  { start: 1.1, verdict: 2.36, end: 3.0, nodes: [[3, 0]], results: ["diff"] },
  {
    start: 3.0,
    verdict: 3.45,
    end: 4.25,
    nodes: [
      [2, 0],
      [2, 1],
    ],
    results: ["match", "diff"],
  },
  {
    start: 4.25,
    verdict: 4.6,
    end: 5.15,
    nodes: [
      [1, 2],
      [1, 3],
    ],
    results: ["diff", "match"],
  },
  {
    start: 5.15,
    verdict: 5.5,
    end: 6.35,
    nodes: [
      [0, 4],
      [0, 5],
    ],
    results: ["match", "diff"],
  },
];
const T_FOUND = 5.5;
const T_MILLION = 6.56;
const T_TWENTY = 7.84;
const T_HALVE = 7.6; // the million-file bar starts halving
const HALVE_STEP = 0.06;

// The verdict a node receives (if it is compared).
const judged = (level: number, index: number) => {
  for (const s of STAGES) {
    const k = s.nodes.findIndex(([l, i]) => l === level && i === index);
    if (k >= 0) return { time: s.verdict, result: s.results[k] };
  }
  return null;
};

// Node state at time t: colour override and opacity (matching halves go dark).
const nodeState = (level: number, index: number, t: number) => {
  let matchTime: number | null = null;
  for (let lv = level, idx = index; lv <= 3; lv++, idx >>= 1) {
    const j = judged(lv, idx);
    if (j && j.result === "match") matchTime = j.time;
  }
  const own = judged(level, index);
  const diff = own && own.result === "diff" && t >= own.time;
  if (diff) return { color: C.changed, opacity: 1, state: "diff" as const };
  if (matchTime !== null && t >= matchTime) {
    const o = interpolate(t, [matchTime + 0.3, matchTime + 0.8], [1, 0.14], {
      ...clamp,
      easing: Easing.out(Easing.quad),
    });
    return { color: C.match, opacity: o, state: "match" as const };
  }
  return { color: null, opacity: 1, state: "none" as const };
};

// Four-letter codes. Your city and your friend's are equal except on the red path.
const onPath = (level: number, index: number) =>
  index === CHANGED >> level && level <= 3;
const code = (level: number, index: number, city: number) => {
  const seed = `${level}-${index}-${city === 1 && onPath(level, index) ? "f" : "y"}`;
  return Array.from({ length: 4 }, (_, k) =>
    Math.floor(random(seed + k) * 16).toString(16),
  ).join("");
};

// ---------------------------------------------------------------------------
// Camera: a focus point F (world), a zoom Z and the screen height hy where F sits.
// ---------------------------------------------------------------------------
type Shot = { F: [number, number, number]; Z: number; hy: number };
const root = T[3][0];
const n2 = T[2][1];
const n1 = T[1][2];
const leaf = T[0][CHANGED];
const SHOTS: Shot[] = [
  { F: [root.x, root.y, 290], Z: 0.52, hy: 570 },
  { F: [n2.x, n2.y, 270], Z: 1.0, hy: 590 },
  { F: [n1.x, n1.y, 210], Z: 1.55, hy: 600 },
  { F: [leaf.x, leaf.y, 110], Z: 2.25, hy: 640 },
  { F: [root.x, root.y, 290], Z: 0.5, hy: 840 },
];
// [start, end] of each move from SHOTS[k] to SHOTS[k + 1].
const MOVES: [number, number][] = [
  [3.55, 4.2],
  [4.68, 5.15],
  [5.58, 6.05],
  [6.3, 7.1],
];

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const shotAt = (t: number): { shot: Shot; speed: number } => {
  let shot = SHOTS[0];
  let speed = 0;
  MOVES.forEach(([a, b], k) => {
    if (t < a) return;
    const p = interpolate(t, [a, b], [0, 1], {
      ...clamp,
      easing: Easing.inOut(Easing.cubic),
    });
    const A = SHOTS[k];
    const B = SHOTS[k + 1];
    shot = {
      F: [
        lerp(A.F[0], B.F[0], p),
        lerp(A.F[1], B.F[1], p),
        lerp(A.F[2], B.F[2], p),
      ],
      Z: Math.exp(lerp(Math.log(A.Z), Math.log(B.Z), p)),
      hy: lerp(A.hy, B.hy, p),
    };
    if (t < b) speed = Math.sin(Math.PI * ((t - a) / (b - a)));
  });
  // A slow breathing push-in while holding the first shot.
  if (t < MOVES[0][0]) {
    shot = { ...shot, Z: shot.Z * (1 + 0.03 * (t / MOVES[0][0])) };
  }
  return { shot, speed };
};

const camFor = (hx: number, s: Shot, sx: number, sy: number): Cam => ({
  x: hx - WIDTH / 2 - (s.F[0] - s.F[1]) * ISO_X * s.Z + sx,
  y: s.hy - HEIGHT * 0.74 - ((s.F[0] + s.F[1]) * 0.5 - s.F[2]) * s.Z + sy,
  zoom: s.Z,
});

const project = (n: TreeNode, cam: Cam) => ({
  sx: WIDTH / 2 + cam.x + (n.x - n.y) * ISO_X * cam.zoom,
  sy: HEIGHT * 0.74 + cam.y + ((n.x + n.y) * 0.5 - n.z) * cam.zoom,
});

// ---------------------------------------------------------------------------
// One city (one half of the split screen).
// ---------------------------------------------------------------------------
const City: React.FC<{ city: number; cam: Cam; t: number }> = ({
  city,
  cam,
  t,
}) => {
  const beams: React.ReactNode[] = [];
  T.slice(0, 3).forEach((lvl) =>
    lvl.forEach((n) => {
      const p = T[n.level + 1][Math.floor(n.index / 2)];
      const st = nodeState(n.level, n.index, t);
      const red = st.state === "diff" && nodeState(p.level, p.index, t).state;
      beams.push(
        <g key={`b${n.level}${n.index}`} opacity={st.opacity}>
          <Beam
            a={[n.x, n.y, n.z]}
            b={[p.x, p.y, p.z]}
            cam={cam}
            color={red === "diff" ? C.changed : (st.color ?? C.hash)}
            width={3}
          />
        </g>,
      );
    }),
  );
  const glitch = city === 1 && t >= T_FOUND && t < T_FOUND + 0.35;
  return (
    <g>
      {beams}
      {TOWER_H.map((h, i) => {
        const st = nodeState(0, i, t);
        const found = i === CHANGED && st.state === "diff";
        return (
          <g key={i} opacity={st.opacity}>
            {glitch && found ? (
              <>
                <g transform={`translate(${-14 * cam.zoom},0)`} opacity={0.7}>
                  <Tower
                    {...towerPos(i)}
                    h={h}
                    cam={cam}
                    color={C.file}
                    windows={false}
                  />
                </g>
                <g transform={`translate(${14 * cam.zoom},0)`} opacity={0.7}>
                  <Tower
                    {...towerPos(i)}
                    h={h}
                    cam={cam}
                    color={C.hash}
                    windows={false}
                  />
                </g>
              </>
            ) : null}
            <Tower
              {...towerPos(i)}
              h={h}
              cam={cam}
              seed={`t${i}`}
              color={st.color ?? C.file}
              glow={found ? 1 : 0.5}
            />
          </g>
        );
      })}
      {T.slice(1, 3).flatMap((lvl) =>
        lvl.map((n) => {
          const st = nodeState(n.level, n.index, t);
          return (
            <g key={`h${n.level}${n.index}`} opacity={st.opacity}>
              <Hub
                x={n.x}
                y={n.y}
                z={n.z}
                cam={cam}
                color={st.color ?? C.hash}
              />
            </g>
          );
        }),
      )}
      <Beacon
        x={root.x}
        y={root.y}
        z={root.z}
        cam={cam}
        color={nodeState(3, 0, t).color ?? C.root}
      />
    </g>
  );
};

// The scanner drone: a small hovering craft with spinning rotors and a lens.
const Drone: React.FC<{ x: number; y: number; frame: number; o: number }> = ({
  x,
  y,
  frame,
  o,
}) => {
  const bob = Math.sin(frame / 6) * 5;
  const spin = Math.abs(Math.sin(frame * 1.3));
  return (
    <g transform={`translate(${x},${y + bob})`} opacity={o}>
      <circle r={46} fill={C.file} opacity={0.18} filter="url(#neon-wide)" />
      {[-1, 1].map((s) => (
        <g key={s}>
          <line
            x1={0}
            y1={0}
            x2={s * 46}
            y2={-12}
            stroke={C.text}
            strokeWidth={3}
          />
          <ellipse
            cx={s * 46}
            cy={-16}
            rx={26 * spin + 4}
            ry={4}
            fill="none"
            stroke={C.file}
            strokeWidth={2.5}
            filter="url(#neon)"
          />
        </g>
      ))}
      <path
        d="M -26 -6 L 26 -6 L 16 14 L -16 14 Z"
        fill={C.faceTop}
        stroke={C.file}
        strokeWidth={2.5}
        filter="url(#neon)"
      />
      <circle cx={0} cy={14} r={7} fill="#ffffff" />
      <circle cx={0} cy={14} r={12} fill={C.file} opacity={0.5} />
    </g>
  );
};

const scramble = (real: string, seed: string, frame: number) =>
  Array.from({ length: 4 }, (_, k) =>
    Math.floor(random(`${seed}${k}${Math.floor(frame / 2)}`) * 16).toString(16),
  ).join("") || real;

// Drone, scan cones and code tags drawn in screen space for one half.
const Scanner: React.FC<{
  city: number;
  cam: Cam;
  t: number;
  frame: number;
}> = ({ city, cam, t, frame }) => {
  const at = (r: Ref) => {
    const n = T[r[0]][r[1]];
    const p = project(n, cam);
    return r[0] === 3 ? { sx: p.sx, sy: p.sy } : p;
  };
  // Where the drone hovers for a stage: above the compared nodes.
  const hover = (s: Stage) => {
    const ps = s.nodes.map(at);
    const x = ps.reduce((a, p) => a + p.sx, 0) / ps.length;
    const y =
      Math.min(...ps.map((p) => p.sy)) - (s.nodes.length > 1 ? 190 : 230);
    return { x, y };
  };
  let k = STAGES.findIndex((s) => t < s.end);
  if (k < 0) k = STAGES.length - 1;
  const cur = hover(STAGES[k]);
  const prev = k > 0 ? hover(STAGES[k - 1]) : { x: cur.x, y: -120 };
  const fly = interpolate(
    t,
    [STAGES[k].start - (k === 0 ? 0.6 : 0.05), STAGES[k].start + 0.3],
    [0, 1],
    { ...clamp, easing: Easing.inOut(Easing.cubic) },
  );
  const leave = interpolate(t, [6.3, 6.9], [0, 1], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });
  const dx = lerp(prev.x, cur.x, fly);
  const dy = lerp(prev.y, cur.y, fly) - leave * 500;

  const s = STAGES[k];
  const scanning = t >= s.start && t < s.verdict;
  const tagsIn = interpolate(t, [s.start, s.start + 0.15], [0, 1], clamp);
  const tagsOut = interpolate(t, [s.end - 0.12, s.end], [1, 0], clamp);
  const sweep = ((t - s.start) * 2.2) % 1;

  return (
    <g>
      {s.nodes.map((r, j) => {
        const p = at(r);
        const verdict = t >= s.verdict ? s.results[j] : null;
        const col =
          verdict === "diff"
            ? C.changed
            : verdict === "match"
              ? C.match
              : C.file;
        const st = nodeState(r[0], r[1], t);
        const real = code(r[0], r[1], city);
        const shown =
          t < s.verdict - 0.18
            ? scramble(real, `${city}${r[0]}${r[1]}`, frame)
            : real;
        const pop = interpolate(t, [s.verdict, s.verdict + 0.2], [1.25, 1], {
          ...clamp,
          easing: Easing.out(Easing.back(3)),
        });
        const isRoot = r[0] === 3;
        const tagY = isRoot
          ? p.sy + 30
          : p.sy - (r[0] === 0 ? 62 : 72) * Math.max(0.8, cam.zoom * 0.8);
        const tagX = isRoot ? p.sx + (city === 0 ? -150 : 150) : p.sx;
        const label = verdict === "diff" ? "✗" : verdict === "match" ? "✓" : "";
        const w = label ? 160 : 118;
        const o =
          tagsIn *
          tagsOut *
          (st.state === "match" ? Math.max(st.opacity, 0.3) : 1);
        const ringR = 46 * Math.max(0.7, cam.zoom);
        return (
          <g key={j} opacity={o}>
            {scanning && fly > 0.6 ? (
              <polygon
                points={`${dx},${dy + 18} ${p.sx - ringR * 0.9},${p.sy} ${p.sx + ringR * 0.9},${p.sy}`}
                fill={C.file}
                opacity={0.13}
              />
            ) : null}
            <ellipse
              cx={p.sx}
              cy={p.sy}
              rx={ringR * (scanning ? 1 + 0.25 * sweep : 1)}
              ry={ringR * 0.5 * (scanning ? 1 + 0.25 * sweep : 1)}
              fill="none"
              stroke={col}
              strokeWidth={3}
              opacity={scanning ? 1 - sweep * 0.6 : 0.9}
              filter="url(#neon)"
            />
            <g transform={`translate(${tagX},${tagY}) scale(${pop})`}>
              <rect
                x={-w / 2}
                y={-28}
                width={w}
                height={54}
                rx={10}
                fill="#0a0420"
                fillOpacity={0.9}
                stroke={col}
                strokeWidth={2.5}
                filter={verdict ? "url(#neon)" : undefined}
              />
              <text
                x={0}
                y={12}
                textAnchor="middle"
                fontFamily={MONO}
                fontSize={36}
                fontWeight={700}
                fill={verdict ? col : C.text}
              >
                {label ? `${label} ${shown}` : shown}
              </text>
            </g>
          </g>
        );
      })}
      <Drone x={dx} y={dy} frame={frame + city * 7} o={1 - leave} />
    </g>
  );
};

// Neon text that flickers on like a sign.
const neonOn = (t: number, at: number, seed: string) => {
  if (t < at) return 0;
  const k = Math.floor((t - at) * FPS);
  if (k > 9) return 1;
  return random(`${seed}${k}`) > 0.45 ? 1 : 0.15;
};
const glow = (c: string) =>
  `0 0 6px ${c}, 0 0 18px ${c}, 0 0 42px ${c}, 0 0 80px ${c}`;

export const V2Scene06Find: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { shot, speed } = shotAt(t);
  const shake =
    t >= T_FOUND && t < T_FOUND + 0.4 ? (1 - (t - T_FOUND) / 0.4) * 14 : 0;
  const shx = shake * (random(`sx${frame}`) - 0.5) * 2;
  const shy = shake * (random(`sy${frame}`) - 0.5) * 2;
  const cams = HX.map((hx) => camFor(hx, shot, shx, shy));
  const finale = interpolate(t, [6.3, 7.0], [0, 1], clamp);

  // Root comparison laser across the divider.
  const bl = project(root, cams[0]);
  const br = project(root, cams[1]);
  const laser = interpolate(t, [1.25, 1.75], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const laserOut = interpolate(t, [2.9, 3.15], [1, 0], clamp);
  const rootDiff = t >= STAGES[0].verdict;

  // Step counter.
  const steps = STAGES.slice(1).filter((s) => t >= s.verdict).length;
  const counterText =
    t < STAGES[0].start
      ? ""
      : steps === 0
        ? "COMPARE ROOTS"
        : steps < 3
          ? `STEP ${steps}`
          : "8 FILES → 3 STEPS";

  const captions: { at: number; until: number; node: React.ReactNode }[] = [
    {
      at: 1.05,
      until: 2.36,
      node: (
        <>
          Compare the <span style={{ color: C.root }}>roots</span>
        </>
      ),
    },
    {
      at: 2.36,
      until: 3.0,
      node: (
        <>
          <span style={{ color: C.changed }}>Different</span> → something
          changed
        </>
      ),
    },
    {
      at: 3.0,
      until: 4.15,
      node: <>Check the two children</>,
    },
    {
      at: 4.15,
      until: T_FOUND,
      node: (
        <>
          Follow the one that{" "}
          <span style={{ color: C.changed }}>doesn&apos;t match</span>
        </>
      ),
    },
    {
      at: T_FOUND,
      until: 6.35,
      node: (
        <>
          Found it: <span style={{ color: C.changed }}>file 6</span>
        </>
      ),
    },
  ];

  // Finale: a bar of a million files, halved 20 times.
  const halves = Math.max(
    0,
    Math.min(20, Math.floor((t - T_HALVE) / HALVE_STEP) + 1),
  );
  const BAR_X = 310;
  const BAR_W = 1300;
  const target = 0.6137;
  const win = BAR_W / 2 ** halves;
  const winX = BAR_X + Math.floor((target * BAR_W) / win) * win;
  const left = Math.ceil(1_000_000 / 2 ** halves);
  const sign1 = neonOn(t, T_MILLION, "m");
  const sign2 = neonOn(t, T_TWENTY, "s");
  const barIn = interpolate(t, [6.9, 7.3], [0, 1], clamp);
  const done = t >= T_HALVE + 19 * HALVE_STEP;
  const donePulse = done
    ? interpolate(
        t,
        [T_HALVE + 19 * HALVE_STEP, T_HALVE + 19 * HALVE_STEP + 0.5],
        [1, 0],
        clamp,
      )
    : 0;

  const fade = interpolate(t, [0, 0.3, 10.7, 11], [1, 0, 0, 1], clamp);
  const flash = interpolate(
    t,
    [T_FOUND - 0.01, T_FOUND, T_FOUND + 0.25],
    [0, 0.35, 0],
    clamp,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: C.skyTop, overflow: "hidden" }}>
      <Sequence from={Math.round(AUDIO_DELAY * FPS)} layout="none">
        <Audio src={staticFile("scene06.wav")} />
      </Sequence>
      <NeonBackground
        cam={{ x: 0, y: -(shot.Z - 0.52) * 160, zoom: 1 }}
        speed={0.6 + 5 * speed}
      />
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute" }}>
        <NeonDefs />
        <defs>
          <clipPath id="s6-left">
            <rect x={0} y={0} width={HALF} height={HEIGHT} />
          </clipPath>
          <clipPath id="s6-right">
            <rect x={HALF} y={0} width={HALF} height={HEIGHT} />
          </clipPath>
        </defs>
        <g opacity={1 - finale * 0.55}>
          {[0, 1].map((city) => (
            <g
              key={city}
              clipPath={`url(#s6-${city === 0 ? "left" : "right"})`}
            >
              <City city={city} cam={cams[city]} t={t} />
              {/* speed streaks while diving */}
              {speed > 0.05
                ? Array.from({ length: 18 }, (_, i) => {
                    const a = random(`a${i}`) * Math.PI * 2;
                    const r0 =
                      180 + random(`r${i}${Math.floor(frame / 2)}`) * 260;
                    const cx = HX[city];
                    const cy = shot.hy;
                    return (
                      <line
                        key={i}
                        x1={cx + Math.cos(a) * r0}
                        y1={cy + Math.sin(a) * r0}
                        x2={cx + Math.cos(a) * (r0 + 160 * speed)}
                        y2={cy + Math.sin(a) * (r0 + 160 * speed)}
                        stroke={i % 2 ? C.file : C.hash}
                        strokeWidth={2}
                        opacity={0.5 * speed}
                      />
                    );
                  })
                : null}
              {t < 6.95 ? (
                <Scanner city={city} cam={cams[city]} t={t} frame={frame} />
              ) : null}
            </g>
          ))}
          {/* root comparison laser */}
          {laser > 0 && laserOut > 0 ? (
            <g opacity={laserOut}>
              <line
                x1={bl.sx}
                y1={bl.sy}
                x2={lerp(bl.sx, br.sx, laser)}
                y2={lerp(bl.sy, br.sy, laser)}
                stroke={rootDiff ? C.changed : C.file}
                strokeWidth={5}
                filter="url(#neon)"
                strokeDasharray={rootDiff ? "none" : "22 10"}
                strokeDashoffset={-frame * 6}
              />
              {rootDiff ? (
                <g
                  transform={`translate(${HALF},${bl.sy}) scale(${interpolate(t, [2.36, 2.56], [1.6, 1], { ...clamp, easing: Easing.out(Easing.back(3)) })})`}
                >
                  <circle
                    r={44}
                    fill="#12031c"
                    stroke={C.changed}
                    strokeWidth={4}
                    filter="url(#neon)"
                  />
                  <text
                    y={20}
                    textAnchor="middle"
                    fontFamily={FONT}
                    fontWeight={900}
                    fontSize={60}
                    fill={C.changed}
                  >
                    ≠
                  </text>
                </g>
              ) : null}
            </g>
          ) : null}
        </g>
        {/* divider */}
        <g opacity={1 - finale}>
          <rect
            x={HALF - 2}
            y={0}
            width={4}
            height={HEIGHT}
            fill={C.hash}
            filter="url(#neon)"
          />
          <rect
            x={HALF - 1}
            y={0}
            width={2}
            height={HEIGHT}
            fill="#ffffff"
            opacity={0.8}
          />
        </g>
        {/* shockwave at the found tower */}
        {t >= T_FOUND && t < T_FOUND + 0.8
          ? (() => {
              const n = T[0][CHANGED];
              const p = project({ ...n, z: 0 }, cams[1]);
              const k = (t - T_FOUND) / 0.8;
              return (
                <ellipse
                  cx={p.sx}
                  cy={p.sy}
                  rx={60 + 500 * k}
                  ry={(60 + 500 * k) * 0.5}
                  fill="none"
                  stroke={C.changed}
                  strokeWidth={8 * (1 - k)}
                  opacity={1 - k}
                  filter="url(#neon)"
                  clipPath="url(#s6-right)"
                />
              );
            })()
          : null}
        {/* finale bar: one million files, halved 20 times */}
        {barIn > 0 ? (
          <g opacity={barIn}>
            <rect
              x={BAR_X}
              y={560}
              width={BAR_W}
              height={56}
              rx={6}
              fill="#0a0420"
              stroke={C.file}
              strokeWidth={2}
              opacity={0.9}
            />
            {Array.from({ length: 50 }, (_, i) => (
              <line
                key={i}
                x1={BAR_X + (BAR_W / 50) * i}
                y1={566}
                x2={BAR_X + (BAR_W / 50) * i}
                y2={610}
                stroke={C.file}
                strokeWidth={1}
                opacity={0.25}
              />
            ))}
            <rect
              x={winX}
              y={560}
              width={Math.max(5, win)}
              height={56}
              fill={done ? C.changed : C.hash}
              opacity={0.85}
              filter="url(#neon)"
            />
            {done ? (
              <circle
                cx={winX}
                cy={588}
                r={30 + 120 * (1 - donePulse)}
                fill="none"
                stroke={C.changed}
                strokeWidth={4}
                opacity={donePulse}
              />
            ) : null}
          </g>
        ) : null}
      </svg>

      {/* half labels */}
      <div
        style={{
          position: "absolute",
          top: 34,
          left: 44,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 40,
          letterSpacing: 4,
          color: C.file,
          textShadow: glow(C.file),
          opacity: 1 - finale,
        }}
      >
        YOUR CITY
      </div>
      <div
        style={{
          position: "absolute",
          top: 34,
          right: 44,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 40,
          letterSpacing: 4,
          color: C.hash,
          textShadow: glow(C.hash),
          opacity: 1 - finale,
        }}
      >
        FRIEND&apos;S CITY
      </div>

      {/* step counter */}
      {counterText ? (
        <div
          style={{
            position: "absolute",
            top: 108,
            left: 0,
            width: WIDTH,
            display: "flex",
            justifyContent: "center",
            opacity: 1 - finale,
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontWeight: 800,
              fontSize: 38,
              letterSpacing: 3,
              color: steps >= 3 ? C.root : C.text,
              padding: "8px 26px",
              borderRadius: 12,
              border: `2px solid ${steps >= 3 ? C.root : C.muted}`,
              background: "rgba(8,3,24,0.85)",
              boxShadow: steps >= 3 ? `0 0 30px ${C.root}` : "none",
            }}
          >
            {counterText}
          </div>
        </div>
      ) : null}

      {/* captions */}
      {captions.map((c, i) => {
        const o =
          interpolate(t, [c.at, c.at + 0.15], [0, 1], clamp) *
          interpolate(t, [c.until - 0.1, c.until], [1, 0], clamp);
        if (o <= 0) return null;
        const y = interpolate(t, [c.at, c.at + 0.2], [16, 0], clamp);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              bottom: 52,
              left: 0,
              width: WIDTH,
              display: "flex",
              justifyContent: "center",
              opacity: o,
              transform: `translateY(${y}px)`,
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 50,
                color: C.text,
                padding: "10px 34px",
                borderRadius: 16,
                background: "rgba(8,3,24,0.82)",
                border: `2px solid ${C.grid}`,
                boxShadow: `0 0 26px ${C.grid}`,
              }}
            >
              {c.node}
            </div>
          </div>
        );
      })}

      {/* finale neon sign */}
      {t >= T_MILLION ? (
        <div
          style={{
            position: "absolute",
            top: 170,
            left: 0,
            width: WIDTH,
            textAlign: "center",
            fontFamily: FONT,
            fontWeight: 900,
          }}
        >
          <div
            style={{
              fontSize: 120,
              color: C.file,
              textShadow: glow(C.file),
              opacity: sign1,
              letterSpacing: 2,
            }}
          >
            1,000,000 files
          </div>
          <div
            style={{
              fontSize: 120,
              marginTop: 10,
              color: C.root,
              textShadow: glow(C.hash),
              opacity: sign2,
              transform: `scale(${t >= T_TWENTY ? interpolate(t, [T_TWENTY, T_TWENTY + 0.25], [1.15, 1], clamp) : 1})`,
            }}
          >
            → about 20 steps
          </div>
        </div>
      ) : null}
      {barIn > 0 ? (
        <div
          style={{
            position: "absolute",
            top: 636,
            left: BAR_X,
            width: BAR_W,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 40,
            opacity: barIn,
          }}
        >
          <span style={{ color: halves >= 20 ? C.changed : C.hash }}>
            step {halves} / 20
          </span>
          <span style={{ color: halves >= 20 ? C.changed : C.text }}>
            files left: {left.toLocaleString("en-US")}
          </span>
        </div>
      ) : null}

      <AbsoluteFill
        style={{
          backgroundColor: "#ffffff",
          opacity: flash,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill style={{ backgroundColor: C.skyTop, opacity: fade }} />
    </AbsoluteFill>
  );
};
