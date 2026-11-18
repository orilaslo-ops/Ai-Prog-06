import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  interpolateColors,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Beacon,
  Beam,
  buildTree,
  C,
  Cam,
  clamp,
  DEFAULT_CAM,
  FONT,
  HEIGHT,
  Hub,
  iso,
  MONO,
  NeonBackground,
  NeonDefs,
  Tower,
  TOWER_H,
  towerPos,
  TreeNode,
  WIDTH,
} from "./kit";

// Scene 5 (10 s), "one file changes". It opens on the exact finished city from
// KitPreview (scene 4 ends there). Tower 6 glitches and turns hot red, its hash
// hologram scrambles, then a red energy surge races up each bridge with the camera
// riding along: every hub it hits turns red with an impact, and finally the gold
// beacon turns red with a shockwave that rolls across the whole city. The camera
// pulls back to show the red path from one file to the root; the rest stays blue.
// Narration: "Now change one file. Its hash changes, so its parent changes, and the
// change climbs all the way to the root."

const T = buildTree();
const CHANGED = 5; // tower 6 (index 5)
// The path from the changed tower to the root: level 0 (tower top) ... level 3.
const PATH: TreeNode[] = T.map((lvl, level) => lvl[CHANGED >> level]);

// Seconds, measured from public/scene05.wav (pauses at 1.34-1.85, 2.95-3.16,
// 4.40-4.73, speech ends 6.78).
const EDIT = 0.95; // "change one file"
const HASH = 2.25; // "its hash changes"
const ARRIVE = [3.7, 5.3, 6.4]; // "parent", "climbs", "root"
const SURGE = [0.6, 0.55, 0.5]; // seconds each surge takes up its bridge
const PULLBACK = [6.75, 8.1];

const OLD_HASH = "3fa9c1";
const NEW_HASH = "e04b7d";
const HEX = "0123456789abcdef";

type V3 = [number, number, number];
const v3 = (n: TreeNode): V3 => [n.x, n.y, n.z];
const lerp3 = (a: V3, b: V3, p: number): V3 => [
  a[0] + (b[0] - a[0]) * p,
  a[1] + (b[1] - a[1]) * p,
  a[2] + (b[2] - a[2]) * p,
];

// The camera that puts world point `p` at screen (WIDTH / 2, ay) with `zoom`.
const camOn = (p: V3, zoom: number, ay: number): Cam => ({
  x: -(p[0] - p[1]) * 0.866 * zoom,
  y: ay - HEIGHT * 0.74 - ((p[0] + p[1]) * 0.5 - p[2]) * zoom,
  zoom,
});
const mixCam = (a: Cam, b: Cam, w: number): Cam => ({
  x: a.x + (b.x - a.x) * w,
  y: a.y + (b.y - a.y) * w,
  zoom: a.zoom + (b.zoom - a.zoom) * w,
});

// A red version of the kit's Beacon (the kit's core gradient is always gold).
const RedBeacon: React.FC<{ p: V3; cam: Cam; boost: number }> = ({
  p,
  cam,
  boost,
}) => {
  const frame = useCurrentFrame();
  const c = iso(p[0], p[1], p[2], cam);
  const pulse = 1 + 0.1 * Math.sin(frame / 4);
  const r = 34 * cam.zoom * pulse * (1 + boost);
  return (
    <g>
      <rect
        x={c.sx - 10 - 30 * boost}
        y={0}
        width={20 + 60 * boost}
        height={c.sy}
        fill={C.changed}
        opacity={0.45}
        filter="url(#neon-wide)"
      />
      <rect
        x={c.sx - 2}
        y={0}
        width={4}
        height={c.sy}
        fill="#ffd0d8"
        opacity={0.7}
      />
      <circle cx={c.sx} cy={c.sy} r={r * 3} fill="url(#beacon-red)" />
      <circle cx={c.sx} cy={c.sy} r={r} fill="url(#beacon-red)" />
      <circle cx={c.sx} cy={c.sy} r={r * 0.45} fill="#ffffff" />
    </g>
  );
};

