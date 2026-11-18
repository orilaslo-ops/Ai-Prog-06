# Merkle trees in one minute

**Goal:** after one minute, the viewer understands how one root hash fingerprints many
files, and how a change is found by following the changed hashes from the root down.

**Style:** dark background, files in grey, hashes in blue, the root in yellow, anything
that changed in red. One scene per file in `src/scenes/`. About 150 words of narration in
total (Kokoro, voice `af_heart`, reads about 2.5 words a second).

| # | Scene file | Time | Seconds |
|---|------------|------|---------|
| 1 | `Scene01Intro.tsx` | 0:00–0:08 | 8 |
| 2 | `Scene02Problem.tsx` | 0:08–0:16 | 8 |
| 3 | `Scene03Fingerprint.tsx` | 0:16–0:25 | 9 |
| 4 | `Scene04Build.tsx` | 0:25–0:37 | 12 |
| 5 | `Scene05Change.tsx` | 0:37–0:47 | 10 |
| 6 | `Scene06Find.tsx` | 0:47–0:58 | 11 |
| 7 | `Scene07Uses.tsx` | 0:58–1:07 | 9 |

Lengths live in `src/scenes/index.ts`; colours and fonts in `src/scenes/theme.ts`.
Each scene plays its own narration file `public/sceneNN.wav` (for example `scene03.wav`),
made with `.venv/bin/python narration/tts.py "<text>" public/sceneNN.wav`.

---|------------|------|---------|
| 1 | `Scene01Intro.tsx` | 0:00–0:05 | 5 |
| 2 | `Scene02Problem.tsx` | 0:05–0:13 | 8 |
| 3 | `Scene03Fingerprint.tsx` | 0:13–0:22 | 9 |
| 4 | `Scene04Build.tsx` | 0:22–0:34 | 12 |
| 5 | `Scene05Change.tsx` | 0:34–0:44 | 10 |
| 6 | `Scene06Find.tsx` | 0:44–0:54 | 10 |
| 7 | `Scene07Uses.tsx` | 0:54–1:02 | 8 |

---

## Scene 1 — Hook

**Shows:** open on a huge wall of tiny grey squares (thousands, drawn in code) while the
camera slowly zooms out, so it feels endless; label "1,000,000 files". One square
somewhere flashes red for a moment, then is lost in the crowd again. A big "?" appears,
then a counter "20 steps". Last second: everything fades back and the title
"Merkle tree" lands, with a small yellow root node under it.

**Narration:** "One letter changed, somewhere in a million files. Could you find it in
just twenty steps? A Merkle tree can."

## Scene 2 — The problem

**Shows:** two computers side by side, each with a long grid of files (draw ~64 small
squares, label "1,000,000 files"). A dashed line between them labelled "same?". One
square on the right blinks red. A counter starts ticking "comparing 1… 2… 3…" and is
crossed out.

**Narration:** "Say you and a friend each have a million files. Are they identical?
Sending every file to compare would take forever."

## Scene 3 — A fingerprint

**Shows:** one file `cat.txt` with the text "hello". An arrow into a box labelled
`hash()`, out comes a short code `3f9a…`. Change "hello" to "hellO" and the code jumps to
a completely different `b71c…` (flash red).

**Narration:** "A hash is a short fingerprint of a file. Change even one letter, and the
fingerprint changes completely."

## Scene 4 — Building the tree

**Shows:** reuse the layout of scene 1, slower. Eight files, a hash under each label
`h1`…`h8`. Pairs slide together: `h1 + h2 → h12`, then `h12 + h34 → h1234`, up to the
root. Show the "+" for the first pair only, then let the rest build quickly.

**Narration:** "Hash every file. Then hash each pair of hashes together, and again, level
by level, until one hash is left: the root. The root depends on every single file."

## Scene 5 — One file changes

**Shows:** the finished tree. File 6 turns red. Its hash turns red, then its parent, then
the grandparent, then the root, one per beat, so the red path climbs to the top. The rest
of the tree stays blue.

**Narration:** "Now change one file. Its hash changes, so its parent changes, and the
change climbs all the way to the root."

## Scene 6 — Finding it fast

**Shows:** two trees side by side (yours and your friend's). Compare roots: different
(red ✗). Step down: the left children match (green ✓, dim that half), the right ones
differ, step into the right half. Repeat until file 6 is highlighted. A counter shows
"3 steps" here, then text "1,000,000 files → about 20 steps".

**Narration:** "To compare, check the roots. If they differ, check the two children and
follow the one that doesn't match. With a million files, that's about twenty steps."

## Scene 7 — Where it's used

**Shows:** three icons drawn in code, each with a small tree under it: Git (branch
symbol), Bitcoin (₿ in a circle), file sync (cloud with two arrows). End on the title
"Merkle tree" with the yellow root.

**Narration:** "Git, Bitcoin and file-sync apps all use Merkle trees, to check a lot of
data by looking at just one hash."

---

## Open questions

- Scene 6 is the key idea; if time runs short, cut scene 7 rather than scene 6.
- Show real hash values (`3f9a…`) or labels (`h12`)? Plan: real-looking codes in scene 3,
  labels in scenes 4–6 so the tree stays readable.
