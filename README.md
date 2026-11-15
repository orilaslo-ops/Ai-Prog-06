# Ai-Prog-06 — Lab 6: explainer video

Topic: **hash tables**. Stack: Remotion (React video) + Kokoro (local TTS) + ffmpeg,
driven by Claude Code.

## Setup (once, on WSL/Ubuntu)

```sh
./setup.sh
```

It installs ffmpeg and Chrome's libraries (asks for your sudo password), Node.js if needed,
Remotion, Kokoro and its model files, then writes `public/narration.wav` and renders the
five-second test clip to `out/test-clip.mp4`.

## Everyday commands

```sh
npm run studio                                   # live preview in the browser
.venv/bin/python narration/tts.py "Text" public/scene1.wav   # narrate a sentence
npm run render:test                              # re-render the test clip
```

Skills for the agent: `npx skills add remotion-dev/skills`.

## Layout

- `src/Root.tsx` — compositions (one per video / test clip)
- `src/TestClip.tsx` — the pre-lab five-second clip
- `narration/tts.py` — Kokoro text to speech
- `public/` — audio and other static assets used by the video
