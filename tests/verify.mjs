import assert from "node:assert/strict";
import { animeCharacters } from "../data/anime.js";
import { dcCharacters, marvelCharacters } from "../data/comics.js";
import { menaceCharacters } from "../data/menaces.js";
import { videoGameCharacters } from "../data/video-games.js";
import {
  CATEGORY_WEIGHTS,
  DAMAGE_PERCENTAGES,
  MAX_HEALTH_PERCENT,
  SPEED_TIERS,
  STRENGTH_DURABILITY_TIERS,
  calculateDamagePercent,
  classifyPowerMismatch,
  chooseWeighted,
  draftAutomatedTeam,
  formatHealth,
  formatPower,
  getCombatStats,
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

assert.deepEqual(STRENGTH_DURABILITY_TIERS, {
  Human: 0,
  Building: 1,
  "City Block": 2,
  Town: 3,
  City: 4,
  Country: 5,
  Continent: 6,
  Planetary: 7,
  Universal: 8,
  Multiversal: 9,
  Outerversal: 10,
  Boundless: 11,
});
assert.deepEqual(SPEED_TIERS, {
  Human: 1,
  "Peak Human": 2,
  Superhuman: 3,
  Subsonic: 4,
  Transonic: 5,
  Supersonic: 6,
  Hypersonic: 7,
  "Sub-Relativistic": 8,
  Relativistic: 9,
  "Speed of Light": 10,
  "Faster than Light": 11,
  "Massively FTL": 12,
  Omnipresent: 13,
});
assert.deepEqual(DAMAGE_PERCENTAGES, {
  threeOrMoreTiersLower: 3,
  twoTiersLower: 8,
  oneTierLower: 15,
  equal: 25,
  oneTierHigher: 40,
  twoTiersHigher: 65,
  threeOrMoreTiersHigher: 100,
});
assert.equal(MAX_HEALTH_PERCENT, 100);

const combatFighter = (name, strength, durability, speed) => ({
  name,
  power: "1",
  strength,
  durability,
  speed,
});
const combatRandom = (values) => {
  let calls = 0;
  const random = () => values[calls++];
  random.calls = () => calls;
  return random;
};

assert.deepEqual(getCombatStats(combatFighter("Labels", "Universal", "Human", "Massively FTL")), {
  strength: 8,
  durability: 0,
  speed: 12,
});
assert.deepEqual(getCombatStats(combatFighter("Numbers", 11, 0, 13)), {
  strength: 11,
  durability: 0,
  speed: 13,
});
assert.throws(() => getCombatStats(null), /Fighter must be an object/);
assert.throws(() => getCombatStats(combatFighter("Bad Strength", 0, 1, 1)), /Strength.*1 to 11/);
assert.throws(() => getCombatStats(combatFighter("Bad Durability", 1, -1, 1)), /Durability.*0 to 11/);
assert.throws(() => getCombatStats(combatFighter("Bad Speed", 1, 1, 14)), /Speed.*1 to 13/);

assert.equal(calculateDamagePercent(1, 4), 3);
assert.equal(calculateDamagePercent(2, 4), 8);
assert.equal(calculateDamagePercent(3, 4), 15);
assert.equal(calculateDamagePercent(4, 4), 25);
assert.equal(calculateDamagePercent(5, 4), 40);
assert.equal(calculateDamagePercent(6, 4), 65);
assert.equal(calculateDamagePercent(7, 4), 100);
assert.equal(calculateDamagePercent(11, 0), 100, "Human durability remains below Building");
assert.equal(calculateDamagePercent("Universal", "Planetary"), 40);
assert.equal(calculateDamagePercent("Outerversal", "Boundless"), 0);
assert.equal(calculateDamagePercent("Boundless", "Boundless"), 25);
assert.throws(() => calculateDamagePercent(12, 1), /Strength.*1 to 11/);

const alternating = resolveClash(
  combatFighter("Faster", 4, 4, 7),
  combatFighter("Slower", 4, 4, 6),
);
assert.equal(alternating.firstAttacker, 1);
assert.equal(alternating.winner, 1);
assert.equal(alternating.leftHealthAfter, 25);
assert.equal(alternating.rightHealthAfter, 0);
assert.deepEqual(alternating.events.map(({ attacker }) => attacker), [1, 2, 1, 2, 1, 2, 1]);
assert.ok(alternating.events.every((event) => event.type === "attack"));

const equalSpeedRandom = combatRandom([0.75]);
const equalSpeed = resolveClash(
  combatFighter("Hard Hitter", 5, 5, 7),
  combatFighter("Quick Starter", 4, 4, 7),
  100,
  100,
  equalSpeedRandom,
);
assert.equal(equalSpeed.firstAttacker, 2);
assert.equal(equalSpeed.events[0].attacker, 2);
assert.equal(equalSpeed.winner, 1);
assert.equal(equalSpeed.leftHealthAfter, 55);
assert.equal(equalSpeedRandom.calls(), 1, "An equal-Speed tie consumes one deterministic coin flip");

const clashRandom = combatRandom([0.75]);
const powerClash = resolveClash(
  combatFighter("Clash Left", 4, 4, 7),
  combatFighter("Clash Right", 4, 4, 7),
  100,
  100,
  clashRandom,
);
assert.equal(powerClash.powerClash, true);
assert.equal(powerClash.events[0].type, "power-clash");
assert.equal(powerClash.events[0].leftDamage, 12.5);
assert.equal(powerClash.events[0].rightDamage, 12.5);
assert.equal(powerClash.events[0].damageMultiplier, 0.5);
assert.equal(powerClash.firstAttacker, 2);
assert.deepEqual(powerClash.events.slice(1).map(({ attacker }) => attacker), [2, 1, 2, 1, 2, 1, 2]);
assert.equal(powerClash.winner, 2);
assert.equal(powerClash.rightHealthAfter, 12.5);
assert.equal(clashRandom.calls(), 1);

const lowHealthClash = resolveClash(
  combatFighter("Low Left", 4, 4, 7),
  combatFighter("Low Right", 4, 4, 7),
  5,
  5,
  () => 0,
);
assert.equal(lowHealthClash.events[0].type, "power-clash");
assert.ok(
  lowHealthClash.events[0].leftHealthAfter <= 0 || lowHealthClash.events[0].rightHealthAfter <= 0,
  "A lethal Power Clash event exposes the eliminated fighter to the presentation layer",
);
assert.notDeepEqual(lowHealthClash.eliminated, { left: true, right: true }, "Only a Boundless clash may double KO");
assert.equal(lowHealthClash.winner, 1);

const speedBlitz = resolveClash(
  combatFighter("Blitzer", 4, 4, 10),
  combatFighter("Target", 4, 4, 6),
);
assert.equal(speedBlitz.blitzType, "speed-blitz");
assert.equal(speedBlitz.openingAttackCount, 2);
assert.deepEqual(speedBlitz.events.map(({ attacker }) => attacker), [1, 1, 2, 1, 2, 1]);
assert.deepEqual(speedBlitz.events.slice(0, 2).map(({ blitzHit }) => blitzHit), [1, 2]);
assert.ok(speedBlitz.events.slice(0, 2).every(({ opening }) => opening));

const belowBlitzThreshold = resolveClash(
  combatFighter("Three Tiers Faster", 4, 4, 9),
  combatFighter("Not Blitzed", 4, 4, 6),
);
assert.equal(belowBlitzThreshold.blitzType, null);
assert.equal(belowBlitzThreshold.openingAttackCount, 1);
assert.deepEqual(belowBlitzThreshold.events.slice(0, 2).map(({ attacker }) => attacker), [1, 2]);

const fiveTierBlitz = resolveClash(
  combatFighter("Five Tiers Faster", 4, 4, 11),
  combatFighter("Still Regular Blitz", 4, 4, 6),
);
assert.equal(fiveTierBlitz.blitzType, "speed-blitz");
assert.equal(fiveTierBlitz.openingAttackCount, 2);

const extremeBlitz = resolveClash(
  combatFighter("Extreme Blitzer", 4, 4, 12),
  combatFighter("Extreme Target", 4, 4, 6),
);
assert.equal(extremeBlitz.blitzType, "extreme-blitz");
assert.equal(extremeBlitz.openingAttackCount, 3);
assert.deepEqual(extremeBlitz.events.map(({ attacker }) => attacker), [1, 1, 1, 2, 1]);
assert.deepEqual(extremeBlitz.events.slice(0, 3).map(({ blitzHit }) => blitzHit), [1, 2, 3]);

const stoppedBlitz = resolveClash(
  combatFighter("One Shot", 7, 7, 13),
  combatFighter("Never Moves", 1, 1, 1),
);
assert.equal(stoppedBlitz.events.length, 1, "A knockout stops the opening burst immediately");
assert.equal(stoppedBlitz.events[0].oneShot, true);
assert.equal(stoppedBlitz.severity, "soloed");
assert.equal(stoppedBlitz.winner, 1);

const losingBlitzer = resolveClash(
  combatFighter("Fast but Harmless", 1, 8, 13),
  combatFighter("Slow Powerhouse", 11, 8, 7),
);
assert.equal(losingBlitzer.blitzType, "extreme-blitz");
assert.equal(losingBlitzer.winner, 2);
assert.notEqual(losingBlitzer.verdict, "extreme-blitz", "A losing blitzer must not receive the winner's verdict");

const immuneTank = resolveClash(
  combatFighter("Boundless Tank", 8, 11, 1),
  combatFighter("Outerversal Speedster", 10, 8, 13),
);
assert.equal(immuneTank.winner, 1);
assert.equal(immuneTank.leftHealthAfter, 100);
assert.equal(immuneTank.events[0].immune, true);
assert.equal(immuneTank.events[0].damage, 0);
assert.ok(immuneTank.events.some(({ attacker, damage }) => attacker === 1 && damage === 25));

const boundlessCanDamage = resolveClash(
  combatFighter("Boundless Attacker", 11, 8, 13),
  combatFighter("Boundless Wall", 8, 11, 12),
);
assert.equal(boundlessCanDamage.events[0].damagePercent, 25);
assert.equal(boundlessCanDamage.winner, 1);

const dualBoundlessLeft = combatFighter("Infinite Left", 11, 11, 13);
const dualBoundlessRight = combatFighter("Infinite Right", 11, 11, 12);
const unusedBoundlessRandom = combatRandom([]);
const boundlessClash = resolveClash(dualBoundlessLeft, dualBoundlessRight, 100, 100, unusedBoundlessRandom);
assert.equal(boundlessClash.reason, "boundless-nullification");
assert.equal(boundlessClash.boundlessClash, true);
assert.equal(boundlessClash.events.length, 1);
assert.equal(boundlessClash.events[0].type, "boundless-clash");
assert.equal(boundlessClash.events[0].doubleKo, true);
assert.deepEqual(boundlessClash.eliminated, { left: true, right: true });
assert.equal(unusedBoundlessRandom.calls(), 0);

const notFullyBoundless = resolveClash(
  dualBoundlessLeft,
  combatFighter("Boundless Durability Only", 10, 11, 13),
);
assert.notEqual(notFullyBoundless.reason, "boundless-nullification");
assert.deepEqual(notFullyBoundless.eliminated, { left: false, right: true });

const mutualImmunity = resolveClash(
  combatFighter("Immune Left", 10, 11, 13),
  combatFighter("Immune Right", 10, 11, 13),
);
assert.equal(mutualImmunity.reason, "mutual-immunity");
assert.equal(mutualImmunity.stalemate, true);
assert.equal(mutualImmunity.events.length, 1);
assert.equal(mutualImmunity.events[0].type, "stalemate");
assert.deepEqual(mutualImmunity.eliminated, { left: false, right: false });

const orderedTeamOne = Object.freeze([
  Object.freeze(combatFighter("A First", 7, 7, 11)),
  Object.freeze(combatFighter("A Final", 10, 10, 13)),
]);
const orderedTeamTwo = Object.freeze([
  Object.freeze(combatFighter("B First", 1, 1, 1)),
  Object.freeze(combatFighter("B Final", 10, 7, 12)),
]);
const enduranceBattle = resolveBattle(orderedTeamOne, orderedTeamTwo);
assert.deepEqual(enduranceBattle.sortedOne.map(({ name }) => name), ["A First", "A Final"]);
assert.deepEqual(enduranceBattle.sortedTwo.map(({ name }) => name), ["B First", "B Final"]);
assert.equal(enduranceBattle.timeline, enduranceBattle.clashes);
assert.equal(enduranceBattle.events, enduranceBattle.actionTimeline);
assert.equal(enduranceBattle.timeline.length, 3);
assert.deepEqual(
  enduranceBattle.timeline.map(({ leftIndex, rightIndex }) => [leftIndex, rightIndex]),
  [[0, 0], [0, 1], [1, 1]],
);
assert.deepEqual(
  enduranceBattle.timeline.map(({ leftHealthBefore, rightHealthBefore }) => [leftHealthBefore, rightHealthBefore]),
  [[100, 100], [100, 100], [100, 100]],
);
assert.deepEqual(
  enduranceBattle.timeline.map(({ nextLeftIndex, nextRightIndex }) => [nextLeftIndex, nextRightIndex]),
  [[0, 1], [1, 1], [1, 2]],
);
assert.deepEqual(
  enduranceBattle.timeline.map(({ leftLastStand, rightLastStand }) => [leftLastStand, rightLastStand]),
  [[false, false], [false, true], [true, false]],
);
assert.deepEqual(
  enduranceBattle.timeline.map(({ leftIsLastFighter, rightIsLastFighter }) => [leftIsLastFighter, rightIsLastFighter]),
  [[false, false], [false, true], [true, true]],
);
assert.equal(enduranceBattle.scoreOne, 2);
assert.equal(enduranceBattle.scoreTwo, 1);
assert.equal(enduranceBattle.winner, 1);
assert.equal(enduranceBattle.isDraw, false);
assert.equal(enduranceBattle.stalemate, false);
assert.equal(enduranceBattle.survivorsOne.length, 1);
assert.equal(enduranceBattle.survivorsOne[0].name, "A Final");
assert.equal(enduranceBattle.survivorsOne[0].health, 100);
assert.equal(enduranceBattle.survivorsOne[0].maxHealth, 100);
assert.equal(enduranceBattle.survivorsOne[0].remainingPercent, 100);
assert.equal(enduranceBattle.survivorsTwo.length, 0);
assert.equal(enduranceBattle.remainingHealthOne, 100);
assert.equal(enduranceBattle.remainingHealthTwo, 0);
assert.deepEqual(enduranceBattle.events.map(({ sequence }) => sequence), [1, 2, 3]);
assert.deepEqual(enduranceBattle.events.map(({ round }) => round), [1, 2, 3]);

const carryBattle = resolveBattle(
  [combatFighter("Damaged Survivor", 4, 4, 7)],
  [combatFighter("Even Opponent", 4, 4, 6), combatFighter("Weak Reserve", 1, 1, 1)],
);
assert.equal(carryBattle.timeline.length, 2);
assert.equal(carryBattle.timeline[0].leftHealthAfter, 25);
assert.equal(carryBattle.timeline[1].leftHealthBefore, 25, "The winner carries percentage health into the next duel");
assert.equal(carryBattle.timeline[1].leftHealthAfter, 25);
assert.equal(carryBattle.survivorsOne[0].remainingPercent, 25);
assert.equal(carryBattle.winner, 1);

const cancellationBattle = resolveBattle(
  [dualBoundlessLeft, combatFighter("Left Finisher", 7, 7, 11)],
  [dualBoundlessRight, combatFighter("Right Reserve", 1, 1, 1)],
);
assert.equal(cancellationBattle.timeline.length, 2);
assert.equal(cancellationBattle.timeline[0].reason, "boundless-nullification");
assert.deepEqual(cancellationBattle.timeline[0].eliminated, { left: true, right: true });
assert.equal(cancellationBattle.timeline[1].leftLastStand, true);
assert.equal(cancellationBattle.timeline[1].rightLastStand, true);
assert.equal(cancellationBattle.winner, 1);

const completeDraw = resolveBattle(
  [dualBoundlessLeft, { ...dualBoundlessLeft, name: "Infinite Left Two" }],
  [dualBoundlessRight, { ...dualBoundlessRight, name: "Infinite Right Two" }],
);
assert.equal(completeDraw.timeline.length, 2);
assert.equal(completeDraw.winner, 0);
assert.equal(completeDraw.isDraw, true);
assert.equal(completeDraw.stalemate, false);
assert.deepEqual(completeDraw.survivorsOne, []);
assert.deepEqual(completeDraw.survivorsTwo, []);
assert.equal(completeDraw.remainingHealthOne, 0);
assert.equal(completeDraw.remainingHealthTwo, 0);

const lockedBattle = resolveBattle(
  [combatFighter("Locked Left", 10, 11, 13), combatFighter("Unused Left", 11, 11, 13)],
  [combatFighter("Locked Right", 10, 11, 12), combatFighter("Unused Right", 11, 11, 13)],
);
assert.equal(lockedBattle.timeline.length, 1, "Mutual immunity terminates instead of looping");
assert.equal(lockedBattle.events.length, 1);
assert.equal(lockedBattle.stalemate, true);
assert.equal(lockedBattle.winner, 0);
assert.equal(lockedBattle.isDraw, true);
assert.equal(lockedBattle.survivorsOne.length, 2);
assert.equal(lockedBattle.survivorsTwo.length, 2);

assert.throws(() => resolveClash(combatFighter("A", 1, 1, 1), combatFighter("B", 1, 1, 2), -1), /Left health/);
assert.throws(() => resolveClash(combatFighter("A", 1, 1, 1), combatFighter("B", 1, 1, 2), 100, 101), /Right health/);
assert.throws(() => resolveClash(combatFighter("A", 1, 1, 1), combatFighter("B", 1, 1, 2), null), /Left health/);
assert.throws(() => resolveClash(combatFighter("A", 1, 1, 1), combatFighter("B", 1, 1, 2), 100, 100, null), /combat RNG/);
assert.throws(
  () => resolveClash(combatFighter("A", 1, 1, 1), combatFighter("B", 2, 2, 1), 100, 100, () => NaN),
  /combat RNG must return a finite number/,
);
assert.throws(() => resolveBattle(null, []), /Teams must be arrays/);
assert.throws(() => resolveBattle([], [combatFighter("B", 1, 1, 1)]), /at least one fighter/);

console.log("Verified 300 fighters, legacy exact-power helpers, tier damage, turn order, blitzes, clashes, Boundless rules, and winner-stays percentage health.");
