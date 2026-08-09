# Update quality policy

Every change to 1v1 Spinner Fighter must be tested before it is published, including small copy, styling, roster, sound, image, and logic changes.

## Required checks

1. Run JavaScript syntax checks for `script.js`, `game-logic.js`, and every changed data module.
2. Run `node tests/verify.mjs`, `node tests/verify-stats.mjs`, `node tests/verify-roster-combat.mjs`, `node tests/verify-presentation.mjs`, `node tests/verify-online.mjs`, and `node tests/verify-static.mjs`.
3. Run `git diff --check`.
4. Test the complete same-device flow in a browser: six picks, handoffs, lineup reveal, every animated clash, final result, sound toggle, and reset.
5. Check at desktop and phone widths, confirm the revealed card has a visible image or initials fallback, and review the console for errors.
6. Exercise the damage matrix boundaries, tied-stat Power Clash, four- and six-tier Speed Blitz thresholds, Boundless immunity, the six-beat exact five-second Boundless timeline, automatic `0:35` soundtrack start and fade cleanup, team-colored beam collision and annihilation, Last Stand presentation, and a full winner-stays-on battle whenever combat or presentation logic changes.
7. Preserve the original Pass & Play flow, run a full bot draft, build and randomize both Sandbox teams, and test an online host and guest through lobby discovery, joining, sequential private drafts, synchronized reveal, battle, disconnect, and cleanup whenever shared mode code changes.

If a bug, visual glitch, or logic issue is found, fix it, rerun the test that exposed it, and then rerun the full applicable regression set. Do not publish until both the targeted retest and the full regression pass.
