# 1v1 Spinner Fighter

A 3v3 multiverse draft with Pass & Play, a solo bot opponent, live peer-to-peer online lobbies, and a fully selectable Sandbox. Every mode ends in the same automatic, winner-stays-on battle driven by Strength, Durability, and Speed.

## Game modes

- Pass & Play — the original game: two private three-spin drafts on one device with a handoff between players.
- Play with Bot — you draft first, then the bot spins and reveals all three of its weighted picks in one simultaneous animation.
- Online — choose a display name, browse live public lobbies, create a six-character lobby, or join another player. The host drafts first and both squads remain concealed until they are complete.
- Sandbox — search or filter all 300 fighters, manually build both squads in battle order, or randomize either side before starting instantly.

## How to play

1. Player 1 spins a weighted category, then spins a character from that pool. Repeat until three fighters are locked.
2. Pass the device to Player 2 without revealing Player 1's squad.
3. Player 2 drafts three fighters the same way, then returns the device to the center.
4. Fighters enter in the order they were drafted. Speed decides who attacks first; a gap of four tiers triggers a Speed Blitz and six tiers triggers an Extreme Blitz.
5. Strength compared with the defender's Durability determines fixed percentage damage, from 3% for a severe disadvantage to a 100% one-shot for a three-tier advantage.
6. Equal Strength and Speed opens with a Power Clash. Boundless Durability ignores lower Strength, while two fighters with both Boundless Strength and Durability erase each other in a special Double KO.
7. The survivor keeps their remaining percentage health and immediately faces the next opposing fighter. The first team to exhaust all three opponents wins.

## Roster

- Anime — 100 fighters: 30 Jujutsu Kaisen, 30 Naruto/Boruto, 30 One Piece, and 10 Dragon Ball
- Marvel — 50 characters in powerful comic forms
- DC — 50 characters in powerful comic forms
- Video Game Legends — 50 characters in their strongest game forms
- Fiction & Toon Menaces — 50 characters from outside the other pools

The category wheel uses 25% Anime, 25% Marvel, 25% DC, 15% Video Game Legends, and 10% Menaces odds. Strength, Durability, and Speed tiers are fictional, subjective, and designed only for this fan-made game.

## Technical notes

The game is static HTML, CSS, and JavaScript with no build step. Online matchmaking and match messages use lazily loaded, encrypted WebRTC peer connections; local and bot modes do not load the online transport. Public lobbies are live and ephemeral, so a host must keep the lobby open and refreshes or closed tabs end the current match. Layered sound effects are synthesized in the browser. Character art uses a cached multi-source fallback chain and falls back to styled initials when no public source has an image.

Run locally with any static server, then open its URL in a modern browser. The production site publishes directly from the `main` branch through GitHub Pages.

Every update follows the test-fix-retest requirements in [CONTRIBUTING.md](CONTRIBUTING.md).
