import assert from "node:assert/strict";
import { animeCharacters } from "../data/anime.js";
import { dcCharacters, marvelCharacters } from "../data/comics.js";
import { menaceCharacters } from "../data/menaces.js";
import {
  CATEGORY_WEIGHTS,
  chooseWeighted,
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
  menace: menaceCharacters,
};

assert.equal(marvelCharacters.length, 50);
assert.equal(dcCharacters.length, 50);
assert.equal(animeCharacters.length, 100);
assert.equal(menaceCharacters.length, 50);
assert.equal(Object.values(pools).flat().length, 250);

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
const weighted = [
  { id: "anime", weight: 0.3 },
  { id: "marvel", weight: 0.3 },
  { id: "dc", weight: 0.3 },
  { id: "menace", weight: 0.1 },
];
assert.equal(chooseWeighted(weighted, 0).id, "anime");
assert.equal(chooseWeighted(weighted, 0.299999).id, "anime");
assert.equal(chooseWeighted(weighted, 0.3).id, "marvel");
assert.equal(chooseWeighted(weighted, 0.6).id, "dc");
assert.equal(chooseWeighted(weighted, 0.95).id, "menace");

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

const equalClash = resolveClash(
  { name: "Equal Left", power: "1e80" },
  { name: "Equal Right", power: "1e80" },
);
assert.equal(equalClash.winner, 0);
assert.equal(equalClash.reason, "equal-power");
assert.equal(equalClash.leftHealthAfter, 0n);
assert.equal(equalClash.rightHealthAfter, 0n);

const infinityWin = resolveClash(boundlessOne, { name: "Huge Finite", power: "9.9e100" });
assert.equal(infinityWin.winner, 1);
assert.equal(infinityWin.leftHealthAfter, Infinity);
assert.equal(infinityWin.rightHealthAfter, 0n);

const infinityCancellation = resolveClash(boundlessOne, boundlessTwo);
assert.equal(infinityCancellation.winner, 0);
assert.equal(infinityCancellation.reason, "boundless-nullification");
assert.equal(infinityCancellation.leftHealthAfter, 0n);
assert.equal(infinityCancellation.rightHealthAfter, 0n);

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

console.log("Verified 250 fighters plus exact BigInt endurance, five-clash timelines, health formatting, and Infinity rules.");
