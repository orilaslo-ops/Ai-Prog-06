import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, MONO, WIDTH, HEIGHT } from "./theme";

// Scene 5 (10 s): the finished tree from scene 4. File 6 changes, and a red pulse
// climbs the tree: h6 -> h56 -> h5678 -> root, one node per narration beat.
// Narration: "Now change one file. Its hash changes, so its parent changes, and the
// change climbs all the way to the root."

const LEAVES = 8;
const LEVEL_Y = [880, 680, 480, 280]; // leaves, then each level above
const NODE_W = [170, 200, 230, 280];
const NODE_H = 90;
const FILE_Y = 1000; // the small file icons under the leaf hashes
const CHANGED_LEAF = 5; // file 6

// Seconds at which each beat happens, timed to the narration words.
// [file 6 edited, h6 red, h56 red, h5678 red, root red]
const BEATS = [0.95, 2.25, 3.7, 5.3, 6.4];
const PULSE_TIME = 0.55; // seconds the red pulse takes to climb one edge

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
const TOP = LEVELS.length - 1;

// h1..h8, h12, h34, ..., h1234, h5678, root
const label = (n: Node): string => {
  if (n.level === TOP) return "root";
  const size = 2 ** n.level;
  const first = n.index * size + 1;
  return (
    "h" + Array.from({ length: size }, (_, k) => String(first + k)).join("")
  );
};

// The nodes on the red path, bottom to top.
const PATH: Node[] = LEVELS.map((lvl, level) => lvl[CHANGED_LEAF >> level]);
const onPath = (n: Node): boolean => PATH[n.level].index === n.index;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Deterministic pseudo-random numbers for particles.
const rand = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Background starfield, fixed positions.
const STARS = Array.from({ length: 90 }, (_, i) => ({
  x: rand(i) * WIDTH,
  y: rand(i + 500) * HEIGHT,
  r: 0.8 + rand(i + 900) * 1.8,
  phase: rand(i + 1300) * Math.PI * 2,
}));

