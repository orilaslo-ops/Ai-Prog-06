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

// Scene 1 — Hook (8 s).
// Narration (6.6 s): "One letter changed, somewhere in a million files. Could you find it
// in just twenty steps? A Merkle tree can."
//
// Beats (seconds, from the narration's pauses):
//   0.0  "One letter changed"            close-up on the wall, one square flares red
//   1.3  "somewhere in a million files"  camera pulls back, the red square is lost,
//                                         "1,000,000 files" counts up
//   3.5  "Could you find it"             a huge glowing "?"
//   4.0  "in just twenty steps?"         a search window halves 20 times onto the
//                                         square, counter ticks to "20 steps"
//   5.3  "A Merkle tree can."            wall dims, title lands, yellow root glows
//                                         with light flowing up its branches

const CELL = 12; // grid pitch at camera scale 1
const SQ = 8; // square size inside a cell
// The changed file: a cell right of centre, so the camera has somewhere to drift.
const TARGET_COL = 113;
const TARGET_ROW = 52;
const TX = TARGET_COL * CELL + CELL / 2;
const TY = TARGET_ROW * CELL + CELL / 2;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const sec = (s: number): number => s * 30;

// Deterministic pseudo-random numbers so every render is identical.
const rand = (i: number): number => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// A few hundred squares that twinkle lighter than the rest, so the wall feels alive.
const SPARKS = Array.from({ length: 420 }, (_, i) => ({
  col: Math.floor(rand(i) * 220) - 30,
  row: Math.floor(rand(i + 1000) * 120) - 20,
  phase: rand(i + 2000) * Math.PI * 2,
  speed: 0.05 + rand(i + 3000) * 0.08,
}));

type Box = { x: number; y: number; w: number; h: number };

// The binary-search windows: start with the whole screen and halve along the longer
// side, always keeping the half that holds the changed square.
const SEARCH: Box[] = (() => {
  const boxes: Box[] = [{ x: 0, y: 0, w: WIDTH, h: HEIGHT }];
  for (let i = 0; i < 20; i++) {
    const b = boxes[boxes.length - 1];
    if (b.w >= b.h) {
      const w = b.w / 2;
      boxes.push({ ...b, w, x: TX < b.x + w ? b.x : b.x + w });
    } else {
      const h = b.h / 2;
      boxes.push({ ...b, h, y: TY < b.y + h ? b.y : b.y + h });
    }
  }
  // Never draw a window smaller than one cell around the target.
  return boxes.map((b) => {
    const w = Math.max(b.w, CELL * 2.6);
    const h = Math.max(b.h, CELL * 2.6);
    const x = Math.min(Math.max(b.x, TX - w + CELL * 1.3), TX - CELL * 1.3);
    const y = Math.min(Math.max(b.y, TY - h + CELL * 1.3), TY - CELL * 1.3);
    return { x, y, w, h };
  });
})();

const SEARCH_START = sec(3.95);
const SEARCH_END = sec(5.0);

const lerpBox = (a: Box, b: Box, t: number): Box => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
});

// Small tree hanging under the title: root, two hashes, four files.
const TREE_ROOT = { x: 960, y: 640 };
const TREE_MID = [
  { x: 860, y: 760 },
  { x: 1060, y: 760 },
];
const TREE_LEAF = [
  { x: 810, y: 860 },
  { x: 910, y: 860 },
  { x: 1010, y: 860 },
  { x: 1110, y: 860 },
];
const TREE_EDGES = [
  ...TREE_MID.map((m) => ({ from: m, to: TREE_ROOT, delay: 0 })),
  ...TREE_LEAF.map((l, i) => ({ from: l, to: TREE_MID[i >> 1], delay: 4 })),
];

