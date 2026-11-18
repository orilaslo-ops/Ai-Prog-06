import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  C,
  Cam,
  clamp,
  FONT,
  FPS,
  HEIGHT,
  iso,
  MONO,
  NeonBackground,
  NeonDefs,
  Tower,
  WIDTH,
} from "./kit";

// Scene 2 (8 s): "Say you and a friend each have a million files. Are they identical?
// Sending every file to compare would take forever."
// Two neon cities far apart: YOU and FRIEND. The camera starts in your city, whips
// along a light highway to your friend's, then pulls out wide while a million-tower
// skyline floods in behind each. "IDENTICAL?" flickers over the highway. Then files
// start crawling across the highway one by one while a giant billboard counter crawls
// 1… 2… 3… of 1,000,000 and the ETA gets hilariously worse, until the city browns
// out as a huge buzzing neon "FOREVER" slams on.

// Beats (seconds), from silencedetect on public/scene02.wav and version 1's timings.
const T = {
  you: 0.15, // "Say you…"
  friend: 0.85, // "…and a friend…"
  million: 1.75, // "…a million files."
  same: 3.28, // "Are they identical?"
  send: 4.52, // "Sending every file…"
  forever: 6.35, // "…forever."
  end: 8,
};

const SQ3 = 1.732;
const CITY_DX = 620; // screen distance of each city centre from the middle
const ROAD_DX = 360; // highway gates, screen offset
const SEND_EVERY = 0.5;
const ROAD_W = 44; // highway half-width (world units) // a file leaves the gate this often
const CRAWL_S = 2.8; // seconds for one file to cross the highway

const ease = Easing.inOut(Easing.cubic);
const kf = (t: number, ts: number[], vs: number[]): number =>
  interpolate(t, ts, vs, { ...clamp, easing: ease });

// Neon tube that buzzes on: dark, stuttering flashes, then steady with rare dropouts.
const buzz = (t: number, start: number, seed: string): number => {
  if (t < start) return 0;
  const f = Math.floor((t - start) * FPS);
  if (f < 11) return random(`${seed}${f}`) > 0.45 ? 1 : 0.12;
  return random(`${seed}d${Math.floor(t * FPS)}`) > 0.97 ? 0.35 : 1;
};

// World positions along the highway line x = -y (horizontal on screen).
const lineXY = (dx: number) => ({ x: dx / SQ3, y: -dx / SQ3 });

type CityTower = { x: number; y: number; h: number; u: number; k: string };
const makeCity = (side: number): CityTower[] => {
  const c = lineXY(side * CITY_DX);
  const out: CityTower[] = [];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const k = `${side}-${i}-${j}`;
      // keep the lane into the city clear where the highway arrives
      const sx = (i - j) * side;
      if (i + j === 3 && sx === -3) continue;
      out.push({
        x: c.x + (i - 1.5) * 85 - 20,
        y: c.y + (j - 1.5) * 85 - 20,
        h: 90 + random(`h${k}`) * 230,
        u: (i + j - 3) * 85,
        k,
      });
    }
  return out.sort((a, b) => a.u - b.u);
};
const CITIES = [makeCity(-1), makeCity(1)];

// The "million": a dense skyline of thin towers behind each city.
type Bar = { s: number; d: number; h: number; w: number; delay: number };
const SKY: Bar[][] = [-1, 1].map((side) =>
  Array.from({ length: 70 }, (_, i) => {
    const s = (random(`bs${side}${i}`) - 0.5) * 760;
    return {
      s,
      d: -250 - random(`bd${side}${i}`) * 260,
      h: 60 + random(`bh${side}${i}`) ** 1.5 * 360,
      w: 10 + random(`bw${side}${i}`) * 16,
      delay: (Math.abs(s) / 380) * 0.55 + random(`bt${side}${i}`) * 0.2,
    };
  }).sort((a, b) => a.d - b.d),
);

const ETA = [
  "2 minutes",
  "1 hour",
  "9 hours",
  "4 days",
  "7 weeks",
  "3 years",
  "60 years",
  "900 years",
  "41,000 years",
];