// A burst of sparks from screen point (x, y) starting at time t0.
const Sparks: React.FC<{
  x: number;
  y: number;
  t: number;
  t0: number;
  n: number;
  seed: string;
  power?: number;
}> = ({ x, y, t, t0, n, seed, power = 1 }) => {
  const dt = t - t0;
  if (dt < 0 || dt > 1) return null;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const a = random(`${seed}a${i}`) * Math.PI * 2;
        const sp = (300 + random(`${seed}s${i}`) * 900) * power;
        const vx = Math.cos(a) * sp;
        const vy = Math.sin(a) * sp - 200;
        const px = x + vx * dt;
        const py = y + vy * dt + 700 * dt * dt;
        const life = 0.5 + random(`${seed}l${i}`) * 0.5;
        const o = Math.max(0, 1 - dt / life);
        return (
          <line
            key={i}
            x1={px}
            y1={py}
            x2={px - vx * 0.035}
            y2={py - (vy + 1400 * dt) * 0.035}
            stroke={i % 3 === 0 ? "#ffffff" : C.changed}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={o}
          />
        );
      })}
    </g>
  );
};

// The red energy surge on one bridge: a red beam drawn up to the comet head, a
// crackling lightning line and a white-hot head with a fading tail.
const Surge: React.FC<{ a: V3; b: V3; p: number; cam: Cam; seed: string }> = ({
  a,
  b,
  p,
  cam,
  seed,
}) => {
  const frame = useCurrentFrame();
  if (p <= 0) return null;
  const head = iso(...lerp3(a, b, p), cam);
  const live = p < 1;
  const bolt = Array.from({ length: 13 }, (_, k) => {
    const q = iso(...lerp3(a, b, (p * k) / 12), cam);
    const j = k === 0 || k === 12 ? 0 : 1;
    return `${q.sx + j * (random(`${seed}x${k}${frame}`) - 0.5) * 22},${
      q.sy + j * (random(`${seed}y${k}${frame}`) - 0.5) * 22
    }`;
  }).join(" ");
  return (
    <g>
      <Beam a={a} b={b} progress={p} color={C.changed} width={7} cam={cam} />
      {live ? (
        <>
          <polyline
            points={bolt}
            fill="none"
            stroke="#ffd6de"
            strokeWidth={2.5}
            opacity={0.85}
          />
          {Array.from({ length: 7 }, (_, k) => {
            const q = iso(...lerp3(a, b, Math.max(0, p - k * 0.035)), cam);
            return (
              <circle
                key={k}
                cx={q.sx}
                cy={q.sy}
                r={(16 - k * 2) * cam.zoom}
                fill={k === 0 ? "#ffffff" : C.changed}
                opacity={1 - k / 7}
              />
            );
          })}
          <circle
            cx={head.sx}
            cy={head.sy}
            r={46 * cam.zoom}
            fill={C.changed}
            opacity={0.6}
            filter="url(#neon-wide)"
          />
        </>
      ) : null}
    </g>
  );
};

// Neon caption that buzzes on: flickers for a few frames after `since` seconds.
const flicker = (dt: number) => {
  if (dt < 0) return 0;
  const f = Math.floor(dt * 30);
  const pattern = [1, 0, 1, 1, 0, 0.4, 1];
  return f < pattern.length ? pattern[f] : 1;
};

const CAPTIONS: [number, string][] = [
  [EDIT, "FILE 6 EDITED"],
  [HASH, "ITS HASH CHANGES"],
  [ARRIVE[0], "SO ITS PARENT CHANGES"],
  [ARRIVE[1], "THE CHANGE CLIMBS"],
  [ARRIVE[2], "THE ROOT CHANGES"],
];

