import assert from "node:assert/strict";
import { animeCharacters } from "../data/anime.js";
import { dcCharacters, marvelCharacters } from "../data/comics.js";
import { menaceCharacters } from "../data/menaces.js";
import { getCharacterStats } from "../data/stats.js";
import { videoGameCharacters } from "../data/video-games.js";
import { resolveBattle, resolveClash } from "../game-logic.js";

const roster = [
  ...animeCharacters,
  ...marvelCharacters,
  ...dcCharacters,
  ...videoGameCharacters,
  ...menaceCharacters,
].map((fighter) => Object.freeze({ ...fighter, ...getCharacterStats(fighter.id) }));

let duelCount = 0;
let maximumDuelEvents = 0;
for (const left of roster) {
  for (const right of roster) {
    if (left.id === right.id) continue;
    const duel = resolveClash(left, right, 100, 100, () => 0.375);
    duelCount += 1;
    maximumDuelEvents = Math.max(maximumDuelEvents, duel.events.length);
    assert.ok(duel.events.length > 0 && duel.events.length <= 256);
    assert.ok(duel.leftHealthAfter >= 0 && duel.leftHealthAfter <= 100);
    assert.ok(duel.rightHealthAfter >= 0 && duel.rightHealthAfter <= 100);
    assert.equal(duel.leftEliminated, duel.leftHealthAfter <= 0);
    assert.equal(duel.rightEliminated, duel.rightHealthAfter <= 0);
    if (duel.boundlessClash) {
      assert.equal(left.strength, 11);
      assert.equal(left.durability, 11);
      assert.equal(right.strength, 11);
      assert.equal(right.durability, 11);
    }
  }
}

let seed = 0x1f2e3d4c;
function deterministicRandom() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}

for (let simulation = 0; simulation < 1_000; simulation += 1) {
  const chosen = new Set();
  const pick = () => {
    let index;
    do index = Math.floor(deterministicRandom() * roster.length);
    while (chosen.has(index));
    chosen.add(index);
    return roster[index];
  };
  const teamOne = [pick(), pick(), pick()];
  const teamTwo = [pick(), pick(), pick()];
  const battle = resolveBattle(teamOne, teamTwo, deterministicRandom);
  assert.ok([0, 1, 2].includes(battle.winner));
  assert.ok(battle.timeline.length > 0 && battle.timeline.length <= 5);
  assert.ok(battle.events.length >= battle.timeline.length);
  assert.deepEqual(battle.sortedOne, teamOne, "Team 1 entry order must be preserved");
  assert.deepEqual(battle.sortedTwo, teamTwo, "Team 2 entry order must be preserved");
  if (battle.winner === 1) {
    assert.ok(battle.survivorsOne.length > 0);
    assert.equal(battle.survivorsTwo.length, 0);
  } else if (battle.winner === 2) {
    assert.equal(battle.survivorsOne.length, 0);
    assert.ok(battle.survivorsTwo.length > 0);
  } else if (battle.stalemate) {
    assert.ok(battle.survivorsOne.length > 0 && battle.survivorsTwo.length > 0);
  } else {
    assert.equal(battle.survivorsOne.length, 0);
    assert.equal(battle.survivorsTwo.length, 0);
  }
}

console.log(`Verified ${duelCount.toLocaleString("en-US")} ordered roster duels, 1,000 complete 3v3 simulations, and a ${maximumDuelEvents}-event maximum duel.`);
