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
import { COLORS, FONT, HEIGHT, MONO, WIDTH } from "./theme";

// Scene 3 (9 s): a file "cat.txt" containing "hello" flows into a hash() machine and
// comes out as a short code plus a fingerprint drawn from the hash bits. One letter
// changes ("hellO"), the file runs through again and both the code and the fingerprint
// change completely (in red).
// Narration: "A hash is a short fingerprint of a file. Change even one letter, and the
// fingerprint changes completely."

// Real SHA-256 digests of the two file contents.
const HASH_A = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"; // hello
const HASH_B = "04a6f55face2f46be8c23f627d539827615851e10751b63ec59db6d2c706b770"; // hellO
const SHOWN = 8; // hex characters shown on screen

const AUDIO_DELAY = 12; // frames of quiet before the narration starts

// Beats, in frames (narration offsets + AUDIO_DELAY; measured with silencedetect).
const T = {
  fileIn: 4,
  machineIn: 14,
  outIn: 24,
  flowA1: 24, // file -> machine
  crunchA: [40, 66],
  flowA2: 50, // machine -> output
  scrambleA: [54, 70],
  revealA: 70, // "...fingerprint of a file"
  cursor: 96, // "Change even one letter"
  flip: 116,
  flowB1: 120,
  crunchB: [134, 162],
  flowB2: 144,
  scrambleB: [146, 166],
  revealB: 166, // "...the fingerprint changes"
  compare: 184, // "completely"
};

// Stage layout (unscaled 1920x1080 coordinates).
const ROW_Y = 510;
const FILE = { x: 370, w: 380, h: 450 };
const MACH = { x: 960, w: 330, h: 290 };
const OUT = { x: 1550, w: 440, h: 500 };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.45, 0, 0.2, 1);

const lerp = (frame: number, input: number[], output: number[]): number =>
  interpolate(frame, input, output, { ...clamp, easing: ease });

// Fingerprint rings derived from the hash bits: each ring's dash pattern and rotation
// come from five hex digits, so two different hashes give two different whorls.
type Ring = { rx: number; ry: number; dash: string; rot: number };
const ringsOf = (hex: string): Ring[] =>
  Array.from({ length: 12 }, (_, k) => {
    const d = (i: number) => parseInt(hex[(k * 5 + i) % hex.length], 16);
    const r = 16 + k * 10;
    return {
      rx: r,
      ry: r * 1.22,
      dash: `${d(0) * 5 + 14} ${d(1) * 1.5 + 7} ${d(2) * 4 + 10} ${d(3) * 1.2 + 6}`,
      rot: d(4) * 22.5,
    };
  });
const RINGS_A = ringsOf(HASH_A);
const RINGS_B = ringsOf(HASH_B);

// A point on the quadratic curve from a to b that bows upwards by `lift`.
const curve = (ax: number, bx: number, y: number, lift: number, t: number) => {
  const cx = (ax + bx) / 2;
  const cy = y - lift;
  const u = 1 - t;
  return {
    x: u * u * ax + 2 * u * t * cx + t * t * bx,
    y: u * u * y + 2 * u * t * cy + t * t * y,
  };
};

// A stream of glowing particles travelling from ax to bx, starting at `start`.
const Stream: React.FC<{
  frame: number;
  start: number;
  ax: number;
  bx: number;
  color: string;
  seed: string;
}> = ({ frame, start, ax, bx, color, seed }) => {
  const N = 16;
  const travel = 16; // frames for one particle to cross
  return (
    <g filter="url(#s3-glow)">
      {Array.from({ length: N }, (_, i) => {
        const born = start + i * 0.9;
        const t = (frame - born) / travel;
        if (t < 0 || t > 1) return null;
        const lane = (random(`${seed}-${i}`) - 0.5) * 36;
        const p = curve(ax, bx, ROW_Y + lane, 40 + lane, Easing.inOut(Easing.quad)(t));
        const size = 4 + random(`${seed}-s${i}`) * 5;
        const fade = Math.sin(Math.PI * t);
        return (
          <g key={i} opacity={fade}>
            <circle cx={p.x} cy={p.y} r={size * 2.2} fill={color} opacity={0.25} />
            <circle cx={p.x} cy={p.y} r={size} fill={color} />
            <circle cx={p.x} cy={p.y} r={size * 0.45} fill="#fff" />
          </g>
        );
      })}
    </g>
  );
};

