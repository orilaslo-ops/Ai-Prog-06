"""Generate narration with Kokoro (local, CPU-only text to speech).

Usage:
    python3 narration/tts.py                      # the test-clip sentence
    python3 narration/tts.py "Some text" out.wav  # any sentence

The model files live in narration/models/ (git-ignored); see setup.sh.
"""

import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

HERE = Path(__file__).resolve().parent
MODELS = HERE / "models"
DEFAULT_TEXT = "A hash table turns a key into an array index, so lookups take constant time."
DEFAULT_OUT = HERE.parent / "public" / "narration.wav"
VOICE = "af_heart"


def main() -> None:
    text = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TEXT
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT
    kokoro = Kokoro(str(MODELS / "kokoro-v1.0.int8.onnx"), str(MODELS / "voices-v1.0.bin"))
    samples, sample_rate = kokoro.create(text, voice=VOICE, speed=1.0, lang="en-us")
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(out, samples, sample_rate)
    print(f"Wrote {out} ({len(samples) / sample_rate:.1f}s)")


if __name__ == "__main__":
    main()
