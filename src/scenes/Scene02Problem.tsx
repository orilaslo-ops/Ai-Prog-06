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

// Scene 2 (8 s): "Say you and a friend each have a million files. Are they identical?
// Sending every file to compare would take forever."
// Two computers, each full of files, a glowing "same?" link between them, one file on
// the right blinks red, then files start flying across one by one while a counter
// ticks "comparing 1… 2… 3…" until it is struck out: this would take forever.

const GRID = 8; // 8 × 8 = 64 squares stand in for a million files
const CELL = 34;
const GAP = 9;
const GRID_SIZE = GRID * CELL + (GRID - 1) * GAP;
const SCREEN_W = 520;
const SCREEN_H = 400;
const MON_Y = 450; // centre of the screens
const LEFT_X = 470;
const RIGHT_X = WIDTH - 470;
const ODD = { row: 5, col: 2 }; // the file that differs on the right computer

// Beats, in seconds, matched to the narration.
const T = {
  you: 0.15, // "Say you…"
  friend: 0.9, // "…and a friend…"
  million: 1.8, // "…a million files."
  same: 3.2, // "Are they identical?"
  blink: 3.6,
  send: 4.5, // "Sending every file…"
  strike: 6.3, // "…would take forever."
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Deterministic pseudo-random numbers so every render is identical.
const rand = (i: number): number => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const cellPos = (
  cx: number,
  row: number,
  col: number,
): { x: number; y: number } => ({
  x: cx - GRID_SIZE / 2 + col * (CELL + GAP) + CELL / 2,
  y: MON_Y - GRID_SIZE / 2 + row * (CELL + GAP) + CELL / 2,
});

const DUST = Array.from({ length: 46 }, (_, i) => ({
  x: rand(i) * WIDTH,
  y: rand(i + 100) * HEIGHT,
  r: 1 + rand(i + 200) * 2.4,
  speed: 6 + rand(i + 300) * 14,
  phase: rand(i + 400) * Math.PI * 2,
}));

// Order in which files are sent across: row by row from the top-left.
const SEND_EVERY = 0.42; // seconds between files: painfully slow on purpose
const FLIGHT = 0.8; // seconds per flight
const sendStart = (k: number): number => T.send + k * SEND_EVERY;

const Computer: React.FC<{
  cx: number;
  label: string;
  appear: number;
  reveal: (row: number, col: number) => number;
  sentGlow: (row: number, col: number) => number;
  odd: number; // 0..1 red blink strength for the odd file (right side only)
}> = ({ cx, label, appear, reveal, sentGlow, odd }) => {
  const top = MON_Y - SCREEN_H / 2;
  return (
    <g
      opacity={appear}
      transform={`translate(0 ${(1 - appear) * 60}) translate(${cx} ${MON_Y}) scale(${
        0.85 + 0.15 * appear
      }) translate(${-cx} ${-MON_Y})`}
    >
      {/* Soft light pool under the computer */}
      <ellipse
        cx={cx}
        cy={MON_Y + 300}
        rx={330}
        ry={36}
        fill="url(#s2-floor)"
      />
      {/* Stand */}
      <path
        d={`M ${cx - 46} ${top + SCREEN_H + 30} L ${cx + 46} ${top + SCREEN_H + 30} L ${
          cx + 70
        } ${top + SCREEN_H + 110} L ${cx - 70} ${top + SCREEN_H + 110} Z`}
        fill="url(#s2-stand)"
      />
      <rect
        x={cx - 150}
        y={top + SCREEN_H + 106}
        width={300}
        height={16}
        rx={8}
        fill="#334155"
      />
      {/* Bezel and screen */}
      <rect
        x={cx - SCREEN_W / 2 - 22}
        y={top - 22}
        width={SCREEN_W + 44}
        height={SCREEN_H + 60}
        rx={30}
        fill="#111c33"
        stroke="#3b4a66"
        strokeWidth={3}
      />
      <rect
        x={cx - SCREEN_W / 2}
        y={top}
        width={SCREEN_W}
        height={SCREEN_H}
        rx={16}
        fill="url(#s2-screen)"
      />
      <rect
        x={cx - SCREEN_W / 2}
        y={top}
        width={SCREEN_W}
        height={SCREEN_H}
        rx={16}
        fill="url(#s2-sheen)"
      />
      <circle cx={cx} cy={top + SCREEN_H + 19} r={5} fill="#475569" />
      {/* Files */}
      {Array.from({ length: GRID * GRID }, (_, i) => {
        const row = Math.floor(i / GRID);
        const col = i % GRID;
        const s = reveal(row, col);
        if (s <= 0.001) return null;
        const p = cellPos(cx, row, col);
        const isOdd = odd > 0 && row === ODD.row && col === ODD.col;
        const glow = sentGlow(row, col);
        const size = CELL * (0.4 + 0.6 * s);
        const stroke = isOdd
          ? COLORS.changed
          : glow > 0
            ? `rgba(56, 189, 248, ${0.35 + 0.65 * glow})`
            : COLORS.border;
        return (
          <rect
            key={i}
            x={p.x - size / 2}
            y={p.y - size / 2}
            width={size}
            height={size}
            rx={6}
            opacity={s}
            fill={
              isOdd
                ? `rgba(248, 113, 113, ${0.25 + 0.6 * odd})`
                : glow > 0
                  ? `rgba(56, 189, 248, ${0.12 + 0.25 * glow})`
                  : COLORS.file
            }
            stroke={stroke}
            strokeWidth={isOdd ? 3 : 2}
            filter={isOdd && odd > 0.5 ? "url(#s2-glow-red)" : undefined}
          />
        );
      })}
      {/* Owner label */}
      <text
        x={cx}
        y={top - 62}
        textAnchor="middle"
        fontSize={46}
        fontWeight={700}
        fill={COLORS.text}
        fontFamily={FONT}
      >
        {label}
      </text>
    </g>
  );
};

export const Scene02Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const pop = (start: number, damping = 14): number =>
    spring({ frame: frame - start * fps, fps, config: { damping, mass: 0.8 } });

  // Camera: a slow push in, a slight drift, and a small kick when the counter is
  // struck out.
  const push = interpolate(frame, [0, durationInFrames], [1.06, 1.0], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const kick = pop(T.strike, 9);
  const shake =
    Math.sin((t - T.strike) * 40) *
    Math.max(0, 1 - (t - T.strike) * 3) *
    (t > T.strike ? 8 : 0);
  const camX = Math.sin(t * 0.6) * 10 + shake;
  const camY = interpolate(t, [0, 8], [14, -6]);
  const camScale = push * (1 + 0.012 * Math.sin(kick * Math.PI));

  const leftIn = pop(T.you, 16);
  const rightIn = pop(T.friend, 16);

  // Files ripple in from the centre of each screen, outwards.
  const reveal =
    (start: number) =>
    (row: number, col: number): number => {
      const d = Math.hypot(row - 3.5, col - 3.5);
      return spring({
        frame: frame - (start + d * 0.09) * fps,
        fps,
        config: { damping: 12, mass: 0.6 },
      });
    };

  // "1,000,000 files" labels
  const millionIn = pop(T.million, 18);
  const millionCount = Math.round(
    interpolate(t, [T.million, T.million + 0.9], [0, 1_000_000], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    }),
  );

  // Link between the computers
  const linkGrow = interpolate(t, [T.same - 0.4, T.same + 0.3], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const sameIn = pop(T.same, 11);
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  const x1 = LEFT_X + SCREEN_W / 2 + 34;
  const x2 = RIGHT_X - SCREEN_W / 2 - 34;
  const lineY = MON_Y;

  // The odd file blinks red a few times, then stays faintly red.
  const blinkT = t - T.blink;
  const odd =
    blinkT < 0
      ? 0
      : blinkT < 1.6
        ? 0.55 + 0.45 * Math.cos(blinkT * Math.PI * 5)
        : interpolate(blinkT, [1.6, 2.2], [1, 0.55], clamp);
  const oddRing = interpolate(blinkT, [0, 0.9], [0, 1], clamp);

  // Sending files one by one along an arc.
  const strikeT = t - T.strike;
  const flights: React.ReactNode[] = [];
  let arrived = 0;
  for (let k = 0; k < GRID * GRID; k++) {
    const s0 = sendStart(k);
    if (s0 > T.strike) break;
    const p = (t - s0) / FLIGHT;
    if (s0 <= t) arrived = k + 1;
    if (p <= 0 || p >= 1) continue;
    const row = Math.floor(k / GRID);
    const col = k % GRID;
    const a = cellPos(LEFT_X, row, col);
    const b = cellPos(RIGHT_X, row, col);
    const e = Easing.inOut(Easing.cubic)(p);
    const lift = 150 + rand(k + 500) * 60;
    const px = a.x + (b.x - a.x) * e;
    const py = a.y + (b.y - a.y) * e - Math.sin(Math.PI * e) * lift;
    const fade = interpolate(strikeT, [0, 0.5], [1, 0], clamp);
    // A short comet trail behind each flying file
    const trail = Array.from({ length: 7 }, (_, j) => {
      const q = Easing.inOut(Easing.cubic)(Math.max(0, p - (j + 1) * 0.025));
      return {
        x: a.x + (b.x - a.x) * q,
        y: a.y + (b.y - a.y) * q - Math.sin(Math.PI * q) * lift,
        o: (1 - j / 7) * 0.5,
        r: 9 - j,
      };
    });
    flights.push(
      <g key={k} opacity={fade}>
        {trail.map((d, j) => (
          <circle
            key={j}
            cx={d.x}
            cy={d.y}
            r={d.r}
            fill={COLORS.hash}
            opacity={d.o}
          />
        ))}
        <rect
          x={px - 15}
          y={py - 15}
          width={30}
          height={30}
          rx={6}
          fill="rgba(56, 189, 248, 0.35)"
          stroke={COLORS.hash}
          strokeWidth={2.5}
          filter="url(#s2-glow-blue)"
          transform={`rotate(${(e - 0.5) * 40} ${px} ${py})`}
        />
      </g>,
    );
  }
  const sentGlow = (row: number, col: number): number => {
    const k = row * GRID + col;
    const done = t - (sendStart(k) + (sendStart(k) > T.strike ? 99 : 0));
    return done > 0 ? Math.max(0.3, 1 - done * 1.5) : 0;
  };
  const sentGlowRight = (row: number, col: number): number => {
    const k = row * GRID + col;
    const s0 = sendStart(k);
    if (s0 > T.strike) return 0;
    const done = t - (s0 + FLIGHT);
    return done > 0 ? Math.max(0.3, 1 - done * 1.5) : 0;
  };

  // Counter
  const counterIn = pop(T.send, 14);
  const shown = Math.max(1, arrived);
  const strikeDraw = interpolate(strikeT, [0, 0.35], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const foreverIn = pop(T.strike + 0.25, 10);
  const numbers = Array.from({ length: Math.min(shown, 5) }, (_, i) => i + 1);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        color: COLORS.text,
        fontFamily: FONT,
      }}
    >
      <Audio src={staticFile("scene02.wav")} />
      <svg
        width={WIDTH}
        height={HEIGHT}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="s2-bg" cx="50%" cy="42%" r="70%">
            <stop offset="0%" stopColor="#1b2a4a" />
            <stop offset="60%" stopColor={COLORS.bg} />
            <stop offset="100%" stopColor="#070c19" />
          </radialGradient>
          <linearGradient id="s2-screen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0b1530" />
            <stop offset="100%" stopColor="#0a1124" />
          </linearGradient>
          <linearGradient id="s2-sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.07)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.0)" />
          </linearGradient>
          <linearGradient id="s2-stand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <radialGradient id="s2-floor">
            <stop offset="0%" stopColor="rgba(56,189,248,0.18)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0)" />
          </radialGradient>
          <linearGradient
            id="s2-link"
            gradientUnits="userSpaceOnUse"
            x1={LEFT_X + SCREEN_W / 2}
            y1={0}
            x2={RIGHT_X - SCREEN_W / 2}
            y2={0}
          >
            <stop offset="0%" stopColor={COLORS.hash} stopOpacity={0.2} />
            <stop offset="50%" stopColor={COLORS.hash} stopOpacity={1} />
            <stop offset="100%" stopColor={COLORS.hash} stopOpacity={0.2} />
          </linearGradient>
          <filter
            id="s2-glow-blue"
            filterUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={WIDTH}
            height={HEIGHT}
          >
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="s2-glow-red"
            x="-150%"
            y="-150%"
            width="400%"
            height="400%"
          >
            <feGaussianBlur stdDeviation="9" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="s2-soft"
            filterUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={WIDTH}
            height={HEIGHT}
          >
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        <rect width={WIDTH} height={HEIGHT} fill="url(#s2-bg)" />
        {/* Drifting dust particles for depth */}
        {DUST.map((d, i) => (
          <circle
            key={i}
            cx={d.x + Math.sin(t * 0.7 + d.phase) * 20}
            cy={(((d.y - t * d.speed) % HEIGHT) + HEIGHT) % HEIGHT}
            r={d.r}
            fill={COLORS.hash}
            opacity={0.08 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2 + d.phase))}
          />
        ))}

        <g
          transform={`translate(${WIDTH / 2 + camX} ${HEIGHT / 2 + camY}) scale(${camScale}) translate(${
            -WIDTH / 2
          } ${-HEIGHT / 2})`}
        >
          <Computer
            cx={LEFT_X}
            label="You"
            appear={leftIn}
            reveal={reveal(T.you + 0.15)}
            sentGlow={sentGlow}
            odd={0}
          />
          <Computer
            cx={RIGHT_X}
            label="Friend"
            appear={rightIn}
            reveal={reveal(T.friend + 0.15)}
            sentGlow={sentGlowRight}
            odd={odd}
          />

          {/* Expanding ring around the odd file */}
          {oddRing > 0 && oddRing < 1 && (
            <circle
              cx={cellPos(RIGHT_X, ODD.row, ODD.col).x}
              cy={cellPos(RIGHT_X, ODD.row, ODD.col).y}
              r={20 + oddRing * 70}
              fill="none"
              stroke={COLORS.changed}
              strokeWidth={4 * (1 - oddRing)}
              opacity={1 - oddRing}
            />
          )}

          {/* "1,000,000 files" under each computer */}
          {[LEFT_X, RIGHT_X].map((cx) => (
            <g
              key={cx}
              opacity={millionIn}
              transform={`translate(0 ${(1 - millionIn) * 24})`}
            >
              <text
                x={cx}
                y={MON_Y + SCREEN_H / 2 + 200}
                textAnchor="middle"
                fontSize={50}
                fontWeight={800}
                fill={COLORS.text}
                fontFamily={MONO}
              >
                {millionCount.toLocaleString("en-US")}
                <tspan fill={COLORS.muted} fontWeight={500} fontFamily={FONT}>
                  {" files"}
                </tspan>
              </text>
            </g>
          ))}

          {/* Dashed link "same?" */}
          <g opacity={linkGrow}>
            <line
              x1={x1}
              y1={lineY}
              x2={x1 + (x2 - x1) * linkGrow}
              y2={lineY}
              stroke={COLORS.hash}
              strokeWidth={10}
              opacity={0.25}
              filter="url(#s2-soft)"
            />
            <line
              x1={x1}
              y1={lineY}
              x2={x1 + (x2 - x1) * linkGrow}
              y2={lineY}
              stroke="url(#s2-link)"
              strokeWidth={5}
              strokeDasharray="18 14"
              strokeDashoffset={-t * 60}
              strokeLinecap="round"
            />
            {/* Light pulses running both ways along the link */}
            {[0, 0.5].map((ph) => {
              const u = (t * 0.6 + ph) % 1;
              return (
                <React.Fragment key={ph}>
                  <circle
                    cx={x1 + (x2 - x1) * u * linkGrow}
                    cy={lineY}
                    r={7}
                    fill="#e0f2fe"
                    filter="url(#s2-glow-blue)"
                  />
                  <circle
                    cx={x2 - (x2 - x1) * u * linkGrow}
                    cy={lineY}
                    r={5}
                    fill="#e0f2fe"
                    opacity={0.7}
                    filter="url(#s2-glow-blue)"
                  />
                </React.Fragment>
              );
            })}
          </g>
          <g
            transform={`translate(${WIDTH / 2} ${lineY + 80}) scale(${sameIn})`}
            opacity={Math.min(1, sameIn)}
          >
            <rect
              x={-110}
              y={-42}
              width={220}
              height={84}
              rx={42}
              fill="#0b1530"
              stroke={COLORS.hash}
              strokeWidth={3}
              opacity={0.95}
            />
            <rect
              x={-110}
              y={-42}
              width={220}
              height={84}
              rx={42}
              fill="none"
              stroke={COLORS.hash}
              strokeWidth={6}
              opacity={0.25 + 0.35 * pulse}
              filter="url(#s2-soft)"
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={48}
              fontWeight={700}
              fill={COLORS.hash}
              fontFamily={FONT}
            >
              same?
            </text>
          </g>

          {flights}
        </g>
      </svg>

      {/* Counter: "comparing 1… 2… 3…", then struck out */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 70,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: Math.min(1, counterIn),
          transform: `translateY(${(1 - counterIn) * 40}px)`,
        }}
      >
        <div
          style={{
            position: "relative",
            padding: "14px 40px",
            borderRadius: 24,
            background: "rgba(15, 23, 42, 0.85)",
            border: `2px solid ${COLORS.edge}`,
            fontSize: 52,
            fontFamily: MONO,
            color:
              interpolate(strikeT, [0, 0.3], [0, 1], clamp) > 0.5
                ? COLORS.muted
                : COLORS.text,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontFamily: FONT, color: COLORS.muted }}>
            comparing{" "}
          </span>
          {numbers.map((n) => (
            <span
              key={n}
              style={{ color: n === shown ? COLORS.hash : undefined }}
            >
              {n}…{" "}
            </span>
          ))}
          <span style={{ color: COLORS.muted, fontSize: 40 }}>/ 1,000,000</span>
          {/* Strike-through */}
          <div
            style={{
              position: "absolute",
              left: 20,
              top: "52%",
              height: 10,
              width: `calc((100% - 40px) * ${strikeDraw})`,
              background: COLORS.changed,
              borderRadius: 5,
              boxShadow: `0 0 24px ${COLORS.changed}`,
              transform: "rotate(-3deg)",
              transformOrigin: "left center",
            }}
          />
          {/* "forever" stamp */}
          <div
            style={{
              position: "absolute",
              left: "100%",
              top: "50%",
              marginLeft: 36,
              marginTop: -40,
              whiteSpace: "nowrap",
              fontFamily: FONT,
              fontSize: 60,
              fontWeight: 900,
              color: COLORS.changed,
              letterSpacing: 4,
              textShadow: `0 0 30px rgba(248,113,113,0.7)`,
              opacity: Math.min(1, foreverIn),
              transform: `rotate(-8deg) scale(${0.4 + 0.6 * foreverIn})`,
            }}
          >
            forever!
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