// The rails the particles run on: a faint curved track with moving dashes and an arrow.
const Rail: React.FC<{
  frame: number;
  ax: number;
  bx: number;
  draw: number;
  heat: number;
  color: string;
}> = ({ frame, ax, bx, draw, heat, color }) => {
  const cx = (ax + bx) / 2;
  const d = `M ${ax} ${ROW_Y} Q ${cx} ${ROW_Y - 40} ${bx} ${ROW_Y}`;
  const len = bx - ax + 30;
  const tip = curve(ax, bx, ROW_Y, 40, draw);
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={COLORS.edge}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - draw)}
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray="4 22"
        strokeDashoffset={-frame * 3}
        opacity={heat * draw}
        filter="url(#s3-glow)"
      />
      <path
        d={`M ${tip.x - 18} ${tip.y - 14} L ${tip.x + 4} ${tip.y} L ${tip.x - 18} ${tip.y + 14}`}
        fill="none"
        stroke={heat > 0.3 ? color : COLORS.border}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={draw}
      />
    </g>
  );
};

// A whorl fingerprint drawn from hash bits; `grow` 0..1 reveals it ring by ring.
const Print: React.FC<{ rings: Ring[]; grow: number; color: string; spin: number }> = ({
  rings,
  grow,
  color,
  spin,
}) => (
  <g>
    {rings.map((r, k) => {
      const g = interpolate(grow * (rings.length + 4) - k, [0, 4], [0, 1], clamp);
      return (
        <ellipse
          key={k}
          cx={0}
          cy={0}
          rx={r.rx * (0.7 + 0.3 * g)}
          ry={r.ry * (0.7 + 0.3 * g)}
          fill="none"
          stroke={color}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray={r.dash}
          opacity={g}
          transform={`rotate(${r.rot + spin * (k % 2 === 0 ? 1 : -1) + (1 - g) * 90})`}
        />
      );
    })}
  </g>
);

const wrap = (v: number, m: number): number => ((v % m) + m) % m;

const HEX = "0123456789abcdef";
const scrambled = (frame: number, seed: string) =>
  Array.from(
    { length: SHOWN },
    (_, i) => HEX[Math.floor(random(`${seed}-${Math.floor(frame / 2)}-${i}`) * 16)],
  ).join("");

