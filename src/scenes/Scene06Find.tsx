import {
  AbsoluteFill,
  Audio,
  interpolate,
  Easing,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, MONO, WIDTH, HEIGHT } from "./theme";

// Scene 6 (11 s): your tree and your friend's tree side by side. A scanning beam
// compares them level by level: roots differ, so step into the children; the
// matching half turns green and fades, the differing half turns red and is followed,
// until file 6 is found after 3 steps. Then: 1,000,000 files → about 20 steps.
// Narration: "To compare, check the roots. If they differ, check the two children and
// follow the one that doesn't match. With a million files, that's about twenty steps."

const AUDIO_DELAY = 0.3; // seconds of breathing room before the voice starts

// ---- Layout: two 8-leaf trees, each 880 px wide ---------------------------------
const TREE_W = 880;
const TREE_X = [40, 1000]; // left edge of yours / your friend's
const LEAVES = 8;
const LEVEL_Y = [760, 590, 420, 250]; // leaves → root
const NODE_W = [96, 124, 148, 176];
const NODE_H = [72, 62, 62, 72];
const TOP = LEVEL_Y.length - 1;

// The changed file is file 6 (index 5); this is its path from leaf to root.
const PATH = [5, 2, 1, 0];

// ---- Timeline (seconds), matched to the narration ---------------------------------
const T_ROOT = 1.1; // "check the roots"
const T_ROOT_RESULT = 2.35; // "If they differ"
// One step per level below the root: when the beam arrives, and when the verdict lands.
const STEP_START = [3.2, 4.45, 5.45]; // level 2, level 1, leaves
const STEP_RESULT = [3.85, 5.0, 5.95];
const T_SUMMARY = 6.55; // "With a million files"
const T_TWENTY = 7.85; // "that's about twenty steps"

// Captions under the trees: [text, colour?] pieces.
const CAPTIONS: { at: number; parts: [string, string?][] }[] = [
  { at: T_ROOT, parts: [["Compare the "], ["roots", COLORS.root], ["…"]] },
  {
    at: T_ROOT_RESULT,
    parts: [["Different", COLORS.changed], [": something changed below"]],
  },
  {
    at: STEP_RESULT[0],
    parts: [
      ["Left ", COLORS.match],
      ["matches: skip it.  "],
      ["Right ", COLORS.changed],
      ["differs: go down"],
    ],
  },
  {
    at: STEP_RESULT[1],
    parts: [["Follow the one that "], ["doesn't match", COLORS.changed]],
  },
  { at: STEP_RESULT[2], parts: [["Found it: "], ["file 6", COLORS.changed]] },
];

type Node = {
  x: number;
  y: number;
  level: number;
  index: number;
  tree: number;
};

const buildTree = (tree: number): Node[][] => {
  const spacing = TREE_W / LEAVES;
  const levels: Node[][] = [
    Array.from({ length: LEAVES }, (_, i) => ({
      x: TREE_X[tree] + spacing * (i + 0.5),
      y: LEVEL_Y[0],
      level: 0,
      index: i,
      tree,
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
        tree,
      })),
    );
  }
  return levels;
};

const TREES = [buildTree(0), buildTree(1)];

const onPath = (n: { level: number; index: number }) =>
  PATH[n.level] === n.index;

// A node is compared when it is a root, or when its parent was on the red path.
const isExamined = (n: { level: number; index: number }) =>
  n.level === TOP || PATH[n.level + 1] === n.index >> 1;

const resultTime = (level: number) =>
  level === TOP ? T_ROOT_RESULT : STEP_RESULT[TOP - 1 - level];
const startTime = (level: number) =>
  level === TOP ? T_ROOT : STEP_START[TOP - 1 - level];

// When does this node fade away? At the verdict of its highest matching ancestor.
const dimTime = (n: { level: number; index: number }): number | null => {
  let best: number | null = null;
  for (let lv = n.level, idx = n.index; lv <= TOP; lv++, idx >>= 1) {
    const a = { level: lv, index: idx };
    if (isExamined(a) && !onPath(a)) best = resultTime(lv);
  }
  return best;
};

