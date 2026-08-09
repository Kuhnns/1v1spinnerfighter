import assert from "node:assert/strict";
import { animeCharacters } from "../data/anime.js";
import { dcCharacters, marvelCharacters } from "../data/comics.js";
import { menaceCharacters } from "../data/menaces.js";
import { videoGameCharacters } from "../data/video-games.js";
import {
  CATEGORY_WEIGHTS,
  classifyPowerMismatch,
  chooseWeighted,
  draftAutomatedTeam,
  formatHealth,
  formatPower,
  healthToPowerString,
  powerScore,
  powerToHealth,
  resolveBattle,
  resolveClash,
  sortTeam,
} from "../game-logic.js";

const pools = {
  anime: animeCharacters,
  marvel: marvelCharacters,
  dc: dcCharacters,
  games: videoGameCharacters,
  menace: menaceCharacters,
};

assert.equal(marvelCharacters.length, 50);
assert.equal(dcCharacters.length, 50);
assert.equal(animeCharacters.length, 100);
assert.equal(videoGameCharacters.length, 50);
assert.equal(menaceCharacters.length, 50);
assert.equal(Object.values(pools).flat().length, 300);
for (const name of ["Kirby", "Arceus", "Bayonetta", "Kratos", "Asura", "Doom Slayer", "Dante", "Sephiroth", "Giygas", "SHODAN", "Kefka Palazzo"]) {
  assert.ok(videoGameCharacters.some((character) => character.name === name), `${name} must be in Video Game Legends`);
  assert.ok(!menaceCharacters.some((character) => character.name === name), `${name} must not remain in Menaces`);
}

const animeSources = Object.groupBy(animeCharacters, (character) => character.source);
assert.equal(animeSources["Jujutsu Kaisen"].length, 30);
assert.equal(animeSources.Naruto.length, 30);
assert.equal(animeSources["One Piece"].length, 30);
assert.equal(animeSources["Dragon Ball"].length, 10);

const all = Object.values(pools).flat();
assert.equal(new Set(all.map((character) => character.id)).size, all.length);
assert.equal(new Set(all.map((character) => character.name.toLowerCase())).size, all.length);

for (const character of all) {
  assert.deepEqual(Object.keys(character).sort(), ["form", "id", "name", "power", "source", "wiki"]);
  Object.values(character).forEach((value) => assert.equal(typeof value, "string"));
  assert.ok(Number.isFinite(powerScore(character.power)) || character.power === "Infinity");
}

assert.ok(Math.abs(Object.values(CATEGORY_WEIGHTS).reduce((sum, weight) => sum + weight, 0) - 1) < 1e-12);
assert.deepEqual(CATEGORY_WEIGHTS, { anime: 0.25, marvel: 0.25, dc: 0.25, games: 0.15, menace: 0.1 });
const weighted = Object.entries(CATEGORY_WEIGHTS).map(([id, weight]) => ({ id, weight }));
assert.equal(chooseWeighted(weighted, 0).id, "anime");
assert.equal(chooseWeighted(weighted, 0.249999).id, "anime");
assert.equal(chooseWeighted(weighted, 0.25).id, "marvel");
assert.equal(chooseWeighted(weighted, 0.5).id, "dc");
assert.equal(chooseWeighted(weighted, 0.75).id, "games");
assert.equal(chooseWeighted(weighted, 0.899999).id, "games");
assert.equal(chooseWeighted(weighted, 0.9).id, "menace");
assert.equal(chooseWeighted(weighted, 0.95).id, "menace");

const draftFighter = (id) => Object.freeze({
  id,
  name: id.toUpperCase(),
  form: "Test Form",
  source: "Test Source",
  wiki: "Test Fighter",
  power: "1",
});
const alphaOne = draftFighter("alpha-1");
const alphaTwo = draftFighter("alpha-2");
const alphaThree = draftFighter("alpha-3");
const betaOne = draftFighter("beta-1");
const betaTwo = draftFighter("beta-2");
const gammaOne = draftFighter("gamma-1");
const gammaTwo = draftFighter("gamma-2");
const automatedCategories = Object.freeze([
  Object.freeze({ id: "alpha", label: "ALPHA", weight: 0.5, roster: Object.freeze([alphaOne, alphaTwo, alphaThree]) }),
  Object.freeze({ id: "beta", label: "BETA", weight: 0.3, roster: Object.freeze([betaOne, betaTwo]) }),
  Object.freeze({ id: "gamma", label: "GAMMA", weight: 0.2, roster: Object.freeze([gammaOne, gammaTwo]) }),
]);

