import assert from "node:assert/strict";
import { animeCharacters } from "../data/anime.js";
import { dcCharacters, marvelCharacters } from "../data/comics.js";
import { menaceCharacters } from "../data/menaces.js";
import {
  CHARACTER_STAT_COUNT,
  CHARACTER_STATS_BY_ID,
  POWER_TIER_LABELS,
  POWER_TIERS,
  SPEED_TIER_LABELS,
  SPEED_TIERS,
  characterStatsById,
  getCharacterStats,
} from "../data/stats.js";
import { videoGameCharacters } from "../data/video-games.js";

const roster = [
  ...marvelCharacters,
  ...dcCharacters,
  ...animeCharacters,
  ...videoGameCharacters,
  ...menaceCharacters,
];
const rosterIds = new Set(roster.map(({ id }) => id));
const statIds = Object.keys(characterStatsById);

assert.equal(roster.length, 300);
assert.equal(rosterIds.size, 300);
assert.equal(CHARACTER_STAT_COUNT, 300);
assert.equal(statIds.length, 300);
assert.deepEqual(new Set(statIds), rosterIds);
assert.equal(CHARACTER_STATS_BY_ID, characterStatsById);
assert.ok(Object.isFrozen(characterStatsById));
assert.ok(Object.isFrozen(POWER_TIERS));
assert.ok(Object.isFrozen(POWER_TIER_LABELS));
assert.ok(Object.isFrozen(SPEED_TIERS));
assert.ok(Object.isFrozen(SPEED_TIER_LABELS));

for (const [id, stats] of Object.entries(characterStatsById)) {
  assert.ok(rosterIds.has(id));
  assert.ok(Object.isFrozen(stats));
  assert.equal(POWER_TIERS[stats.strengthLabel], stats.strength);
  assert.equal(POWER_TIERS[stats.durabilityLabel], stats.durability);
  assert.equal(SPEED_TIERS[stats.speedLabel], stats.speed);
  assert.equal(POWER_TIER_LABELS[stats.strength], stats.strengthLabel);
  assert.equal(POWER_TIER_LABELS[stats.durability], stats.durabilityLabel);
  assert.equal(SPEED_TIER_LABELS[stats.speed], stats.speedLabel);
}

assert.deepEqual(getCharacterStats("one-piece-trafalgar-law"), {
  strength: 6,
  durability: 5,
  speed: 11,
  strengthLabel: "Continent",
  durabilityLabel: "Country",
  speedLabel: "Faster than Light",
});
assert.equal(getCharacterStats("game-noctis-lucis-caelum").strengthLabel, "Planetary");
assert.deepEqual(getCharacterStats("game-kratos"), {
  strength: 11,
  durability: 10,
  speed: 12,
  strengthLabel: "Boundless",
  durabilityLabel: "Outerversal",
  speedLabel: "Massively FTL",
});
assert.equal(getCharacterStats("marvel-silver-surfer").speedLabel, "Massively FTL");
assert.equal(getCharacterStats("dc-brainiac").durabilityLabel, "Planetary");
assert.equal(getCharacterStats("the-doctor").durability, 0);
assert.equal(getCharacterStats("not-a-roster-id"), null);

console.log(`Verified ${CHARACTER_STAT_COUNT} immutable character stat assignments.`);
