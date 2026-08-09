export const BOUNDLESS_BEAT_MS = 5000;
export const BOUNDLESS_TRACK_START_SECONDS = 35;
export const BOUNDLESS_TRACK_CLIP_SECONDS = 30;
export const BOUNDLESS_TRACK_PREP_TIMEOUT_MS = 12000;
export const BOUNDLESS_MUSIC_FADE_IN_SECONDS = 2;
export const BOUNDLESS_MUSIC_FADE_OUT_SECONDS = 1.8;
export const BOUNDLESS_OUTRO_MS = 2000;

export const BATTLE_PACE = Object.freeze({
  entrance: 900,
  dialogue: 1000,
  charge: 700,
  impact: 900,
  response: 1300,
  finish: 700,
});

export const BOUNDLESS_CUES = Object.freeze([
  Object.freeze({ at: 0, cue: "left-dialogue", side: 1, focus: "left", copy: "LET’S USE EVERY LAST DROP." }),
  Object.freeze({ at: BOUNDLESS_BEAT_MS, cue: "right-dialogue", side: 2, focus: "right", copy: "JUST THIS ONCE." }),
  Object.freeze({ at: BOUNDLESS_BEAT_MS * 2, cue: "power-rise", side: 0, focus: "both", copy: "INFINITE POWER RISING" }),
  Object.freeze({ at: BOUNDLESS_BEAT_MS * 3, cue: "beam-release", side: 0, focus: "both", copy: "TWIN BEAMS RELEASED" }),
  Object.freeze({ at: BOUNDLESS_BEAT_MS * 4, cue: "beam-collision", side: 0, focus: "both", copy: "REALITY COLLAPSES" }),
  Object.freeze({ at: BOUNDLESS_BEAT_MS * 5, cue: "annihilation", side: 0, focus: "both", copy: "MUTUAL ANNIHILATION" }),
]);

export function eventDialogue(event, phase, options = {}) {
  if (!event || (phase !== "preview" && phase !== "verdict")) return [];
  const remaining = options.remaining || "STILL STANDING.";
  const taunt = options.taunt || "THAT TICKLES.";

  if (event.type === "boundless-clash") return [];
  if (event.type === "stalemate") {
    return [
      { side: 1, kind: "thought", copy: "NO OPENING…" },
      { side: 2, kind: "thought", copy: "NO OPENING…" },
    ];
  }
  if (event.type === "power-clash") {
    if (phase === "preview") {
      return [
        { side: 1, kind: "shout", copy: "I WON’T YIELD!" },
        { side: 2, kind: "shout", copy: "THEN COME ON!" },
      ];
    }
    const leftOut = event.leftHealthAfter <= 0;
    const rightOut = event.rightHealthAfter <= 0;
    if (leftOut || rightOut) return [{ side: leftOut ? 2 : 1, kind: "shout", copy: "I’M STILL HERE!" }];
    return [
      { side: 1, kind: "thought", copy: "I FELT THAT…" },
      { side: 2, kind: "thought", copy: "I FELT THAT…" },
    ];
  }
  if (event.type !== "attack") return [];

  if (phase === "preview") {
    const copy = event.blitzType === "extreme-blitz"
      ? "YOU WON’T SEE THE THIRD HIT!"
      : event.blitzType === "speed-blitz"
        ? "TOO SLOW!"
        : event.oneShot
          ? "THIS ENDS NOW!"
          : "MY TURN.";
    return [{ side: event.attacker, kind: event.oneShot || event.blitzType ? "shout" : "speech", copy }];
  }

  const defenderOut = event.defender === 1 ? event.leftHealthAfter <= 0 : event.rightHealthAfter <= 0;
  if (event.immune) return [{ side: event.defender, kind: "speech", copy: taunt }];
  if (defenderOut) return [{ side: event.attacker, kind: "shout", copy: "FINISHED." }];
  return [{ side: event.defender, kind: "thought", copy: remaining }];
}