export const Scene01Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ---- Camera: start deep inside the wall, pull back with a long ease-out, then a
  // slow push-in at the end for the title.
  const pull = interpolate(frame, [0, sec(3.6)], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.55, 0, 0.2, 1),
  });
  const scale =
    interpolate(pull, [0, 1], [7.5, 1]) *
    interpolate(frame, [sec(5.2), sec(8)], [1, 1.06], clamp);
  // The target starts at screen centre and drifts to its real place.
  const camX = interpolate(pull, [0, 1], [WIDTH / 2, TX]);
  const camY = interpolate(pull, [0, 1], [HEIGHT / 2, TY]);
  const shake =
    interpolate(frame, [6, 16], [1, 0], clamp) * Math.sin(frame * 2.3) * 6;
  const camera = `translate(${camX + shake} ${camY}) scale(${scale}) translate(${-TX} ${-TY})`;

  // ---- The red flare ("One letter changed") and its return to grey.
  const flareIn = spring({
    frame: frame - 6,
    fps,
    config: { damping: 12, stiffness: 160 },
  });
  const flareOut = interpolate(frame, [sec(1.6), sec(2.6)], [1, 0], clamp);
  // It lights up again when the search lands on it.
  const found = spring({
    frame: frame - SEARCH_END,
    fps,
    config: { damping: 14 },
  });
  const red = flareIn * flareOut;
  const foundRed =
    found * interpolate(frame, [sec(5.4), sec(6.0)], [1, 0], clamp);
  const ripple = (delay: number): number =>
    interpolate(frame, [6 + delay, 36 + delay], [0, 1], clamp);

  // ---- "1,000,000 files" counter.
  const countT = interpolate(frame, [sec(1.4), sec(2.9)], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const count = Math.round(1_000_000 * countT);
  const labelIn = spring({
    frame: frame - sec(1.3),
    fps,
    config: { damping: 18 },
  });
  const labelOut = interpolate(frame, [sec(5.1), sec(5.5)], [1, 0], clamp);

  // ---- The "?".
  const qIn = spring({
    frame: frame - sec(3.45),
    fps,
    config: { damping: 9, stiffness: 120 },
  });
  const qOut = interpolate(
    frame,
    [SEARCH_START, SEARCH_START + 8],
    [1, 0],
    clamp,
  );
  const qWobble = Math.sin(frame * 0.18) * 4;

  // ---- Binary search: one halving every few frames.
  const stepF = interpolate(frame, [SEARCH_START, SEARCH_END], [0, 20], {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });
  const step = Math.floor(stepF);
  const box = lerpBox(
    SEARCH[step],
    SEARCH[Math.min(step + 1, 20)],
    Easing.out(Easing.cubic)(stepF - step),
  );
  const searchOn =
    interpolate(frame, [SEARCH_START - 4, SEARCH_START + 2], [0, 1], clamp) *
    interpolate(frame, [sec(5.5), sec(5.9)], [1, 0], clamp);
  const stepsShown = Math.min(20, Math.ceil(stepF));
  const stepsPop = spring({
    frame: frame - SEARCH_END,
    fps,
    config: { damping: 10, stiffness: 200 },
  });

  // ---- Finale: wall dims, title and root land.
  const dim = interpolate(frame, [sec(5.2), sec(6.0)], [0, 0.78], clamp);
  const titleIn = spring({
    frame: frame - sec(5.3),
    fps,
    config: { damping: 16, stiffness: 110 },
  });
  const rootIn = spring({
    frame: frame - sec(5.8),
    fps,
    config: { damping: 11, stiffness: 140 },
  });
  const edgeGrow = (delay: number): number =>
    spring({ frame: frame - sec(6.0) - delay, fps, config: { damping: 30 } });
  const glowPulse = 0.75 + 0.25 * Math.sin(frame * 0.2);

  // Squares that twinkle: in stage coordinates, so they move with the camera.
  const sparks = SPARKS.map((s, i) => {
    const o = Math.max(0, Math.sin(frame * s.speed + s.phase));
    if (o < 0.15) return null;
    return (
      <rect
        key={i}
        x={s.col * CELL + (CELL - SQ) / 2}
        y={s.row * CELL + (CELL - SQ) / 2}
        width={SQ}
        height={SQ}
        rx={1.4}
        fill={COLORS.muted}
        opacity={o * 0.35}
      />
    );
  });

  const title = "Merkle tree";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        fontFamily: FONT,
        color: COLORS.text,
      }}
    >
      <Audio src={staticFile("scene01.wav")} />

      <svg
        width={WIDTH}
        height={HEIGHT}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <pattern
            id="s1-grid"
            width={CELL}
            height={CELL}
            patternUnits="userSpaceOnUse"
          >
            <rect
              x={(CELL - SQ) / 2}
              y={(CELL - SQ) / 2}
              width={SQ}
              height={SQ}
              rx={1.4}
              fill={COLORS.file}
              stroke={COLORS.edge}
              strokeWidth={0.6}
            />
          </pattern>
          <filter id="s1-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="s1-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="s1-vignette" cx="50%" cy="50%" r="75%">
            <stop offset="45%" stopColor={COLORS.bg} stopOpacity={0} />
            <stop offset="100%" stopColor="#020617" stopOpacity={0.95} />
          </radialGradient>
          <radialGradient
            id="s1-sweep"
            gradientUnits="userSpaceOnUse"
            cx={interpolate(frame, [0, sec(5)], [400, 1500], clamp)}
            cy={interpolate(frame, [0, sec(5)], [300, 760], clamp)}
            r={700}
          >
            <stop offset="0%" stopColor={COLORS.hash} stopOpacity={0.1} />
            <stop offset="100%" stopColor={COLORS.hash} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="s1-rootHalo">
            <stop offset="0%" stopColor={COLORS.root} stopOpacity={0.55} />
            <stop offset="100%" stopColor={COLORS.root} stopOpacity={0} />
          </radialGradient>
          <linearGradient id="s1-edge" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={COLORS.hash} stopOpacity={0.15} />
            <stop offset="100%" stopColor={COLORS.root} stopOpacity={0.9} />
          </linearGradient>
        </defs>

        {/* The wall, seen through the camera. */}
        <g transform={camera}>
          <rect
            x={-3000}
            y={-2000}
            width={8000}
            height={5000}
            fill="url(#s1-grid)"
          />
          {sparks}

          {/* The changed file. */}
          {red > 0.01 && (
            <g>
              {[0, 8, 16].map((d) => {
                const r = ripple(d);
                return r > 0 && r < 1 && flareOut > 0 ? (
                  <circle
                    key={d}
                    cx={TX}
                    cy={TY}
                    r={CELL * (0.6 + r * 5)}
                    fill="none"
                    stroke={COLORS.changed}
                    strokeWidth={1.2 * (1 - r)}
                    opacity={(1 - r) * flareOut}
                  />
                ) : null;
              })}
              <rect
                x={TX - SQ / 2}
                y={TY - SQ / 2}
                width={SQ}
                height={SQ}
                rx={1.4}
                fill={COLORS.changed}
                opacity={red}
                filter="url(#s1-glow)"
                transform={`translate(${TX} ${TY}) scale(${0.6 + 0.4 * red}) translate(${-TX} ${-TY})`}
              />
            </g>
          )}

          {/* Burst when the search lands on the changed file. */}
          {[0, 6].map((d) => {
            const r = interpolate(
              frame,
              [SEARCH_END + d, SEARCH_END + d + 24],
              [0, 1],
              clamp,
            );
            return r > 0 && r < 1 ? (
              <circle
                key={`f${d}`}
                cx={TX}
                cy={TY}
                r={CELL * (1 + r * 14)}
                fill="none"
                stroke={COLORS.changed}
                strokeWidth={5 * (1 - r)}
                opacity={1 - r}
                filter="url(#s1-soft)"
              />
            ) : null;
          })}

          {/* Search window: dark outside, glowing blue frame. */}
          {searchOn > 0 && (
            <g opacity={searchOn}>
              <path
                d={`M-3000 -2000 H5000 V3000 H-3000 Z M${box.x} ${box.y} v${box.h} h${box.w} v${-box.h} Z`}
                fill="#020617"
                fillOpacity={0.62}
                fillRule="evenodd"
              />
              <path
                d={`M-3000 ${box.y + box.h / 2} H5000 M${box.x + box.w / 2} -2000 V3000`}
                stroke={COLORS.hash}
                strokeWidth={1 / scale}
                strokeDasharray={`${6 / scale} ${6 / scale}`}
                opacity={0.45}
              />
              <rect
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                fill="none"
                stroke={COLORS.hash}
                strokeWidth={3 / scale}
                filter="url(#s1-soft)"
              />
            </g>
          )}
          {/* Found it: the changed file glows red again, on top of everything. */}
          {foundRed > 0.01 && (
            <rect
              x={TX - SQ / 2}
              y={TY - SQ / 2}
              width={SQ}
              height={SQ}
              rx={1.4}
              fill={COLORS.changed}
              opacity={Math.min(1, foundRed)}
              filter="url(#s1-glow)"
              transform={`translate(${TX} ${TY}) scale(${2.6 * found}) translate(${-TX} ${-TY})`}
            />
          )}
        </g>

        <rect width={WIDTH} height={HEIGHT} fill="url(#s1-sweep)" />
        <rect width={WIDTH} height={HEIGHT} fill="url(#s1-vignette)" />
        <rect width={WIDTH} height={HEIGHT} fill={COLORS.bg} opacity={dim} />

        {/* Finale tree: light runs up the branches into the root. */}
        {rootIn > 0.01 && (
          <g>
            {TREE_EDGES.map((e, i) => {
              const g = edgeGrow(e.delay);
              const x2 = e.from.x + (e.to.x - e.from.x) * g;
              const y2 = e.from.y + (e.to.y - e.from.y) * g;
              return (
                <g key={i}>
                  <line
                    x1={e.from.x}
                    y1={e.from.y}
                    x2={x2}
                    y2={y2}
                    stroke="url(#s1-edge)"
                    strokeWidth={4}
                    strokeLinecap="round"
                  />
                  {[0, 0.33, 0.66].map((off) => {
                    const t = (frame / 22 + off + i * 0.17) % 1;
                    if (g < 0.98) return null;
                    return (
                      <circle
                        key={off}
                        cx={e.from.x + (e.to.x - e.from.x) * t}
                        cy={e.from.y + (e.to.y - e.from.y) * t}
                        r={4}
                        fill={COLORS.root}
                        opacity={Math.sin(t * Math.PI)}
                        filter="url(#s1-soft)"
                      />
                    );
                  })}
                </g>
              );
            })}
            {TREE_LEAF.map((l, i) => {
              const s = edgeGrow(4 + i * 2);
              return (
                <rect
                  key={i}
                  x={l.x - 18}
                  y={l.y - 18}
                  width={36}
                  height={36}
                  rx={6}
                  fill={COLORS.file}
                  stroke={i === 2 ? COLORS.changed : COLORS.border}
                  strokeWidth={3}
                  opacity={s}
                />
              );
            })}
            {TREE_MID.map((m, i) => {
              const s = edgeGrow(2 + i * 2);
              return (
                <circle
                  key={i}
                  cx={m.x}
                  cy={m.y}
                  r={20 * s}
                  fill={COLORS.bg}
                  stroke={COLORS.hash}
                  strokeWidth={4}
                  filter="url(#s1-soft)"
                />
              );
            })}
            <circle
              cx={TREE_ROOT.x}
              cy={TREE_ROOT.y}
              r={110 * rootIn * glowPulse}
              fill="url(#s1-rootHalo)"
            />
            <circle
              cx={TREE_ROOT.x}
              cy={TREE_ROOT.y}
              r={30 * rootIn}
              fill={COLORS.root}
              filter="url(#s1-glow)"
            />
          </g>
        )}
      </svg>

      {/* "1,000,000 files" */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 90,
          textAlign: "center",
          opacity: labelIn * labelOut,
          transform: `translateY(${(1 - labelIn) * 40}px)`,
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: "18px 44px",
            borderRadius: 999,
            background: "rgba(15, 23, 42, 0.82)",
            border: `2px solid ${COLORS.border}`,
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: 1,
            boxShadow: "0 0 60px rgba(15,23,42,0.9)",
          }}
        >
          <span
            style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}
          >
            {count.toLocaleString("en-US")}
          </span>{" "}
          <span style={{ color: COLORS.muted, fontWeight: 500 }}>files</span>
        </span>
      </div>

      {/* "?" */}
      {qIn * qOut > 0.01 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 420,
            fontWeight: 800,
            color: COLORS.text,
            opacity: Math.min(1, qIn) * qOut,
            transform: `scale(${0.3 + 0.7 * qIn + 0.4 * (1 - qOut)}) rotate(${qWobble}deg)`,
            textShadow: `0 0 40px ${COLORS.hash}, 0 0 120px rgba(56,189,248,0.6)`,
          }}
        >
          ?
        </div>
      )}

      {/* Step counter. */}
      {searchOn > 0.01 && (
        <div
          style={{
            position: "absolute",
            top: 80,
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: searchOn,
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "16px 44px",
              borderRadius: 24,
              background: "rgba(15, 23, 42, 0.85)",
              border: `3px solid ${COLORS.hash}`,
              boxShadow: `0 0 ${30 + 40 * stepsPop}px rgba(56,189,248,0.55)`,
              fontSize: 76,
              fontWeight: 800,
              color: COLORS.hash,
              transform: `scale(${1 + 0.18 * stepsPop * (1 - Math.min(1, (frame - SEARCH_END) / 20))})`,
            }}
          >
            <span
              style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}
            >
              {String(Math.max(1, stepsShown)).padStart(2, " ")}
            </span>{" "}
            steps
          </span>
        </div>
      )}

      {/* Title. */}
      {titleIn > 0.01 && (
        <div
          style={{
            position: "absolute",
            top: 330,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 150,
            fontWeight: 800,
            letterSpacing: -2,
          }}
        >
          {title.split("").map((ch, i) => {
            const s = spring({
              frame: frame - sec(5.3) - i * 1.5,
              fps,
              config: { damping: 13, stiffness: 140 },
            });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  whiteSpace: "pre",
                  opacity: Math.min(1, s),
                  transform: `translateY(${(1 - s) * 80}px) scale(${0.6 + 0.4 * s})`,
                  filter: `blur(${Math.max(0, 1 - s) * 12}px)`,
                  textShadow: "0 0 50px rgba(250,204,21,0.25)",
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};