function sequenceRandom(values) {
  let calls = 0;
  const random = () => values[calls++];
  random.calls = () => calls;
  return random;
}

const inputUsed = new Set([alphaOne.id, betaOne.id]);
const inputUsedSnapshot = [...inputUsed];
const deterministicRandom = sequenceRandom([0, 0, 0.99, 0, 0.49, 0.999]);
const automatedTeam = draftAutomatedTeam(automatedCategories, inputUsed, deterministicRandom);
assert.deepEqual(automatedTeam.map(({ id }) => id), ["alpha-2", "gamma-1", "alpha-3"]);
assert.deepEqual(automatedTeam.map(({ categoryId }) => categoryId), ["alpha", "gamma", "alpha"]);
assert.deepEqual(automatedTeam.map(({ categoryLabel }) => categoryLabel), ["ALPHA", "GAMMA", "ALPHA"]);
assert.equal(automatedTeam.length, 3);
assert.equal(new Set(automatedTeam.map(({ id }) => id)).size, 3);
assert.equal(deterministicRandom.calls(), 6, "Automated drafting must consume exactly two random units per pick");
assert.deepEqual([...inputUsed], inputUsedSnapshot, "Automated drafting must not mutate its used-id Set");
assert.ok(automatedTeam.every(({ id }) => !inputUsed.has(id)));
assert.notEqual(automatedTeam[0], alphaTwo, "Decorating a fighter must return a new record");
assert.equal("categoryId" in alphaTwo, false, "Roster fighters must not be decorated in place");

const exhaustedCategoryRandom = sequenceRandom([0, 0, 0, 0.999, 0.5, 0]);
const exhaustedCategoryTeam = draftAutomatedTeam([
  { id: "heavy", label: "HEAVY", weight: 0.99, roster: [draftFighter("heavy-only")] },
  {
    id: "reserve",
    label: "RESERVE",
    weight: 0.01,
    roster: [draftFighter("reserve-1"), draftFighter("reserve-2"), draftFighter("reserve-3")],
  },
], new Set(), exhaustedCategoryRandom);
assert.deepEqual(exhaustedCategoryTeam.map(({ id }) => id), ["heavy-only", "reserve-3", "reserve-1"]);
assert.deepEqual(exhaustedCategoryTeam.map(({ categoryId }) => categoryId), ["heavy", "reserve", "reserve"]);
assert.equal(exhaustedCategoryRandom.calls(), 6, "An exhausted category must be removed instead of rerolled");

const globallyShared = draftFighter("globally-shared");
const globallyUniqueTeam = draftAutomatedTeam([
  { id: "left", label: "LEFT", weight: 0.5, roster: [globallyShared, draftFighter("left-only")] },
  { id: "right", label: "RIGHT", weight: 0.5, roster: [globallyShared, draftFighter("right-1"), draftFighter("right-2")] },
], new Set(), sequenceRandom([0, 0, 0.9, 0, 0.9, 0.9]));
assert.deepEqual(globallyUniqueTeam.map(({ id }) => id), ["globally-shared", "right-1", "right-2"]);
assert.equal(new Set(globallyUniqueTeam.map(({ id }) => id)).size, 3, "IDs shared across rosters must not be drawn twice");

const threeFighterCategory = [{
  id: "valid",
  label: "VALID",
  weight: 1,
  roster: [draftFighter("valid-1"), draftFighter("valid-2"), draftFighter("valid-3")],
}];
assert.throws(() => draftAutomatedTeam(), /Categories must be a non-empty array/);
assert.throws(() => draftAutomatedTeam([], new Set(), () => 0), /Categories must be a non-empty array/);
assert.throws(() => draftAutomatedTeam(threeFighterCategory, [], () => 0), /used fighter ids.*Set/i);
assert.throws(() => draftAutomatedTeam(threeFighterCategory, new Set([""]), () => 0), /non-empty string/);
assert.throws(() => draftAutomatedTeam(threeFighterCategory, new Set(), 0), /RNG must be a function/);
assert.throws(() => draftAutomatedTeam(threeFighterCategory, new Set(), () => NaN), /RNG must return a finite number/);
assert.throws(() => draftAutomatedTeam([null], new Set(), () => 0), /must be an object/);
assert.throws(() => draftAutomatedTeam([
  { id: "same", label: "ONE", weight: 1, roster: [] },
  { id: "same", label: "TWO", weight: 1, roster: [] },
], new Set(), () => 0), /Duplicate category id/);
assert.throws(() => draftAutomatedTeam([
  { id: "bad-weight", label: "BAD", weight: -1, roster: [] },
], new Set(), () => 0), /finite, non-negative weight/);
assert.throws(() => draftAutomatedTeam([
  { id: "bad-roster", label: "BAD", weight: 1, roster: null },
], new Set(), () => 0), /roster array/);
assert.throws(() => draftAutomatedTeam([
  { id: "bad-fighter", label: "BAD", weight: 1, roster: [{}] },
], new Set(), () => 0), /non-empty id/);
assert.throws(() => draftAutomatedTeam([
  { id: "too-small", label: "SMALL", weight: 1, roster: [draftFighter("only-1"), draftFighter("only-2")] },
], new Set(), () => 0), /requires at least 3 unused fighters/);
assert.throws(() => draftAutomatedTeam([
  { id: "zero", label: "ZERO", weight: 0, roster: [draftFighter("zero-1"), draftFighter("zero-2"), draftFighter("zero-3")] },
], new Set(), () => 0), /requires at least 3 unused fighters/);

