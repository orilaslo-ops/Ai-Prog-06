# Ai-Prog-06 — Lab 6: explainer video

Topic: **Merkle trees** (changed from hash tables on lab day). After a minute the viewer
should understand how one root hash fingerprints many files, and how a change is found by
following the path of changed hashes from the root down.

 Stack: Remotion (React video) + Kokoro (local TTS) + ffmpeg,
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
npx remotion render Scene01Intro renders/render-01.mp4   # render scene 1 (new name each time!)
```

Skills for the agent: `npx skills add remotion-dev/skills`.

## Layout

- `src/Root.tsx` — compositions (one per video / test clip)
- `src/TestClip.tsx` — the pre-lab five-second clip (hash tables)
- `src/scenes/` — one file per scene of the Merkle tree video (`Scene01Intro.tsx`, …)
- `renders/` — numbered renders `render-01.mp4`, `render-02.mp4`, … (git-ignored, never overwrite)
- `narration/tts.py` — Kokoro text to speech
- `public/` — audio and other static assets used by the video
