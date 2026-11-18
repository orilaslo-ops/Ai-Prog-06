// Version 2 ("the living tree"): same script and narration files as version 1,
// new visuals. Each scene owns one file; lengths match version 1's narration.
import { V2Scene01Hook } from "./V2Scene01Hook";
import { V2Scene02Problem } from "./V2Scene02Problem";
import { V2Scene03Fingerprint } from "./V2Scene03Fingerprint";
import { V2Scene04Grow } from "./V2Scene04Grow";
import { V2Scene05Change } from "./V2Scene05Change";
import { V2Scene06Find } from "./V2Scene06Find";
import { V2Scene07Uses } from "./V2Scene07Uses";

export const SCENES_V2 = [
  { id: "V2Scene01Hook", component: V2Scene01Hook, seconds: 8 },
  { id: "V2Scene02Problem", component: V2Scene02Problem, seconds: 8 },
  { id: "V2Scene03Fingerprint", component: V2Scene03Fingerprint, seconds: 9 },
  { id: "V2Scene04Grow", component: V2Scene04Grow, seconds: 12 },
  { id: "V2Scene05Change", component: V2Scene05Change, seconds: 10 },
  { id: "V2Scene06Find", component: V2Scene06Find, seconds: 11 },
  { id: "V2Scene07Uses", component: V2Scene07Uses, seconds: 9 },
] as const;