const usedDuringFailure = new Set(["human-pick"]);
assert.throws(
  () => draftAutomatedTeam(threeFighterCategory, usedDuringFailure, sequenceRandom([0, 0, NaN])),
  /RNG must return a finite number/,
);
assert.deepEqual([...usedDuringFailure], ["human-pick"], "A mid-draft error must not mutate the caller's Set");

assert.equal(formatPower("1500000000"), "1.5B");
assert.equal(formatPower("1.5e9"), "1.5B");
assert.equal(formatPower("Infinity"), "∞ BOUNDLESS");
assert.equal(formatHealth(0n), "0");
assert.equal(formatHealth(1_599_999_999n), "1.5B");
assert.equal(formatHealth("999999"), "999K");
assert.equal(formatHealth("1234567890123456789012345678901234567890"), "1.2e39");
assert.equal(formatHealth("1e100"), "1e100");

assert.equal(powerToHealth("1.5e9"), 1_500_000_000n);
assert.equal(powerToHealth("100e-2"), 1n);
assert.equal(
  powerToHealth("9.7e99"),
  97n * 10n ** 98n,
);
assert.equal(powerToHealth(42n), 42n);
assert.equal(powerToHealth("Infinity"), Infinity);
assert.equal(healthToPowerString(1_500_000_000n), "1500000000");
assert.equal(healthToPowerString(Infinity), "Infinity");
assert.throws(() => powerToHealth("1.5"), /Invalid power value/);
assert.throws(() => powerToHealth("0"), /Invalid power value/);
assert.throws(() => powerToHealth("not-a-power"), /Invalid power value/);
assert.throws(() => powerToHealth(Number.MAX_SAFE_INTEGER + 1), /Invalid power value/);

const finiteLow = { name: "Low", power: "1e3" };
const finiteHigh = { name: "High", power: "1e9" };
const boundlessOne = { name: "Infinite One", power: "Infinity" };
const boundlessTwo = { name: "Infinite Two", power: "Infinity" };
assert.deepEqual(sortTeam([finiteLow, boundlessOne, finiteHigh]).map((character) => character.name), [
  "Infinite One",
  "High",
  "Low",
]);

const almostEqualLow = { name: "Almost Equal Low", power: "1000000000000000000000000000000" };
const almostEqualHigh = { name: "Almost Equal High", power: "1000000000000000000000000000001" };
assert.deepEqual(sortTeam([almostEqualLow, almostEqualHigh]).map((character) => character.name), [
  "Almost Equal High",
  "Almost Equal Low",
]);