// Short, stable fake hash codes; the friend's path nodes get different ones.
const code = (level: number, index: number, tree: number): string => {
  const changed = tree === 1 && onPath({ level, index });
  let h = (level * 7919 + index * 104729 + (changed ? 15485863 : 0)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h.toString(16).padStart(8, "0").slice(0, 4);
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Deterministic background specks.
const SPECKS = Array.from({ length: 46 }, (_, i) => {
  const r = (k: number) => {
    const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  return {
    x: r(1) * WIDTH,
    y: r(2) * HEIGHT,
    s: 1 + r(3) * 2.2,
    v: 6 + r(4) * 14,
    p: r(5),
  };
});

export const Scene06Find: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const sp = (at: number, damping = 14, mass = 0.7) =>
    spring({ frame: frame - at * fps, fps, config: { damping, mass } });
  const ramp = (a: number, b: number) =>
    interpolate(t, [a, b], [0, 1], {
      ...clamp,
      easing: Easing.inOut(Easing.cubic),
    });

  // ---- Camera: a slow push in while we descend, then ease back for the summary.
  const descend = ramp(T_ROOT, STEP_RESULT[2]);
  const back = ramp(T_SUMMARY - 0.1, T_SUMMARY + 0.8);
  const camScale = 1 + 0.03 * descend - 0.09 * back;
  const camY = 22 * descend - 60 * back;

  // ---- The scanning beam, which glides from level to level.
  const beamLevels = [TOP, 2, 1, 0];
  const beamTimes = [T_ROOT, ...STEP_START];
  let beamY = LEVEL_Y[TOP];
  for (let k = 1; k < beamLevels.length; k++) {
    const p = spring({
      frame: frame - (beamTimes[k] - 0.15) * fps,
      fps,
      config: { damping: 18, mass: 0.8 },
    });
    beamY += (LEVEL_Y[beamLevels[k]] - LEVEL_Y[beamLevels[k - 1]]) * p;
  }
  const beamOn =
    ramp(T_ROOT - 0.3, T_ROOT + 0.2) *
    (1 - ramp(STEP_RESULT[2] + 0.4, T_SUMMARY));
  const sweep = ((t - T_ROOT) * 0.9) % 1;

  // ---- Step counter.
  const stepsDone = STEP_START.filter((s) => t >= s).length;
  const counterIn = sp(STEP_START[0] - 0.1, 16);
  const counterBump = STEP_START.reduce(
    (acc, s) => acc + Math.max(0, 1 - Math.abs(t - s - 0.08) / 0.18),
    0,
  );

  // ---- Summary.
  const sumIn = sp(T_SUMMARY, 16, 0.8);
  const arrowIn = sp(T_TWENTY - 0.25, 15);
  const twentyIn = sp(T_TWENTY, 10, 0.6);
  const treeDim = 1 - 0.45 * ramp(T_SUMMARY, T_SUMMARY + 0.6);

  // Node visual state, shared by both trees.
  const nodeState = (n: Node) => {
    const intro = sp(
      0.05 + (TOP - n.level) * 0.12 + n.index * 0.03 + n.tree * 0.08,
      15,
    );
    const examined = isExamined(n);
    const verdict = examined ? sp(resultTime(n.level), 12, 0.6) : 0;
    const dt = dimTime(n);
    const dim =
      dt === null ? 0 : interpolate(t, [dt + 0.25, dt + 0.75], [0, 1], clamp);
    const scanning = examined
      ? interpolate(
          t,
          [startTime(n.level), resultTime(n.level)],
          [0, 1],
          clamp,
        ) * (t < resultTime(n.level) ? 1 : 0)
      : 0;
    const red = examined && onPath(n) ? verdict : 0;
    const green = examined && !onPath(n) ? verdict : 0;
    return { intro, examined, verdict, dim, scanning, red, green };
  };

  const leafHit = sp(STEP_RESULT[2] + 0.05, 9, 0.6);
  const burst = interpolate(t, [STEP_RESULT[2], STEP_RESULT[2] + 0.9], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      <Sequence from={Math.round(AUDIO_DELAY * fps)} layout="none">
        <Audio src={staticFile("scene06.wav")} />
      </Sequence>

      <svg
        width={WIDTH}
        height={HEIGHT}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="s6-vignette" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#1e293b" stopOpacity={0.9} />
            <stop offset="100%" stopColor={COLORS.bg} stopOpacity={1} />
          </radialGradient>
          <linearGradient id="s6-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.hash} stopOpacity={0} />
            <stop offset="50%" stopColor={COLORS.hash} stopOpacity={0.16} />
            <stop offset="100%" stopColor={COLORS.hash} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="s6-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="50%" stopColor="#e0f2fe" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
          <filter id="s6-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="9" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="s6-soft" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        <rect width={WIDTH} height={HEIGHT} fill="url(#s6-vignette)" />
        {SPECKS.map((s, i) => {
          const y = (((s.y - t * s.v) % HEIGHT) + HEIGHT) % HEIGHT;
          return (
            <circle
              key={i}
              cx={s.x + Math.sin(t * 0.7 + s.p * 6) * 8}
              cy={y}
              r={s.s}
              fill={COLORS.hash}
              opacity={0.08 + 0.1 * Math.sin(t * 2 + s.p * 9) ** 2}
            />
          );
        })}

        <g
          transform={`translate(${WIDTH / 2} ${470 + camY}) scale(${camScale}) translate(${-WIDTH / 2} -470)`}
        >
          {/* Centre divider */}
          <line
            x1={WIDTH / 2}
            x2={WIDTH / 2}
            y1={190}
            y2={830}
            stroke={COLORS.border}
            strokeWidth={2}
            strokeDasharray="4 12"
            strokeLinecap="round"
            opacity={0.5 * sp(0.2, 20) * treeDim}
          />

          {/* Scanning beam across both trees */}
          <g opacity={beamOn}>
            <rect
              x={0}
              y={beamY - 70}
              width={WIDTH}
              height={140}
              fill="url(#s6-beam)"
            />
            <rect
              x={0}
              y={beamY - 1}
              width={WIDTH}
              height={2}
              fill={COLORS.hash}
              opacity={0.35}
            />
            <rect
              x={-300 + sweep * (WIDTH + 600) - 150}
              y={beamY - 2}
              width={300}
              height={4}
              fill="url(#s6-sweep)"
              filter="url(#s6-soft)"
            />
          </g>

          {TREES.map((levels, tree) => (
            <g key={tree} opacity={treeDim}>
              {/* Edges */}
              {levels.slice(1).flatMap((level) =>
                level.flatMap((parent) =>
                  [0, 1].map((side) => {
                    const child =
                      levels[parent.level - 1][2 * parent.index + side];
                    const cs = nodeState(child);
                    const grow = sp(0.25 + (TOP - parent.level) * 0.12, 18);
                    const x1 = parent.x;
                    const y1 = parent.y + NODE_H[parent.level] / 2;
                    const x2 = child.x;
                    const y2 = child.y - NODE_H[child.level] / 2;
                    const hot = cs.red;
                    const stroke = hot > 0.5 ? COLORS.changed : COLORS.edge;
                    return (
                      <g
                        key={`${parent.level}-${parent.index}-${side}`}
                        opacity={1 - 0.8 * cs.dim}
                      >
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x1 + (x2 - x1) * grow}
                          y2={y1 + (y2 - y1) * grow}
                          stroke={stroke}
                          strokeWidth={hot > 0.5 ? 6 : 4}
                          strokeLinecap="round"
                          filter={hot > 0.5 ? "url(#s6-glow)" : undefined}
                        />
                        {/* Particles flowing down the compared branch */}
                        {cs.examined && child.level < TOP
                          ? [0, 0.22, 0.44].map((off) => {
                              const s0 = startTime(child.level) - 0.15 + off;
                              const p = interpolate(
                                t,
                                [s0, s0 + 0.55],
                                [0, 1],
                                {
                                  ...clamp,
                                  easing: Easing.inOut(Easing.quad),
                                },
                              );
                              if (p <= 0 || p >= 1) return null;
                              return (
                                <circle
                                  key={off}
                                  cx={x1 + (x2 - x1) * p}
                                  cy={y1 + (y2 - y1) * p}
                                  r={7 - off * 6}
                                  fill="#e0f2fe"
                                  filter="url(#s6-glow)"
                                  opacity={Math.sin(p * Math.PI)}
                                />
                              );
                            })
                          : null}
                      </g>
                    );
                  }),
                ),
              )}

              {/* Nodes */}
              {levels.flat().map((n) => {
                const st = nodeState(n);
                const w = NODE_W[n.level];
                const h = NODE_H[n.level];
                const isLeaf = n.level === 0;
                const isRoot = n.level === TOP;
                const base = isRoot
                  ? COLORS.root
                  : isLeaf
                    ? COLORS.border
                    : COLORS.hash;
                const stroke =
                  st.red > 0.5
                    ? COLORS.changed
                    : st.green > 0.5
                      ? COLORS.match
                      : base;
                const textCol =
                  st.red > 0.5
                    ? COLORS.changed
                    : st.green > 0.5
                      ? COLORS.match
                      : isRoot
                        ? COLORS.root
                        : COLORS.hash;
                const pulse = st.scanning * (0.5 + 0.5 * Math.sin(t * 18));
                const found = isLeaf && onPath(n) ? leafHit : 0;
                const scale =
                  (0.6 + 0.4 * st.intro) *
                  (1 +
                    0.08 * pulse +
                    0.12 * Math.sin(Math.min(1, st.verdict) * Math.PI)) *
                  (1 + 0.12 * found);
                const fillTint =
                  st.red > 0.5
                    ? `rgba(248, 113, 113, ${0.18 * Math.min(1, st.red)})`
                    : st.green > 0.5
                      ? `rgba(74, 222, 128, ${0.12})`
                      : isRoot
                        ? "rgba(250, 204, 21, 0.12)"
                        : COLORS.file;
                return (
                  <g
                    key={`${n.level}-${n.index}`}
                    opacity={Math.min(1, st.intro) * (1 - 0.78 * st.dim)}
                    transform={`translate(${n.x} ${n.y}) scale(${scale})`}
                  >
                    {/* Scanning ring */}
                    {st.scanning > 0 ? (
                      <rect
                        x={-w / 2 - 10}
                        y={-h / 2 - 10}
                        width={w + 20}
                        height={h + 20}
                        rx={22}
                        fill="none"
                        stroke="#e0f2fe"
                        strokeWidth={3}
                        strokeDasharray="14 10"
                        strokeDashoffset={-t * 60}
                        opacity={0.35 + 0.5 * pulse}
                      />
                    ) : null}
                    {/* Found burst on file 6 */}
                    {found > 0 && n.tree === 1
                      ? [0, 0.25].map((d) => {
                          const b = Math.max(
                            0,
                            Math.min(1, (burst - d) / (1 - d)),
                          );
                          return (
                            <circle
                              key={d}
                              r={50 + 120 * b}
                              fill="none"
                              stroke={COLORS.changed}
                              strokeWidth={6 * (1 - b)}
                              opacity={1 - b}
                            />
                          );
                        })
                      : null}
                    <rect
                      x={-w / 2}
                      y={-h / 2}
                      width={w}
                      height={h}
                      rx={16}
                      fill={fillTint}
                      stroke={stroke}
                      strokeWidth={isRoot ? 5 : 4}
                      filter={
                        st.red > 0.5 || isRoot ? "url(#s6-glow)" : undefined
                      }
                    />
                    {isLeaf ? (
                      <>
                        <text
                          y={-12}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={22}
                          fontWeight={600}
                          fontFamily={FONT}
                          fill={COLORS.text}
                        >
                          {`file ${n.index + 1}`}
                        </text>
                        <text
                          y={16}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={20}
                          fontFamily={MONO}
                          fill={textCol}
                        >
                          {code(n.level, n.index, n.tree)}
                        </text>
                      </>
                    ) : (
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={isRoot ? 32 : 28}
                        fontWeight={isRoot ? 700 : 500}
                        fontFamily={MONO}
                        fill={textCol}
                      >
                        {code(n.level, n.index, n.tree)}
                      </text>
                    )}
                    {/* Verdict badge */}
                    {st.examined && st.verdict > 0.01 ? (
                      <g
                        transform={`translate(${w / 2 - 4} ${-h / 2 + 2}) scale(${st.verdict})`}
                      >
                        <circle
                          r={19}
                          fill={onPath(n) ? COLORS.changed : COLORS.match}
                          stroke={COLORS.bg}
                          strokeWidth={4}
                        />
                        {onPath(n) ? (
                          <path
                            d="M -7 -7 L 7 7 M 7 -7 L -7 7"
                            stroke={COLORS.bg}
                            strokeWidth={4.5}
                            strokeLinecap="round"
                          />
                        ) : (
                          <path
                            d="M -8 0 L -2.5 6 L 8 -6"
                            stroke={COLORS.bg}
                            strokeWidth={4.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        )}
                      </g>
                    ) : null}
                  </g>
                );
              })}
            </g>
          ))}
        </g>
      </svg>

      {/* Tree titles */}
      {["Yours", "Your friend's"].map((label, i) => {
        const s = sp(0.1 + i * 0.1, 16);
        return (
          <div
            key={label}
            style={{
              position: "absolute",
              top: 66,
              left: TREE_X[i],
              width: TREE_W,
              textAlign: "center",
              fontSize: 46,
              fontWeight: 700,
              color: COLORS.text,
              letterSpacing: 0.5,
              opacity: s * (1 - (0.4 * (1 - treeDim)) / 0.45),
              transform: `translateY(${(1 - s) * -30}px)`,
            }}
          >
            {label}
          </div>
        );
      })}

      {/* Step counter */}
      <div
        style={{
          position: "absolute",
          top: 62,
          left: WIDTH / 2 - 110,
          width: 220,
          height: 64,
          borderRadius: 32,
          background: "rgba(15, 23, 42, 0.85)",
          border: `3px solid ${stepsDone === 3 ? COLORS.changed : COLORS.hash}`,
          boxShadow: `0 0 ${18 + 30 * counterBump}px ${stepsDone === 3 ? "rgba(248,113,113,0.55)" : "rgba(56,189,248,0.45)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          color: COLORS.text,
          fontSize: 34,
          fontWeight: 700,
          opacity: counterIn * (1 - ramp(T_SUMMARY, T_SUMMARY + 0.5)),
          transform: `scale(${(0.7 + 0.3 * counterIn) * (1 + 0.15 * counterBump)})`,
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            color: stepsDone === 3 ? COLORS.changed : COLORS.hash,
          }}
        >
          {Math.max(1, stepsDone)}
        </span>
        <span>{stepsDone <= 1 ? "step" : "steps"}</span>
      </div>

      {/* Captions that spell out each beat */}
      {CAPTIONS.map((c, i) => {
        const end =
          i + 1 < CAPTIONS.length ? CAPTIONS[i + 1].at : T_SUMMARY - 0.1;
        const o =
          interpolate(t, [c.at, c.at + 0.2], [0, 1], clamp) *
          interpolate(t, [end - 0.15, end], [1, 0], clamp);
        if (o <= 0) return null;
        const s = sp(c.at, 14, 0.6);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 868,
              width: "100%",
              textAlign: "center",
              fontSize: 50,
              fontWeight: 600,
              color: COLORS.text,
              opacity: o,
              transform: `translateY(${(1 - Math.min(1, s)) * 24}px)`,
            }}
          >
            {c.parts.map(([txt, col], k) => (
              <span key={k} style={{ color: col ?? COLORS.text }}>
                {txt}
              </span>
            ))}
          </div>
        );
      })}

      {/* Summary: 1,000,000 files → about 20 steps */}
      <div
        style={{
          position: "absolute",
          top: 840,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "baseline",
          gap: 34,
          fontSize: 76,
          fontWeight: 800,
          color: COLORS.text,
          opacity: Math.min(1, sumIn),
          transform: `translateY(${(1 - sumIn) * 50}px)`,
          textShadow: "0 6px 30px rgba(0,0,0,0.6)",
        }}
      >
        <span>
          <span style={{ fontFamily: MONO, color: COLORS.muted }}>
            1,000,000
          </span>{" "}
          files
        </span>
        <span
          style={{
            color: COLORS.hash,
            opacity: Math.min(1, arrowIn),
            transform: `translateX(${(1 - arrowIn) * -40}px)`,
            display: "inline-block",
          }}
        >
          →
        </span>
        <span
          style={{
            opacity: Math.min(1, twentyIn),
            transform: `scale(${0.5 + 0.5 * twentyIn})`,
            display: "inline-block",
          }}
        >
          about{" "}
          <span
            style={{
              color: COLORS.root,
              fontFamily: MONO,
              textShadow: "0 0 28px rgba(250, 204, 21, 0.7)",
            }}
          >
            20
          </span>{" "}
          steps
        </span>
      </div>

      {/* Twenty dots: one per step down a million-file tree */}
      <div
        style={{
          position: "absolute",
          top: 968,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          gap: 18,
          opacity: Math.min(1, sumIn),
        }}
      >
        {Array.from({ length: 20 }, (_, i) => {
          const d = sp(T_TWENTY + 0.05 + i * 0.055, 12, 0.5);
          return (
            <div
              key={i}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                border: `3px solid ${COLORS.border}`,
                background: d > 0.5 ? COLORS.root : "transparent",
                boxShadow:
                  d > 0.5 ? "0 0 16px rgba(250, 204, 21, 0.8)" : "none",
                transform: `scale(${1 + 0.4 * Math.sin(Math.min(1, d) * Math.PI)})`,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
