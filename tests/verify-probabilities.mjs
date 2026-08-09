import assert from "node:assert/strict";
import { animeCharacters } from "../data/anime.js";
import { dcCharacters, marvelCharacters } from "../data/comics.js";
import { menaceCharacters } from "../data/menaces.js";
import { getCharacterStats } from "../data/stats.js";
import { videoGameCharacters } from "../data/video-games.js";
import { characterDrawWeight, chooseStrengthWeightedCharacter } from "../game-logic.js";

const categories = {
  anime: animeCharacters,
  marvel: marvelCharacters,
  dc: dcCharacters,
  games: videoGameCharacters,
  menace: menaceCharacters,
};
const expectedTicketTotals = {
  anime: 631,
  marvel: 164,
  dc: 153,
  games: 216,
  menace: 139,
};

for (const [categoryId, roster] of Object.entries(categories)) {
  const pool = roster.map((fighter) => ({ ...fighter, ...getCharacterStats(fighter.id) }));
  const totalTickets = pool.reduce((sum, fighter) => sum + characterDrawWeight(fighter), 0);
  assert.equal(totalTickets, expectedTicketTotals[categoryId]);

  const ticketCounts = new Map(pool.map(({ id }) => [id, 0]));
  for (let ticket = 0; ticket < totalTickets; ticket += 1) {
    const fighter = chooseStrengthWeightedCharacter(pool, (ticket + 0.5) / totalTickets);
    ticketCounts.set(fighter.id, ticketCounts.get(fighter.id) + 1);
  }

  for (const fighter of pool) {
    assert.equal(
      ticketCounts.get(fighter.id),
      characterDrawWeight(fighter),
      `${fighter.name} must own exactly its assigned tickets inside ${categoryId}`,
    );
  }

  for (const left of pool) {
    for (const right of pool) {
      if (left.strength < right.strength) {
        assert.ok(
          characterDrawWeight(left) > characterDrawWeight(right),
          `${left.name} must be more likely than stronger ${right.name} inside ${categoryId}`,
        );
      } else if (left.strength === right.strength) {
        assert.equal(characterDrawWeight(left), characterDrawWeight(right));
      }
    }
  }
}

const kratos = { ...videoGameCharacters.find(({ id }) => id === "game-kratos"), ...getCharacterStats("game-kratos") };
assert.equal(characterDrawWeight(kratos), 1);
assert.equal(characterDrawWeight(kratos) / expectedTicketTotals.games, 1 / 216);

console.log("Verified exact Strength-ticket probabilities for all 300 fighters across five categories.");
