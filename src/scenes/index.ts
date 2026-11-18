// The scenes of the Merkle tree video, in order, with their length in seconds.
// Each scene owns one file and one narration file public/sceneNN.wav (see SCRIPT.md).
import { Scene01Intro } from "./Scene01Intro";
import { Scene02Problem } from "./Scene02Problem";
import { Scene03Fingerprint } from "./Scene03Fingerprint";
import { Scene04Build } from "./Scene04Build";
import { Scene05Change } from "./Scene05Change";
import { Scene06Find } from "./Scene06Find";
import { Scene07Uses } from "./Scene07Uses";

export const SCENES = [
  { id: "Scene01Intro", component: Scene01Intro, seconds: 8 },
  { id: "Scene02Problem", component: Scene02Problem, seconds: 8 },
  { id: "Scene03Fingerprint", component: Scene03Fingerprint, seconds: 9 },
  { id: "Scene04Build", component: Scene04Build, seconds: 12 },
  { id: "Scene05Change", component: Scene05Change, seconds: 10 },
  { id: "Scene06Find", component: Scene06Find, seconds: 11 },
  { id: "Scene07Uses", component: Scene07Uses, seconds: 9 },
] as const;
