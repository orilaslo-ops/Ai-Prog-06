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
import { COLORS, FONT, HEIGHT, WIDTH } from "./theme";

// Scene 7 (9 s): where Merkle trees are used. Three glowing icons drawn in code
// (Git, Bitcoin, file sync) pop in as they are named, each grows a small Merkle
// tree, light pulses climb every tree to its root, then the three roots fly
// together into one big yellow root under the title "Merkle tree".
// Narration: "Git, Bitcoin and file-sync apps all use Merkle trees, to check a lot
// of data by looking at just one hash."

// Narration beats, in seconds (measured from public/scene07.wav, 6.8 s long).
const T = {
  git: 0.05,
  bitcoin: 0.6,
  sync: 1.3,
  trees: 2.3, // "all use Merkle trees"
  pulses: 4.0, // "to check a lot of data"
  merge: 5.35, // "by looking at just one hash"
  arrive: 6.25,
  title: 6.45,
};

const CARD_X = [420, 960, 1500];
const ICON_Y = 300;
const LABEL_Y = 485;
const TREE = { root: 590, mid: 705, leaf: 825 };
const LEAF_DX = [-180, -60, 60, 180];
const MID_DX = [-120, 120];
const FINAL = { x: 960, y: 700 };
const LABELS = ["Git", "Bitcoin", "File sync"];
const START = [T.git, T.bitcoin, T.sync];

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

type Pt = { x: number; y: number };

// Point on a quadratic curve, used for the flight of the roots.
const quad = (a: Pt, c: Pt, b: Pt, t: number): Pt => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});

const lerp = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

// ---------- icons (all drawn around 0,0, roughly 150 px wide) ----------

const GitIcon: React.FC<{ t: number }> = ({ t }) => {
  // The branch draws itself, then the branch tip pops in.
  const draw = interpolate(t, [0.1, 0.7], [0, 1], clamp);
  const tip = interpolate(t, [0.55, 0.85], [0, 1], clamp);
  return (
    <g stroke={COLORS.text} strokeWidth={11} strokeLinecap="round" fill="none">
      <line x1={-30} y1={-58} x2={-30} y2={58} />
      <path
        d="M -30 34 C -30 -6, 38 6, 38 -26"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
        stroke={COLORS.hash}
      />
      <circle cx={-30} cy={-58} r={15} fill={COLORS.bg} />
      <circle cx={-30} cy={58} r={15} fill={COLORS.bg} />
      <circle
        cx={38}
        cy={-34}
        r={15 * tip}
        fill={COLORS.bg}
        stroke={COLORS.hash}
      />
    </g>
  );
};

const BitcoinIcon: React.FC<{ t: number }> = ({ t }) => {
  const draw = interpolate(t, [0.05, 0.75], [0, 1], clamp);
  return (
    <g
      transform="rotate(14)"
      stroke={COLORS.root}
      strokeWidth={12}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <path
        d="M -30 -52 L 10 -52 A 25 25 0 0 1 10 -2 L -30 -2 M -30 -2 L 16 -2 A 27 27 0 0 1 16 52 L -30 52 Z M -30 -52 L -30 52"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
      />
      {[-14, 6].map((x) => (
        <g key={x} opacity={interpolate(t, [0.5, 0.8], [0, 1], clamp)}>
          <line x1={x} y1={-70} x2={x} y2={-54} />
          <line x1={x} y1={54} x2={x} y2={70} />
        </g>
      ))}
    </g>
  );
};

const SyncIcon: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const draw = interpolate(t, [0.05, 0.7], [0, 1], clamp);
  const arrows = interpolate(t, [0.45, 0.8], [0, 1], clamp);
  // The two arrows bob in opposite directions: data going up and down.
  const bob = Math.sin(frame / 6) * 6 * arrows;
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path
        d="M -48 22 A 26 26 0 0 1 -44 -28 A 38 38 0 0 1 26 -36 A 30 30 0 0 1 50 22 Z"
        transform="translate(0 -12)"
        stroke={COLORS.text}
        strokeWidth={11}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
      />
      <g stroke={COLORS.hash} strokeWidth={10} opacity={arrows}>
        <g transform={`translate(-18 ${-bob})`}>
          <line x1={0} y1={56} x2={0} y2={0} />
          <path d="M -14 14 L 0 0 L 14 14" />
        </g>
        <g transform={`translate(18 ${bob})`}>
          <line x1={0} y1={0} x2={0} y2={56} />
          <path d="M -14 42 L 0 56 L 14 42" />
        </g>
      </g>
    </g>
  );
};