// Neon text drawn in SVG: wide glow + tube + white core.
const NeonText: React.FC<{
  x: number;
  y: number;
  size: number;
  color: string;
  children: string;
  opacity?: number;
  spacing?: number;
  family?: string;
}> = ({ x, y, size, color, children, opacity = 1, spacing = 4, family }) => {
  const common = {
    x,
    y,
    fontSize: size,
    fontFamily: family ?? FONT,
    fontWeight: 900,
    textAnchor: "middle" as const,
    letterSpacing: spacing,
  };
  return (
    <g opacity={opacity}>
      <text {...common} fill={color} opacity={0.6} filter="url(#neon-wide)">
        {children}
      </text>
      <text
        {...common}
        fill="none"
        stroke={color}
        strokeWidth={size / 14}
        filter="url(#neon)"
      >
        {children}
      </text>
      <text {...common} fill="#ffffff" opacity={0.9}>
        {children}
      </text>
    </g>
  );
};

export const V2Scene02Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;

  // ---- camera: close on YOU, whip along the highway to FRIEND, pull out wide ----
  const focusDx = kf(t, [0, 0.7, 1.45, 2.5], [-CITY_DX, -CITY_DX, CITY_DX, 0]);
  const zoom = kf(
    t,
    [0, 0.7, 1.45, 2.6, 4.4, 6.3, 8],
    [1.45, 1.38, 1.38, 0.9, 0.9, 0.97, 1.0],
  );
  const focusZ = kf(t, [0, 1.45, 2.6], [200, 200, 0]);
  const targetY = kf(t, [0, 1.45, 2.6, 6.3, 8], [660, 660, 880, 900, 905]);
  const shake =
    t > T.forever
      ? Math.sin((t - T.forever) * 55) *
        Math.max(0, 1 - (t - T.forever) * 3) *
        14
      : 0;
  const cam: Cam = {
    x: -focusDx * zoom + shake,
    y: targetY - HEIGHT * 0.74 + focusZ * zoom + shake * 0.5,
    zoom,
  };

  // power brownout when the FOREVER sign draws all the current
  const power =
    t < T.forever
      ? 1
      : interpolate(
          t,
          [T.forever, T.forever + 0.12, T.forever + 0.9],
          [1, 0.35, 0.6],
          clamp,
        );

  // ---- files on the highway ----
  const sent = t < T.send ? 0 : Math.floor((t - T.send) / SEND_EVERY) + 1;
  const files = Array.from({ length: sent }, (_, k) => {
    const age = t - (T.send + k * SEND_EVERY);
    const p = Math.min(1, age / CRAWL_S);
    const dx = -ROAD_DX + p * 2 * ROAD_DX;
    return { k, dx, age, p };
  });
  const lastLeave = T.send + (sent - 1) * SEND_EVERY;
  const counterPop = sent > 0 ? Math.max(0, 1 - (t - lastLeave) * 5) : 0;
  const etaIdx = Math.min(
    ETA.length - 1,
    Math.max(0, Math.floor((t - T.send - 0.15) / 0.2)),
  );

  const road = (dx: number, a: number, z = 0) => {
    const p = lineXY(dx);
    return iso(p.x + a, p.y + a, z, cam);
  };
  const roadPoly = [
    road(-ROAD_DX - 40, -ROAD_W),
    road(ROAD_DX + 40, -ROAD_W),
    road(ROAD_DX + 40, ROAD_W),
    road(-ROAD_DX - 40, ROAD_W),
  ];
  const dashOff = (t * 30) % 40;

  // ---- signs / holograms anchored in the world ----
  const youSign = buzz(t, T.you, "you");
  const friendSign = buzz(t, T.friend, "fr");
  const million = interpolate(t, [T.million, T.million + 0.8], [0, 1], clamp);
  const millionCount = Math.round(
    interpolate(t, [T.million, T.million + 0.8], [0, 1_000_000], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    }),
  );
  const sameOn = t < T.send - 0.05 ? buzz(t, T.same, "same") : 0;
  const boardOn = buzz(t, T.send - 0.08, "board");
  const mid = iso(0, 0, 440, cam);
  const z = cam.zoom;

  const foreverOn = buzz(t, T.forever, "forever");
  const foreverScale = interpolate(
    t,
    [T.forever, T.forever + 0.18],
    [1.25, 1],
    {
      ...clamp,
      easing: Easing.out(Easing.back(2)),
    },
  );

  const fade = interpolate(
    frame,
    [0, 9, T.end * FPS - 9, T.end * FPS],
    [0, 1, 1, 0],
    clamp,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: C.skyTop }}>
      <Audio src={staticFile("scene02.wav")} />
      <AbsoluteFill style={{ opacity: fade }}>
        <AbsoluteFill style={{ opacity: 0.4 + 0.6 * power }}>
          <NeonBackground cam={cam} speed={t < T.send ? 0.6 : 0.15} />
        </AbsoluteFill>
        <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute" }}>
          <NeonDefs />
          <g opacity={0.35 + 0.65 * power}>
            {/* the million: dense skyline flooding in behind each city */}
            {SKY.map((bars, ci) => {
              const c = lineXY((ci === 0 ? -1 : 1) * CITY_DX);
              return (
                <g key={`sky${ci}`}>
                  {bars.map((b, i) => {
                    const g = interpolate(
                      t,
                      [T.million + b.delay, T.million + b.delay + 0.35],
                      [0, 1],
                      { ...clamp, easing: Easing.out(Easing.back(1.6)) },
                    );
                    if (g <= 0) return null;
                    const base = iso(
                      c.x + b.s / SQ3 + b.d / 2,
                      c.y - b.s / SQ3 + b.d / 2,
                      0,
                      cam,
                    );
                    const h = b.h * g * z;
                    const w = b.w * z;
                    return (
                      <g key={i}>
                        <rect
                          x={base.sx - w / 2}
                          y={base.sy - h}
                          width={w}
                          height={h}
                          fill="#0d0826"
                          stroke={C.file}
                          strokeOpacity={0.35}
                          strokeWidth={1.2}
                        />
                        <line
                          x1={base.sx - w / 2}
                          x2={base.sx + w / 2}
                          y1={base.sy - h}
                          y2={base.sy - h}
                          stroke={i % 7 === 0 ? C.hash : C.file}
                          strokeWidth={2.5}
                          opacity={0.9}
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* back halves of both cities */}
            {CITIES.map((city, ci) =>
              city
                .filter((tw) => tw.u < 0)
                .map((tw) => (
                  <Tower
                    key={tw.k}
                    x={tw.x}
                    y={tw.y}
                    w={40}
                    d={40}
                    h={tw.h}
                    cam={cam}
                    seed={tw.k}
                    glow={ci === 0 ? 0.55 : 0.5}
                  />
                )),
            )}

            {/* the light highway */}
            <polygon
              points={roadPoly.map((q) => `${q.sx},${q.sy}`).join(" ")}
              fill="#140a33"
              opacity={0.9}
            />
            {/* edges: no SVG filter (a flat line has a zero-height filter box) */}
            {[-ROAD_W, ROAD_W].map((a) => {
              const p = road(-ROAD_DX - 40, a);
              const q = road(ROAD_DX + 40, a);
              return (
                <g key={a}>
                  {[14, 7, 3].map((w, i) => (
                    <line
                      key={w}
                      x1={p.sx}
                      y1={p.sy}
                      x2={q.sx}
                      y2={q.sy}
                      stroke={i === 2 ? "#e9fdff" : C.file}
                      strokeWidth={w * z}
                      opacity={[0.15, 0.4, 1][i]}
                      strokeLinecap="round"
                    />
                  ))}
                </g>
              );
            })}
            {(() => {
              const p = road(-ROAD_DX - 40, 0);
              const q = road(ROAD_DX + 40, 0);
              return (
                <line
                  x1={p.sx}
                  y1={p.sy}
                  x2={q.sx}
                  y2={q.sy}
                  stroke={C.hash}
                  strokeWidth={2.5}
                  strokeDasharray={`${18 * z} ${22 * z}`}
                  strokeDashoffset={-dashOff * z}
                  opacity={0.8}
                />
              );
            })()}
            {/* gates at both ends */}
            {[-1, 1].map((side) => {
              const a = road(side * ROAD_DX, -ROAD_W - 12);
              const b = road(side * ROAD_DX, ROAD_W + 12);
              const a2 = road(side * ROAD_DX, -ROAD_W - 12, 110);
              const b2 = road(side * ROAD_DX, ROAD_W + 12, 110);
              const flash =
                side === -1 && sent > 0
                  ? Math.max(0, 1 - (t - lastLeave) * 4)
                  : 0;
              return (
                <g
                  key={`gate${side}`}
                  stroke={side === -1 ? C.file : C.hash}
                  strokeWidth={3 + flash * 4}
                  fill="none"
                  filter="url(#neon)"
                >
                  <polyline
                    points={`${a.sx},${a.sy} ${a2.sx},${a2.sy} ${b2.sx},${b2.sy} ${b.sx},${b.sy}`}
                  />
                </g>
              );
            })}

            {/* files crawling across, one by one */}
            {files.map((f) => {
              const p = lineXY(f.dx);
              const trailA = road(Math.max(-ROAD_DX, f.dx - 90), 0, 10);
              const trailB = road(f.dx, 0, 10);
              const bob = Math.abs(Math.sin(f.age * 9 + f.k)) * 4;
              return (
                <g key={`f${f.k}`} opacity={f.p >= 1 ? 0 : 1}>
                  <line
                    x1={trailA.sx}
                    y1={trailA.sy}
                    x2={trailB.sx}
                    y2={trailB.sy}
                    stroke={C.file}
                    strokeWidth={18 * z}
                    opacity={0.5}
                    filter="url(#neon-wide)"
                  />
                  <g transform={`translate(0 ${-bob * z})`}>
                    <Tower
                      x={p.x - 18}
                      y={p.y - 18}
                      w={36}
                      d={36}
                      h={42}
                      cam={cam}
                      glow={1}
                      windows={false}
                    />
                  </g>
                </g>
              );
            })}

            {/* front halves of both cities */}
            {CITIES.map((city, ci) =>
              city
                .filter((tw) => tw.u >= 0)
                .map((tw) => (
                  <Tower
                    key={tw.k}
                    x={tw.x}
                    y={tw.y}
                    w={40}
                    d={40}
                    h={tw.h}
                    cam={cam}
                    seed={tw.k}
                    glow={ci === 0 ? 0.55 : 0.5}
                  />
                )),
            )}
          </g>

          {/* city signs and million labels */}
          {[-1, 1].map((side) => {
            const c = lineXY(side * CITY_DX);
            const top = iso(c.x - 150, c.y - 150, 370, cam);
            const lab = iso(c.x - 150, c.y - 150, 470, cam);
            const on = side === -1 ? youSign : friendSign;
            return (
              <g key={`sign${side}`}>
                <NeonText
                  x={top.sx}
                  y={top.sy}
                  size={78 * z}
                  color={side === -1 ? C.file : C.hash}
                  opacity={on * (0.5 + 0.5 * power)}
                  spacing={10 * z}
                >
                  {side === -1 ? "YOU" : "FRIEND"}
                </NeonText>
                <g opacity={million}>
                  <text
                    x={lab.sx}
                    y={lab.sy}
                    fontSize={52 * z}
                    fontFamily={MONO}
                    fontWeight={800}
                    fill={C.text}
                    textAnchor="middle"
                    filter="url(#neon)"
                  >
                    {millionCount.toLocaleString("en-US")} files
                  </text>
                </g>
              </g>
            );
          })}

          {/* zzz: your friend dozes off waiting */}
          {t > 5.4
            ? [0, 1, 2].map((i) => {
                const c = lineXY(CITY_DX);
                const p = iso(c.x - 100, c.y - 100, 250, cam);
                const age = (t - 5.4 - i * 0.45) % 1.35;
                if (t - 5.4 - i * 0.45 < 0) return null;
                return (
                  <text
                    key={`z${i}`}
                    x={p.sx + (170 + age * 60) * z}
                    y={p.sy - age * 120 * z}
                    fontSize={(54 + age * 40) * z}
                    fontFamily={FONT}
                    fontWeight={900}
                    fill={C.hash}
                    opacity={Math.sin((age / 1.35) * Math.PI) * power}
                    filter="url(#neon)"
                  >
                    z
                  </text>
                );
              })
            : null}

          {/* "IDENTICAL?" hologram over the highway */}
          {sameOn > 0 ? (
            <g transform={`translate(${mid.sx} ${mid.sy}) scale(${z})`}>
              <NeonText
                x={0}
                y={20}
                size={118}
                color={C.hash}
                opacity={sameOn}
                spacing={8}
              >
                IDENTICAL?
              </NeonText>
              {[-1, 1].map((s) => (
                <line
                  key={s}
                  x1={s * 420}
                  y1={-10}
                  x2={s * 640}
                  y2={110}
                  stroke={C.hash}
                  strokeWidth={4}
                  strokeDasharray="14 14"
                  strokeDashoffset={t * 60 * s}
                  opacity={sameOn * 0.8}
                  filter="url(#neon)"
                />
              ))}
            </g>
          ) : null}

          {/* the billboard counter */}
          {boardOn > 0 ? (
            <g
              transform={`translate(${mid.sx} ${mid.sy}) scale(${z})`}
              opacity={boardOn * (0.55 + 0.45 * power)}
            >
              {[-260, 260].map((x) => (
                <line
                  key={x}
                  x1={x}
                  y1={160}
                  x2={x}
                  y2={440}
                  stroke={C.muted}
                  strokeWidth={6}
                  opacity={0.6}
                />
              ))}
              <rect
                x={-400}
                y={-170}
                width={800}
                height={330}
                rx={18}
                fill="#0a0420"
                opacity={0.88}
              />
              <rect
                x={-400}
                y={-170}
                width={800}
                height={330}
                rx={18}
                fill="none"
                stroke={C.hash}
                strokeWidth={5}
                filter="url(#neon)"
              />
              <text
                x={0}
                y={-108}
                fontSize={38}
                fontFamily={FONT}
                fontWeight={800}
                letterSpacing={8}
                fill={C.muted}
                textAnchor="middle"
              >
                FILES SENT
              </text>
              <g transform={`translate(0 -22) scale(${1 + counterPop * 0.12})`}>
                <text
                  x={0}
                  y={30}
                  fontSize={92}
                  fontFamily={MONO}
                  fontWeight={900}
                  textAnchor="middle"
                  fill={C.file}
                  filter="url(#neon)"
                >
                  <tspan fill={counterPop > 0.5 ? "#ffffff" : C.file}>
                    {sent.toLocaleString("en-US")}
                  </tspan>
                  <tspan fill={C.muted} fontSize={64}>
                    {" / 1,000,000"}
                  </tspan>
                </text>
              </g>
              {/* progress bar: microscopic fill */}
              <rect
                x={-360}
                y={46}
                width={720}
                height={18}
                rx={9}
                fill="none"
                stroke={C.muted}
                strokeWidth={2}
              />
              <rect
                x={-360}
                y={46}
                width={Math.max(0, sent) * 0.8}
                height={18}
                rx={4}
                fill={C.match}
                filter="url(#neon)"
              />
              <text
                x={0}
                y={122}
                fontSize={44}
                fontFamily={MONO}
                fontWeight={800}
                textAnchor="middle"
                fill={t > T.forever ? C.changed : C.root}
              >
                {"ETA: "}
                {t > T.forever ? "∞" : ETA[etaIdx]}
              </text>
            </g>
          ) : null}
        </svg>

        {/* FOREVER: buzzing neon, with one bad tube */}
        {foreverOn > 0 ? (
          <AbsoluteFill
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 560,
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 900,
                fontSize: 230,
                letterSpacing: 26,
                transform: `scale(${foreverScale}) rotate(-4deg)`,
                opacity: foreverOn,
                display: "flex",
              }}
            >
              {"FOREVER".split("").map((ch, i) => {
                const bad =
                  i === 5 &&
                  t > T.forever + 0.6 &&
                  random(`bad${Math.floor(t * 12)}`) > 0.55;
                const col = i < 4 ? C.hash : C.changed;
                return (
                  <span
                    key={i}
                    style={{
                      color: bad ? "#3a0a2a" : "#fff2fb",
                      textShadow: bad
                        ? "none"
                        : `0 0 6px ${col}, 0 0 18px ${col}, 0 0 44px ${col}, 0 0 90px ${col}, 0 0 160px ${col}`,
                      WebkitTextStroke: bad ? `2px ${col}55` : `3px ${col}`,
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
          </AbsoluteFill>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
