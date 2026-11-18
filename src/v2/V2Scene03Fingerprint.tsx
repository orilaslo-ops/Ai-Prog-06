import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  C,
  clamp,
  FONT,
  HEIGHT,
  MONO,
  NeonBackground,
  NeonDefs,
  WIDTH,
} from "./kit";

// Version 2, scene 3 (9 s): "A hash is a short fingerprint of a file. Change even one
// letter, and the fingerprint changes completely."
// A holographic file card "cat.txt" (hello) flies through a SHA-256 laser gate. Where it
// crosses the laser sheet it is cut into a stream of hex glyphs that pour into a
// holographic readout, which decodes the real digest prefix 2cf24dba character by
// character. A targeting reticle locks onto the last letter, a glitch / RGB-split hit
// flips it to "O", and the new file runs through the gate: the readout scrambles and
// lands on 04a6f55f, every character different, with a second glitch on "completely".

// Real SHA-256 digests.
const HASH_A =
  "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"; // hello
const HASH_B =
  "04a6f55face2f46be8c23f627d539827615851e10751b63ec59db6d2c706b770"; // hellO
const SHOWN = 8;
const HEX = "0123456789abcdef";

const AUDIO_DELAY = 12;
// Narration (frames, incl. AUDIO_DELAY; from silencedetect on scene03.wav):
// 12-80 "A hash is a short fingerprint of a file." | 96-133 "Change even one letter,"
// | 141-193 "and the fingerprint changes completely."
const T = {
  cardIn: 2,
  passA: [26, 62] as const, // card left edge 150 -> past the gate
  decodeA: 54,
  labelA: 70,
  cardB: 88, // the file prints in again
  reticle: [100, 114] as const,
  glitch1: 118, // "one letter"
  passB: [138, 166] as const,
  decodeB: 160,
  glitch2: 184, // "completely"
  compare: 196,
  end: 270,
};

// Layout.
const GX = 820; // the gate's laser plane
const GY = 520;
const CARD = { x0: 150, y: 330, w: 340, h: 390 };
const PANEL = { x: 1120, y: 230, w: 660, h: 600 };
const HEX_X = PANEL.x + 52;
const CH_W = 58; // monospace cell width for the hex readout
const ROW_Y = [PANEL.y + 200, PANEL.y + 410]; // centre line of each hex row

const ease = Easing.bezier(0.45, 0, 0.2, 1);

const cardLeft = (f: number, pass: readonly [number, number]) =>
  interpolate(f, [pass[0], pass[1]], [CARD.x0, GX + 10], {
    ...clamp,
    easing: Easing.bezier(0.5, 0, 0.75, 1),
  });

// Frames during which the card overlaps the laser plane (found once, numerically).
const crossing = (pass: readonly [number, number]): [number, number] => {
  let a = -1;
  let b = -1;
  for (let f = pass[0]; f <= pass[1]; f += 0.25) {
    const l = cardLeft(f, pass);
    if (a < 0 && l + CARD.w > GX) a = f;
    if (b < 0 && l >= GX) b = f;
  }
  return [a, b < 0 ? pass[1] : b];
};
const CROSS_A = crossing(T.passA);
const CROSS_B = crossing(T.passB);

// Glitch strength 0…1 from impact frames, decaying with a jittery tail.
const glitchAt = (f: number) => {
  const hit = (t0: number, len: number, power: number) => {
    const d = f - t0;
    if (d < 0 || d > len) return 0;
    const decay = Math.pow(1 - d / len, 1.6);
    const jitter = random(`gj${Math.floor(f / 2)}`) > 0.35 ? 1 : 0.35;
    return power * decay * jitter;
  };
  return Math.max(
    hit(T.glitch1, 14, 1),
    hit(T.glitch2, 16, 1),
    hit(T.decodeB + 8, 6, 0.35),
  );
};