// ---------- the scene ----------

export const Scene07Uses: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (sec: number) => sec * fps;

  // Merge: everything but the roots fades away, the roots fly to the centre.
  const mergeRaw = interpolate(frame, [s(T.merge), s(T.arrive)], [0, 1], clamp);
  const merge = Easing.inOut(Easing.cubic)(mergeRaw);
  const cardsFade = interpolate(
    frame,
    [s(T.merge), s(T.merge + 0.5)],
    [1, 0],
    clamp,
  );
  const arrived = spring({
    frame: frame - s(T.arrive),
    fps,
    config: { damping: 12, stiffness: 120 },
  });
  const burst = interpolate(frame, [s(T.arrive), s(T.arrive + 1.1)], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.quad),
  });

  // Gentle camera: slow drift and push-in, a small kick when the roots meet.
  const zoom =
    interpolate(frame, [0, s(T.merge)], [1.04, 1.0], clamp) +
    interpolate(frame, [s(T.merge), s(9)], [0, 0.06], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    }) +
    0.012 * Math.sin(Math.PI * Math.min(1, Math.max(0, burst * 2)));
  const camX = Math.sin(frame / 70) * 10 * (1 - merge);
  const camY = Math.cos(frame / 90) * 6 * (1 - merge);

  // Background particles drifting upwards.
  const particles = Array.from({ length: 70 }, (_, i) => {
    const x0 = random(`px${i}`) * WIDTH;
    const speed = 0.4 + random(`ps${i}`) * 1.2;
    const y =
      (((random(`py${i}`) * HEIGHT - frame * speed) % HEIGHT) + HEIGHT) %
      HEIGHT;
    const x = x0 + Math.sin(frame / 40 + i) * 12;
    const r = 1 + random(`pr${i}`) * 2.5;
    const tw = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(frame / 12 + i * 1.7));
    const hue = random(`pc${i}`) > 0.8 ? COLORS.root : COLORS.hash;
    return { x, y, r, tw, hue, i };
  });

  // Each card: pop-in spring, tree growth, and the pulse climbing it.
  const cards = CARD_X.map((cx, k) => {
    const pop = spring({
      frame: frame - s(START[k]),
      fps,
      config: { damping: 11, stiffness: 140 },
    });
    const iconT = interpolate(
      frame,
      [s(START[k]), s(START[k] + 0.9)],
      [0, 1],
      clamp,
    );
    // "Spotlight" while the name is spoken.
    const nextStart = k < 2 ? START[k + 1] : T.trees;
    const spot =
      interpolate(frame, [s(START[k]), s(START[k] + 0.2)], [0, 1], clamp) *
      interpolate(frame, [s(nextStart), s(nextStart + 0.4)], [1, 0], clamp);
    const tree = (lvl: number, idx: number) =>
      spring({
        frame: frame - s(T.trees + lvl * 0.35 + k * 0.1 + idx * 0.05),
        fps,
        config: { damping: 14 },
      });
    const pulse = interpolate(
      frame,
      [s(T.pulses + k * 0.15), s(T.pulses + 1.0 + k * 0.15)],
      [0, 1],
      clamp,
    );
    const rootFlash = interpolate(
      frame,
      [s(T.pulses + 1.0 + k * 0.15), s(T.pulses + 1.5 + k * 0.15)],
      [1, 0],
      clamp,
    );
    return { cx, k, pop, iconT, spot, tree, pulse, rootFlash };
  });

  const finalRootR = 26 + 34 * arrived;
  const glowPulse = 0.5 + 0.5 * Math.sin(frame / 8);
  const titleChars = "Merkle tree".split("");

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 55%, #16213d 0%, ${COLORS.bg} 65%)`,
        fontFamily: FONT,
        color: COLORS.text,
        overflow: "hidden",
      }}
    >
      <Audio src={staticFile("scene07.wav")} />

      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${camX}px, ${camY}px) scale(${zoom})`,
          transformOrigin: "50% 60%",
        }}
      >
        <defs>
          <filter id="s7glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="s7bigglow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <radialGradient id="s7disc" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#24324f" />
            <stop offset="100%" stopColor="#111a30" />
          </radialGradient>
          <linearGradient id="s7ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={COLORS.hash} />
            <stop offset="100%" stopColor={COLORS.root} />
          </linearGradient>
          <radialGradient id="s7root" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fff7c2" />
            <stop offset="45%" stopColor={COLORS.root} />
            <stop offset="100%" stopColor="#ca8a04" />
          </radialGradient>
        </defs>

        {/* drifting background particles */}
        {particles.map((p) => (
          <circle
            key={p.i}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={p.hue}
            opacity={p.tw}
          />
        ))}

        {/* the three cards */}
        {cards.map((c) => {
          const scale = (0.4 + 0.6 * c.pop) * (1 + 0.06 * c.spot);
          const ringRot = frame * (c.k === 1 ? -1.2 : 1.2);
          return (
            <g key={c.k} opacity={Math.min(1, c.pop * 1.5) * cardsFade}>
              {/* icon disc */}
              <g transform={`translate(${c.cx} ${ICON_Y}) scale(${scale})`}>
                <circle
                  r={118}
                  fill={COLORS.hash}
                  opacity={0.12 + 0.25 * c.spot}
                  filter="url(#s7bigglow)"
                />
                <circle
                  r={128}
                  fill="none"
                  stroke="url(#s7ring)"
                  strokeWidth={3}
                  strokeDasharray="6 14"
                  opacity={0.7}
                  transform={`rotate(${ringRot})`}
                />
                <circle
                  r={108}
                  fill="url(#s7disc)"
                  stroke="url(#s7ring)"
                  strokeWidth={4}
                />
                <g filter="url(#s7glow)">
                  {c.k === 0 && <GitIcon t={c.iconT} />}
                  {c.k === 1 && <BitcoinIcon t={c.iconT} />}
                  {c.k === 2 && <SyncIcon t={c.iconT} frame={frame} />}
                </g>
              </g>
              {/* shockwave ring when the icon lands */}
              <circle
                cx={c.cx}
                cy={ICON_Y}
                r={108 + 120 * c.iconT}
                fill="none"
                stroke={COLORS.hash}
                strokeWidth={3}
                opacity={
                  interpolate(c.iconT, [0, 0.05, 0.6], [0, 0.8, 0], clamp) * 1
                }
              />
              <text
                x={c.cx}
                y={LABEL_Y}
                textAnchor="middle"
                fontSize={50}
                fontWeight={700}
                fill={COLORS.text}
                fontFamily={FONT}
                opacity={interpolate(c.iconT, [0.2, 0.5], [0, 1], clamp)}
              >
                {LABELS[c.k]}
              </text>
              <MiniTree card={c} frame={frame} />
            </g>
          );
        })}

        {/* light trails + flying roots */}
        {cards.map((c) => {
          const from: Pt = { x: c.cx, y: TREE.root };
          const ctrl: Pt = {
            x: (c.cx + FINAL.x) / 2,
            y: c.k === 1 ? TREE.root + 40 : 470,
          };
          const at = (t: number) =>
            c.k === 1 ? lerp(from, FINAL, t) : quad(from, ctrl, FINAL, t);
          const grow = c.tree(2, 0);
          if (grow <= 0.01) return null;
          const trail = Array.from({ length: 14 }, (_, i) => {
            const tt = Math.max(0, merge - i * 0.025);
            return { ...at(tt), i };
          });
          const pos = at(merge);
          const r = 28 + 6 * merge;
          const visible = interpolate(arrived, [0, 0.3], [1, 0], clamp);
          return (
            <g key={`fly${c.k}`} opacity={visible}>
              {merge > 0 &&
                merge < 1 &&
                trail.map((p) => (
                  <circle
                    key={p.i}
                    cx={p.x}
                    cy={p.y}
                    r={r * (1 - p.i / 16)}
                    fill={COLORS.root}
                    opacity={0.35 * (1 - p.i / 14)}
                  />
                ))}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r * 1.8}
                fill={COLORS.root}
                opacity={0.25 + 0.6 * c.rootFlash}
                filter="url(#s7bigglow)"
              />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r * grow}
                fill="url(#s7root)"
                stroke="#fff7c2"
                strokeWidth={3}
              />
            </g>
          );
        })}

        {/* the final root, burst and sparks */}
        {arrived > 0.001 && (
          <g>
            <circle
              cx={FINAL.x}
              cy={FINAL.y}
              r={finalRootR * (2.4 + 0.4 * glowPulse)}
              fill={COLORS.root}
              opacity={0.35 + 0.15 * glowPulse}
              filter="url(#s7bigglow)"
            />
            {[0, 1].map((w) => {
              const b = Math.max(0, burst - w * 0.18);
              return (
                <circle
                  key={w}
                  cx={FINAL.x}
                  cy={FINAL.y}
                  r={60 + 520 * b}
                  fill="none"
                  stroke={w ? COLORS.hash : COLORS.root}
                  strokeWidth={6 * (1 - b)}
                  opacity={(1 - b) * 0.9}
                />
              );
            })}
            {Array.from({ length: 36 }, (_, i) => {
              const ang = (i / 36) * Math.PI * 2 + random(`sa${i}`) * 0.2;
              const dist = (120 + 380 * random(`sd${i}`)) * burst;
              const len = 26 * (1 - burst);
              const x = FINAL.x + Math.cos(ang) * dist;
              const y = FINAL.y + Math.sin(ang) * dist;
              return (
                <line
                  key={i}
                  x1={x}
                  y1={y}
                  x2={x - Math.cos(ang) * len}
                  y2={y - Math.sin(ang) * len}
                  stroke={i % 3 === 0 ? COLORS.hash : COLORS.root}
                  strokeWidth={4}
                  strokeLinecap="round"
                  opacity={1 - burst}
                />
              );
            })}
            {/* rotating rays behind the root */}
            <g
              transform={`translate(${FINAL.x} ${FINAL.y}) rotate(${frame * 0.6})`}
              opacity={0.18 * arrived}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <path
                  key={i}
                  d="M -9 0 L 9 0 L 0 -190 Z"
                  fill={COLORS.root}
                  transform={`rotate(${i * 30})`}
                />
              ))}
            </g>
            <circle
              cx={FINAL.x}
              cy={FINAL.y}
              r={finalRootR}
              fill="url(#s7root)"
              stroke="#fff7c2"
              strokeWidth={4}
              filter="url(#s7glow)"
            />
            <text
              x={FINAL.x}
              y={FINAL.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="ui-monospace, Menlo, monospace"
              fontWeight={700}
              fontSize={26}
              fill="#422006"
              opacity={interpolate(arrived, [0.5, 1], [0, 1], clamp)}
            >
              root
            </text>
          </g>
        )}
      </svg>

      {/* final title, letters spring in one by one */}
      <div
        style={{
          position: "absolute",
          top: 330,
          width: "100%",
          textAlign: "center",
          fontSize: 150,
          fontWeight: 800,
          letterSpacing: 2,
          whiteSpace: "pre",
        }}
      >
        {titleChars.map((ch, i) => {
          const a = spring({
            frame: frame - s(T.title) - i * 2,
            fps,
            config: { damping: 10, stiffness: 160 },
          });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: Math.min(1, a * 1.4),
                transform: `translateY(${(1 - a) * 70}px) scale(${0.6 + 0.4 * a})`,
                color: COLORS.text,
                textShadow: `0 0 ${20 + 20 * glowPulse}px rgba(56, 189, 248, ${0.35 * a}), 0 0 60px rgba(250, 204, 21, ${0.25 * a})`,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          top: 850,
          width: "100%",
          textAlign: "center",
          fontSize: 46,
          color: COLORS.text,
          letterSpacing: 1,
          opacity: interpolate(
            frame,
            [s(T.title + 0.6), s(T.title + 1.1)],
            [0, 1],
            clamp,
          ),
          transform: `translateY(${interpolate(frame, [s(T.title + 0.6), s(T.title + 1.1)], [20, 0], clamp)}px)`,
        }}
      >
        <span style={{ color: COLORS.root, fontWeight: 700 }}>one hash</span> to
        check them all
      </div>
    </AbsoluteFill>
  );
};

// ---------- one small Merkle tree under a card ----------

type Card = {
  cx: number;
  k: number;
  tree: (lvl: number, idx: number) => number;
  pulse: number;
  rootFlash: number;
};

const MiniTree: React.FC<{ card: Card; frame: number }> = ({ card }) => {
  const { cx, tree, pulse } = card;
  const leaves = LEAF_DX.map((dx, i) => ({ x: cx + dx, y: TREE.leaf, i }));
  const mids = MID_DX.map((dx, i) => ({ x: cx + dx, y: TREE.mid, i }));
  const root = { x: cx, y: TREE.root };

  // pulse: 0..0.5 leaf -> mid, 0.5..1 mid -> root
  const p1 = interpolate(pulse, [0, 0.5], [0, 1], clamp);
  const p2 = interpolate(pulse, [0.5, 1], [0, 1], clamp);
  const pulsing = pulse > 0 && pulse < 1;
  const leafLit = interpolate(pulse, [0, 0.1, 0.5], [0, 1, 0.3], clamp);
  const midLit = interpolate(pulse, [0.4, 0.55, 1], [0, 1, 0.3], clamp);

  const edge = (a: Pt, b: Pt, g: number, key: string) => (
    <line
      key={key}
      x1={a.x}
      y1={a.y}
      x2={a.x + (b.x - a.x) * g}
      y2={a.y + (b.y - a.y) * g}
      stroke={COLORS.edge}
      strokeWidth={5}
    />
  );

  return (
    <g>
      {mids.map((m) =>
        [0, 1].map((side) =>
          edge(leaves[m.i * 2 + side], m, tree(1, m.i), `e1${m.i}${side}`),
        ),
      )}
      {mids.map((m) => edge(m, root, tree(2, 0), `e2${m.i}`))}

      {/* light pulses climbing the tree */}
      {pulsing && (
        <g filter="url(#s7glow)">
          {p1 < 1 &&
            leaves.map((l) => {
              const m = mids[Math.floor(l.i / 2)];
              const p = lerp(l, m, Easing.inOut(Easing.quad)(p1));
              return (
                <circle
                  key={`p1${l.i}`}
                  cx={p.x}
                  cy={p.y}
                  r={9}
                  fill={COLORS.hash}
                />
              );
            })}
          {p2 > 0 &&
            p2 < 1 &&
            mids.map((m) => {
              const p = lerp(m, root, Easing.inOut(Easing.quad)(p2));
              return (
                <circle
                  key={`p2${m.i}`}
                  cx={p.x}
                  cy={p.y}
                  r={10}
                  fill={COLORS.root}
                />
              );
            })}
        </g>
      )}

      {leaves.map((l) => {
        const g = tree(0, l.i);
        return (
          <g
            key={`l${l.i}`}
            transform={`translate(${l.x} ${l.y}) scale(${g})`}
            opacity={Math.min(1, g)}
          >
            <rect
              x={-28}
              y={-34}
              width={56}
              height={68}
              rx={8}
              fill={COLORS.file}
              stroke={leafLit > 0.05 ? COLORS.hash : COLORS.border}
              strokeWidth={3 + 2 * leafLit}
            />
            {[-14, 0, 14].map((y) => (
              <line
                key={y}
                x1={-15}
                x2={y === 14 ? 5 : 15}
                y1={y}
                y2={y}
                stroke={COLORS.muted}
                strokeWidth={3}
                strokeLinecap="round"
              />
            ))}
          </g>
        );
      })}
      {mids.map((m) => {
        const g = tree(1, m.i);
        return (
          <circle
            key={`m${m.i}`}
            cx={m.x}
            cy={m.y}
            r={22 * g}
            fill={COLORS.file}
            stroke={COLORS.hash}
            strokeWidth={4 + 3 * midLit}
          />
        );
      })}
    </g>
  );
};
