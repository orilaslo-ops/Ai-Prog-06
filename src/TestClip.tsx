import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Pre-lab test clip: the key "cat" is hashed straight into bucket 3.
const BUCKETS = 8;
const TARGET = 3;

export const TestClip: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleIn = spring({ frame, fps, config: { damping: 200 } });
  const keyIn = spring({ frame: frame - 0.6 * fps, fps, config: { damping: 200 } });
  // The key travels from the hash box down to its bucket.
  const drop = interpolate(frame, [2 * fps, 3.2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glow = interpolate(frame, [3.1 * fps, 3.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cell = 150;
  const gap = 20;
  const rowWidth = BUCKETS * cell + (BUCKETS - 1) * gap;
  const targetX = TARGET * (cell + gap) + cell / 2 - rowWidth / 2;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        fontFamily: "Inter, Helvetica, Arial, sans-serif",
        alignItems: "center",
      }}
    >
      <Audio src={staticFile("narration.wav")} />
      <div
        style={{
          marginTop: 90,
          fontSize: 96,
          fontWeight: 700,
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 40}px)`,
        }}
      >
        Hash table
      </div>
      <div
        style={{
          marginTop: 50,
          fontSize: 52,
          fontFamily: "monospace",
          opacity: keyIn,
          color: "#94a3b8",
        }}
      >
        hash("cat") % 8 = {TARGET}
      </div>
      <div
        style={{
          position: "absolute",
          top: 380 + drop * 339,
          zIndex: 1,
          left: "50%",
          transform: `translateX(calc(-50% + ${drop * targetX}px))`,
          opacity: keyIn,
          padding: "12px 20px",
          borderRadius: 16,
          backgroundColor: "#38bdf8",
          color: "#0f172a",
          fontSize: 40,
          fontWeight: 700,
        }}
      >
        "cat"
      </div>
      <div style={{ position: "absolute", top: 680, display: "flex", gap }}>
        {Array.from({ length: BUCKETS }, (_, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div
              style={{
                width: cell,
                height: cell,
                borderRadius: 20,
                border: "4px solid #475569",
                backgroundColor:
                  i === TARGET ? `rgba(250, 204, 21, ${glow * 0.9})` : "#1e293b",
              }}
            />
            <div style={{ marginTop: 14, fontSize: 40, color: "#94a3b8" }}>{i}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
