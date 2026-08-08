# 1v1 Spinner Fighter

A same-device, pass-and-play 3v3 multiverse draft. Each player privately spins three times, passes the device, and reveals a power-sorted squad for a cinematic head-to-head battle.

## How to play

1. Player 1 spins a weighted category, then spins a character from that pool. Repeat until three fighters are locked.
2. Pass the device to Player 2 without revealing Player 1's squad.
3. Player 2 drafts three fighters the same way, then returns the device to the center.
4. Both squads are automatically arranged from greatest to least power and clash in three matched rounds.
5. Two Boundless fighters cancel each other out. Otherwise, the higher fan-made power level wins the clash. The squad with more clash wins takes the battle.

## Roster

- Anime — 100 fighters: 30 Jujutsu Kaisen, 30 Naruto/Boruto, 30 One Piece, and 10 Dragon Ball
- Marvel — 50 characters in powerful comic forms
- DC — 50 characters in powerful comic forms
- Fiction & Toon Menaces — 50 characters from outside the other pools

The category wheel uses 30% Anime, 30% Marvel, 30% DC, and 10% Menaces odds. Rankings and power levels are fictional, subjective, and designed only for this fan-made game.

## Technical notes

The game is static HTML, CSS, and JavaScript with no build step or online multiplayer. Sound effects are synthesized in the browser. Selected character images are requested from English Wikipedia when available and fall back to styled initials when unavailable.

Run locally with any static server, then open its URL in a modern browser. The production site publishes directly from the `main` branch through GitHub Pages.
