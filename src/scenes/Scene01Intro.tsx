import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Scene 1 (5 s): eight files at the bottom, hashes combine pairwise level by level,
// and a single root hash lights up at the top.
// Narration: "A Merkle tree fingerprints a million files with one hash at the top."

const W = 1920;
const LEAVES = 8;
const LEVEL_Y = [880, 680, 480, 280]; // leaves, then each level above
const NODE_W = [170, 200, 230, 280];
const NODE_H = 90;
const LEVEL_START = [0.4, 1.4, 2.1, 2.8]; // seconds when each level appears

const COLORS = {
  bg: "#0f172a",
  text: "#f8fafc",
  muted: "#94a3b8",
  file: "#1e293b",
  border: "#475569",
  hash: "#38bdf8",
  edge: "#334155",
  root: "#facc15",
};

type Node = { x: number; y: number; level: number; index: number };

// Centres of the nodes on each level: leaves are spread evenly, every parent sits
// half-way between its two children.
const buildLevels = (): Node[][] => {
  const spacing = W / LEAVES;
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

export const Scene01Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 0 → 1 as a node pops in; leaves arrive one after another.
  const appear = (node: Node) => {
    const stagger = node.level === 0 ? node.index * 0.08 : node.index * 0.1;
    return spring({
      frame: frame - (LEVEL_START[node.level] + stagger) * fps,
      fps,
      config: { damping: 200 },
    });
  };

  const titleIn = spring({ frame, fps, config: { damping: 200 } });
  const rootGlow = interpolate(frame, [3.2 * fps, 3.7 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        color: COLORS.text,
        fontFamily: "Inter, Helvetica, Arial, sans-serif",
      }}
    >
      <Audio src={staticFile("starter.wav")} />
      <div
        style={{
          position: "absolute",
          top: 70,
          width: "100%",
          textAlign: "center",
          fontSize: 96,
          fontWeight: 700,
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 40}px)`,
        }}
      >
        Merkle tree
      </div>

      <svg width={W} height={1080} style={{ position: "absolute", top: 0, left: 0 }}>
        {/* Edges: drawn from each child up to its parent as the parent appears. */}
        {LEVELS.slice(1).flatMap((level) =>
          level.flatMap((parent) => {
            const grow = appear(parent);
            return [0, 1].map((side) => {
              const child = LEVELS[parent.level - 1][2 * parent.index + side];
              const x1 = child.x;
              const y1 = child.y - NODE_H / 2;
              const x2 = parent.x;
              const y2 = parent.y + NODE_H / 2;
              return (
                <line
                  key={`${parent.level}-${parent.index}-${side}`}
                  x1={x1}
                  y1={y1}
                  x2={x1 + (x2 - x1) * grow}
                  y2={y1 + (y2 - y1) * grow}
                  stroke={COLORS.edge}
                  strokeWidth={5}
                />
              );
            });
          }),
        )}

        {/* Nodes: files at the bottom, hashes above them. */}
        {LEVELS.flat().map((node) => {
          const s = appear(node);
          const w = NODE_W[node.level];
          const isLeaf = node.level === 0;
          const isRoot = node.level === LEVELS.length - 1;
          const stroke = isRoot
            ? `rgba(250, 204, 21, ${0.4 + 0.6 * rootGlow})`
            : isLeaf
              ? COLORS.border
              : COLORS.hash;
          return (
            <g
              key={`${node.level}-${node.index}`}
              opacity={s}
              transform={`translate(${node.x} ${node.y}) scale(${0.6 + 0.4 * s})`}
            >
              <rect
                x={-w / 2}
                y={-NODE_H / 2}
                width={w}
                height={NODE_H}
                rx={18}
                fill={isRoot ? `rgba(250, 204, 21, ${rootGlow * 0.25})` : COLORS.file}
                stroke={stroke}
                strokeWidth={isRoot ? 6 : 4}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isLeaf ? 38 : 34}
                fontFamily={isLeaf ? "Inter, Helvetica, Arial, sans-serif" : "monospace"}
                fill={isRoot ? COLORS.root : isLeaf ? COLORS.text : COLORS.hash}
              >
                {isLeaf ? `file ${node.index + 1}` : isRoot ? "root hash" : "hash"}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