const exactScale = 10n ** 250n;
assert.deepEqual(classifyPowerMismatch(exactScale, exactScale), {
  severity: "fair",
  verdict: "dead-even",
  stronger: 0,
  powerGap: 0n,
});
assert.deepEqual(classifyPowerMismatch(exactScale + 1n, exactScale), {
  severity: "fair",
  verdict: "photo-finish",
  stronger: 1,
  powerGap: 1n,
});
assert.equal(classifyPowerMismatch(exactScale * 5n - 1n, exactScale * 4n).severity, "fair");
assert.deepEqual(classifyPowerMismatch(exactScale * 5n, exactScale * 4n), {
  severity: "edge",
  verdict: "narrow-edge",
  stronger: 1,
  powerGap: exactScale,
});
assert.equal(classifyPowerMismatch(exactScale * 2n - 1n, exactScale).severity, "edge");
assert.equal(classifyPowerMismatch(exactScale * 2n, exactScale).severity, "dominant");
assert.equal(classifyPowerMismatch(exactScale * 10n - 1n, exactScale).severity, "dominant");
assert.equal(classifyPowerMismatch(exactScale * 10n, exactScale).severity, "brutal");
assert.equal(classifyPowerMismatch(exactScale * 1000n - 1n, exactScale).severity, "brutal");
assert.deepEqual(classifyPowerMismatch(exactScale * 1000n, exactScale), {
  severity: "soloed",
  verdict: "total-mismatch",
  stronger: 1,
  powerGap: exactScale * 999n,
});
assert.deepEqual(classifyPowerMismatch(1n, 10n ** 500n), {
  severity: "soloed",
  verdict: "total-mismatch",
  stronger: 2,
  powerGap: 10n ** 500n - 1n,
});
assert.deepEqual(classifyPowerMismatch(Infinity, exactScale), {
  severity: "soloed",
  verdict: "boundless-overmatch",
  stronger: 1,
  powerGap: Infinity,
});
assert.deepEqual(classifyPowerMismatch(exactScale, "Infinity"), {
  severity: "soloed",
  verdict: "boundless-overmatch",
  stronger: 2,
  powerGap: Infinity,
});
assert.deepEqual(classifyPowerMismatch("Infinity", Infinity), {
  severity: "fair",
  verdict: "boundless-nullification",
  stronger: 0,
  powerGap: 0n,
});

const finiteClash = resolveClash(
  { name: "Fifteen", power: "15" },
  { name: "Ten", power: "10" },
);
assert.equal(finiteClash.winner, 1);
assert.equal(finiteClash.reason, "greater-power");
assert.equal(finiteClash.leftHealthBefore, 15n);
assert.equal(finiteClash.rightHealthBefore, 10n);
assert.equal(finiteClash.leftHealthAfter, 5n);
assert.equal(finiteClash.rightHealthAfter, 0n);
assert.deepEqual(finiteClash.eliminated, { left: false, right: true });
assert.equal(finiteClash.severity, "edge");
assert.equal(finiteClash.verdict, "narrow-edge");
assert.equal(finiteClash.stronger, 1);
assert.equal(finiteClash.powerGap, 5n);

const exactBigIntClash = resolveClash(
  { name: "Exact High", power: "1" },
  { name: "Exact Low", power: "1" },
  exactScale + 1n,
  exactScale,
);
assert.equal(exactBigIntClash.leftHealthAfter, 1n);
assert.equal(exactBigIntClash.rightHealthAfter, 0n);
assert.equal(exactBigIntClash.severity, "fair");
assert.equal(exactBigIntClash.verdict, "photo-finish");
assert.equal(exactBigIntClash.powerGap, 1n);

const equalClash = resolveClash(
  { name: "Equal Left", power: "1e80" },
  { name: "Equal Right", power: "1e80" },
);
assert.equal(equalClash.winner, 0);
assert.equal(equalClash.reason, "equal-power");
assert.equal(equalClash.leftHealthAfter, 0n);
assert.equal(equalClash.rightHealthAfter, 0n);
assert.equal(equalClash.severity, "fair");
assert.equal(equalClash.verdict, "dead-even");
assert.equal(equalClash.powerGap, 0n);

const infinityWin = resolveClash(boundlessOne, { name: "Huge Finite", power: "9.9e100" });
assert.equal(infinityWin.winner, 1);
assert.equal(infinityWin.leftHealthAfter, Infinity);
assert.equal(infinityWin.rightHealthAfter, 0n);
assert.equal(infinityWin.severity, "soloed");
assert.equal(infinityWin.verdict, "boundless-overmatch");
assert.equal(infinityWin.powerGap, Infinity);

const infinityCancellation = resolveClash(boundlessOne, boundlessTwo);
assert.equal(infinityCancellation.winner, 0);
assert.equal(infinityCancellation.reason, "boundless-nullification");
assert.equal(infinityCancellation.leftHealthAfter, 0n);
assert.equal(infinityCancellation.rightHealthAfter, 0n);
assert.equal(infinityCancellation.severity, "fair");
assert.equal(infinityCancellation.verdict, "boundless-nullification");
assert.equal(infinityCancellation.powerGap, 0n);

const fighter = (name, power) => ({ name, power });
const enduranceBattle = resolveBattle(
  [fighter("A4", "4"), fighter("A10", "10"), fighter("A5", "5")],
  [fighter("B6", "6"), fighter("B3", "3"), fighter("B7", "7")],
);

