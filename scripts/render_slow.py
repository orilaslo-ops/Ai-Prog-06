"""Render the explainer at a calmer pace: slower pictures, slower voice, a pause after
each sentence.

How it works:
1. The composition is rendered with the input prop `slow` (e.g. 1.3). Each scene then
   sees a clock that runs 1.3 times slower (fractional frames, so motion stays smooth),
   so every animation runs 1.3 times slower. See src/SlowMo.tsx.
2. The narration is re-spoken one sentence at a time with Kokoro at a slower speed.
   Each sentence starts at its original start time times `slow`, so it still lands on
   the same animation, and the time saved by the slower stretch becomes a pause after
   every sentence.

Usage:
    .venv/bin/python scripts/render_slow.py Explainer renders/render-03.mp4
    .venv/bin/python scripts/render_slow.py ExplainerV2 renders/render-04.mp4 --slow 1.3

Pass --browser-executable when Remotion cannot download its own browser.
"""

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "narration" / "models"
VOICE = "af_heart"
RATE = 24000
GAP = 0.35  # shortest pause kept between two sentences, in seconds


def run(cmd: list[str]) -> str:
    print("+", " ".join(cmd), flush=True)
    res = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit(res.stdout[-3000:] + res.stderr[-3000:])
    return res.stdout + res.stderr


def scene_lengths(composition: str) -> list[int]:
    """Scene lengths in seconds, in order, from the composition's scene list."""
    index = ROOT / "src" / ("v2" if composition.endswith("V2") else "scenes") / "index.ts"
    return [int(s) for s in re.findall(r"seconds:\s*(\d+)", index.read_text())]


def narration_texts() -> list[str]:
    """The narration of scenes 1-7 from SCRIPT.md (the version 1 sections)."""
    text = (ROOT / "SCRIPT.md").read_text()
    found = re.findall(r'\*\*Narration:\*\*\s*"(.*?)"', text, re.S)
    return [" ".join(t.split()) for t in found[:7]]


def sentences(text: str) -> list[str]:
    # A colon gets its own pause too ("until one hash is left: the root.").
    return [s.strip() for s in re.split(r"(?<=[.?!:])\s+", text) if s.strip()]


def speech_spans(path: Path) -> list[tuple[float, float]]:
    """(start, end) of the stretches of speech in a wav, from ffmpeg's silencedetect."""
    out = run(
        ["ffmpeg", "-i", str(path), "-af", "silencedetect=n=-40dB:d=0.18", "-f", "null", "-"]
    )
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    length = sf.info(str(path)).duration
    spans, pos = [], 0.0
    for s, e in zip(starts, ends + [length] * (len(starts) - len(ends))):
        if s > pos + 0.02:
            spans.append((pos, s))
        pos = e
    if pos < length - 0.02:
        spans.append((pos, length))
    return spans


def sentence_starts(path: Path, count: int) -> list[float]:
    """Start time of each sentence in an original narration wav: the speech after the
    count-1 longest pauses."""
    spans = speech_spans(path)
    gaps = sorted(
        range(1, len(spans)), key=lambda i: spans[i][0] - spans[i - 1][1], reverse=True
    )[: count - 1]
    return [spans[0][0]] + [spans[i][0] for i in sorted(gaps)]


def trim(samples: np.ndarray, threshold: float = 0.01) -> np.ndarray:
    loud = np.nonzero(np.abs(samples) > threshold)[0]
    if len(loud) == 0:
        return samples
    return samples[max(0, loud[0] - 240) : loud[-1] + 2400]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("composition")
    ap.add_argument("output")
    ap.add_argument("--slow", type=float, default=1.3)
    ap.add_argument("--speed", type=float, default=0.88, help="Kokoro speaking speed")
    ap.add_argument("--browser-executable")
    ap.add_argument("--frames", help="reuse slow frames from an earlier run (frames.mp4)")
    args = ap.parse_args()

    browser = [f"--browser-executable={args.browser_executable}"] if args.browser_executable else []
    lengths = scene_lengths(args.composition)
    texts = narration_texts()
    total = sum(lengths)
    tmp = Path(tempfile.mkdtemp(prefix="render-slow-"))

    # Where each scene's narration starts in the normal-speed video (scenes may delay it).
    run(["npx", "remotion", "render", args.composition, str(tmp / "normal.wav"), "--codec=wav", *browser])
    normal = tmp / "normal.wav"

    kokoro = Kokoro(str(MODELS / "kokoro-v1.0.int8.onnx"), str(MODELS / "voices-v1.0.bin"))
    track = np.zeros(int((total * args.slow + 1) * RATE), dtype=np.float32)
    plan = []
    scene_start = 0.0
    last_end = 0.0
    for n, (seconds, text) in enumerate(zip(lengths, texts), start=1):
        part = tmp / f"part{n}.wav"
        run(["ffmpeg", "-y", "-i", str(normal), "-ss", str(scene_start), "-t", str(seconds), str(part)])
        onset = speech_spans(part)[0][0]
        wav = ROOT / "public" / f"scene{n:02d}.wav"
        lines = sentences(text)
        starts = sentence_starts(wav, len(lines))
        first = starts[0]
        for line, s in zip(lines, starts):
            at = max(args.slow * (scene_start + onset + s - first), last_end + GAP)
            samples, rate = kokoro.create(line, voice=VOICE, speed=args.speed, lang="en-us")
            assert rate == RATE
            clip = trim(np.asarray(samples, dtype=np.float32))
            i = int(at * RATE)
            track[i : i + len(clip)] += clip[: len(track) - i]
            last_end = at + len(clip) / RATE
            plan.append({"scene": n, "at": round(at, 2), "end": round(last_end, 2), "text": line})
        scene_end = args.slow * (scene_start + seconds)
        if last_end > scene_end:
            print(f"warning: scene {n} narration runs {last_end - scene_end:.2f}s into the next scene")
        scene_start += seconds
    sf.write(tmp / "narration.wav", track, RATE)
    print(json.dumps(plan, indent=1))

    # Slow pictures: every scene's clock runs `slow` times slower (src/SlowMo.tsx).
    frames = Path(args.frames) if args.frames else tmp / "frames.mp4"
    if not args.frames:
        props = json.dumps({"slow": args.slow})
        run(["npx", "remotion", "render", args.composition, str(frames), f"--props={props}", "--muted", *browser])
    out = ROOT / args.output
    out.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "ffmpeg", "-y", "-i", str(frames), "-i", str(tmp / "narration.wav"),
            "-map", "0:v", "-map", "1:a",
            "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
            "-shortest", str(out),
        ]
    )
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