// ---------------------------------------------------------------------------
// The SHA-256 gate: a ring standing across the card's path, seen at an angle, with a
// laser sheet in its plane. Drawn in two halves so the card passes through it.
// ---------------------------------------------------------------------------
const RX = 92;
const RY = 330;
const arc = (side: "back" | "front", rx: number, ry: number) =>
  side === "back"
    ? `M ${GX} ${GY - ry} A ${rx} ${ry} 0 0 0 ${GX} ${GY + ry}`
    : `M ${GX} ${GY - ry} A ${rx} ${ry} 0 0 1 ${GX} ${GY + ry}`;

const GateHalf: React.FC<{
  side: "back" | "front";
  power: number;
  heat: number;
}> = ({ side, power, heat }) => {
  const frame = useCurrentFrame();
  const col = heat > 0.5 ? C.changed : C.hash;
  const op = side === "back" ? 0.55 : 1;
  return (
    <g opacity={power * op}>
      <path
        d={arc(side, RX, RY)}
        fill="none"
        stroke={col}
        strokeWidth={40}
        opacity={0.25}
        filter="url(#neon-wide)"
      />
      <path
        d={arc(side, RX, RY)}
        fill="none"
        stroke={C.faceTop}
        strokeWidth={26}
      />
      <path
        d={arc(side, RX, RY)}
        fill="none"
        stroke={col}
        strokeWidth={5}
        filter="url(#neon)"
      />
      <path
        d={arc(side, RX - 16, RY - 16)}
        fill="none"
        stroke={C.file}
        strokeWidth={2}
        strokeDasharray="6 14"
        strokeDashoffset={(side === "back" ? 1 : -1) * frame * 3}
        opacity={0.8}
      />
      {/* emitter studs around the ring */}
      {Array.from({ length: 9 }, (_, i) => {
        const a = (-Math.PI / 2) * 0.92 + (i / 8) * Math.PI * 0.92;
        const sx = GX + (side === "back" ? -1 : 1) * RX * Math.cos(a);
        const sy = GY + RY * Math.sin(a);
        const on = 0.5 + 0.5 * Math.sin(frame / 4 + i * 1.3);
        return (
          <circle
            key={i}
            cx={sx}
            cy={sy}
            r={5}
            fill="#fff"
            opacity={0.4 + 0.6 * on}
          />
        );
      })}
    </g>
  );
};

const LaserSheet: React.FC<{ power: number; cut: number; heat: number }> = ({
  power,
  cut,
  heat,
}) => {
  const frame = useCurrentFrame();
  const col = heat > 0.5 ? C.changed : C.hash;
  const scanY = GY + Math.sin(frame / 7) * (RY - 30);
  const scan2 = GY + Math.sin(frame / 7 + 2.1) * (RY - 60);
  return (
    <g opacity={power}>
      <defs>
        <clipPath id="s3-ring">
          <ellipse cx={GX} cy={GY} rx={RX - 6} ry={RY - 6} />
        </clipPath>
        <linearGradient id="s3-sheet" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={col} stopOpacity={0} />
          <stop offset="0.5" stopColor={col} stopOpacity={0.35} />
          <stop offset="1" stopColor={col} stopOpacity={0} />
        </linearGradient>
      </defs>
      <g clipPath="url(#s3-ring)">
        <rect
          x={GX - RX}
          y={GY - RY}
          width={RX * 2}
          height={RY * 2}
          fill="url(#s3-sheet)"
        />
        {[scanY, scan2].map((y, i) => (
          <g key={i}>
            <rect
              x={GX - RX}
              y={y - 10}
              width={RX * 2}
              height={20}
              fill={col}
              opacity={0.35}
              filter="url(#neon-wide)"
            />
            <line
              x1={GX - RX}
              y1={y}
              x2={GX + RX}
              y2={y}
              stroke="#fff"
              strokeWidth={2.5}
              opacity={0.9}
            />
          </g>
        ))}
      </g>
      {/* the vertical cutting plane, bright while a file crosses it */}
      <rect
        x={GX - 14}
        y={GY - RY + 10}
        width={28}
        height={(RY - 10) * 2}
        fill={col}
        opacity={0.15 + 0.5 * cut}
        filter="url(#neon-wide)"
      />
      <line
        x1={GX}
        y1={GY - RY + 8}
        x2={GX}
        y2={GY + RY - 8}
        stroke="#fff"
        strokeWidth={1.5 + 3 * cut}
        opacity={0.35 + 0.65 * cut}
        filter="url(#neon)"
      />
    </g>
  );
};

