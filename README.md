# 1v1 Spinner Fighter

A same-device, pass-and-play 3v3 multiverse draft. Each player privately spins three times, passes the device, and reveals a power-sorted squad for a cinematic winner-stays-on battle.

## How to play

1. Player 1 spins a weighted category, then spins a character from that pool. Repeat until three fighters are locked.
2. Pass the device to Player 2 without revealing Player 1's squad.
3. Player 2 drafts three fighters the same way, then returns the device to the center.
4. Both squads are automatically arranged from greatest to least power. A fighter's power level becomes their starting health.
5. In each clash, the lower health is subtracted from the higher health. The survivor keeps that remaining health and immediately faces the opposing team's next fighter.
6. Equal finite health knocks out both fighters. Two Boundless fighters cancel each other out, while a Boundless fighter remains unchanged against finite health.
7. The first team to exhaust all three opposing fighters wins. If both teams are exhausted together, the battle is a draw.

## Roster

- Anime — 100 fighters: 30 Jujutsu Kaisen, 30 Naruto/Boruto, 30 One Piece, and 10 Dragon Ball
- Marvel — 50 characters in powerful comic forms
- DC — 50 characters in powerful comic forms
- Video Game Legends — 50 characters in their strongest game forms
- Fiction & Toon Menaces — 50 characters from outside the other pools

The category wheel uses 25% Anime, 25% Marvel, 25% DC, 15% Video Game Legends, and 10% Menaces odds. Rankings and power levels are fictional, subjective, and designed only for this fan-made game.

## Technical notes

The game is static HTML, CSS, and JavaScript with no build step or online multiplayer. Layered sound effects are synthesized in the browser. Character art uses a cached multi-source fallback chain and falls back to styled initials when no public source has an image.

Run locally with any static server, then open its URL in a modern browser. The production site publishes directly from the `main` branch through GitHub Pages.

Every update follows the test-fix-retest requirements in [CONTRIBUTING.md](CONTRIBUTING.md).