export const V2Scene05Change: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const end = durationInFrames / fps;

  const springAt = (sec: number, damping = 12, mass = 0.6) =>
    spring({ frame: frame - sec * fps, fps, config: { damping, mass } });

  // Surge progress along each bridge on the path (0 = not started, 1 = arrived).
  const surge = ARRIVE.map((at, k) =>
    interpolate(t, [at - SURGE[k], at], [0, 1], {
      ...clamp,
      easing: Easing.in(Easing.quad),
    }),
  );
  // How red each node on the path is: tower at EDIT, then each hub on arrival.
  const red = [EDIT, ...ARRIVE].map((at) => springAt(at, 200));
  const pop = [EDIT, ...ARRIVE].map((at) =>
    t < at ? 0 : Math.exp(-(t - at) * 5) * Math.cos((t - at) * 22),
  );

  // --- Camera: push in on tower 6, ride each surge up, then pull back wide.
  const focusAt = (): { p: V3; zoom: number; ay: number } => {
    const towerTop = v3(PATH[0]);
    if (t < ARRIVE[0] - SURGE[0])
      return {
        p: towerTop,
        zoom: interpolate(t, [0.9, 3.1], [1.65, 1.8], clamp),
        ay: 560,
      };
    for (let k = 0; k < 3; k++) {
      const holdUntil = k < 2 ? ARRIVE[k + 1] - SURGE[k + 1] : end;
      if (t < holdUntil) {
        const p = lerp3(v3(PATH[k]), v3(PATH[k + 1]), surge[k]);
        const zA = [1.8, 1.6, 1.45][k];
        const zB = [1.6, 1.45, 1.3][k];
        return {
          p,
          zoom: zA + (zB - zA) * surge[k],
          ay: 560 - 40 * Math.min(1, k + surge[k]),
        };
      }
    }
    return { p: v3(PATH[3]), zoom: 1.3, ay: 520 };
  };
  const f = focusAt();
  const pushIn = interpolate(t, [0.4, 0.95], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.7, 0, 0.2, 1),
  });
  const pullOut = interpolate(t, PULLBACK, [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const WIDE: Cam = { x: 0, y: 10, zoom: 1 };
  const baseCam = mixCam(
    mixCam(DEFAULT_CAM, camOn(f.p, f.zoom, f.ay), pushIn),
    WIDE,
    pullOut,
  );

  // Screen shake: a decaying jolt at every impact.
  const shakeAt = (at: number, amp: number) =>
    t < at ? 0 : amp * Math.exp(-(t - at) * 7);
  const shakeAmp =
    shakeAt(EDIT, 12) +
    shakeAt(HASH, 5) +
    shakeAt(ARRIVE[0], 12) +
    shakeAt(ARRIVE[1], 15) +
    shakeAt(ARRIVE[2], 30);
  const cam: Cam = {
    x: baseCam.x + shakeAmp * (random(`shx${frame}`) - 0.5) * 2,
    y: baseCam.y + shakeAmp * (random(`shy${frame}`) - 0.5) * 2,
    zoom: baseCam.zoom,
  };

  // --- Glitch on the changed tower.
  const glitch = interpolate(
    t,
    [EDIT - 0.12, EDIT, EDIT + 0.45, EDIT + 0.7],
    [0, 1, 0.6, 0],
    clamp,
  );
  const glitching = glitch > 0.02;

  // --- Root shockwave across the city.
  const wave = t - ARRIVE[2];
  const waveR = wave > 0 ? wave * 1500 : -1;
  const root = PATH[3];
  const groundC = iso(root.x, root.y, 0, cam);
  const rootC = iso(root.x, root.y, root.z, cam);

  // The untouched tree dims a little at the end so the red path pops.
  const dim = interpolate(t, [7, 8.2], [1, 0.7], clamp);

  const towerPulse = (i: number) => {
    if (waveR < 0) return 0;
    const d = Math.abs(i - 3.5) * 210 * 1.15;
    return Math.exp(-(((waveR - d) / 120) ** 2));
  };

  const towerColor = interpolateColors(red[0], [0, 1], [C.file, C.changed]);

  // Hash hologram: scrambles at HASH, then shows the new value in red.
  const scramble = t > HASH - 0.25 && t < HASH + 0.1;
  const hashText = scramble
    ? Array.from(
        { length: 6 },
        (_, k) => HEX[Math.floor(random(`hx${frame}${k}`) * 16)],
      ).join("")
    : t < HASH
      ? OLD_HASH
      : NEW_HASH;
  const hashColor = t < HASH - 0.25 ? C.file : C.changed;
  const tagIn = interpolate(t, [1.35, 1.65], [0, 1], clamp);
  const tagOut = interpolate(t, [4.5, 4.9], [1, 0], clamp);
  const roofTop = iso(PATH[0].x, PATH[0].y, PATH[0].z, cam);
  const tagX = roofTop.sx + 85;
  const tagY = roofTop.sy + 40;

  // Caption.
  const capIdx = CAPTIONS.reduce((acc, [at], i) => (t >= at ? i : acc), -1);
  const capOn = capIdx >= 0 ? flicker(t - CAPTIONS[capIdx][0]) : 0;
  const finalLine = interpolate(t, [7.6, 8.2], [0, 1], clamp);

  const fade = Math.min(
    interpolate(t, [0, 0.3], [0, 1], clamp),
    interpolate(t, [end - 0.3, end], [1, 0], clamp),
  );

  const flash =
    0.35 * Math.max(0, 1 - Math.abs(t - EDIT) / 0.12) +
    (wave > 0 ? 0.55 * Math.exp(-wave * 5) : 0);

  const tw = (i: number, color: string, glow: number) => (
    <Tower
      {...towerPos(i)}
      h={TOWER_H[i]}
      seed={`t${i}`}
      cam={cam}
      color={color}
      glow={glow}
    />
  );

  // Screen box around the changed tower, for the glitch slices.
  const tb = iso(towerPos(CHANGED).x, towerPos(CHANGED).y, 0, cam);
  const tTop = iso(PATH[0].x, PATH[0].y, PATH[0].z, cam).sy - 40 * cam.zoom;
  const tBot = tb.sy + 60 * cam.zoom;
  const tCx = iso(PATH[0].x, PATH[0].y, 0, cam).sx;
  const sliceH = (tBot - tTop) / 7;

  return (
    <AbsoluteFill style={{ backgroundColor: C.skyTop }}>
      <Audio src={staticFile("scene05.wav")} />
      <AbsoluteFill style={{ opacity: fade }}>
        <NeonBackground cam={cam} />
        <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute" }}>
          <NeonDefs />
          <defs>
            <radialGradient id="beacon-red" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.35" stopColor={C.changed} />
              <stop offset="1" stopColor={C.changed} stopOpacity="0" />
            </radialGradient>
            {Array.from({ length: 7 }, (_, k) => (
              <clipPath key={k} id={`s5slice${k}`}>
                <rect
                  x={tCx - 300}
                  y={tTop + k * sliceH}
                  width={600}
                  height={sliceH + 1}
                />
              </clipPath>
            ))}
          </defs>

          {/* Ground shockwave from under the beacon. */}
          {waveR > 0 && wave < 1.6
            ? [0, 0.18, 0.36].map((lag, k) => {
                const R = Math.max(0, (wave - lag) * 1500);
                const o = Math.max(0, 1 - (wave - lag) / 1.2);
                return R > 0 ? (
                  <ellipse
                    key={k}
                    cx={groundC.sx}
                    cy={groundC.sy}
                    rx={R * 1.2247 * cam.zoom}
                    ry={R * 0.7071 * cam.zoom}
                    fill="none"
                    stroke={k === 0 ? "#ffffff" : C.changed}
                    strokeWidth={(k === 0 ? 5 : 10) * o + 1}
                    opacity={o}
                    filter="url(#neon)"
                  />
                ) : null;
              })
            : null}

          {/* Bridges: the untouched ones, then the red surges on the path. */}
          <g opacity={dim}>
            {T.slice(0, 3).flatMap((lvl) =>
              lvl.map((n) => {
                const p = T[n.level + 1][Math.floor(n.index / 2)];
                return (
                  <Beam
                    key={`b${n.level}${n.index}`}
                    a={[n.x, n.y, n.z]}
                    b={[p.x, p.y, p.z]}
                    cam={cam}
                    width={4}
                  />
                );
              }),
            )}
          </g>
          {[0, 1, 2].map((k) => (
            <Surge
              key={k}
              a={v3(PATH[k])}
              b={v3(PATH[k + 1])}
              p={surge[k]}
              cam={cam}
              seed={`s${k}`}
            />
          ))}
          {/* Energy keeps flowing up the red path once it is lit. */}
          {[0, 1, 2].map((k) => {
            if (surge[k] < 1) return null;
            const a = iso(...v3(PATH[k]), cam);
            const b = iso(...v3(PATH[k + 1]), cam);
            return (
              <line
                key={`flow${k}`}
                x1={a.sx}
                y1={a.sy}
                x2={b.sx}
                y2={b.sy}
                stroke="#ffffff"
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray="6 34"
                strokeDashoffset={frame * 6}
                opacity={0.85}
              />
            );
          })}

          {/* Towers. */}
          {TOWER_H.map((_, i) =>
            i === CHANGED ? null : (
              <g key={i} opacity={Math.max(dim, towerPulse(i))}>
                {tw(i, C.file, 0.5 + 0.5 * towerPulse(i))}
              </g>
            ),
          )}
          {glitching ? (
            <g>
              {/* RGB split ghosts */}
              <g
                transform={`translate(${-14 * glitch * cam.zoom},0)`}
                opacity={0.55 * glitch}
              >
                {tw(CHANGED, C.file, 1)}
              </g>
              <g
                transform={`translate(${14 * glitch * cam.zoom},0)`}
                opacity={0.55 * glitch}
              >
                {tw(CHANGED, C.changed, 1)}
              </g>
              {/* Torn horizontal slices */}
              {Array.from({ length: 7 }, (_, k) => {
                const dx =
                  (random(`gl${k}${Math.floor(frame / 2)}`) - 0.5) *
                  70 *
                  glitch *
                  cam.zoom;
                return (
                  <g key={k} clipPath={`url(#s5slice${k})`}>
                    <g transform={`translate(${dx},0)`}>
                      {tw(CHANGED, towerColor, 0.6 + 0.4 * glitch)}
                    </g>
                  </g>
                );
              })}
              {Array.from({ length: 5 }, (_, k) => {
                const y = tTop + random(`gb${k}${frame}`) * (tBot - tTop);
                const w = (80 + random(`gw${k}${frame}`) * 220) * cam.zoom;
                return (
                  <rect
                    key={`gb${k}`}
                    x={tCx - w / 2 + (random(`gx${k}${frame}`) - 0.5) * 120}
                    y={y}
                    width={w}
                    height={4 + random(`gh${k}${frame}`) * 10}
                    fill={k % 2 ? C.file : C.changed}
                    opacity={0.8 * glitch}
                  />
                );
              })}
            </g>
          ) : (
            tw(
              CHANGED,
              towerColor,
              0.55 + 0.45 * red[0] + 0.4 * Math.max(0, pop[0]),
            )
          )}
          {/* Red glow pooling around the changed tower. */}
          <ellipse
            cx={tCx}
            cy={tb.sy + 30 * cam.zoom}
            rx={110 * cam.zoom}
            ry={40 * cam.zoom}
            fill={C.changed}
            opacity={0.35 * red[0]}
            filter="url(#neon-wide)"
          />

          {/* Hubs. */}
          {T.slice(1, 3).flatMap((lvl) =>
            lvl.map((n) => {
              const k = PATH[n.level] === n ? n.level : -1;
              if (k < 0)
                return (
                  <g key={`h${n.level}${n.index}`} opacity={dim}>
                    <Hub x={n.x} y={n.y} z={n.z} cam={cam} />
                  </g>
                );
              const c = iso(n.x, n.y, n.z, cam);
              return (
                <g key={`h${n.level}${n.index}`}>
                  <Hub
                    x={n.x}
                    y={n.y}
                    z={n.z}
                    cam={cam}
                    color={interpolateColors(
                      red[k],
                      [0, 1],
                      [C.hash, C.changed],
                    )}
                    scale={1 + 0.25 * red[k] + 0.6 * Math.max(0, pop[k])}
                  />
                  {red[k] > 0.01 ? (
                    <circle
                      cx={c.sx}
                      cy={c.sy}
                      r={9 * cam.zoom}
                      fill="#ffffff"
                      opacity={red[k]}
                    />
                  ) : null}
                </g>
              );
            }),
          )}

          {/* Impact rings at each hub. */}
          {[1, 2].map((k) => {
            const dt = t - ARRIVE[k - 1];
            if (dt < 0 || dt > 0.8) return null;
            const c = iso(...v3(PATH[k]), cam);
            const o = 1 - dt / 0.8;
            return (
              <g key={`ring${k}`}>
                <ellipse
                  cx={c.sx}
                  cy={c.sy}
                  rx={(30 + dt * 520) * cam.zoom}
                  ry={(14 + dt * 240) * cam.zoom}
                  fill="none"
                  stroke={C.changed}
                  strokeWidth={8 * o}
                  opacity={o}
                  filter="url(#neon)"
                />
                <circle
                  cx={c.sx}
                  cy={c.sy}
                  r={(20 + dt * 300) * cam.zoom}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={3 * o}
                  opacity={o * 0.8}
                />
              </g>
            );
          })}

          {/* Beacon: gold, then red. */}
          <g opacity={1 - red[3]}>
            <Beacon x={root.x} y={root.y} z={root.z} cam={cam} />
          </g>
          {red[3] > 0.01 ? (
            <g opacity={red[3]}>
              <RedBeacon
                p={v3(root)}
                cam={cam}
                boost={
                  Math.max(0, pop[3]) * 0.8 +
                  (wave > 0 ? 0.6 * Math.exp(-wave * 3) : 0)
                }
              />
            </g>
          ) : null}
          {wave > 0 && wave < 1.2 ? (
            <circle
              cx={rootC.sx}
              cy={rootC.sy}
              r={40 + wave * 1400}
              fill="none"
              stroke={C.changed}
              strokeWidth={30 * (1 - wave / 1.2)}
              opacity={1 - wave / 1.2}
              filter="url(#neon)"
            />
          ) : null}

          {/* Sparks at every impact. */}
          <Sparks
            x={iso(...v3(PATH[0]), cam).sx}
            y={iso(...v3(PATH[0]), cam).sy}
            t={t}
            t0={EDIT}
            n={22}
            seed="e"
          />
          {[1, 2, 3].map((k) => {
            const c = iso(...v3(PATH[k]), cam);
            return (
              <Sparks
                key={`sp${k}`}
                x={c.sx}
                y={c.sy}
                t={t}
                t0={ARRIVE[k - 1]}
                n={k === 3 ? 40 : 24}
                seed={`p${k}`}
                power={k === 3 ? 1.6 : 1}
              />
            );
          })}

          {/* Hash hologram beside the changed tower. */}
          {tagIn * tagOut > 0 ? (
            <g opacity={tagIn * tagOut}>
              <line
                x1={roofTop.sx + 10}
                y1={roofTop.sy + 10}
                x2={tagX}
                y2={tagY + 20}
                stroke={hashColor}
                strokeWidth={2}
                opacity={0.8}
              />
              <rect
                x={tagX}
                y={tagY}
                width={210}
                height={104}
                rx={8}
                fill="#0a0420"
                fillOpacity={0.82}
                stroke={hashColor}
                strokeWidth={2.5}
                filter={scramble ? undefined : "url(#neon)"}
              />
              <text
                x={tagX + 16}
                y={tagY + 38}
                fill={C.muted}
                fontFamily={FONT}
                fontSize={28}
                fontWeight={700}
                letterSpacing={3}
              >
                HASH
              </text>
              <text
                x={
                  tagX + 16 + (scramble ? (random(`hj${frame}`) - 0.5) * 10 : 0)
                }
                y={tagY + 86}
                fill={hashColor}
                fontFamily={MONO}
                fontSize={42}
                fontWeight={700}
              >
                {hashText}
              </text>
            </g>
          ) : null}
        </svg>

        {/* Full-frame glitch bars at the edit. */}
        {glitching ? (
          <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute" }}>
            {Array.from({ length: 9 }, (_, k) => (
              <rect
                key={k}
                x={0}
                y={random(`fb${k}${frame}`) * HEIGHT}
                width={WIDTH}
                height={2 + random(`fh${k}${frame}`) * 16}
                fill={k % 2 ? C.file : C.changed}
                opacity={0.22 * glitch}
              />
            ))}
          </svg>
        ) : null}

        <AbsoluteFill
          style={{
            backgroundColor: C.changed,
            opacity: flash,
            mixBlendMode: "screen",
          }}
        />

        {/* Neon caption. */}
        {capIdx >= 0 ? (
          <div
            style={{
              position: "absolute",
              left: 70,
              top: 56,
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: 62,
              letterSpacing: 6,
              color: "#ffe3e8",
              opacity: capOn,
              textShadow: `0 0 8px ${C.changed}, 0 0 22px ${C.changed}, 0 0 48px ${C.changed}`,
            }}
          >
            {CAPTIONS[capIdx][1]}
          </div>
        ) : null}
        <div
          style={{
            position: "absolute",
            left: 74,
            top: 146,
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 40,
            color: C.text,
            opacity: finalLine,
            textShadow: `0 0 14px ${C.skyTop}`,
          }}
        >
          1 file edited <span style={{ color: C.changed }}>→</span> a new root
          hash
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