// Sparks spraying from where the laser cuts the card.
const Sparks: React.FC<{ cut: number; seed: string; heat: number }> = ({
  cut,
  seed,
  heat,
}) => {
  const frame = useCurrentFrame();
  if (cut <= 0.01) return null;
  return (
    <g>
      {Array.from({ length: 26 }, (_, i) => {
        const life = 8;
        const born = Math.floor(frame / life) * life + (i % life);
        const t = ((frame - born + life) % life) / life;
        const r = (k: string) =>
          random(`${seed}${k}${i}${Math.floor((frame - (i % life)) / life)}`);
        const y0 = CARD.y + 20 + r("y") * (CARD.h - 40);
        const vx = -60 - r("vx") * 160;
        const vy = (r("vy") - 0.5) * 140;
        const x = GX + vx * t;
        const y = y0 + vy * t + 120 * t * t;
        return (
          <line
            key={i}
            x1={x}
            y1={y}
            x2={x - vx * 0.08}
            y2={y - vy * 0.08}
            stroke={i % 3 === 0 ? "#fff" : heat > 0.5 ? C.changed : C.root}
            strokeWidth={2.5}
            opacity={cut * (1 - t)}
          />
        );
      })}
    </g>
  );
};

// Hex glyphs that leave the laser plane and fly into the readout row.
const GlyphStream: React.FC<{
  cross: [number, number];
  row: number;
  color: string;
  seed: string;
}> = ({ cross, row, color, seed }) => {
  const frame = useCurrentFrame();
  const N = 54;
  const travel = 20;
  return (
    <g fontFamily={MONO} fontWeight={700}>
      {Array.from({ length: N }, (_, i) => {
        const born = cross[0] + ((cross[1] - cross[0]) * i) / N;
        const t = (frame - born) / travel;
        if (t < 0 || t > 1) return null;
        const r = (k: string) => random(`${seed}${k}${i}`);
        const y0 = CARD.y + 30 + r("y") * (CARD.h - 60);
        const target = Math.floor(r("t") * SHOWN);
        const tx = HEX_X + CH_W * (target + 0.5);
        const ty = ROW_Y[row];
        const e = Easing.inOut(Easing.cubic)(t);
        const cx = (GX + tx) / 2 + (r("cx") - 0.5) * 120;
        const cy = Math.min(y0, ty) - 80 - r("cy") * 160;
        const u = 1 - e;
        const x = u * u * GX + 2 * u * e * cx + e * e * tx;
        const y = u * u * y0 + 2 * u * e * cy + e * e * ty;
        const ch =
          HEX[Math.floor(random(`${seed}c${i}${Math.floor(frame / 2)}`) * 16)];
        const size = 22 + r("s") * 22;
        return (
          <g key={i} opacity={Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.95}>
            <circle cx={x} cy={y} r={size * 0.7} fill={color} opacity={0.22} />
            <text
              x={x}
              y={y + size * 0.35}
              fontSize={size}
              fill={i % 4 === 0 ? "#fff" : color}
              textAnchor="middle"
            >
              {ch}
            </text>
          </g>
        );
      })}
    </g>
  );
};