assert.deepEqual(enduranceBattle.sortedOne.map(({ name }) => name), ["A10", "A5", "A4"]);
assert.deepEqual(enduranceBattle.sortedTwo.map(({ name }) => name), ["B7", "B6", "B3"]);
assert.equal(enduranceBattle.timeline, enduranceBattle.clashes);
assert.equal(enduranceBattle.timeline.length, 5);
assert.deepEqual(
  enduranceBattle.timeline.map(({ leftIndex, rightIndex }) => [leftIndex, rightIndex]),
  [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]],
);
assert.deepEqual(
  enduranceBattle.timeline.map(({ leftHealthBefore, rightHealthBefore }) => [leftHealthBefore, rightHealthBefore]),
  [[10n, 7n], [3n, 6n], [5n, 3n], [2n, 3n], [4n, 1n]],
);
assert.deepEqual(
  enduranceBattle.timeline.map(({ leftHealthAfter, rightHealthAfter }) => [leftHealthAfter, rightHealthAfter]),
  [[3n, 0n], [0n, 3n], [2n, 0n], [0n, 1n], [3n, 0n]],
);
assert.deepEqual(
  enduranceBattle.timeline.map(({ nextLeftIndex, nextRightIndex }) => [nextLeftIndex, nextRightIndex]),
  [[0, 1], [1, 1], [1, 2], [2, 2], [2, 3]],
);
assert.deepEqual(
  enduranceBattle.timeline.map(({ remainingOne, remainingTwo }) => [remainingOne, remainingTwo]),
  [[3, 2], [2, 2], [2, 1], [1, 1], [1, 0]],
);
assert.deepEqual(
  enduranceBattle.timeline.map(({ severity, verdict }) => [severity, verdict]),
  [
    ["edge", "narrow-edge"],
    ["dominant", "decisive-win"],
    ["edge", "narrow-edge"],
    ["edge", "narrow-edge"],
    ["dominant", "decisive-win"],
  ],
);
assert.equal(enduranceBattle.scoreOne, 3);
assert.equal(enduranceBattle.scoreTwo, 2);
assert.equal(enduranceBattle.winner, 1);
assert.equal(enduranceBattle.isDraw, false);
assert.equal(enduranceBattle.survivorsOne.length, 1);
assert.equal(enduranceBattle.survivorsOne[0].name, "A4");
assert.equal(enduranceBattle.survivorsOne[0].health, 3n);
assert.equal(enduranceBattle.survivorsOne[0].maxHealth, 4n);
assert.equal(enduranceBattle.survivorsOne[0].remainingPower, "3");
assert.equal(enduranceBattle.survivorsTwo.length, 0);
assert.equal(enduranceBattle.remainingHealthOne, 3n);
assert.equal(enduranceBattle.remainingHealthTwo, 0n);

const cancellationBattle = resolveBattle(
  [boundlessOne, fighter("Left Five", "5")],
  [boundlessTwo, fighter("Right Three", "3")],
);
assert.equal(cancellationBattle.timeline.length, 2);
assert.equal(cancellationBattle.timeline[0].reason, "boundless-nullification");
assert.equal(cancellationBattle.timeline[1].leftHealthAfter, 2n);
assert.equal(cancellationBattle.winner, 1);

const completeDraw = resolveBattle(
  [boundlessOne, fighter("Left Ten", "10"), fighter("Left Two", "2")],
  [boundlessTwo, fighter("Right Ten", "10"), fighter("Right Two", "2")],
);
assert.equal(completeDraw.timeline.length, 3);
assert.equal(completeDraw.winner, 0);
assert.equal(completeDraw.isDraw, true);
assert.deepEqual(completeDraw.survivorsOne, []);
assert.deepEqual(completeDraw.survivorsTwo, []);
assert.equal(completeDraw.remainingHealthOne, 0n);
assert.equal(completeDraw.remainingHealthTwo, 0n);

const infinitySweep = resolveBattle(
  [boundlessOne, fighter("Reserve Two", "2"), fighter("Reserve One", "1")],
  [fighter("Thirty", "30"), fighter("Twenty", "20"), fighter("Ten", "10")],
);
assert.equal(infinitySweep.timeline.length, 3);
assert.ok(infinitySweep.timeline.every((clash) => clash.leftHealthAfter === Infinity));
assert.ok(infinitySweep.timeline.every((clash) => clash.rightHealthAfter === 0n));
assert.equal(infinitySweep.winner, 1);
assert.equal(infinitySweep.survivorsOne.length, 3);
assert.equal(infinitySweep.remainingHealthOne, Infinity);
assert.equal(infinitySweep.remainingHealthTwo, 0n);

console.log("Verified 300 fighters plus exact BigInt endurance, mismatch severity boundaries, health formatting, and Infinity rules.");
