import assert from "node:assert/strict";
import {
  BATTLE_PACE,
  BOUNDLESS_BEAT_MS,
  BOUNDLESS_CUES,
  CUSTOM_TRACK_MIN_DURATION_SECONDS,
  CUSTOM_TRACK_START_SECONDS,
  eventDialogue,
} from "../battle-presentation.js";

assert.equal(BOUNDLESS_BEAT_MS, 5000);
assert.equal(CUSTOM_TRACK_START_SECONDS, 35);
assert.equal(CUSTOM_TRACK_MIN_DURATION_SECONDS, 55);
assert.deepEqual(BOUNDLESS_CUES.map(({ at }) => at), [0, 5000, 10000, 15000, 20000]);
assert.deepEqual(BOUNDLESS_CUES.map(({ cue }) => cue), ["left-dialogue", "right-dialogue", "windup", "impact", "verdict"]);
assert.deepEqual(BOUNDLESS_CUES.slice(0, 2).map(({ side }) => side), [1, 2]);
assert.equal(BOUNDLESS_CUES[0].copy, "LET’S USE EVERY LAST DROP.");
assert.equal(BOUNDLESS_CUES[1].copy, "JUST THIS ONCE.");
assert.ok(Object.values(BATTLE_PACE).every((duration) => duration >= 700), "Readable battle holds must never collapse to animation-only timing");
assert.ok(
  BATTLE_PACE.dialogue + BATTLE_PACE.tap + BATTLE_PACE.impact + BATTLE_PACE.response >= 3800,
  "Each ordinary action needs a medium-speed dialogue, tap, impact, and response cadence",
);

const leftAttack = { type: "attack", attacker: 1, defender: 2, leftHealthAfter: 100, rightHealthAfter: 75 };
assert.deepEqual(eventDialogue(leftAttack, "preview"), [{ side: 1, kind: "speech", copy: "MY TURN." }]);
assert.deepEqual(
  eventDialogue({ ...leftAttack, immune: true }, "verdict", { taunt: "SERIOUSLY?" }),
  [{ side: 2, kind: "speech", copy: "SERIOUSLY?" }],
  "Immunity dialogue belongs to the defender",
);
assert.deepEqual(
  eventDialogue({ ...leftAttack, rightHealthAfter: 0 }, "verdict"),
  [{ side: 1, kind: "shout", copy: "FINISHED." }],
  "Knockout dialogue belongs to the attacker",
);
assert.deepEqual(
  eventDialogue({ ...leftAttack, attacker: 2, defender: 1, leftHealthAfter: 60 }, "verdict", { remaining: "60% LEFT. STILL STANDING." }),
  [{ side: 1, kind: "thought", copy: "60% LEFT. STILL STANDING." }],
  "Damage reactions belong to the defender",
);
assert.deepEqual(
  eventDialogue({ type: "power-clash", leftHealthAfter: 80, rightHealthAfter: 80 }, "preview").map(({ side }) => side),
  [1, 2],
  "Power Clash dialogue must render above both fighters",
);
assert.deepEqual(
  eventDialogue({ type: "stalemate" }, "verdict").map(({ side, kind }) => [side, kind]),
  [[1, "thought"], [2, "thought"]],
);
assert.deepEqual(eventDialogue({ type: "boundless-clash" }, "preview"), [], "Boundless dialogue uses its exact five-second cue plan");

console.log("Verified manga dialogue ownership, medium battle pacing, exact five-second Boundless cues, and the 0:35 local-track contract.");