export const Scene05Change: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // 0 -> 1 spring that starts at `sec`.
  const springAt = (sec: number, damping = 14, mass = 0.8): number =>
    spring({ frame: frame - sec * fps, fps, config: { damping, mass } });

  // How red each node on the path is (0..1): the file at beat 0, h6 at beat 1, ...
  const redness = (level: number): number => springAt(BEATS[level + 1], 200);
  const pop = (level: number): number => springAt(BEATS[level + 1], 9, 0.6);

  // --- Camera: lean in on file 6, ride the pulse up, then pull back to the whole tree.
  const camFocusY = interpolate(
    t,
    [0, 0.6, 1.6, BEATS[2], BEATS[3], BEATS[4], 7.6, 9.2],
    [540, 540, 760, 700, 620, 560, 560, 580],
    { ...clamp, easing: Easing.inOut(Easing.cubic) },
  );
  const camFocusX = interpolate(
    t,
    [0, 0.6, 1.6, BEATS[2], BEATS[3], BEATS[4], 7.6, 9.2],
    [960, 960, PATH[0].x, PATH[1].x, 1080, 960, 960, 960],
    { ...clamp, easing: Easing.inOut(Easing.cubic) },
  );
  const camScale = interpolate(
    t,
    [0, 0.6, 1.6, BEATS[3], BEATS[4], 7.6, 9.2],
    [1, 1, 1.25, 1.12, 1.0, 1.0, 0.95],
    { ...clamp, easing: Easing.inOut(Easing.cubic) },
  );
  const tx = WIDTH / 2 - camFocusX * camScale;
  const ty = HEIGHT / 2 - camFocusY * camScale;

  // --- File 6 edit: shake + flash.
  const editT = t - BEATS[0];
  const shake =
    editT > 0 && editT < 0.5 ? Math.sin(editT * 70) * 9 * (1 - editT / 0.5) : 0;
  const fileRed = springAt(BEATS[0], 200);

  // Pulse travelling along the edge from path level `l` to level `l + 1`.
  const pulseProgress = (l: number): number =>
    interpolate(t, [BEATS[l + 1] - PULSE_TIME, BEATS[l + 1]], [0, 1], {
      ...clamp,
      easing: Easing.inOut(Easing.quad),
    });

  // The rest of the tree dims slightly once the path starts lighting up.
  const dimOthers = interpolate(t, [BEATS[1], BEATS[2]], [1, 0.55], clamp);

  const finalGlow = springAt(BEATS[4], 200);
  const caption = springAt(BEATS[4] + 0.35, 16);
  const intro = springAt(0, 200);

  const edgeEnds = (child: Node, parent: Node) => ({
    x1: child.x,
    y1: child.y - NODE_H / 2,
    x2: parent.x,
    y2: parent.y + NODE_H / 2,
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 40%, #16213d 0%, ${COLORS.bg} 70%)`,
        color: COLORS.text,
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      <Audio src={staticFile("scene05.wav")} />

      {/* Red ambient wash that grows as the change reaches the root. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 26%, rgba(248,113,113,${
            0.22 * finalGlow
          }) 0%, rgba(248,113,113,0) 55%)`,
        }}
      />

      <svg
        width={WIDTH}
        height={HEIGHT}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <filter id="s5glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="s5soft" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <radialGradient id="s5pulse">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="35%" stopColor={COLORS.changed} />
            <stop offset="100%" stopColor={COLORS.changed} stopOpacity={0} />
          </radialGradient>
          <linearGradient id="s5node" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#24324a" />
            <stop offset="100%" stopColor={COLORS.file} />
          </linearGradient>
        </defs>

        {/* Twinkling stars, with a little parallax against the camera. */}
        <g transform={`translate(${tx * 0.08} ${ty * 0.08})`}>
          {STARS.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#cbd5e1"
              opacity={
                (0.12 + 0.18 * (0.5 + 0.5 * Math.sin(t * 2 + s.phase))) * intro
              }
            />
          ))}
        </g>

        <g transform={`translate(${tx} ${ty}) scale(${camScale})`}>
          {/* Edges */}
          {LEVELS.slice(1).flatMap((level) =>
            level.flatMap((parent) =>
              [0, 1].map((side) => {
                const child = LEVELS[parent.level - 1][2 * parent.index + side];
                const e = edgeEnds(child, parent);
                const hot = onPath(child) && onPath(parent);
                const p = hot ? pulseProgress(child.level) : 0;
                return (
                  <g key={`e${parent.level}-${parent.index}-${side}`}>
                    <line
                      {...e}
                      stroke={COLORS.edge}
                      strokeWidth={5}
                      strokeLinecap="round"
                      opacity={hot ? 1 : dimOthers}
                    />
                    {hot && p > 0 ? (
                      <line
                        x1={e.x1}
                        y1={e.y1}
                        x2={e.x1 + (e.x2 - e.x1) * p}
                        y2={e.y1 + (e.y2 - e.y1) * p}
                        stroke={COLORS.changed}
                        strokeWidth={7}
                        strokeLinecap="round"
                        filter="url(#s5glow)"
                      />
                    ) : null}
                  </g>
                );
              }),
            ),
          )}

          {/* Comet pulses climbing each red edge, with a fading trail. */}
          {PATH.slice(0, -1).map((child, l) => {
            const p = pulseProgress(l);
            if (p <= 0 || p >= 1) return null;
            const e = edgeEnds(child, PATH[l + 1]);
            return (
              <g key={`pulse${l}`}>
                {Array.from({ length: 8 }, (_, k) => {
                  const q = Math.max(0, p - k * 0.035);
                  return (
                    <circle
                      key={k}
                      cx={e.x1 + (e.x2 - e.x1) * q}
                      cy={e.y1 + (e.y2 - e.y1) * q}
                      r={(k === 0 ? 26 : 16) * (1 - k / 9)}
                      fill="url(#s5pulse)"
                      opacity={1 - k / 8}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Small file icons under the leaves; file 6 gets edited. */}
          {LEVELS[0].map((leaf) => {
            const isChanged = leaf.index === CHANGED_LEAF;
            const red = isChanged ? fileRed : 0;
            const stroke = interpolateColors(
              red,
              [0, 1],
              [COLORS.border, COLORS.changed],
            );
            const dx = isChanged ? shake : 0;
            const s = isChanged
              ? 1 + 0.18 * springAt(BEATS[0], 8, 0.5) - 0.18 * red
              : 1;
            return (
              <g
                key={`f${leaf.index}`}
                opacity={intro * (isChanged ? 1 : 0.35 + 0.65 * dimOthers)}
                transform={`translate(${leaf.x + dx} ${FILE_Y}) scale(${s})`}
              >
                <line
                  x1={0}
                  y1={-NODE_H / 2 - 3}
                  x2={0}
                  y2={-38}
                  stroke={stroke}
                  strokeWidth={3}
                />
                <path
                  d="M -30 -38 L 14 -38 L 30 -22 L 30 38 L -30 38 Z"
                  fill={interpolateColors(
                    red,
                    [0, 1],
                    [COLORS.file, "#3b1d24"],
                  )}
                  stroke={stroke}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  filter={isChanged && red > 0.05 ? "url(#s5glow)" : undefined}
                />
                <path
                  d="M 14 -38 L 14 -22 L 30 -22"
                  fill="none"
                  stroke={stroke}
                  strokeWidth={3}
                />
                {[0, 1, 2].map((r) => (
                  <rect
                    key={r}
                    x={-20}
                    y={-14 + r * 14}
                    width={
                      r === 1 && isChanged
                        ? 40 * (1 - red) + 22 * red
                        : 40 - r * 8
                    }
                    height={5}
                    rx={2.5}
                    fill={r === 1 && isChanged ? stroke : "#64748b"}
                  />
                ))}
              </g>
            );
          })}

          {/* Nodes */}
          {LEVELS.flat().map((node) => {
            const hot = onPath(node);
            const w = NODE_W[node.level];
            const isRoot = node.level === TOP;
            const red = hot ? redness(node.level) : 0;
            const bump = hot ? pop(node.level) : 0;
            const scale =
              1 +
              0.16 *
                Math.sin(Math.min(bump, 1) * Math.PI) *
                (bump < 1.2 ? 1 : 0);
            const base = isRoot ? COLORS.root : COLORS.hash;
            const stroke = interpolateColors(
              red,
              [0, 1],
              [base, COLORS.changed],
            );
            const text = label(node);
            const breathe = 0.6 + 0.4 * Math.sin(t * 5);
            return (
              <g
                key={`n${node.level}-${node.index}`}
                opacity={hot ? 1 : dimOthers}
                transform={`translate(${node.x} ${node.y}) scale(${scale})`}
              >
                {/* Soft halo behind changed nodes (and the root). */}
                {red > 0.02 || isRoot ? (
                  <rect
                    x={-w / 2 - 6}
                    y={-NODE_H / 2 - 6}
                    width={w + 12}
                    height={NODE_H + 12}
                    rx={24}
                    fill={stroke}
                    opacity={
                      red > 0.02
                        ? red *
                          (isRoot ? 0.55 + 0.25 * finalGlow * breathe : 0.4)
                        : 0.18
                    }
                    filter="url(#s5soft)"
                  />
                ) : null}
                <rect
                  x={-w / 2}
                  y={-NODE_H / 2}
                  width={w}
                  height={NODE_H}
                  rx={18}
                  fill={interpolateColors(red, [0, 1], ["#1e293b", "#3a1a22"])}
                  stroke={stroke}
                  strokeWidth={isRoot ? 6 : 4}
                />
                <rect
                  x={-w / 2 + 4}
                  y={-NODE_H / 2 + 4}
                  width={w - 8}
                  height={NODE_H / 2 - 4}
                  rx={14}
                  fill="url(#s5node)"
                  opacity={0.5}
                />
                {/* Label: flips to a primed label (h6 -> h6′) as it turns red. */}
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={isRoot ? 40 : 36}
                  fontWeight={isRoot ? 700 : 500}
                  fontFamily={isRoot ? FONT : MONO}
                  fill={interpolateColors(red, [0, 1], [base, "#fecaca"])}
                  transform={`scale(1 ${hot ? Math.abs(Math.cos(Math.min(red, 1) * Math.PI)) * 0.999 + 0.001 : 1})`}
                >
                  {text}
                  {red > 0.5 ? (
                    <tspan fontFamily={FONT} fontWeight={700} dx={2}>
                      ′
                    </tspan>
                  ) : null}
                </text>
              </g>
            );
          })}

          {/* Spark bursts as each node turns red. */}
          {[-1, 0, 1, 2, 3].map((l) => {
            const at = BEATS[l + 1];
            const dt = t - at;
            if (dt < 0 || dt > 0.9) return null;
            const cx = l < 0 ? LEVELS[0][CHANGED_LEAF].x : PATH[l].x;
            const cy = l < 0 ? FILE_Y : PATH[l].y;
            const k = dt / 0.9;
            const ease = 1 - (1 - k) ** 3;
            const count = l === 3 ? 26 : 16;
            return (
              <g key={`burst${l}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={40 + ease * (l === 3 ? 260 : 150)}
                  fill="none"
                  stroke={COLORS.changed}
                  strokeWidth={6 * (1 - k)}
                  opacity={1 - k}
                />
                {Array.from({ length: count }, (_, i) => {
                  const ang =
                    (i / count) * Math.PI * 2 + rand(i + l * 31) * 0.5;
                  const dist =
                    (l === 3 ? 230 : 130) *
                    (0.6 + 0.6 * rand(i * 7 + l)) *
                    ease;
                  return (
                    <circle
                      key={i}
                      cx={cx + Math.cos(ang) * dist}
                      cy={cy + Math.sin(ang) * dist * 0.75}
                      r={(3 + 4 * rand(i + 99 + l)) * (1 - k * 0.7)}
                      fill={i % 3 === 0 ? "#fff" : COLORS.changed}
                      opacity={1 - k}
                    />
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Caption */}
      <div
        style={{
          position: "absolute",
          top: 70,
          width: "100%",
          textAlign: "center",
          fontSize: 60,
          fontWeight: 700,
          letterSpacing: 0.5,
          opacity: caption,
          transform: `translateY(${(1 - caption) * -30}px)`,
          textShadow: "0 0 30px rgba(248,113,113,0.45)",
        }}
      >
        1 file changed{" "}
        <span style={{ color: COLORS.changed }}>→ root changed</span>
      </div>
    </AbsoluteFill>
  );
};
