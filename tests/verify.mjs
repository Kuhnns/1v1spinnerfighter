import assert from "node:assert/strict";
import { animeCharacters } from "../data/anime.js";
import { dcCharacters, marvelCharacters } from "../data/comics.js";
import { menaceCharacters } from "../data/menaces.js";
import {
  CATEGORY_WEIGHTS,
  chooseWeighted,
  formatPower,
  powerScore,
  resolveBattle,
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

const finiteLow = { name: "Low", power: "1e3" };
const finiteHigh = { name: "High", power: "1e9" };
const boundlessOne = { name: "Infinite One", power: "Infinity" };
const boundlessTwo = { name: "Infinite Two", power: "Infinity" };
assert.deepEqual(sortTeam([finiteLow, boundlessOne, finiteHigh]).map((character) => character.name), [
  "Infinite One",
  "High",
  "Low",
]);

const battle = resolveBattle(
  [boundlessOne, finiteHigh, finiteLow],
  [boundlessTwo, finiteLow, { name: "Lowest", power: "1" }],
);
assert.equal(battle.clashes[0].reason, "boundless-nullification");
assert.equal(battle.scoreOne, 2);
assert.equal(battle.scoreTwo, 0);
assert.equal(battle.winner, 1);

console.log("Verified 250 fighters, weighted pools, power formatting, sorting, and battle cancellation rules.");