// ---------------------------------------------------------------------------
// The file card (HTML, so the text stays crisp). Clipped at the laser plane.
// ---------------------------------------------------------------------------
const FileCard: React.FC<{
  left: number;
  top: number;
  opacity: number;
  text: string;
  changedIdx: number; // index of the changed letter, -1 none
  printIn: number; // 0…1 holographic print-in from the top
  glitch: number;
  tint: string;
}> = ({ left, top, opacity, text, changedIdx, printIn, glitch, tint }) => {
  const frame = useCurrentFrame();
  const clipRight = Math.max(0, left + CARD.w - GX);
  const clipBottom = (1 - printIn) * CARD.h;
  if (clipRight >= CARD.w || opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: CARD.w,
        height: CARD.h,
        opacity,
        clipPath: `inset(0px ${clipRight}px ${clipBottom}px 0px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 18,
          border: `3px solid ${tint}`,
          background:
            "linear-gradient(160deg, rgba(0,229,255,0.16), rgba(20,15,51,0.85) 45%, rgba(176,38,255,0.18))",
          boxShadow: `0 0 28px ${tint}, inset 0 0 40px rgba(0,229,255,0.25)`,
        }}
      />
      {/* scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 18,
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 6px)",
          backgroundPosition: `0 ${frame * 1.5}px`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 84,
          borderBottom: `2px solid ${tint}`,
          display: "flex",
          alignItems: "center",
          gap: 16,
          paddingLeft: 28,
          color: C.text,
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 42,
        }}
      >
        <svg width={34} height={42} viewBox="0 0 34 42">
          <path
            d="M3 3 H22 L31 12 V39 H3 Z"
            fill="none"
            stroke={tint}
            strokeWidth={3}
          />
          <path d="M22 3 V12 H31" fill="none" stroke={tint} strokeWidth={3} />
        </svg>
        cat.txt
      </div>
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 104,
          color: C.text,
          textShadow: `0 0 18px ${C.file}`,
          letterSpacing: 2,
        }}
      >
        {text
          .split("")
          .map((ch, i) =>
            i === changedIdx ? (
              <RgbText
                key={i}
                text={ch}
                color={C.changed}
                split={4 + 26 * glitch}
              />
            ) : (
              <span key={i}>{ch}</span>
            ),
          )}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 34,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT,
          fontSize: 36,
          color: C.muted,
        }}
      >
        5 bytes
      </div>
      {/* print-in edge */}
      {printIn < 1 ? (
        <div
          style={{
            position: "absolute",
            left: -10,
            right: -10,
            top: CARD.h * printIn - 3,
            height: 6,
            background: "#fff",
            boxShadow: `0 0 24px 8px ${C.file}`,
          }}
        />
      ) : null}
    </div>
  );
};

// Text drawn three times in red / cyan / white with a horizontal split.
const RgbText: React.FC<{ text: string; color: string; split: number }> = ({
  text,
  color,
  split,
}) => (
  <span style={{ position: "relative", display: "inline-block" }}>
    <span
      style={{
        position: "absolute",
        left: -split,
        top: 0,
        color: "#ff0040",
        mixBlendMode: "screen",
        opacity: 0.85,
      }}
    >
      {text}
    </span>
    <span
      style={{
        position: "absolute",
        left: split,
        top: 0,
        color: "#00f0ff",
        mixBlendMode: "screen",
        opacity: 0.85,
      }}
    >
      {text}
    </span>
    <span
      style={{ position: "relative", color, textShadow: `0 0 22px ${color}` }}
    >
      {text}
    </span>
  </span>
);

// ---------------------------------------------------------------------------
// Holographic readout: two rows (hello / hellO) decoding character by character.
// ---------------------------------------------------------------------------
const HexRow: React.FC<{
  hash: string;
  start: number;
  color: string;
  seed: string;
  glitch: number;
  y: number;
}> = ({ hash, start, color, seed, glitch, y }) => {
  const frame = useCurrentFrame();
  if (frame < start - 14) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: HEX_X - PANEL.x,
        top: y - PANEL.y - 62,
        height: 124,
        display: "flex",
        fontFamily: MONO,
        fontWeight: 700,
        fontSize: 96,
        lineHeight: "124px",
      }}
    >
      {Array.from({ length: SHOWN + 1 }, (_, i) => {
        if (i === SHOWN) {
          const on = frame > start + SHOWN * 3;
          return (
            <span
              key={i}
              style={{
                width: 70,
                color: C.muted,
                opacity: on ? 1 : 0,
                fontSize: 70,
              }}
            >
              …
            </span>
          );
        }
        const lock = start + i * 3;
        const locked = frame >= lock;
        const ch = locked
          ? hash[i]
          : HEX[Math.floor(random(`${seed}${i}${Math.floor(frame / 2)}`) * 16)];
        const since = frame - lock;
        const flash = locked ? interpolate(since, [0, 7], [1, 0], clamp) : 0;
        const rise = locked
          ? interpolate(since, [0, 6], [1.35, 1], {
              ...clamp,
              easing: Easing.out(Easing.back(2)),
            })
          : 1;
        const jitterY = locked
          ? 0
          : (random(`${seed}j${i}${frame}`) - 0.5) * 14;
        const c = locked ? color : C.muted;
        return (
          <span
            key={i}
            style={{
              width: CH_W,
              textAlign: "center",
              display: "inline-block",
              transform: `translateY(${jitterY}px) scale(${rise})`,
              opacity: locked ? 1 : 0.55,
            }}
          >
            {glitch > 0.05 && locked ? (
              <RgbText
                text={ch}
                color={c}
                split={glitch * 18 * (random(`${seed}g${i}${frame}`) - 0.3)}
              />
            ) : (
              <span
                style={{
                  color: flash > 0.5 ? "#ffffff" : c,
                  textShadow: `0 0 ${12 + 30 * flash}px ${c}`,
                }}
              >
                {ch}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
};

const Readout: React.FC<{ power: number; glitch: number; compare: number }> = ({
  power,
  glitch,
  compare,
}) => {
  const frame = useCurrentFrame();
  const rowB = interpolate(
    frame,
    [T.decodeB - 22, T.decodeB - 10],
    [0, 1],
    clamp,
  );
  const labelA = interpolate(frame, [T.labelA, T.labelA + 8], [0, 1], clamp);
  const flicker = power < 1 ? (random(`pf${frame}`) > 0.3 ? 1 : 0.3) : 1;
  const corner = (l: boolean, t: boolean): React.CSSProperties => ({
    position: "absolute",
    width: 46,
    height: 46,
    [l ? "left" : "right"]: -6,
    [t ? "top" : "bottom"]: -6,
    borderColor: C.file,
    borderStyle: "solid",
    borderWidth: 0,
    [l ? "borderLeftWidth" : "borderRightWidth"]: 6,
    [t ? "borderTopWidth" : "borderBottomWidth"]: 6,
    filter: `drop-shadow(0 0 8px ${C.file})`,
  });
  const label = (
    text: string,
    input: string,
    col: string,
    op: number,
    y: number,
  ) => (
    <div
      style={{
        position: "absolute",
        left: HEX_X - PANEL.x,
        top: y - PANEL.y - 112,
        fontFamily: FONT,
        fontSize: 38,
        color: C.muted,
        opacity: op,
        display: "flex",
        gap: 14,
        alignItems: "baseline",
      }}
    >
      <span style={{ fontFamily: MONO, color: col, fontWeight: 700 }}>
        {input}
      </span>
      <span>{text}</span>
    </div>
  );
  return (
    <div
      style={{
        position: "absolute",
        left: PANEL.x,
        top: PANEL.y,
        width: PANEL.w,
        height: PANEL.h,
        opacity: power * flicker,
        transform: `perspective(1400px) rotateY(${12 * (1 - compare)}deg) scaleY(${0.2 + 0.8 * power})`,
        transformOrigin: "left center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,229,255,0.12), rgba(10,2,24,0.78) 30%, rgba(10,2,24,0.78) 70%, rgba(255,43,214,0.12))",
          border: "1.5px solid rgba(0,229,255,0.5)",
          boxShadow: "0 0 40px rgba(0,229,255,0.25)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, rgba(0,229,255,0.07) 0px, rgba(0,229,255,0.07) 2px, transparent 2px, transparent 5px)",
          backgroundPosition: `0 ${-frame * 2}px`,
        }}
      />
      <div style={corner(true, true)} />
      <div style={corner(false, true)} />
      <div style={corner(true, false)} />
      <div style={corner(false, false)} />
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 22,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 36,
          letterSpacing: 6,
          color: C.file,
          textShadow: `0 0 14px ${C.file}`,
        }}
      >
        FINGERPRINT
      </div>
      {label("→ hash", '"hello"', C.text, labelA, ROW_Y[0])}
      <HexRow
        hash={HASH_A}
        start={T.decodeA}
        color="#ffd9f7"
        seed="ra"
        glitch={0}
        y={ROW_Y[0]}
      />
      {label("→ hash", '"hellO"', C.changed, rowB, ROW_Y[1])}
      <HexRow
        hash={HASH_B}
        start={T.decodeB}
        color={C.changed}
        seed="rb"
        glitch={glitch}
        y={ROW_Y[1]}
      />
      {/* compare: every column differs */}
      {Array.from({ length: SHOWN }, (_, i) => {
        const p = interpolate(
          frame,
          [T.compare + i * 2.5, T.compare + i * 2.5 + 8],
          [0, 1],
          {
            ...clamp,
            easing: Easing.out(Easing.back(3)),
          },
        );
        if (p <= 0) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: HEX_X - PANEL.x + CH_W * i,
              width: CH_W,
              top: ROW_Y[1] - PANEL.y + 58,
              textAlign: "center",
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 48,
              color: C.changed,
              textShadow: `0 0 14px ${C.changed}`,
              transform: `scale(${p})`,
            }}
          >
            ≠
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------

export const V2Scene03Fingerprint: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const glitch = glitchAt(frame);
  const g1 = frame >= T.glitch1 ? 1 : 0;

  // Camera: slow push in, a kick on each glitch, then drift toward the readout.
  const push = interpolate(frame, [0, T.compare], [1.08, 1.0], {
    ...clamp,
    easing: ease,
  });
  const toReadout = interpolate(
    frame,
    [T.compare - 6, T.compare + 40],
    [0, 1],
    { ...clamp, easing: ease },
  );
  const zoom = push + 0.06 * toReadout + 0.03 * glitch;
  const camX = -150 * toReadout;
  const shake = glitch * 22;
  const sx = (random(`shx${frame}`) - 0.5) * shake;
  const sy = (random(`shy${frame}`) - 0.5) * shake;

  // Gate power-on (neon sign flicker).
  const gateOn = interpolate(frame, [4, 22], [0, 1], clamp);
  const gateFlick =
    gateOn < 1 ? (random(`gf${frame}`) > 0.4 ? gateOn : gateOn * 0.25) : 1;
  const heat = frame >= T.passB[0] - 4 ? 1 : 0;

  // Card A
  const inSpring = spring({
    frame: frame - T.cardIn,
    fps,
    config: { damping: 16, mass: 0.8 },
  });
  const leftA =
    frame < T.passA[0]
      ? interpolate(inSpring, [0, 1], [-420, CARD.x0])
      : cardLeft(frame, T.passA);
  // Card B
  const printB = interpolate(frame, [T.cardB, T.cardB + 14], [0, 1], {
    ...clamp,
    easing: ease,
  });
  const leftB = cardLeft(frame, T.passB);

  const cutA = frame >= CROSS_A[0] && frame <= CROSS_A[1] ? 1 : 0;
  const cutB = frame >= CROSS_B[0] && frame <= CROSS_B[1] ? 1 : 0;
  const cut = Math.max(cutA, cutB);

  // Reticle locking onto the last letter of card B.
  const letterX = CARD.x0 + CARD.w / 2 + 2 * 64.6; // centre of the 5th char (64.6 px per char)
  const letterY = CARD.y + 120 + 62;
  const ret = interpolate(frame, [T.reticle[0], T.reticle[1]], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const retOp =
    interpolate(frame, [T.reticle[0], T.reticle[0] + 4], [0, 1], clamp) *
    interpolate(frame, [T.glitch1 + 10, T.glitch1 + 18], [1, 0], clamp);
  const retSize = interpolate(ret, [0, 1], [260, 92]);
  const retRot = interpolate(ret, [0, 1], [90, 0]);
  const shock = interpolate(frame, [T.glitch1, T.glitch1 + 16], [0, 1], clamp);

  const panelPower = interpolate(
    frame,
    [T.decodeA - 26, T.decodeA - 14],
    [0, 1],
    { ...clamp, easing: ease },
  );
  const compare = interpolate(frame, [T.compare - 6, T.compare + 30], [0, 1], {
    ...clamp,
    easing: ease,
  });

  const fade =
    interpolate(frame, [0, 9], [1, 0], clamp) +
    interpolate(frame, [T.end - 9, T.end], [0, 1], clamp);

  const caption = interpolate(frame, [T.compare + 22, T.compare + 34], [0, 1], {
    ...clamp,
    easing: ease,
  });

  const filterOn = glitch > 0.04;
  const split = Math.round(glitch * 18);

  return (
    <AbsoluteFill style={{ backgroundColor: C.skyTop, overflow: "hidden" }}>
      <Sequence from={AUDIO_DELAY} layout="none">
        <Audio src={staticFile("scene03.wav")} />
      </Sequence>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <filter
            id="s3-glitch"
            x="-5%"
            y="-5%"
            width="110%"
            height="110%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.00001 0.045"
              numOctaves={1}
              seed={Math.floor(frame / 2)}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={glitch * 70}
              xChannelSelector="R"
              yChannelSelector="B"
              result="d"
            />
            <feColorMatrix
              in="d"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="r"
            />
            <feOffset in="r" dx={split} result="ro" />
            <feColorMatrix
              in="d"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="g"
            />
            <feColorMatrix
              in="d"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="b"
            />
            <feOffset in="b" dx={-split} result="bo" />
            <feBlend in="ro" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="bo" mode="screen" />
          </filter>
        </defs>
      </svg>

      <AbsoluteFill
        style={{
          filter: filterOn ? "url(#s3-glitch)" : undefined,
          transform: `translate(${sx}px, ${sy}px)`,
        }}
      >
        <AbsoluteFill
          style={{
            transform: `translate(${camX * 0.4}px, 0px) scale(${1 + (zoom - 1) * 0.5})`,
          }}
        >
          <NeonBackground
            cam={{ x: camX, y: 0, zoom: 1 }}
            speed={1.2 + 3 * glitch}
            horizonY={600}
          />
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            transform: `translate(${camX}px, 0px) scale(${zoom})`,
            transformOrigin: "50% 50%",
          }}
        >
          {/* back half of the gate + floor glow */}
          <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute" }}>
            <NeonDefs />
            <ellipse
              cx={GX}
              cy={GY + RY + 20}
              rx={260}
              ry={46}
              fill={heat ? C.changed : C.hash}
              opacity={0.3 * gateFlick}
              filter="url(#neon-wide)"
            />
            <ellipse
              cx={GX}
              cy={GY + RY + 20}
              rx={170}
              ry={28}
              fill="none"
              stroke={C.file}
              strokeWidth={3}
              opacity={0.7 * gateFlick}
              filter="url(#neon)"
            />
            <GateHalf side="back" power={gateFlick} heat={heat} />
            {/* card shadow streak on the floor */}
          </svg>

          {/* the file cards */}
          {frame < T.passA[1] + 2 ? (
            <FileCard
              left={leftA}
              top={CARD.y}
              opacity={1}
              text="hello"
              changedIdx={-1}
              printIn={1}
              glitch={0}
              tint={C.file}
            />
          ) : null}
          {frame >= T.cardB ? (
            <FileCard
              left={leftB}
              top={CARD.y}
              opacity={1}
              text={g1 ? "hellO" : "hello"}
              changedIdx={g1 ? 4 : -1}
              printIn={printB}
              glitch={glitch}
              tint={g1 ? C.changed : C.file}
            />
          ) : null}

          {/* laser, front half of the gate, sparks, glyph streams */}
          <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute" }}>
            <LaserSheet power={gateFlick} cut={cut} heat={heat} />
            <GateHalf side="front" power={gateFlick} heat={heat} />
            <Sparks cut={cutA} seed="spA" heat={0} />
            <Sparks cut={cutB} seed="spB" heat={1} />
            <GlyphStream cross={CROSS_A} row={0} color={C.hash} seed="gA" />
            <GlyphStream cross={CROSS_B} row={1} color={C.changed} seed="gB" />

            {/* reticle on the letter */}
            {retOp > 0 ? (
              <g
                transform={`translate(${letterX} ${letterY}) rotate(${retRot})`}
                opacity={retOp}
                stroke={C.changed}
                strokeWidth={5}
                fill="none"
                filter="url(#neon)"
              >
                {[0, 90, 180, 270].map((a) => (
                  <path
                    key={a}
                    transform={`rotate(${a})`}
                    d={`M ${-retSize / 2} ${-retSize / 2 + 26} V ${-retSize / 2} H ${-retSize / 2 + 26}`}
                  />
                ))}
                <circle r={6} fill={C.changed} />
              </g>
            ) : null}
            {shock > 0 && shock < 1 ? (
              <circle
                cx={letterX}
                cy={letterY}
                r={40 + 380 * shock}
                fill="none"
                stroke={C.changed}
                strokeWidth={10 * (1 - shock)}
                opacity={1 - shock}
                filter="url(#neon)"
              />
            ) : null}
          </svg>

          {/* gate sign */}
          <div
            style={{
              position: "absolute",
              left: GX - 200,
              width: 400,
              top: GY - RY - 92,
              textAlign: "center",
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 54,
              letterSpacing: 8,
              color: heat ? C.changed : C.hash,
              opacity: gateFlick,
              textShadow: `0 0 10px ${heat ? C.changed : C.hash}, 0 0 34px ${heat ? C.changed : C.hash}`,
            }}
          >
            SHA-256
          </div>

          <Readout power={panelPower} glitch={glitch} compare={compare} />
        </AbsoluteFill>

        {/* hit flash */}
        <AbsoluteFill
          style={{
            backgroundColor: C.changed,
            opacity: glitch * 0.1,
            mixBlendMode: "screen",
          }}
        />
        {/* glitch scan bars */}
        {glitch > 0.05
          ? Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: random(`bar${i}${Math.floor(frame / 2)}`) * HEIGHT,
                  height: 4 + random(`bh${i}${frame}`) * 26,
                  background: i % 2 ? C.file : C.changed,
                  opacity: glitch * 0.35,
                  mixBlendMode: "screen",
                }}
              />
            ))
          : null}
      </AbsoluteFill>

      {/* caption */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 70,
          textAlign: "center",
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 52,
          color: C.text,
          opacity: caption,
          transform: `translateY(${(1 - caption) * 24}px)`,
          textShadow: "0 0 18px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.9)",
        }}
      >
        1 letter changed →{" "}
        <span style={{ color: C.changed }}>
          a totally different fingerprint
        </span>
      </div>

      <AbsoluteFill
        style={{
          backgroundColor: C.skyTop,
          opacity: fade,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