export const Scene03Fingerprint: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = (at: number, damping = 14) =>
    spring({ frame: frame - at, fps, config: { damping, stiffness: 140, mass: 0.8 } });

  // Camera: settle in, push towards the file for the letter change, swing to the
  // output for the new fingerprint, then pull back for the comparison.
  const camKeys = [0, 40, T.cursor, T.flip + 4, T.revealB - 18, T.revealB + 6, T.compare + 10, 270];
  const camS = lerp(frame, camKeys, [1.08, 1, 1, 1.12, 1.12, 1.07, 1, 0.985]);
  const camX = lerp(frame, camKeys, [960, 960, 960, 720, 720, 1120, 960, 960]);
  const camY = lerp(frame, camKeys, [540, 540, 540, 540, 540, 540, 540, 540]);

  const fileIn = pop(T.fileIn);
  const machIn = pop(T.machineIn);
  const outIn = pop(T.outIn);
  const rail1 = lerp(frame, [T.flowA1 - 10, T.flowA1 + 6], [0, 1]);
  const rail2 = lerp(frame, [T.flowA2 - 10, T.flowA2 + 6], [0, 1]);

  const changed = frame >= T.flip;
  const flipPop = pop(T.flip, 9);
  const red = interpolate(frame, [T.flip, T.flip + 8], [0, 1], clamp);

  // Machine activity: 0 idle, 1 crunching.
  const activity = (w: number[]) =>
    interpolate(frame, [w[0], w[0] + 6, w[1] - 6, w[1]], [0, 1, 1, 0], clamp);
  const crunch = Math.max(activity(T.crunchA), activity(T.crunchB));
  const machColor = frame >= T.flip ? COLORS.changed : COLORS.hash;
  const gearSpin = interpolate(frame, [0, 270], [0, 260]) + crunch * frame * 6;

  const heat1 = Math.max(
    interpolate(frame, [T.flowA1, T.flowA1 + 6, T.flowA1 + 30, T.flowA1 + 40], [0, 1, 1, 0], clamp),
    interpolate(frame, [T.flowB1, T.flowB1 + 6, T.flowB1 + 30, T.flowB1 + 40], [0, 1, 1, 0], clamp),
  );
  const heat2 = Math.max(
    interpolate(frame, [T.flowA2, T.flowA2 + 6, T.flowA2 + 26, T.flowA2 + 36], [0, 1, 1, 0], clamp),
    interpolate(frame, [T.flowB2, T.flowB2 + 6, T.flowB2 + 26, T.flowB2 + 36], [0, 1, 1, 0], clamp),
  );

  // Output text: blank, scramble, hash A, scramble, hash B.
  let code = "";
  let codeColor: string = COLORS.hash;
  if (frame >= T.revealB) {
    code = HASH_B.slice(0, SHOWN);
    codeColor = COLORS.changed;
  } else if (frame >= T.scrambleB[0]) {
    code = scrambled(frame, "b");
    codeColor = COLORS.changed;
  } else if (frame >= T.revealA) {
    code = HASH_A.slice(0, SHOWN);
  } else if (frame >= T.scrambleA[0]) {
    code = scrambled(frame, "a");
  }
  const scrambling =
    (frame >= T.scrambleA[0] && frame < T.revealA) ||
    (frame >= T.scrambleB[0] && frame < T.revealB);
  const revealPopA = pop(T.revealA, 10);
  const revealPopB = pop(T.revealB, 10);
  const codeScale = frame >= T.revealB ? 0.85 + 0.15 * revealPopB : frame >= T.revealA ? 0.85 + 0.15 * revealPopA : 1;

  const printA = lerp(frame, [T.revealA - 6, T.revealA + 26], [0, 1]);
  const printAOut = lerp(frame, [T.scrambleB[0] - 4, T.scrambleB[0] + 10], [1, 0]);
  const printB = lerp(frame, [T.revealB - 4, T.revealB + 26], [0, 1]);

  // Shockwave flashes at the letter flip and the new hash.
  const wave = (at: number) => interpolate(frame, [at, at + 22], [0, 1], clamp);
  const flipWave = wave(T.flip);
  const hashWave = wave(T.revealB);
  const flash = interpolate(frame, [T.revealB, T.revealB + 3, T.revealB + 18], [0, 0.22, 0], clamp);

  const cursorOn = frame >= T.cursor && frame < T.flip && Math.floor((frame - T.cursor) / 7) % 2 === 0;

  const capA = pop(T.revealA - 4, 200);
  const capB = pop(T.compare, 200);
  const caption1Out = interpolate(frame, [T.cursor - 6, T.cursor + 4], [1, 0], clamp);

  const fileStroke = changed ? COLORS.changed : COLORS.border;
  const outStroke = frame >= T.scrambleB[0] ? COLORS.changed : COLORS.hash;
  const outGlow = interpolate(frame, [T.revealA - 4, T.revealA + 10], [0, 1], clamp);

  // Background drift: a slow field of faint hex digits.
  const bgDigits = Array.from({ length: 46 }, (_, i) => ({
    x: random(`bx${i}`) * WIDTH,
    y: wrap(random(`by${i}`) * (HEIGHT + 200) - frame * (0.4 + random(`bv${i}`) * 0.8), HEIGHT + 200) - 50,
    c: HEX[Math.floor(random(`bc${i}`) * 16)],
    s: 20 + random(`bs${i}`) * 26,
  }));

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, fontFamily: FONT, overflow: "hidden" }}>
      <Sequence from={AUDIO_DELAY} layout="none">
        <Audio src={staticFile("scene03.wav")} />
      </Sequence>

      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="s3-vignette" cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor="#1b2a4a" />
            <stop offset="60%" stopColor={COLORS.bg} />
            <stop offset="100%" stopColor="#070b16" />
          </radialGradient>
          <filter id="s3-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="s3-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <linearGradient id="s3-machine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#0b1324" />
          </linearGradient>
          <linearGradient id="s3-card" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#243247" />
            <stop offset="100%" stopColor={COLORS.file} />
          </linearGradient>
        </defs>

        <rect width={WIDTH} height={HEIGHT} fill="url(#s3-vignette)" />
        {bgDigits.map((d, i) => (
          <text
            key={i}
            x={d.x}
            y={d.y}
            fontFamily={MONO}
            fontSize={d.s}
            fill={COLORS.hash}
            opacity={0.06}
          >
            {d.c}
          </text>
        ))}

        <g transform={`translate(960 540) scale(${camS}) translate(${-camX} ${-camY})`}>
          {/* Rails and particles */}
          <Rail
            frame={frame}
            ax={FILE.x + FILE.w / 2 + 20}
            bx={MACH.x - MACH.w / 2 - 24}
            draw={rail1}
            heat={heat1}
            color={changed ? COLORS.changed : COLORS.hash}
          />
          <Rail
            frame={frame}
            ax={MACH.x + MACH.w / 2 + 20}
            bx={OUT.x - OUT.w / 2 - 24}
            draw={rail2}
            heat={heat2}
            color={frame >= T.flowB2 ? COLORS.changed : COLORS.hash}
          />
          {[
            { s: T.flowA1, c: COLORS.text, k: "a1", a: 0 },
            { s: T.flowA2, c: COLORS.hash, k: "a2", a: 1 },
            { s: T.flowB1, c: COLORS.changed, k: "b1", a: 0 },
            { s: T.flowB2, c: COLORS.changed, k: "b2", a: 1 },
          ].map((st) => (
            <Stream
              key={st.k}
              frame={frame}
              start={st.s}
              ax={st.a === 0 ? FILE.x + FILE.w / 2 + 20 : MACH.x + MACH.w / 2 + 20}
              bx={st.a === 0 ? MACH.x - MACH.w / 2 - 24 : OUT.x - OUT.w / 2 - 24}
              color={st.c}
              seed={st.k}
            />
          ))}

          {/* The file */}
          <g
            transform={`translate(${FILE.x} ${ROW_Y + (1 - fileIn) * 80}) scale(${0.8 + 0.2 * fileIn})`}
            opacity={fileIn}
          >
            <rect
              x={-FILE.w / 2}
              y={-FILE.h / 2}
              width={FILE.w}
              height={FILE.h}
              rx={60}
              fill={COLORS.changed}
              opacity={0.18 * red}
              filter="url(#s3-soft)"
            />
            <path
              d={`M ${-FILE.w / 2 + 24} ${-FILE.h / 2}
                  H ${FILE.w / 2 - 80}
                  L ${FILE.w / 2} ${-FILE.h / 2 + 80}
                  V ${FILE.h / 2 - 24}
                  Q ${FILE.w / 2} ${FILE.h / 2} ${FILE.w / 2 - 24} ${FILE.h / 2}
                  H ${-FILE.w / 2 + 24}
                  Q ${-FILE.w / 2} ${FILE.h / 2} ${-FILE.w / 2} ${FILE.h / 2 - 24}
                  V ${-FILE.h / 2 + 24}
                  Q ${-FILE.w / 2} ${-FILE.h / 2} ${-FILE.w / 2 + 24} ${-FILE.h / 2} Z`}
              fill="url(#s3-card)"
              stroke={fileStroke}
              strokeWidth={5}
            />
            <path
              d={`M ${FILE.w / 2 - 80} ${-FILE.h / 2} V ${-FILE.h / 2 + 60} Q ${FILE.w / 2 - 80} ${-FILE.h / 2 + 80} ${FILE.w / 2 - 60} ${-FILE.h / 2 + 80} H ${FILE.w / 2}`}
              fill="#334155"
              stroke={fileStroke}
              strokeWidth={5}
              strokeLinejoin="round"
            />
            <text
              x={-FILE.w / 2 + 40}
              y={-FILE.h / 2 + 66}
              fontFamily={MONO}
              fontSize={40}
              fontWeight={700}
              fill={COLORS.muted}
            >
              cat.txt
            </text>
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x={-FILE.w / 2 + 40}
                y={110 + i * 34}
                width={[260, 200, 230][i]}
                height={12}
                rx={6}
                fill={COLORS.border}
                opacity={0.35}
              />
            ))}
            <text y={30} textAnchor="middle" fontFamily={MONO} fontSize={104} fontWeight={700}>
              <tspan fill={COLORS.text}>hell</tspan>
              <tspan
                fill={changed ? COLORS.changed : COLORS.text}
                filter={changed ? "url(#s3-glow)" : undefined}
                fontSize={changed ? 104 * (0.6 + 0.4 * flipPop) : 104}
              >
                {changed ? "O" : "o"}
              </tspan>
            </text>
            {cursorOn && <rect x={160} y={-50} width={8} height={100} fill={COLORS.root} />}
            {flipWave > 0 && flipWave < 1 && (
              <circle
                cx={125}
                cy={-5}
                r={20 + flipWave * 160}
                fill="none"
                stroke={COLORS.changed}
                strokeWidth={8 * (1 - flipWave)}
                opacity={1 - flipWave}
              />
            )}
            {changed && (
              <text
                x={125}
                y={-90}
                textAnchor="middle"
                fontSize={30}
                fontWeight={700}
                fill={COLORS.changed}
                opacity={interpolate(frame, [T.flip + 4, T.flip + 12], [0, 1], clamp)}
              >
                o → O
              </text>
            )}
          </g>

          {/* The hash() machine */}
          <g
            transform={`translate(${MACH.x} ${ROW_Y + (1 - machIn) * 80}) scale(${(0.8 + 0.2 * machIn) * (1 + crunch * 0.04 * Math.sin(frame * 1.3))})`}
            opacity={machIn}
          >
            <circle r={210} fill={machColor} opacity={0.1 + crunch * 0.22} filter="url(#s3-soft)" />
            <g transform={`rotate(${gearSpin})`}>
              {Array.from({ length: 36 }, (_, i) => (
                <rect
                  key={i}
                  x={-4}
                  y={-232}
                  width={8}
                  height={i % 3 === 0 ? 26 : 14}
                  rx={4}
                  fill={machColor}
                  opacity={0.25 + crunch * 0.6}
                  transform={`rotate(${i * 10})`}
                />
              ))}
            </g>
            <rect
              x={-MACH.w / 2}
              y={-MACH.h / 2}
              width={MACH.w}
              height={MACH.h}
              rx={40}
              fill="url(#s3-machine)"
              stroke={machColor}
              strokeWidth={5}
            />
            {/* Scan lines inside the machine while it works. */}
            {Array.from({ length: 5 }, (_, i) => {
              const y = ((frame * 9 + i * 58) % (MACH.h - 40)) - MACH.h / 2 + 20;
              return (
                <rect
                  key={i}
                  x={-MACH.w / 2 + 24}
                  y={y}
                  width={MACH.w - 48}
                  height={3}
                  rx={1.5}
                  fill={machColor}
                  opacity={crunch * 0.5}
                />
              );
            })}
            <text
              y={10}
              textAnchor="middle"
              fontFamily={MONO}
              fontSize={78}
              fontWeight={700}
              fill={COLORS.text}
              filter={crunch > 0.2 ? "url(#s3-glow)" : undefined}
            >
              hash()
            </text>
            <text
              y={80}
              textAnchor="middle"
              fontFamily={MONO}
              fontSize={28}
              fill={COLORS.muted}
              letterSpacing={4}
            >
              SHA-256
            </text>
          </g>

          {/* The output: fingerprint + short code */}
          <g
            transform={`translate(${OUT.x} ${ROW_Y + (1 - outIn) * 80}) scale(${0.8 + 0.2 * outIn})`}
            opacity={outIn}
          >
            <rect
              x={-OUT.w / 2}
              y={-OUT.h / 2}
              width={OUT.w}
              height={OUT.h}
              rx={44}
              fill={outStroke}
              opacity={0.14 * outGlow}
              filter="url(#s3-soft)"
            />
            <rect
              x={-OUT.w / 2}
              y={-OUT.h / 2}
              width={OUT.w}
              height={OUT.h}
              rx={44}
              fill="url(#s3-card)"
              stroke={outStroke}
              strokeWidth={5}
              strokeOpacity={0.35 + 0.65 * outGlow}
            />
            <rect
              x={-OUT.w / 2}
              y={-OUT.h / 2}
              width={OUT.w}
              height={OUT.h}
              rx={44}
              fill={COLORS.changed}
              opacity={flash}
            />
            <g transform="translate(0 -70)">
              <circle r={150} fill="#0b1324" stroke={COLORS.edge} strokeWidth={3} />
              <g opacity={printAOut}>
                <Print rings={RINGS_A} grow={printA} color={COLORS.hash} spin={frame * 0.15} />
              </g>
              <g filter="url(#s3-glow)">
                <Print rings={RINGS_B} grow={printB} color={COLORS.changed} spin={frame * 0.15} />
              </g>
              {hashWave > 0 && hashWave < 1 && (
                <circle
                  r={150 + hashWave * 200}
                  fill="none"
                  stroke={COLORS.changed}
                  strokeWidth={10 * (1 - hashWave)}
                  opacity={1 - hashWave}
                />
              )}
            </g>
            <text
              y={175}
              textAnchor="middle"
              fontFamily={MONO}
              fontSize={62}
              fontWeight={700}
              fill={codeColor}
              opacity={scrambling ? 0.75 : 1}
              filter={scrambling ? undefined : "url(#s3-glow)"}
              transform={`scale(${codeScale})`}
            >
              {code ? `${code}…` : ""}
            </text>
          </g>

          {/* Old code, kept under the card for the comparison */}
          <g
            opacity={capB}
            transform={`translate(${OUT.x} ${ROW_Y + OUT.h / 2 + 60 - (1 - capB) * 20})`}
          >
            <text
              textAnchor="middle"
              fontFamily={MONO}
              fontSize={44}
              fill={COLORS.muted}
            >
              was{" "}
              <tspan fill={COLORS.hash} textDecoration="line-through">
                {HASH_A.slice(0, SHOWN)}…
              </tspan>
            </text>
          </g>
        </g>

        {/* Captions (screen space, unaffected by the camera) */}
        <g opacity={capA * caption1Out} transform={`translate(960 ${110 - (1 - capA) * 20})`}>
          <text textAnchor="middle" fontSize={58} fontWeight={700} fill={COLORS.text}>
            a <tspan fill={COLORS.hash}>hash</tspan> = a file&apos;s fingerprint
          </text>
        </g>
        <g opacity={capB} transform={`translate(960 ${110 - (1 - capB) * 20})`}>
          <text textAnchor="middle" fontSize={58} fontWeight={700} fill={COLORS.text}>
            1 letter changed → <tspan fill={COLORS.changed}>a completely new fingerprint</tspan>
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
