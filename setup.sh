#!/usr/bin/env bash
# One-time setup for the Lab 6 stack on WSL / Ubuntu, then render the test clip.
# The apt step needs sudo, so run this script yourself in a terminal: ./setup.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "== 1. System packages (ffmpeg + libraries Remotion's Chrome needs) =="
sudo apt-get update
sudo apt-get install -y ffmpeg libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 \
  libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 \
  libpango-1.0-0 libcairo2 libcups2

echo "== 2. Node.js (needs 18+) =="
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

echo "== 3. Remotion =="
npm install

echo "== 4. Kokoro (Python venv + model files, ~140 MB) =="
if ! command -v uv >/dev/null; then curl -LsSf https://astral.sh/uv/install.sh | sh; export PATH="$HOME/.local/bin:$PATH"; fi
uv venv -q --python 3.12 .venv
uv pip install -q --python .venv/bin/python -r requirements.txt
mkdir -p narration/models
base=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1
for f in kokoro-v1.0.int8.onnx voices-v1.0.bin; do
  [ -f "narration/models/$f" ] || curl -fL -o "narration/models/$f" "$base/$f"
done

echo "== 5. Narration + 5-second test clip =="
.venv/bin/python narration/tts.py
npx remotion render TestClip out/test-clip.mp4
echo "Done: out/test-clip.mp4"
