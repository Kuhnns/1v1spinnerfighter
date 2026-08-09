import { animeCharacters } from "./data/anime.js?v=20260809-5";
import { dcCharacters, marvelCharacters } from "./data/comics.js?v=20260809-5";
import { menaceCharacters } from "./data/menaces.js?v=20260809-5";
import { getCharacterStats } from "./data/stats.js?v=20260809-5";
import { videoGameCharacters } from "./data/video-games.js?v=20260809-5";
import {
  CATEGORY_WEIGHTS,
  chooseWeighted,
  draftAutomatedTeam,
  randomIndex,
  resolveBattle,
} from "./game-logic.js?v=20260809-5";
import {
  formatLobbyCodeInput,
  OnlineLobbyNetwork,
  normalizeLobbyCode,
  sanitizePlayerName,
} from "./online-network.js?v=20260809-5";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const REDUCED_MOTION_AUDIO_SCALE = 0.035;

function combatRoster(roster, categoryId, categoryLabel) {
  return roster.map((fighter) => {
    const stats = getCharacterStats(fighter.id);
    if (!stats) throw new Error(`Missing combat stats for ${fighter.id}`);
    return Object.freeze({ ...fighter, ...stats, categoryId, categoryLabel });
  });
}

const categories = [
  { id: "anime", label: "ANIME", weight: CATEGORY_WEIGHTS.anime, roster: combatRoster(animeCharacters, "anime", "ANIME"), center: 45 },
  { id: "marvel", label: "MARVEL", weight: CATEGORY_WEIGHTS.marvel, roster: combatRoster(marvelCharacters, "marvel", "MARVEL"), center: 135 },
  { id: "dc", label: "DC", weight: CATEGORY_WEIGHTS.dc, roster: combatRoster(dcCharacters, "dc", "DC"), center: 225 },
  { id: "games", label: "VIDEO GAME LEGENDS", weight: CATEGORY_WEIGHTS.games, roster: combatRoster(videoGameCharacters, "games", "VIDEO GAME LEGENDS"), center: 297 },
  { id: "menace", label: "FICTION & TOON MENACES", weight: CATEGORY_WEIGHTS.menace, roster: combatRoster(menaceCharacters, "menace", "FICTION & TOON MENACES"), center: 342 },
];

const screens = $$(".screen");
const startGameButton = $("#start-game");
const startBotButton = $("#start-bot");
const openOnlineButton = $("#open-online");
const startSandboxButton = $("#start-sandbox");
const modePill = $("#mode-pill");
const soundToggle = $("#sound-toggle");
const draftOverline = $("#draft-overline");
const draftLeaveOnline = $("#draft-leave-online");
const pickNumber = $("#pick-number");
const pickPips = $("#pick-pips");
const lockedList = $("#locked-list");
const wheelStage = $("#wheel-stage");
const categoryWheel = $("#category-wheel");
const reelStage = $("#reel-stage");
const revealStage = $("#reveal-stage");
const draftCardMount = $("#draft-card-mount");
const stageStep = $("#stage-step");
const stageInstruction = $("#stage-instruction");
const spinResult = $("#spin-result");
const spinAction = $("#spin-action");
const reelCategory = $("#reel-category");
const reelName = $("#reel-name");
const reelForm = $("#reel-form");
const handoffKicker = $("#handoff-kicker");
const handoffTitle = $("#handoff-title");
const handoffCopy = $("#handoff-copy");
const handoffAction = $("#handoff-action");
const botDraftScreen = $("#bot-draft-screen");
const botDraftStatus = $("#bot-draft-status");
const botDraftGrid = $("#bot-draft-grid");
const botRevealAction = $("#bot-reveal-action");
const onlineScreen = $("#online-screen");
const onlineBrowserPanel = $("#online-browser-panel");
const onlineRoomPanel = $("#online-room-panel");
const onlineBack = $("#online-back");
const onlineName = $("#online-name");
const createLobbyButton = $("#create-lobby");
const joinCode = $("#join-code");
const joinLobbyButton = $("#join-lobby");
const refreshLobbiesButton = $("#refresh-lobbies");
const onlineStatus = $("#online-status");
const lobbyList = $("#lobby-list");
const onlineRoomCode = $("#online-room-code");
const onlineRoomTitle = $("#online-room-title");
const onlineRoomCopy = $("#online-room-copy");
const copyLobbyCode = $("#copy-lobby-code");
const leaveLobbyButton = $("#leave-lobby");
const onlineWaitKicker = $("#online-wait-kicker");
const onlineWaitTitle = $("#online-wait-title");
const onlineWaitCopy = $("#online-wait-copy");
const onlineLeaveMatch = $("#online-leave-match");
const sandboxBack = $("#sandbox-back");
const sandboxFilter = $("#sandbox-filter");
const sandboxSearch = $("#sandbox-search");
const sandboxClearSearch = $("#sandbox-clear-search");
const sandboxRandomAll = $("#sandbox-random-all");
const sandboxRoster = $("#sandbox-roster");
const sandboxEmpty = $("#sandbox-empty");
const sandboxResultsCount = $("#sandbox-results-count");
const sandboxStatus = $("#sandbox-status");
const sandboxStart = $("#sandbox-start");
const sandboxFighterTemplate = $("#sandbox-fighter-template");
const sandboxTeamPanels = $$('[data-sandbox-team].sandbox-team-panel');
const sandboxSideButtons = $$('[data-sandbox-side]');
const sandboxRandomTeamButtons = $$('[data-sandbox-random-team]');
const sandboxClearTeamButtons = $$('[data-sandbox-clear-team]');
const p1Lineup = $("#p1-lineup");
const p2Lineup = $("#p2-lineup");
const p1Total = $("#p1-total");
const p2Total = $("#p2-total");
const sideOneLabel = $("#side-one-label");
const sideTwoLabel = $("#side-two-label");
const beginBattle = $("#begin-battle");
const battleScoreOne = $("#battle-score-one");
const battleScoreTwo = $("#battle-score-two");
const battleSideOneLabel = $("#battle-side-one-label");
const battleSideTwoLabel = $("#battle-side-two-label");
const clashNumber = $("#clash-number");
const clashTotal = $("#clash-total");
const clashArena = $("#clash-arena");
const defeatStamp = $("#defeat-stamp");
const battleCardOne = $("#battle-card-one");
const battleCardTwo = $("#battle-card-two");
const clashVerdict = $("#clash-verdict");
const battleAnnouncer = $("#battle-announcer");
const skipBattle = $("#skip-battle");
const resultKicker = $("#result-kicker");
const resultTitle = $("#result-title");
const resultScore = $("#result-score");
const resultCopy = $("#result-copy");
const resultGrid = $("#result-grid");
const resetGameButton = $("#reset-game");
const reviewLineups = $("#review-lineups");
const changeModeButton = $("#change-mode");
const toast = $("#toast");

const tierColors = {
  elite: "#b7bdc8",
  titan: "#f6b94b",
  cosmic: "#46e1ff",
  multiversal: "#a16eff",
  outer: "#ff5576",
  boundless: "#dfff42",
};

const severityClasses = ["severity-fair", "severity-edge", "severity-dominant", "severity-brutal", "severity-soloed"];
const severityCopy = Object.freeze({
  fair: "PHOTO FINISH",
  edge: "NARROW EDGE",
  dominant: "DOMINATED",
  brutal: "BRUTAL",
  soloed: "SOLOED",
});

const state = {
  mode: "pass",
  activePlayer: 0,
  teams: [[], []],
  used: new Set(),
  phase: "category",
  selectedCategory: null,
  selectedCharacter: null,
  wheelRotation: 0,
  busy: false,
  handoffMode: "player-two",
  battle: null,
  battleToken: 0,
  flowToken: 0,
  onlineRole: null,
  localPlayerIndex: 0,
  playerNames: ["PLAYER 1", "PLAYER 2"],
  sandboxActiveSide: 0,
};

const fighterById = new Map(categories.flatMap((category) => category.roster.map((fighter) => [fighter.id, fighter])));
const allFighters = [...fighterById.values()];
const sandboxFighterNodes = new Map();
let sandboxImageObserver = null;
let onlineNetwork = null;
let onlineNetworkName = "";
let pendingOnlineTeamIds = null;

class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.activeNodes = new Set();
    this.enabled = readSoundPreference();
  }

  arm() {
    if (!this.enabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.compressor = this.context.createDynamicsCompressor();
      this.master.gain.value = 0.72;
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 16;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.006;
      this.compressor.release.value = 0.18;
      this.master.connect(this.compressor).connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume();
  }

  tone(frequency, duration = 0.08, options = {}) {
    if (!this.enabled) return;
    this.arm();
    if (!this.context) return;
    const scale = motionPreference.matches ? REDUCED_MOTION_AUDIO_SCALE : 1;
    const { delay = 0, type = "sine", volume = 0.035, endFrequency = frequency } = options;
    const scaledDuration = Math.max(0.025, duration * scale);
    const start = this.context.currentTime + delay * scale;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const activeNode = { oscillator, gain };
    this.activeNodes.add(activeNode);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(35, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, endFrequency), start + scaledDuration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + scaledDuration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + scaledDuration + 0.02);
    oscillator.addEventListener("ended", () => this.activeNodes.delete(activeNode), { once: true });
  }

  stopAll() {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.activeNodes.forEach(({ oscillator, gain }) => {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0.0001, now, 0.012);
        oscillator.stop(now + 0.05);
      } catch {
        // The node may already have ended.
      }
    });
    this.activeNodes.clear();
  }

  tap() {
    this.tone(260, 0.045, { type: "square", volume: 0.018, endFrequency: 190 });
  }

  wheel() {
    for (let index = 0; index < 15; index += 1) {
      const delay = index * (0.05 + index * 0.007);
      this.tone(170 + index * 21, 0.045, { delay, type: "square", volume: 0.015 });
    }
  }

  arcade() {
    [392, 523, 659, 784, 1047].forEach((note, index) => {
      this.tone(note, 0.09, { delay: index * 0.055, type: "square", volume: 0.018, endFrequency: note * 1.04 });
    });
  }

  botDraft() {
    [0, 0.07, 0.14].forEach((laneDelay, lane) => {
      for (let index = 0; index < 7; index += 1) {
        const note = 155 + lane * 72 + index * 31;
        this.tone(note, 0.07, {
          delay: laneDelay + index * 0.085,
          type: lane % 2 ? "square" : "triangle",
          volume: 0.012,
          endFrequency: note * 1.08,
        });
      }
    });
  }

  onlineConnect() {
    [294, 440, 659].forEach((note, index) => {
      this.tone(note, 0.18, { delay: index * 0.075, type: "sine", volume: 0.022, endFrequency: note * 1.08 });
    });
  }

  reelTick(index) {
    if (index % 2 === 0) this.tone(320 + (index % 7) * 25, 0.035, { type: "triangle", volume: 0.012 });
  }

  reveal(tier = 5) {
    const level = Math.max(0, Math.min(13, Number(tier) || 0));
    const base = Math.min(720, 180 + level * 40);
    this.tone(base, 0.42, { type: "sawtooth", volume: 0.025, endFrequency: base * 1.7 });
    this.tone(base * 1.5, 0.5, { delay: 0.06, type: "sine", volume: 0.035, endFrequency: base * 2.05 });
  }

  charge(severity = "fair") {
    const strength = { fair: 0, edge: 1, dominant: 2, brutal: 3, soloed: 4 }[severity] ?? 0;
    const base = 115 + strength * 18;
    for (let index = 0; index < 5 + strength; index += 1) {
      this.tone(base + index * (22 + strength * 3), 0.12, {
        delay: index * 0.065,
        type: index % 2 ? "triangle" : "sawtooth",
        volume: 0.009 + strength * 0.002,
        endFrequency: base * 1.55 + index * 30,
      });
    }
  }

  impact(tierOne, tierTwo, severity = "fair") {
    const intensity = Math.min(1, Math.max(Number(tierOne) || 0, Number(tierTwo) || 0) / 11);
    const mismatch = { fair: 0, edge: 0.12, dominant: 0.28, brutal: 0.48, soloed: 0.72 }[severity] ?? 0;
    this.tone(95 + intensity * 55, 0.52 + mismatch * 0.3, { type: "sawtooth", volume: 0.05 + mismatch * 0.025, endFrequency: 40 });
    this.tone(520 + intensity * 400 + mismatch * 420, 0.26, { delay: 0.05, type: "square", volume: 0.018 + mismatch * 0.012, endFrequency: 120 });
    if (severity === "brutal" || severity === "soloed") {
      this.tone(62, 0.72, { delay: 0.03, type: "sine", volume: 0.06, endFrequency: 35 });
      this.tone(severity === "soloed" ? 1900 : 1380, 0.11, { type: "square", volume: 0.018, endFrequency: 180 });
    }
  }

  verdict(winner) {
    const notes = winner ? [330, 495, 660] : [280, 260, 240];
    notes.forEach((note, index) => this.tone(note, 0.22, { delay: index * 0.1, type: "triangle", volume: 0.025 }));
  }

  defeat(severity, winner) {
    if (!winner || severity === "fair" || severity === "edge") {
      this.verdict(winner);
      return;
    }
    const notes = severity === "soloed"
      ? [880, 440, 110, 55]
      : severity === "brutal"
        ? [620, 310, 92]
        : [520, 390, 260];
    notes.forEach((note, index) => this.tone(note, 0.3 + index * 0.07, {
      delay: index * 0.075,
      type: severity === "dominant" ? "triangle" : "sawtooth",
      volume: 0.02 + index * 0.006,
      endFrequency: Math.max(35, note * 0.46),
    }));
  }

  lock(tier = 5) {
    const level = Math.max(0, Math.min(13, Number(tier) || 0));
    const base = Math.min(620, 210 + level * 32);
    [1, 1.25, 1.5].forEach((ratio, index) => {
      this.tone(base * ratio, 0.18, { delay: index * 0.075, type: "triangle", volume: 0.022 });
    });
  }

  handoff() {
    this.tone(410, 0.44, { type: "sine", volume: 0.025, endFrequency: 130 });
    this.tone(220, 0.35, { delay: 0.1, type: "triangle", volume: 0.018, endFrequency: 520 });
  }

  battleStart() {
    [110, 165, 247, 370].forEach((note, index) => {
      this.tone(note, 0.34, { delay: index * 0.11, type: "sawtooth", volume: 0.02, endFrequency: note * 1.22 });
    });
  }

  drain(isKnockout = false) {
    this.tone(isKnockout ? 240 : 360, isKnockout ? 0.52 : 0.34, {
      type: "sawtooth",
      volume: isKnockout ? 0.035 : 0.022,
      endFrequency: isKnockout ? 48 : 150,
    });
    if (isKnockout) {
      [210, 150, 90].forEach((note, index) => this.tone(note, 0.18, { delay: 0.14 + index * 0.1, type: "square", volume: 0.015 }));
    }
  }

  nullify() {
    this.tone(180, 0.72, { type: "sawtooth", volume: 0.026, endFrequency: 178 });
    this.tone(183, 0.72, { type: "sawtooth", volume: 0.026, endFrequency: 181 });
  }

  blitz(extreme = false) {
    const hits = extreme ? 3 : 2;
    for (let index = 0; index < hits; index += 1) {
      this.tone(980 + index * 330, 0.095, {
        delay: index * 0.075,
        type: "square",
        volume: 0.024,
        endFrequency: 220,
      });
    }
  }

  powerClash() {
    this.tone(210, 0.55, { type: "sawtooth", volume: 0.05, endFrequency: 720 });
    this.tone(840, 0.42, { delay: 0.04, type: "square", volume: 0.026, endFrequency: 120 });
  }

  boundlessClash() {
    this.stopAll();
    [55, 82, 123, 185, 370, 740].forEach((note, index) => {
      this.tone(note, 0.58, {
        delay: index * 0.11,
        type: index < 3 ? "sine" : "sawtooth",
        volume: 0.025 + index * 0.004,
        endFrequency: note * 1.7,
      });
    });
  }

  immune() {
    this.tone(150, 0.38, { type: "triangle", volume: 0.018, endFrequency: 148 });
    this.tone(151, 0.38, { type: "sine", volume: 0.018, endFrequency: 150 });
  }

  final(winner) {
    this.stopAll();
    const notes = winner ? [196, 294, 392, 587] : [260, 247, 233];
    notes.forEach((note, index) => this.tone(note, 0.42, { delay: index * 0.13, type: "triangle", volume: 0.032 }));
  }
}

const sound = new SoundEngine();
const IMAGE_REQUEST_TIMEOUT = 6500;
const IMAGE_RESOLUTION_TIMEOUT = 15000;
const NEGATIVE_IMAGE_CACHE_TTL = 30000;
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const ANILIST_API = "https://graphql.anilist.co";
const animeSources = new Set(["Jujutsu Kaisen", "Naruto", "Dragon Ball", "One Piece"]);
const imageOverrides = Object.freeze({
  "one-piece-rocks-d-xebec": [
    "https://static.wikia.nocookie.net/onepiece/images/f/fb/Rocks_D._Xebec_Manga_Infobox.png/revision/latest?cb=20260228213945",
  ],
});
const fandomApis = Object.freeze({
  "Jujutsu Kaisen": "https://jujutsu-kaisen.fandom.com/api.php",
  Naruto: "https://naruto.fandom.com/api.php",
  "Dragon Ball": "https://dragonball.fandom.com/api.php",
  "One Piece": "https://onepiece.fandom.com/api.php",
  Marvel: "https://marvel.fandom.com/api.php",
  DC: "https://dc.fandom.com/api.php",
});
const imageResolutionCache = new Map();
const imageRequestCache = new Map();
const imageProbeCache = new Map();
let toastTimer = 0;

function readSoundPreference() {
  try {
    return localStorage.getItem("spinner-fighter-sound") !== "off";
  } catch {
    return true;
  }
}

function saveSoundPreference() {
  try {
    localStorage.setItem("spinner-fighter-sound", sound.enabled ? "on" : "off");
  } catch {
    // Sound still works when storage is unavailable.
  }
}

function readOnlineName() {
  try {
    return sanitizePlayerName(localStorage.getItem("spinner-fighter-online-name") || "");
  } catch {
    return "";
  }
}

function saveOnlineName(name) {
  try {
    localStorage.setItem("spinner-fighter-online-name", name);
  } catch {
    // The online session can continue when persistent storage is unavailable.
  }
}

function randomUnit() {
  if (window.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return value[0] / 4294967296;
  }
  return Math.random();
}

function battleSeed(teamOne, teamTwo) {
  const signature = `tier-combat-v1|${teamOne.map(({ id }) => id).join(",")}|${teamTwo.map(({ id }) => id).join(",")}`;
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededBattleRandom(teamOne, teamTwo) {
  let value = battleSeed(teamOne, teamTwo);
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function defaultOnlineName() {
  return `PLAYER ${String(Math.floor(randomUnit() * 9000) + 1000)}`;
}

function motionTime(standard, minimal = 35) {
  return motionPreference.matches ? minimal : standard;
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initials(name) {
  const words = name.replace(/^The\s+/i, "").split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function categoryLabel(character) {
  if (character.categoryId === "games") return "VIDEO GAMES";
  if (character.categoryId === "menace") return "MENACE";
  return character.categoryLabel || character.source;
}

function fighterTier(character) {
  const peak = Math.max(character.strength, character.durability);
  if (peak >= 11) return "boundless";
  if (peak >= 10) return "outer";
  if (peak >= 9) return "multiversal";
  if (peak >= 7) return "cosmic";
  if (peak >= 4) return "titan";
  return "elite";
}

function statMarkup(character, compact = false) {
  return `
    <div class="fighter-stats${compact ? " is-compact" : ""}" aria-label="Strength ${escapeHtml(character.strengthLabel)}, durability ${escapeHtml(character.durabilityLabel)}, speed ${escapeHtml(character.speedLabel)}">
      <span><i>STR</i><b>${escapeHtml(character.strengthLabel)}</b></span>
      <span><i>DUR</i><b>${escapeHtml(character.durabilityLabel)}</b></span>
      <span><i>SPD</i><b>${escapeHtml(character.speedLabel)}</b></span>
    </div>
  `;
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, "");
}

function battleHealthText(character, health) {
  if (character?.durability === 11 && health > 0) return "∞";
  return `${formatPercent(health)}%`;
}

function healthPercent(current, maximum) {
  const currentValue = Number(current);
  const maximumValue = Number(maximum);
  if (!Number.isFinite(currentValue) || !Number.isFinite(maximumValue) || maximumValue <= 0) return 0;
  if (currentValue <= 0) return 0;
  const percent = (currentValue / maximumValue) * 100;
  return Math.max(0.5, Math.min(100, Math.round(percent * 10) / 10));
}

function focusWithoutScroll(element) {
  if (!element) return;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function showScreen(id) {
  let activeScreen = null;
  screens.forEach((screen) => {
    const active = screen.id === id;
    screen.hidden = !active;
    screen.classList.toggle("is-active", active);
    if (active) activeScreen = screen;
  });
  if (activeScreen) {
    activeScreen.tabIndex = -1;
    focusWithoutScroll(activeScreen);
  }
  window.scrollTo({ top: 0, behavior: motionPreference.matches ? "auto" : "smooth" });
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function updateSoundButton() {
  soundToggle.setAttribute("aria-pressed", String(sound.enabled));
  soundToggle.setAttribute("aria-label", sound.enabled ? "Mute sound" : "Turn on sound");
  soundToggle.firstElementChild.textContent = sound.enabled ? "SFX" : "OFF";
}

function sideName(index) {
  if (state.mode === "bot") return index === 0 ? "PLAYER 1" : "BOT";
  if (state.mode === "online") return state.playerNames[index] || `PLAYER ${index + 1}`;
  return `PLAYER ${index + 1}`;
}

function resultWinnerName(winner) {
  if (state.mode === "pass" || state.mode === "sandbox") return `PLAYER ${winner}`;
  if (state.mode === "bot") return winner === 1 ? "PLAYER 1" : "BOT";
  return winner - 1 === state.localPlayerIndex ? "YOU" : sideName(winner - 1).toUpperCase();
}

function updateModeChrome() {
  const modeCopy = {
    pass: "PASS & PLAY",
    bot: "VS BOT",
    online: "ONLINE",
    sandbox: "SANDBOX",
  };
  modePill.textContent = modeCopy[state.mode] || "CHOOSE MODE";
  sideOneLabel.textContent = sideName(0);
  sideTwoLabel.textContent = sideName(1);
  battleSideOneLabel.textContent = `${sideName(0)} LEFT`;
  battleSideTwoLabel.textContent = `${sideName(1)} LEFT`;
  resetGameButton.textContent = state.mode === "online"
    ? "RETURN TO LOBBIES"
    : state.mode === "bot"
      ? "PLAY BOT AGAIN"
      : state.mode === "sandbox"
        ? "BUILD ANOTHER MATCHUP"
        : "RESET & SPIN AGAIN";
}

function setOnlineStatus(message, stateName = "") {
  onlineStatus.textContent = message;
  if (stateName) onlineStatus.dataset.state = stateName;
  else delete onlineStatus.dataset.state;
}

function canonicalTeam(ids) {
  if (!Array.isArray(ids) || ids.length !== 3 || new Set(ids).size !== 3) return null;
  const team = ids.map((id) => fighterById.get(id));
  return team.every(Boolean) ? team.map((fighter) => ({ ...fighter })) : null;
}

function characterImageKey(character) {
  return character.id || `${character.name}|${character.source}|${character.wiki}`;
}

function uniqueUrls(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && /^https:\/\//i.test(value)))];
}

function normalizedLookup(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenKey(value) {
  return normalizedLookup(value).split(" ").filter(Boolean).sort().join(" ");
}

function cachedJson(url, options = {}) {
  const method = options.method || "GET";
  const cacheKey = `${method}:${url}:${options.body || ""}`;
  if (imageRequestCache.has(cacheKey)) return imageRequestCache.get(cacheKey);

  const request = (async () => {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    let timeout = 0;
    try {
      const fetchRequest = fetch(url, {
        ...options,
        credentials: "omit",
        signal: controller?.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null);
      const deadline = new Promise((resolve) => {
        timeout = window.setTimeout(() => {
          controller?.abort();
          resolve(null);
        }, IMAGE_REQUEST_TIMEOUT);
      });
      return await Promise.race([fetchRequest, deadline]);
    } catch {
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  })();

  imageRequestCache.set(cacheKey, request);
  request.then((payload) => {
    if (!payload) imageRequestCache.delete(cacheKey);
  });
  return request;
}

function wikipediaUrl(parameters) {
  const url = new URL(WIKIPEDIA_API);
  const values = {
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    redirects: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "640",
    pilicense: "any",
    ...parameters,
  };
  Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.href;
}

function fandomApiFor(character) {
  if (fandomApis[character.source]) return fandomApis[character.source];
  if (/marvel/i.test(character.source)) return fandomApis.Marvel;
  if (/\bdc\b|watchmen/i.test(character.source)) return fandomApis.DC;
  return null;
}

function fandomUrl(endpoint, parameters) {
  const url = new URL(endpoint);
  const values = {
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    redirects: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "640",
    ...parameters,
  };
  Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.href;
}

function pageImageUrls(payload) {
  const pages = payload?.query?.pages;
  if (!pages) return [];
  const list = Array.isArray(pages) ? [...pages] : Object.values(pages);
  return uniqueUrls(
    list
      .sort((left, right) => (left.index ?? Number.MAX_SAFE_INTEGER) - (right.index ?? Number.MAX_SAFE_INTEGER))
      .map((page) => page.thumbnail?.source),
  );
}

async function wikipediaTitleImages(character) {
  if (/^(?:list of|characters (?:in|of)|cast of)\b/i.test(character.wiki)) return [];
  const payload = await cachedJson(wikipediaUrl({ titles: character.wiki }));
  return pageImageUrls(payload);
}

async function wikipediaSearchImages(character) {
  const quotedName = character.name.replace(/"/g, "");
  const payload = await cachedJson(wikipediaUrl({
    generator: "search",
    gsrsearch: `"${quotedName}" ${character.source}`,
    gsrnamespace: "0",
    gsrlimit: "6",
  }));
  return pageImageUrls(payload);
}

function overrideImages(character) {
  return uniqueUrls(imageOverrides[character.id] || []);
}

async function fandomSearchImages(character) {
  const endpoint = fandomApiFor(character);
  if (!endpoint) return [];
  const payload = await cachedJson(fandomUrl(endpoint, {
    generator: "search",
    gsrsearch: character.name,
    gsrnamespace: "0",
    gsrlimit: "5",
  }));
  return pageImageUrls(payload);
}

function aniListMatchScore(candidate, character) {
  const expectedName = normalizedLookup(character.name);
  const expectedTokens = tokenKey(character.name);
  const names = [candidate.name?.full, ...(candidate.name?.alternative || [])];
  const normalizedNames = names.map(normalizedLookup);
  const exactName = normalizedNames.includes(expectedName);
  const sameTokens = names.some((name) => tokenKey(name) === expectedTokens);
  const source = normalizedLookup(character.source);
  const mediaTitles = (candidate.media?.nodes || []).flatMap((media) => [
    media.title?.romaji,
    media.title?.english,
  ]).map(normalizedLookup).filter(Boolean);
  const sourceMatch = mediaTitles.some((title) => title.includes(source) || source.includes(title));

  if (!exactName && !sameTokens) return -1;
  return (sourceMatch ? 100 : 0) + (exactName ? 20 : sameTokens ? 15 : 0);
}

async function aniListImages(character) {
  const query = `
    query CharacterImages($search: String) {
      Page(page: 1, perPage: 25) {
        characters(search: $search, sort: SEARCH_MATCH) {
          name { full alternative }
          image { large medium }
          media(perPage: 10) { nodes { title { romaji english } } }
        }
      }
    }
  `;
  const payload = await cachedJson(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { search: character.name } }),
  });
  const matches = payload?.data?.Page?.characters || [];
  const best = matches
    .map((candidate) => ({ candidate, score: aniListMatchScore(candidate, character) }))
    .filter((match) => match.score >= 0)
    .sort((left, right) => right.score - left.score)[0]?.candidate;
  return uniqueUrls([best?.image?.large, best?.image?.medium]);
}

function imageLoads(source) {
  if (imageProbeCache.has(source)) return imageProbeCache.get(source);

  const probe = new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (loaded) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(loaded);
    };
    const timeout = window.setTimeout(() => finish(false), IMAGE_REQUEST_TIMEOUT);
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("load", () => finish(image.naturalWidth > 0), { once: true });
    image.addEventListener("error", () => finish(false), { once: true });
    image.src = source;
    if (image.complete) Promise.resolve().then(() => finish(image.naturalWidth > 0));
  });

  imageProbeCache.set(source, probe);
  probe.then((loaded) => {
    if (!loaded) {
      window.setTimeout(() => {
        if (imageProbeCache.get(source) === probe) imageProbeCache.delete(source);
      }, NEGATIVE_IMAGE_CACHE_TTL);
    }
  });
  return probe;
}

function withTimeout(promise, milliseconds) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(value);
    };
    const timeout = window.setTimeout(() => finish(null), milliseconds);
    promise.then(finish, () => finish(null));
  });
}

export async function resolveImageProviders(providers, character, loadImage = imageLoads) {
  const seen = new Set();
  for (const provider of providers) {
    let candidates = [];
    try {
      candidates = await provider(character);
    } catch {
      continue;
    }
    const sources = uniqueUrls(Array.isArray(candidates) ? candidates : [])
      .filter((source) => !seen.has(source));
    sources.forEach((source) => seen.add(source));
    const outcomes = await Promise.all(sources.map(async (source) => ({ source, loaded: await loadImage(source) })));
    const firstLoaded = outcomes.find(({ loaded }) => loaded);
    if (firstLoaded) return firstLoaded.source;
  }
  return null;
}

export async function getCharacterImage(character) {
  const cacheKey = characterImageKey(character);
  if (imageResolutionCache.has(cacheKey)) return imageResolutionCache.get(cacheKey);

  const resolution = (async () => {
    const isAnime = character.categoryId === "anime" || animeSources.has(character.source);
    const providers = isAnime
      ? [overrideImages, aniListImages, fandomSearchImages, wikipediaSearchImages, wikipediaTitleImages]
      : [overrideImages, fandomSearchImages, wikipediaSearchImages, wikipediaTitleImages];
    return resolveImageProviders(providers, character);
  })();
  const request = withTimeout(resolution, IMAGE_RESOLUTION_TIMEOUT);

  imageResolutionCache.set(cacheKey, request);
  request.then((source) => {
    if (!source) imageResolutionCache.delete(cacheKey);
  });
  return request;
}

async function hydratePortrait(root, character) {
  const portrait = $("[data-portrait]", root);
  if (!portrait || portrait.dataset.loaded === "true" || portrait.dataset.loading === "true") return;
  portrait.dataset.loading = "true";
  const source = await getCharacterImage(character);
  if (!source || !portrait.isConnected) {
    delete portrait.dataset.loading;
    return;
  }

  const image = new Image();
  let settled = false;
  const finishDetached = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(displayTimeout);
    delete portrait.dataset.loading;
  };
  const finishFailure = () => {
    if (settled) return;
    if (!portrait.isConnected) {
      finishDetached();
      return;
    }
    settled = true;
    window.clearTimeout(displayTimeout);
    delete portrait.dataset.loaded;
    delete portrait.dataset.loading;
    const failedProbe = Promise.resolve(false);
    imageProbeCache.set(source, failedProbe);
    window.setTimeout(() => {
      if (imageProbeCache.get(source) === failedProbe) imageProbeCache.delete(source);
    }, NEGATIVE_IMAGE_CACHE_TTL);
    imageResolutionCache.delete(characterImageKey(character));
    if (portrait.isConnected) hydratePortrait(root, character);
  };
  const finishLoad = () => {
    if (settled) return;
    if (!portrait.isConnected) {
      finishDetached();
      return;
    }
    if (!image.naturalWidth) {
      finishFailure();
      return;
    }
    settled = true;
    window.clearTimeout(displayTimeout);
    portrait.prepend(image);
    portrait.dataset.loaded = "true";
    delete portrait.dataset.loading;
  };
  const displayTimeout = window.setTimeout(finishFailure, IMAGE_REQUEST_TIMEOUT);
  image.alt = `${character.name}, ${character.form}`;
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("load", finishLoad, { once: true });
  image.addEventListener("error", finishFailure, { once: true });
  image.src = source;
  if (image.complete) Promise.resolve().then(() => (image.naturalWidth ? finishLoad() : finishFailure()));
}

function fighterCard(character, cardNumber = "", healthState = null) {
  const tier = fighterTier(character);
  const card = document.createElement("article");
  card.className = "fighter-card";
  card.dataset.tier = tier;
  if (character.categoryId) card.dataset.category = character.categoryId;
  if (healthState) card.classList.add("has-health");
  const healthMarkup = healthState
    ? `
      <div class="battle-health" role="progressbar" aria-label="${escapeHtml(character.name)} health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${healthPercent(healthState.current, healthState.maximum)}" aria-valuetext="${escapeHtml(`${battleHealthText(character, healthState.current)} remaining`)}">
        <div class="battle-health-copy">
          <span>HEALTH REMAINING</span>
          <strong data-health-value>${escapeHtml(battleHealthText(character, healthState.current))}</strong>
        </div>
        <div class="battle-health-track"><span data-health-fill style="width: ${healthPercent(healthState.current, healthState.maximum)}%"></span></div>
      </div>
      ${statMarkup(character, true)}
    `
    : statMarkup(character);
  card.innerHTML = `
    <div class="fighter-portrait" data-portrait>
      <span class="fighter-fallback">${escapeHtml(initials(character.name))}</span>
    </div>
    <div class="fighter-card-top">
      <span>${escapeHtml(categoryLabel(character))}</span>
      <b>${escapeHtml(cardNumber || tier.toUpperCase())}</b>
    </div>
    <div class="fighter-card-copy">
      <span class="source">${escapeHtml(character.source)}</span>
      <h3>${escapeHtml(character.name)}</h3>
      <p class="form">${escapeHtml(character.form)}</p>
      ${healthMarkup}
    </div>
  `;
  if (healthState) {
    card.combatMaximum = healthState.maximum;
    card.combatCurrent = healthState.current;
    card.combatCharacter = character;
  }
  hydratePortrait(card, character);
  return card;
}

function emergencyRevealCard(character) {
  const card = document.createElement("article");
  card.className = "reveal-fallback-card";
  const portrait = document.createElement("div");
  portrait.className = "reveal-fallback-portrait";
  portrait.textContent = initials(character.name);
  const source = document.createElement("span");
  source.textContent = character.source;
  const name = document.createElement("h3");
  name.textContent = character.name;
  const form = document.createElement("p");
  form.textContent = character.form;
  const stats = document.createElement("strong");
  stats.textContent = `STR ${character.strengthLabel} · DUR ${character.durabilityLabel} · SPD ${character.speedLabel}`;
  card.append(portrait, source, name, form, stats);
  return card;
}

function updateCardHealth(slot, health, eliminated) {
  const card = $(".fighter-card", slot);
  if (!card || card.combatMaximum === undefined) return;
  card.combatCurrent = health;
  const percent = healthPercent(health, card.combatMaximum);
  const fill = $("[data-health-fill]", card);
  const value = $("[data-health-value]", card);
  const progress = $(".battle-health", card);
  fill.style.width = `${percent}%`;
  const character = card.combatCharacter;
  value.textContent = battleHealthText(character, health);
  progress.setAttribute("aria-valuenow", String(percent));
  progress.setAttribute("aria-valuetext", `${battleHealthText(character, health)} remaining`);
  card.classList.toggle("is-exhausted", eliminated);
  card.classList.toggle("is-survivor", !eliminated);
}

function lineupCard(character, rank) {
  const tier = fighterTier(character);
  const card = document.createElement("article");
  card.className = "lineup-card";
  card.dataset.tier = tier;
  card.innerHTML = `
    <div class="lineup-rank" data-portrait>
      ${escapeHtml(initials(character.name))}
      <span>0${rank}</span>
    </div>
    <div class="lineup-card-copy">
      <b>${escapeHtml(character.name)}</b>
      <small>${escapeHtml(character.form)}</small>
    </div>
    <div class="lineup-stats" aria-label="Strength ${escapeHtml(character.strengthLabel)}, durability ${escapeHtml(character.durabilityLabel)}, speed ${escapeHtml(character.speedLabel)}">
      <span><i>STR</i><b>${escapeHtml(character.strengthLabel)}</b></span>
      <span><i>DUR</i><b>${escapeHtml(character.durabilityLabel)}</b></span>
      <span><i>SPD</i><b>${escapeHtml(character.speedLabel)}</b></span>
    </div>
  `;
  hydratePortrait(card, character);
  return card;
}

function lockedPickCard(character) {
  const tier = fighterTier(character);
  const card = document.createElement("div");
  card.className = "locked-pick";
  card.style.setProperty("--tier", tierColors[tier]);
  card.innerHTML = `
    <div class="mini-avatar" data-portrait>${escapeHtml(initials(character.name))}</div>
    <div><b>${escapeHtml(character.name)}</b><small>STR ${escapeHtml(character.strengthLabel)} · DUR ${escapeHtml(character.durabilityLabel)} · SPD ${escapeHtml(character.speedLabel)}</small></div>
  `;
  hydratePortrait(card, character);
  return card;
}

function emptyPick(index) {
  const item = document.createElement("div");
  item.className = "empty-pick";
  item.innerHTML = `<span>0${index}</span><b>EMPTY SLOT</b>`;
  return item;
}

function resetState() {
  state.activePlayer = 0;
  state.teams = [[], []];
  state.used = new Set();
  state.phase = "category";
  state.selectedCategory = null;
  state.selectedCharacter = null;
  state.busy = false;
  state.handoffMode = "player-two";
  state.battle = null;
  state.battleToken += 1;
  state.flowToken += 1;
}

function startNewGame(mode = state.mode) {
  if (mode !== "pass" && mode !== "bot") mode = "pass";
  sound.stopAll();
  sound.arm();
  sound.tap();
  state.mode = mode;
  state.onlineRole = null;
  state.localPlayerIndex = 0;
  state.playerNames = ["PLAYER 1", mode === "bot" ? "BOT" : "PLAYER 2"];
  resetState();
  updateModeChrome();
  renderDraft();
  showScreen("draft-screen");
}

function renderDraft() {
  const team = state.teams[state.activePlayer];
  draftLeaveOnline.hidden = state.mode !== "online";
  draftOverline.textContent = state.mode === "pass"
    ? `PLAYER ${state.activePlayer + 1} · PRIVATE DRAFT`
    : state.mode === "online"
      ? `YOU · ONLINE PRIVATE DRAFT`
      : "YOU · PRIVATE DRAFT";
  pickNumber.textContent = `0${team.length + 1}`;
  $$("span", pickPips).forEach((pip, index) => {
    pip.classList.toggle("is-complete", index < team.length);
    pip.classList.toggle("is-current", index === team.length);
  });

  lockedList.replaceChildren();
  for (let index = 0; index < 3; index += 1) {
    lockedList.append(team[index] ? lockedPickCard(team[index]) : emptyPick(index + 1));
  }
  resetSpinStage();
}

function draftCardNumber() {
  const pick = state.teams[state.activePlayer].length + 1;
  if (state.mode === "pass") return `P${state.activePlayer + 1} · 0${pick}`;
  return `YOU · 0${pick}`;
}

function resetSpinStage() {
  state.phase = "category";
  state.selectedCategory = null;
  state.selectedCharacter = null;
  state.busy = false;
  wheelStage.hidden = false;
  wheelStage.classList.remove("is-spinning");
  reelStage.hidden = true;
  revealStage.hidden = true;
  draftCardMount.replaceChildren();
  stageStep.textContent = "STEP 1 OF 2";
  stageInstruction.textContent = "SPIN FOR A UNIVERSE";
  spinResult.textContent = "Weighted odds are live. The multiverse decides.";
  spinAction.textContent = "SPIN CATEGORY";
  spinAction.disabled = false;
  if (!spinAction.closest(".screen")?.hidden) focusWithoutScroll(spinAction);
}

async function spinCategory() {
  if (state.busy || state.phase !== "category") return;
  const token = state.flowToken;
  state.busy = true;
  spinAction.disabled = true;
  spinResult.textContent = "Universes colliding…";
  sound.wheel();

  const category = chooseWeighted(categories, randomUnit());
  state.selectedCategory = category;
  const normalized = ((state.wheelRotation % 360) + 360) % 360;
  const target = (360 - category.center + 360) % 360;
  const correction = (target - normalized + 360) % 360;
  state.wheelRotation += 5 * 360 + correction;
  categoryWheel.style.transform = `rotate(${state.wheelRotation}deg)`;
  wheelStage.classList.add("is-spinning");

  await wait(motionTime(2280, 80));
  if (token !== state.flowToken) return;
  wheelStage.classList.remove("is-spinning");
  state.phase = "character";
  state.busy = false;
  spinAction.disabled = false;
  spinAction.textContent = "SUMMON FIGHTER";
  focusWithoutScroll(spinAction);
  stageStep.textContent = "STEP 2 OF 2";
  stageInstruction.textContent = `${category.label} LOCKED`;
  spinResult.textContent = `${category.label} selected · ${category.roster.length} elite forms in the pool.`;
  if (category.id === "games") sound.arcade();
  else sound.reveal(category.id === "menace" ? 10 : 7);
}

async function spinCharacter() {
  if (state.busy || state.phase !== "character" || !state.selectedCategory) return;
  const token = state.flowToken;
  state.busy = true;
  spinAction.disabled = true;
  wheelStage.hidden = true;
  reelStage.hidden = false;
  revealStage.hidden = true;

  const category = state.selectedCategory;
  const pool = category.roster.filter((character) => !state.used.has(character.id));
  const rawPick = pool[randomIndex(pool.length, randomUnit())];
  state.selectedCharacter = { ...rawPick, categoryId: category.id, categoryLabel: category.label };
  reelCategory.textContent = category.label;
  reelName.textContent = "SEARCHING…";
  reelForm.textContent = `${pool.length} remaining power signatures`;
  spinResult.textContent = "Scanning strongest known forms…";

  let tick = 0;
  let interval = null;
  const cycle = () => {
    if (token !== state.flowToken) {
      if (interval) window.clearInterval(interval);
      return;
    }
    const preview = pool[randomIndex(pool.length, randomUnit())];
    reelName.textContent = preview.name.toUpperCase();
    reelForm.textContent = preview.form;
    sound.reelTick(tick);
    tick += 1;
  };
  cycle();
  interval = window.setInterval(cycle, motionTime(72, 20));
  await wait(motionTime(1740, 90));
  window.clearInterval(interval);
  if (token !== state.flowToken) return;

  reelStage.hidden = true;
  revealStage.hidden = false;
  try {
    draftCardMount.replaceChildren(fighterCard(state.selectedCharacter, draftCardNumber()));
  } catch (error) {
    console.error("Fighter card rendering fell back to the compatibility layout.", error);
    draftCardMount.replaceChildren(emergencyRevealCard(state.selectedCharacter));
  }
  state.phase = "lock";
  state.busy = false;
  spinAction.disabled = false;
  spinAction.textContent = "LOCK FIGHTER";
  focusWithoutScroll(spinAction);
  stageInstruction.textContent = "POWER SIGNATURE FOUND";
  spinResult.textContent = `${state.selectedCharacter.name} answers the spin.`;
  sound.reveal(Math.max(state.selectedCharacter.strength, state.selectedCharacter.durability));
  if (category.id === "games") sound.arcade();
}

async function lockCharacter() {
  if (state.busy || state.phase !== "lock" || !state.selectedCharacter) return;
  const token = state.flowToken;
  state.busy = true;
  spinAction.disabled = true;
  sound.lock(Math.max(state.selectedCharacter.strength, state.selectedCharacter.durability));
  const team = state.teams[state.activePlayer];
  team.push(state.selectedCharacter);
  state.used.add(state.selectedCharacter.id);
  renderLockedOnly();
  spinResult.textContent = `${state.selectedCharacter.name} locked into slot ${team.length}.`;
  await wait(motionTime(520, 40));
  if (token !== state.flowToken) return;

  if (team.length < 3) {
    renderDraft();
    return;
  }
  if (state.mode === "bot") {
    await runBotDraft();
    return;
  }
  if (state.mode === "online") {
    await finishOnlineDraft();
    return;
  }
  showHandoff();
}

function renderLockedOnly() {
  const team = state.teams[state.activePlayer];
  lockedList.replaceChildren();
  for (let index = 0; index < 3; index += 1) {
    lockedList.append(team[index] ? lockedPickCard(team[index]) : emptyPick(index + 1));
  }
  $$("span", pickPips).forEach((pip, index) => {
    pip.classList.toggle("is-complete", index < team.length);
    pip.classList.toggle("is-current", index === team.length && team.length < 3);
  });
}

function createBotReel(index) {
  const reel = document.createElement("div");
  reel.className = "bot-reel";
  const slot = document.createElement("span");
  slot.textContent = `BOT SLOT 0${index + 1}`;
  const category = document.createElement("strong");
  category.dataset.botCategory = "";
  category.textContent = "SCANNING UNIVERSES";
  const fighter = document.createElement("small");
  fighter.dataset.botFighter = "";
  fighter.textContent = "POWER SIGNATURE SEARCHING…";
  reel.append(slot, category, fighter);
  return reel;
}

function updateBotReels(slots, tick) {
  slots.forEach((slot, index) => {
    const category = categories[(tick + index * 2) % categories.length];
    const preview = category.roster[(tick * 7 + index * 19) % category.roster.length];
    $("[data-bot-category]", slot).textContent = category.label;
    $("[data-bot-fighter]", slot).textContent = preview.name.toUpperCase();
  });
  sound.reelTick(tick);
}

async function runBotDraft() {
  const token = ++state.flowToken;
  state.phase = "bot-draft";
  state.busy = true;
  const botTeam = draftAutomatedTeam(categories, state.used, randomUnit);
  const slots = $$('[data-bot-slot]', botDraftGrid);
  slots.forEach((slot, index) => slot.replaceChildren(createBotReel(index)));
  botDraftStatus.textContent = "Three weighted universes are spinning at once…";
  botRevealAction.hidden = true;
  botDraftScreen.classList.remove("is-revealed");
  botDraftScreen.classList.add("is-spinning");
  showScreen("bot-draft-screen");
  sound.botDraft();

  let tick = 0;
  updateBotReels(slots, tick);
  const interval = window.setInterval(() => {
    tick += 1;
    updateBotReels(slots, tick);
  }, motionTime(92, 24));
  await wait(motionTime(2100, 110));
  window.clearInterval(interval);
  if (token !== state.flowToken) return;

  state.teams[1] = botTeam;
  botTeam.forEach((fighter) => state.used.add(fighter.id));
  slots.forEach((slot, index) => slot.replaceChildren(fighterCard(botTeam[index], `BOT · 0${index + 1}`)));
  botDraftScreen.classList.remove("is-spinning");
  botDraftScreen.classList.add("is-revealed");
  botDraftStatus.textContent = "The bot locked all three fighters. Your matchup is ready.";
  botRevealAction.hidden = false;
  state.phase = "bot-ready";
  state.busy = false;
  const strongest = botTeam.reduce((best, fighter) => (
    Math.max(fighter.strength, fighter.durability) > Math.max(best.strength, best.durability) ? fighter : best
  ));
  sound.reveal(Math.max(strongest.strength, strongest.durability));
  focusWithoutScroll(botRevealAction);
}

function setSandboxStatus(message, stateName = "building") {
  sandboxStatus.textContent = message;
  sandboxStatus.dataset.state = stateName;
}

function sandboxSelectedIds() {
  return new Set(state.teams.flat().map(({ id }) => id));
}

function setSandboxSide(side) {
  state.sandboxActiveSide = side === 1 ? 1 : 0;
  sandboxTeamPanels.forEach((panel) => panel.classList.toggle("is-active", Number(panel.dataset.sandboxTeam) === state.sandboxActiveSide));
  sandboxSideButtons.forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.sandboxSide) === state.sandboxActiveSide)));
  renderSandboxRosterState();
  const ready = state.teams.every((team) => team.length === 3);
  setSandboxStatus(
    ready
      ? "Both squads are locked in entry order. Start the custom battle when ready."
      : `Editing Team ${state.sandboxActiveSide + 1}. Choose fighters in the order they should enter.`,
    ready ? "ready" : "building",
  );
}

function renderSandboxTeam(side) {
  const team = state.teams[side];
  const count = $(`[data-sandbox-team-count="${side}"]`);
  if (count) count.textContent = `${team.length} / 3`;
  const clear = $(`[data-sandbox-clear-team="${side}"]`);
  if (clear) clear.disabled = team.length === 0;
  const slots = $$(`[data-sandbox-slots="${side}"] [data-sandbox-slot]`);
  slots.forEach((slot, index) => {
    const fighter = team[index];
    slot.classList.toggle("is-filled", Boolean(fighter));
    slot.disabled = !fighter;
    if (!fighter) {
      delete slot.dataset.fighterId;
      slot.setAttribute("aria-label", `Team ${side + 1} empty slot ${index + 1}`);
      slot.innerHTML = `<span>0${index + 1}</span><b>EMPTY SLOT</b><small>SELECT A FIGHTER</small>`;
      return;
    }
    slot.dataset.fighterId = fighter.id;
    slot.setAttribute("aria-label", `Remove ${fighter.name} from Team ${side + 1} slot ${index + 1}`);
    slot.innerHTML = `
      <span>0${index + 1}</span>
      <div class="sandbox-slot-portrait" data-portrait>${escapeHtml(initials(fighter.name))}</div>
      <b>${escapeHtml(fighter.name)}</b>
      <small>${escapeHtml(fighter.form)}</small>
    `;
    hydratePortrait(slot, fighter);
  });
}

function renderSandboxRosterState() {
  const selected = sandboxSelectedIds();
  const activeTeamFull = state.teams[state.sandboxActiveSide].length >= 3;
  sandboxFighterNodes.forEach((node, id) => {
    const button = $("[data-sandbox-pick]", node);
    const selectedSide = state.teams[0].some((fighter) => fighter.id === id)
      ? 0
      : state.teams[1].some((fighter) => fighter.id === id)
        ? 1
        : -1;
    const isSelected = selected.has(id);
    node.classList.toggle("is-selected", isSelected);
    node.dataset.selectedTeam = selectedSide >= 0 ? String(selectedSide) : "";
    button.disabled = isSelected || activeTeamFull;
    button.setAttribute("aria-pressed", String(isSelected));
    $(".sandbox-fighter-add", node).textContent = selectedSide >= 0 ? `P${selectedSide + 1}` : "+";
  });

  renderSandboxTeam(0);
  renderSandboxTeam(1);
  const ready = state.teams.every((team) => team.length === 3);
  sandboxStart.disabled = !ready;
  if (ready) setSandboxStatus("Both squads are locked in entry order. Start the custom battle when ready.", "ready");
}

function addSandboxFighter(id) {
  const fighter = fighterById.get(id);
  const team = state.teams[state.sandboxActiveSide];
  if (!fighter || sandboxSelectedIds().has(id)) return;
  if (team.length >= 3) {
    setSandboxStatus(`Team ${state.sandboxActiveSide + 1} already has three fighters. Remove one or edit the other team.`, "error");
    return;
  }
  team.push({ ...fighter });
  sound.tap();
  if (team.length === 3 && state.teams[1 - state.sandboxActiveSide].length < 3) {
    setSandboxSide(1 - state.sandboxActiveSide);
  } else {
    renderSandboxRosterState();
    const ready = state.teams.every((sandboxTeam) => sandboxTeam.length === 3);
    setSandboxStatus(
      ready
        ? "Both squads are locked in entry order. Start the custom battle when ready."
        : `${fighter.name} added to Team ${state.sandboxActiveSide + 1} slot ${team.length}.`,
      ready ? "ready" : "building",
    );
  }
}

function removeSandboxFighter(side, index) {
  const team = state.teams[side];
  if (!team[index]) return;
  const [removed] = team.splice(index, 1);
  state.sandboxActiveSide = side;
  renderSandboxRosterState();
  setSandboxSide(side);
  setSandboxStatus(`${removed.name} removed from Team ${side + 1}.`, "building");
}

function shuffledFighters(excludedIds = new Set()) {
  const pool = allFighters.filter(({ id }) => !excludedIds.has(id)).map((fighter) => ({ ...fighter }));
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1, randomUnit());
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool;
}

function randomizeSandboxTeam(side) {
  const otherIds = new Set(state.teams[1 - side].map(({ id }) => id));
  state.teams[side] = shuffledFighters(otherIds).slice(0, 3);
  state.sandboxActiveSide = side;
  sound.botDraft();
  renderSandboxRosterState();
  setSandboxSide(side);
  const ready = state.teams.every((team) => team.length === 3);
  setSandboxStatus(
    ready
      ? "Both squads are randomized and ready. Start the custom battle or edit any slot."
      : `Team ${side + 1} randomized. Select a slot to remove a fighter or keep building.`,
    ready ? "ready" : "building",
  );
}

function randomizeSandboxMatch() {
  const matchup = shuffledFighters().slice(0, 6);
  state.teams = [matchup.slice(0, 3), matchup.slice(3, 6)];
  sound.botDraft();
  setSandboxSide(0);
  setSandboxStatus("Six unique fighters randomized. Both teams are ready.", "ready");
  focusWithoutScroll(sandboxStart);
}

function loadSandboxFighterImage(node, fighter) {
  const image = $("[data-fighter-image]", node);
  if (!image || image.dataset.requested === "true") return;
  image.dataset.requested = "true";
  getCharacterImage(fighter).then((source) => {
    if (!source || !node.isConnected) return;
    image.addEventListener("load", () => {
      image.hidden = false;
      node.classList.add("has-image");
    }, { once: true });
    image.addEventListener("error", () => {
      image.hidden = true;
      node.classList.remove("has-image");
    }, { once: true });
    image.src = source;
  });
}

function createSandboxFighterNode(fighter) {
  const node = sandboxFighterTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.sandboxFighterId = fighter.id;
  node.dataset.category = fighter.categoryId;
  const button = $("[data-sandbox-pick]", node);
  button.setAttribute("aria-label", `Add ${fighter.name}, ${fighter.form}, to the active team`);
  const art = $(".sandbox-fighter-art", node);
  const fallback = document.createElement("b");
  fallback.className = "sandbox-fighter-initials";
  fallback.textContent = initials(fighter.name);
  art.prepend(fallback);
  const image = $("[data-fighter-image]", node);
  image.alt = `${fighter.name}, ${fighter.form}`;
  image.hidden = true;
  $("[data-fighter-category]", node).textContent = categoryLabel(fighter);
  $("[data-fighter-name]", node).textContent = fighter.name;
  $("[data-fighter-form]", node).textContent = fighter.form;
  $("[data-fighter-strength]", node).textContent = fighter.strengthLabel;
  $("[data-fighter-durability]", node).textContent = fighter.durabilityLabel;
  $("[data-fighter-speed]", node).textContent = fighter.speedLabel;
  button.addEventListener("click", () => addSandboxFighter(fighter.id));
  sandboxFighterNodes.set(fighter.id, node);
  return node;
}

function filterSandboxRoster() {
  const filter = sandboxFilter.value;
  const query = normalizedLookup(sandboxSearch.value);
  let count = 0;
  allFighters.forEach((fighter) => {
    const node = sandboxFighterNodes.get(fighter.id);
    const categoryMatches = filter === "all" || fighter.categoryId === filter;
    const textMatches = !query || normalizedLookup(`${fighter.name} ${fighter.form}`).includes(query);
    const visible = categoryMatches && textMatches;
    node.hidden = !visible;
    if (visible) count += 1;
  });
  sandboxResultsCount.textContent = String(count);
  sandboxEmpty.hidden = count !== 0;
  sandboxClearSearch.disabled = !sandboxSearch.value;
}

function initializeSandboxRoster() {
  if (sandboxFighterNodes.size) return;
  const nodes = allFighters.map(createSandboxFighterNode);
  sandboxRoster.replaceChildren(...nodes);
  sandboxRoster.setAttribute("aria-busy", "false");
  if ("IntersectionObserver" in window) {
    sandboxImageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const fighter = fighterById.get(entry.target.dataset.sandboxFighterId);
        if (fighter) loadSandboxFighterImage(entry.target, fighter);
        sandboxImageObserver.unobserve(entry.target);
      });
    }, { root: sandboxRoster, rootMargin: "180px" });
    nodes.forEach((node) => sandboxImageObserver.observe(node));
  } else {
    nodes.forEach((node) => {
      const fighter = fighterById.get(node.dataset.sandboxFighterId);
      if (fighter) loadSandboxFighterImage(node, fighter);
    });
  }
}

function openSandbox() {
  state.flowToken += 1;
  state.battleToken += 1;
  sound.stopAll();
  sound.arm();
  resetState();
  state.mode = "sandbox";
  state.playerNames = ["PLAYER 1", "PLAYER 2"];
  state.sandboxActiveSide = 0;
  updateModeChrome();
  initializeSandboxRoster();
  sandboxFilter.value = "all";
  sandboxSearch.value = "";
  filterSandboxRoster();
  renderSandboxRosterState();
  setSandboxSide(0);
  showScreen("sandbox-screen");
}

function startSandboxBattle() {
  if (state.teams.some((team) => team.length !== 3)) {
    setSandboxStatus("Choose three fighters for each team before starting.", "error");
    return;
  }
  state.used = new Set(state.teams.flat().map(({ id }) => id));
  sound.lock(Math.max(...state.teams.flat().map(({ strength, durability }) => Math.max(strength, durability))));
  prepareReveal();
}

function onlineMessage(detail, fallback) {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail.message === "string" && detail.message.trim()) return detail.message;
  return fallback;
}

function renderLobbyBrowser(lobbies = []) {
  lobbyList.replaceChildren();
  if (!lobbies.length) {
    const empty = document.createElement("li");
    empty.className = "lobby-empty";
    empty.textContent = "No open lobbies yet. Create one and become the first challenger.";
    lobbyList.append(empty);
    return;
  }

  lobbies.forEach((lobby) => {
    const row = document.createElement("li");
    row.className = "lobby-row";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = lobby.hostName;
    const meta = document.createElement("span");
    meta.textContent = `${lobby.code} · 1 / 2 PLAYERS`;
    copy.append(name, meta);
    const join = document.createElement("button");
    join.className = "secondary-button lobby-join";
    join.type = "button";
    join.textContent = "JOIN";
    join.setAttribute("aria-label", `Join ${lobby.hostName}'s lobby ${lobby.code}`);
    join.addEventListener("click", () => joinOnlineLobby(lobby.code));
    row.append(copy, join);
    lobbyList.append(row);
  });
}

function setOnlineControlsBusy(busy) {
  createLobbyButton.disabled = busy;
  joinLobbyButton.disabled = busy;
  refreshLobbiesButton.disabled = busy;
  onlineBrowserPanel.setAttribute("aria-busy", String(busy));
}

function currentOnlineName() {
  const cleaned = sanitizePlayerName(onlineName.value) || defaultOnlineName();
  onlineName.value = cleaned;
  saveOnlineName(cleaned);
  return cleaned;
}

function bindOnlineNetwork(network) {
  network.addEventListener("lobbies", (event) => {
    if (onlineNetwork !== network) return;
    renderLobbyBrowser(event.detail || []);
    setOnlineControlsBusy(false);
  });
  network.addEventListener("status", (event) => {
    if (onlineNetwork !== network) return;
    setOnlineStatus(onlineMessage(event.detail, "Online arena updated."));
  });
  network.addEventListener("error", (event) => {
    if (onlineNetwork !== network) return;
    setOnlineControlsBusy(false);
    setOnlineStatus(onlineMessage(event.detail, "Online connection failed. Try again."), "error");
  });
  network.addEventListener("match", (event) => {
    if (onlineNetwork !== network) return;
    beginOnlineMatch(event.detail);
  });
  network.addEventListener("team", (event) => {
    if (onlineNetwork !== network) return;
    receiveOnlineTeam(event.detail?.ids);
  });
  network.addEventListener("peer-left", () => {
    if (onlineNetwork !== network) return;
    handleOnlinePeerLeft();
  });
}

async function ensureOnlineNetwork({ force = false } = {}) {
  const playerName = currentOnlineName();
  if (!force && onlineNetwork && onlineNetworkName === playerName) {
    await onlineNetwork.openDirectory();
    return onlineNetwork;
  }
  if (onlineNetwork) await onlineNetwork.destroy();
  const network = new OnlineLobbyNetwork({ playerName });
  onlineNetwork = network;
  onlineNetworkName = playerName;
  bindOnlineNetwork(network);
  await network.openDirectory();
  return network;
}

function showOnlineBrowserPanel() {
  onlineBrowserPanel.hidden = false;
  onlineRoomPanel.hidden = true;
  showScreen("online-screen");
}

function showOnlineRoom(code, title, copy) {
  onlineBrowserPanel.hidden = true;
  onlineRoomPanel.hidden = false;
  onlineRoomCode.textContent = code;
  onlineRoomTitle.textContent = title;
  onlineRoomCopy.textContent = copy;
  showScreen("online-screen");
  onlineRoomTitle.tabIndex = -1;
  focusWithoutScroll(onlineRoomTitle);
}

async function openOnlineBrowser({ force = false } = {}) {
  state.flowToken += 1;
  state.battleToken += 1;
  state.mode = "online";
  state.onlineRole = null;
  pendingOnlineTeamIds = null;
  updateModeChrome();
  if (!onlineName.value) onlineName.value = readOnlineName() || defaultOnlineName();
  renderLobbyBrowser([]);
  showOnlineBrowserPanel();
  setOnlineControlsBusy(true);
  setOnlineStatus("Connecting to the live lobby network…", "loading");
  try {
    await ensureOnlineNetwork({ force });
    setOnlineControlsBusy(false);
    setOnlineStatus("Live lobbies update automatically. Choose one or create your own.", "ready");
  } catch (error) {
    console.error("Online lobby initialization failed.", error);
    setOnlineControlsBusy(false);
    setOnlineStatus("Online is temporarily unavailable. Pass & Play and Bot still work.", "error");
  }
}

async function createOnlineLobby() {
  setOnlineControlsBusy(true);
  setOnlineStatus("Creating your public lobby…", "loading");
  try {
    const network = await ensureOnlineNetwork();
    const code = await network.createLobby();
    if (!code) throw new Error("Could not create the lobby. Try again.");
    showOnlineRoom(code, "WAITING FOR A CHALLENGER", "Your lobby is public. Keep this tab open while another player joins.");
    setOnlineStatus(`Lobby ${code} is live.`, "ready");
  } catch (error) {
    console.error("Lobby creation failed.", error);
    setOnlineStatus(onlineMessage(error, "Could not create the lobby. Try again."), "error");
    setOnlineControlsBusy(false);
  }
}

async function joinOnlineLobby(rawCode) {
  const formattedCode = formatLobbyCodeInput(rawCode);
  const code = normalizeLobbyCode(formattedCode);
  joinCode.value = formattedCode;
  const valid = Boolean(code);
  joinCode.setAttribute("aria-invalid", String(!valid));
  if (!valid) {
    setOnlineStatus("Enter a complete 6-character lobby code.", "error");
    focusWithoutScroll(joinCode);
    return;
  }

  setOnlineControlsBusy(true);
  setOnlineStatus(`Joining lobby ${code}…`, "loading");
  try {
    const network = await ensureOnlineNetwork();
    showOnlineRoom(code, "CONNECTING TO HOST", "Claiming the open player slot. This normally takes a few seconds.");
    const joined = await network.joinLobby(code);
    if (!joined) throw new Error("That lobby is unavailable or already full.");
  } catch (error) {
    console.error("Lobby join failed.", error);
    setOnlineStatus(onlineMessage(error, "That lobby is unavailable or already full."), "error");
    setOnlineControlsBusy(false);
    showOnlineBrowserPanel();
  }
}

function showOnlineWait(kicker, title, copy) {
  onlineWaitKicker.textContent = kicker;
  onlineWaitTitle.textContent = title;
  onlineWaitCopy.textContent = copy;
  showScreen("online-wait-screen");
}

function beginOnlineMatch(detail = {}) {
  const role = detail.role === "guest" ? "guest" : "host";
  const opponentName = sanitizePlayerName(detail.opponentName) || "OPPONENT";
  const localName = onlineNetworkName || currentOnlineName();
  resetState();
  state.mode = "online";
  state.onlineRole = role;
  state.localPlayerIndex = role === "host" ? 0 : 1;
  state.playerNames = role === "host" ? [localName, opponentName] : [opponentName, localName];
  state.activePlayer = state.localPlayerIndex;
  updateModeChrome();
  sound.onlineConnect();
  if (role === "host") {
    renderDraft();
    showScreen("draft-screen");
    showToast(`${opponentName} joined. You spin first.`);
  } else {
    showOnlineWait("CONNECTED · PLAYER 2", "HOST IS DRAFTING.", `${opponentName} spins first. Your private three-spin turn begins when their squad is locked.`);
  }
  if (pendingOnlineTeamIds) {
    const queued = pendingOnlineTeamIds;
    pendingOnlineTeamIds = null;
    receiveOnlineTeam(queued);
  }
}

function receiveOnlineTeam(ids) {
  if (!state.onlineRole) {
    pendingOnlineTeamIds = ids;
    return;
  }
  const team = canonicalTeam(ids);
  const localTeam = state.teams[state.localPlayerIndex];
  const overlaps = team?.some((fighter) => localTeam.some((local) => local.id === fighter.id));
  if (!team || overlaps) {
    state.flowToken += 1;
    showOnlineWait("MATCH STOPPED", "INVALID SQUAD DATA", "The opponent sent an invalid or duplicate squad. Leave this match and choose another lobby.");
    return;
  }

  if (state.onlineRole === "guest") {
    if (state.teams[0].length) return;
    state.teams[0] = team;
    team.forEach((fighter) => state.used.add(fighter.id));
    state.activePlayer = 1;
    renderDraft();
    showScreen("draft-screen");
    showToast("Host squad sealed. Your turn starts now.");
    return;
  }

  if (state.teams[0].length !== 3) {
    pendingOnlineTeamIds = ids;
    return;
  }
  if (state.teams[1].length) return;
  state.teams[1] = team;
  team.forEach((fighter) => state.used.add(fighter.id));
  prepareReveal();
}

async function finishOnlineDraft() {
  const team = state.teams[state.localPlayerIndex];
  if (!onlineNetwork || !state.onlineRole || team.length !== 3) {
    showOnlineWait("MATCH INTERRUPTED", "CONNECTION LOST", "Your squad could not be synchronized. Return to the lobby browser and try again.");
    return;
  }
  const token = state.flowToken;
  state.phase = "online-wait";
  state.busy = false;
  try {
    const sent = await onlineNetwork.sendTeam(team.map(({ id }) => id));
    if (token !== state.flowToken) return;
    if (!sent) {
      showOnlineWait("MATCH INTERRUPTED", "SYNC FAILED", "The squad could not reach your opponent. Return to the lobby browser and try again.");
      return;
    }
    if (state.onlineRole === "host") {
      if (pendingOnlineTeamIds) {
        const queued = pendingOnlineTeamIds;
        pendingOnlineTeamIds = null;
        receiveOnlineTeam(queued);
      } else {
        showOnlineWait("YOUR SQUAD IS SEALED", "OPPONENT DRAFTING.", `${sideName(1)} is spinning three private fighters now. The matchup reveals when they lock in.`);
      }
    } else {
      prepareReveal();
    }
  } catch (error) {
    if (token !== state.flowToken) return;
    console.error("Online team synchronization failed.", error);
    showOnlineWait("MATCH INTERRUPTED", "SYNC FAILED", "The squad could not reach your opponent. Return to the lobby browser and try again.");
  }
}

function handleOnlinePeerLeft() {
  if (!state.onlineRole) return;
  state.flowToken += 1;
  state.battleToken += 1;
  sound.stopAll();
  showOnlineWait("CONNECTION CLOSED", "OPPONENT LEFT.", "This match has ended. Return to the lobby browser to find another challenger.");
}

async function leaveOnlineMatchToBrowser() {
  state.flowToken += 1;
  state.battleToken += 1;
  sound.stopAll();
  if (onlineNetwork) await onlineNetwork.leaveMatch();
  resetState();
  state.mode = "online";
  state.onlineRole = null;
  updateModeChrome();
  await openOnlineBrowser();
}

async function returnToModeSelection() {
  state.flowToken += 1;
  state.battleToken += 1;
  sound.stopAll();
  if (onlineNetwork) await onlineNetwork.destroy();
  onlineNetwork = null;
  onlineNetworkName = "";
  pendingOnlineTeamIds = null;
  resetState();
  state.mode = "pass";
  state.playerNames = ["PLAYER 1", "PLAYER 2"];
  modePill.textContent = "CHOOSE MODE";
  sideOneLabel.textContent = "PLAYER 1";
  sideTwoLabel.textContent = "PLAYER 2";
  battleSideOneLabel.textContent = "PLAYER 1 LEFT";
  battleSideTwoLabel.textContent = "PLAYER 2 LEFT";
  showScreen("start-screen");
}

function showHandoff() {
  state.busy = false;
  sound.handoff();
  if (state.activePlayer === 0) {
    state.handoffMode = "player-two";
    handoffKicker.textContent = "PLAYER 1 SQUAD LOCKED";
    handoffTitle.textContent = "PASS THE DEVICE.";
    handoffCopy.textContent = "Hand the screen to Player 2. Player 1's three picks are now fully concealed.";
    handoffAction.textContent = "I’M PLAYER 2 — CONTINUE";
  } else {
    state.handoffMode = "reveal";
    handoffKicker.textContent = "BOTH SQUADS SEALED";
    handoffTitle.textContent = "RETURN TO CENTER.";
    handoffCopy.textContent = "Place the device where both players can see it. The squads are ready to be revealed.";
    handoffAction.textContent = "WE’RE BOTH READY — REVEAL";
  }
  showScreen("handoff-screen");
}

function continueHandoff() {
  sound.tap();
  if (state.handoffMode === "player-two") {
    state.activePlayer = 1;
    renderDraft();
    showScreen("draft-screen");
  } else {
    prepareReveal();
  }
}

function peakLabel(team) {
  const highest = team.reduce((best, character) => (character.strength > best.strength ? character : best));
  return `PEAK ${highest.strengthLabel.toUpperCase()} STR`;
}

function prepareReveal() {
  if (state.teams.some((team) => team.length !== 3)) {
    showToast("Both squads need three fighters before the reveal.");
    return false;
  }
  sound.stopAll();
  updateModeChrome();
  state.battle = resolveBattle(state.teams[0], state.teams[1], seededBattleRandom(state.teams[0], state.teams[1]));
  p1Lineup.replaceChildren(...state.battle.sortedOne.map((character, index) => lineupCard(character, index + 1)));
  p2Lineup.replaceChildren(...state.battle.sortedTwo.map((character, index) => lineupCard(character, index + 1)));
  p1Total.textContent = peakLabel(state.battle.sortedOne);
  p2Total.textContent = peakLabel(state.battle.sortedTwo);
  showScreen("reveal-screen");
  sound.reveal(Math.max(...state.teams.flat().map(({ strength, durability }) => Math.max(strength, durability))));
  return true;
}

const immunityTaunts = Object.freeze([
  "That tickles.",
  "Seriously?",
  "Was that supposed to hurt?",
  "…",
  "Try again.",
]);

function eventFighters(event) {
  return {
    left: state.battle.sortedOne[event.leftIndex],
    right: state.battle.sortedTwo[event.rightIndex],
  };
}

function matchupForEvent(event) {
  return state.battle.timeline[event.round - 1];
}

function eventRemaining(event, side) {
  const team = side === 1 ? state.battle.sortedOne : state.battle.sortedTwo;
  const index = side === 1 ? event.leftIndex : event.rightIndex;
  const health = side === 1 ? event.leftHealthAfter : event.rightHealthAfter;
  return Math.max(0, team.length - index - (health <= 0 ? 1 : 0));
}

function showDefeatStamp(text) {
  defeatStamp.textContent = text;
  clashArena.classList.remove("show-defeat");
  void defeatStamp.offsetWidth;
  clashArena.classList.add("show-defeat");
}

function setEventPreview(event, matchup) {
  clashVerdict.className = "clash-verdict";
  clashVerdict.dataset.severity = matchup.severity;
  clashVerdict.style.removeProperty("--winner-color");
  const eyebrow = $("span", clashVerdict);
  const headline = $("strong", clashVerdict);
  const { left, right } = eventFighters(event);

  if (event.type === "boundless-clash") {
    clashVerdict.classList.add("is-null");
    eyebrow.textContent = "BOUNDLESS STRENGTH × BOUNDLESS DURABILITY";
    headline.textContent = "“LET’S USE EVERY LAST DROP.” · “JUST THIS ONCE.”";
  } else if (event.type === "power-clash") {
    clashVerdict.classList.add("is-win");
    eyebrow.textContent = `${left.strengthLabel.toUpperCase()} STR × ${right.strengthLabel.toUpperCase()} STR`;
    headline.textContent = "POWER CLASH · ATTACKS COLLIDE";
  } else if (event.type === "stalemate") {
    clashVerdict.classList.add("is-null");
    eyebrow.textContent = "0 DAMAGE · 0 DAMAGE";
    headline.textContent = "IMMOVABLE STALEMATE";
  } else {
    const attacker = event.attacker === 1 ? left : right;
    const defender = event.defender === 1 ? left : right;
    clashVerdict.classList.add("is-win");
    clashVerdict.style.setProperty("--winner-color", event.attacker === 1 ? "var(--p1)" : "var(--p2)");
    eyebrow.textContent = event.blitzType
      ? `${event.blitzType === "extreme-blitz" ? "EXTREME BLITZ" : "SPEED BLITZ"} · HIT ${event.blitzHit} OF ${event.blitzHits}`
      : `${attacker.strengthLabel.toUpperCase()} STR → ${defender.durabilityLabel.toUpperCase()} DUR`;
    headline.textContent = event.immune
      ? `${attacker.name.toUpperCase()} ATTACKS · NO EFFECT`
      : event.oneShot
        ? "OVERWHELMING POWER!"
        : `${attacker.name.toUpperCase()} ATTACKS`;
  }
  battleAnnouncer.textContent = `${eyebrow.textContent}. ${headline.textContent}`;
}

function setEventVerdict(event, matchup) {
  const eyebrow = $("span", clashVerdict);
  const headline = $("strong", clashVerdict);
  const { left, right } = eventFighters(event);

  if (event.type === "boundless-clash") {
    clashVerdict.classList.add("is-null");
    eyebrow.textContent = "∞ → ??? → 0";
    headline.textContent = "BOUNDLESS CLASH · DOUBLE KO";
  } else if (event.type === "power-clash") {
    eyebrow.textContent = `P1 −${formatPercent(event.leftDamage)}% · P2 −${formatPercent(event.rightDamage)}%`;
    const eliminated = event.leftHealthAfter <= 0 ? left : event.rightHealthAfter <= 0 ? right : null;
    headline.textContent = eliminated
      ? `POWER CLASH KO · ${eliminated.name.toUpperCase()} FALLS`
      : "BOTH TAKE HALF DAMAGE · TURN ORDER ROLLED";
  } else if (event.type === "stalemate") {
    eyebrow.textContent = "NEITHER FIGHTER CAN DAMAGE THE OTHER";
    headline.textContent = "STALEMATE · MATCH DRAWN";
  } else {
    const attacker = event.attacker === 1 ? left : right;
    const defender = event.defender === 1 ? left : right;
    const defenderHealth = event.defender === 1 ? event.leftHealthAfter : event.rightHealthAfter;
    if (event.immune) {
      const taunt = immunityTaunts[(event.sequence * 7 + event.round) % immunityTaunts.length];
      eyebrow.textContent = "BOUNDLESS DURABILITY · 0 DAMAGE";
      headline.textContent = `${defender.name.toUpperCase()}: “${taunt}”`;
    } else if (event.oneShot) {
      eyebrow.textContent = `${attacker.name.toUpperCase()} DEALS ${formatPercent(event.damage)}% DAMAGE`;
      headline.textContent = `ONE SHOT · ${defender.name.toUpperCase()} ERASED`;
    } else {
      eyebrow.textContent = `${attacker.name.toUpperCase()} DEALS ${formatPercent(event.damage)}% DAMAGE`;
      headline.textContent = `${defender.name.toUpperCase()} · ${battleHealthText(defender, defenderHealth)} REMAINS`;
    }
  }

  const defenderEliminated = event.type === "attack"
    && (event.defender === 1 ? event.leftHealthAfter <= 0 : event.rightHealthAfter <= 0);
  if (defenderEliminated && (matchup.severity === "brutal" || matchup.severity === "soloed")) {
    showDefeatStamp(matchup.severity === "soloed" ? "SOLOED" : "BRUTAL");
  }
  battleAnnouncer.textContent = `${eyebrow.textContent}. ${headline.textContent}`;
}

function setEventEffects(event, matchup, isLastStand) {
  clashArena.classList.remove(
    "is-impact",
    "show-defeat",
    "is-speed-blitz",
    "is-extreme-blitz",
    "is-power-clash",
    "is-boundless-clash",
    "is-immune",
    "is-last-stand",
    ...severityClasses,
  );
  clashArena.style.removeProperty("--winner-color");
  clashArena.classList.add(`severity-${matchup.severity}`);
  if (event.blitzType === "speed-blitz") clashArena.classList.add("is-speed-blitz");
  if (event.blitzType === "extreme-blitz") clashArena.classList.add("is-extreme-blitz");
  if (event.type === "power-clash") clashArena.classList.add("is-power-clash");
  if (event.type === "boundless-clash") clashArena.classList.add("is-boundless-clash");
  if (event.immune) clashArena.classList.add("is-immune");
  if (isLastStand) clashArena.classList.add("is-last-stand");
  if (event.attacker) clashArena.style.setProperty("--winner-color", event.attacker === 1 ? "var(--p1)" : "var(--p2)");
  defeatStamp.textContent = "";
  setEventPreview(event, matchup);
}

async function playBattle() {
  if (!state.battle && !prepareReveal()) return;
  const token = ++state.battleToken;
  showScreen("battle-screen");
  battleScoreOne.textContent = String(state.battle.sortedOne.length);
  battleScoreTwo.textContent = String(state.battle.sortedTwo.length);
  clashTotal.textContent = `/ ${String(state.battle.events.length).padStart(2, "0")}`;
  skipBattle.disabled = false;
  sound.stopAll();
  sound.battleStart();
  let activeRound = 0;

  for (let index = 0; index < state.battle.events.length; index += 1) {
    if (token !== state.battleToken) return;
    const event = state.battle.events[index];
    const matchup = matchupForEvent(event);
    const { left, right } = eventFighters(event);
    const newRound = event.round !== activeRound;
    const isLastStand = newRound && (event.leftLastStand || event.rightLastStand);
    clashNumber.textContent = String(index + 1).padStart(2, "0");

    if (newRound) {
      activeRound = event.round;
      if (isLastStand) {
        clashArena.dataset.lastStand = event.leftLastStand && event.rightLastStand
          ? "both"
          : event.leftLastStand
            ? "left"
            : "right";
      } else {
        delete clashArena.dataset.lastStand;
      }
      battleCardOne.replaceChildren(fighterCard(
        left,
        event.leftHealthBefore < 100 ? "P1 · SURVIVOR" : `P1 · #${event.leftIndex + 1}`,
        { current: event.leftHealthBefore, maximum: 100 },
      ));
      battleCardTwo.replaceChildren(fighterCard(
        right,
        event.rightHealthBefore < 100 ? "P2 · SURVIVOR" : `P2 · #${event.rightIndex + 1}`,
        { current: event.rightHealthBefore, maximum: 100 },
      ));
      clashArena.classList.remove("is-loaded");
      void clashArena.offsetWidth;
      requestAnimationFrame(() => clashArena.classList.add("is-loaded"));
      if (isLastStand) {
        clashArena.classList.add("is-last-stand");
        const doubleLastStand = clashArena.dataset.lastStand === "both";
        showDefeatStamp(doubleLastStand ? "DOUBLE LAST STAND" : "LAST STAND");
        battleAnnouncer.textContent = doubleLastStand
          ? `${sideName(0)} and ${sideName(1)} send out their final fighters. Double last stand.`
          : `${event.leftLastStand ? sideName(0) : sideName(1)} sends out the final fighter. Last stand.`;
        sound.handoff();
      }
      await wait(motionTime(isLastStand ? 850 : 520, 30));
      if (token !== state.battleToken) return;
    }

    battleScoreOne.textContent = String(state.battle.sortedOne.length - event.leftIndex);
    battleScoreTwo.textContent = String(state.battle.sortedTwo.length - event.rightIndex);
    setEventEffects(event, matchup, isLastStand);

    if (event.type === "boundless-clash") {
      sound.stopAll();
      await wait(motionTime(520, 35));
      if (token !== state.battleToken) return;
      showDefeatStamp("3 · 2 · 1");
      sound.boundlessClash();
      await wait(motionTime(940, 35));
    } else {
      if (event.blitzHit === 1) sound.blitz(event.blitzType === "extreme-blitz");
      else sound.charge(matchup.severity);
      await wait(motionTime(330, 25));
    }
    if (token !== state.battleToken) return;

    clashArena.classList.add("is-impact");
    if (event.type === "boundless-clash") {
      showDefeatStamp("CLASH");
      sound.boundlessClash();
    } else if (event.type === "power-clash") {
      sound.powerClash();
    } else if (event.type === "stalemate" || event.immune) {
      sound.immune();
    } else {
      const attacker = event.attacker === 1 ? left : right;
      const defender = event.defender === 1 ? left : right;
      sound.impact(attacker.strength, defender.durability, matchup.severity);
    }

    await wait(motionTime(event.type === "boundless-clash" ? 820 : 420, 30));
    if (token !== state.battleToken) return;
    updateCardHealth(battleCardOne, event.leftHealthAfter, event.leftHealthAfter <= 0);
    updateCardHealth(battleCardTwo, event.rightHealthAfter, event.rightHealthAfter <= 0);
    setEventVerdict(event, matchup);
    battleScoreOne.textContent = String(eventRemaining(event, 1));
    battleScoreTwo.textContent = String(eventRemaining(event, 2));

    if (event.type === "boundless-clash") {
      showDefeatStamp("DOUBLE KO");
      sound.nullify();
    } else if (event.type === "attack") {
      const defenderEliminated = event.defender === 1 ? event.leftHealthAfter <= 0 : event.rightHealthAfter <= 0;
      sound.drain(defenderEliminated);
      if (defenderEliminated) sound.defeat(matchup.severity, event.attacker);
    }

    await wait(motionTime(event.type === "boundless-clash" ? 1450 : 760, 35));
  }

  if (token !== state.battleToken) return;
  await wait(motionTime(420, 25));
  if (token !== state.battleToken) return;
  showResult();
}

function showResult() {
  state.battleToken += 1;
  const battle = state.battle;
  const isDraw = battle.winner === 0;
  resultKicker.textContent = isDraw ? "FINAL VERDICT · COMPLETE STALEMATE" : "FINAL VERDICT · FIGHTERS LEFT";
  const winnerName = isDraw ? "" : resultWinnerName(battle.winner);
  resultTitle.textContent = isDraw ? "THE BATTLE DRAWS" : winnerName === "YOU" ? "YOU WIN" : `${winnerName} WINS`;
  resultTitle.style.color = isDraw ? "var(--paper)" : battle.winner === 1 ? "var(--p1)" : "var(--p2)";
  resultScore.textContent = `${battle.survivorsOne.length} — ${battle.survivorsTwo.length}`;
  if (isDraw) {
    resultCopy.textContent = battle.stalemate
      ? "Neither active fighter could damage the other. The matchup ends in an immovable stalemate."
      : "Every fighter is exhausted or erased. No combatants remain on either side.";
  } else {
    const survivors = battle.winner === 1 ? battle.survivorsOne : battle.survivorsTwo;
    const lead = survivors[0];
    const reserveCount = Math.max(0, survivors.length - 1);
    resultCopy.textContent = `${lead.name} finishes with ${battleHealthText(lead, lead.health)} health${reserveCount ? ` and ${reserveCount} fighter${reserveCount === 1 ? "" : "s"} still in reserve` : ""}.`;
  }

  resultGrid.replaceChildren();
  battle.timeline.forEach((clash, index) => {
    const row = document.createElement("div");
    row.className = "result-row";
    row.dataset.severity = clash.severity;
    const special = clash.reason === "boundless-nullification"
      ? "BOUNDLESS CLASH · DOUBLE KO"
      : clash.stalemate
        ? "IMMOVABLE STALEMATE"
        : clash.verdict === "extreme-blitz"
          ? "EXTREME BLITZ"
          : clash.verdict === "speed-blitz"
            ? "SPEED BLITZ"
            : severityCopy[clash.severity] || "VICTORY";
    const winningFighter = clash.winner === 1 ? clash.left : clash.right;
    const winningHealth = clash.winner === 1 ? clash.leftHealthAfter : clash.rightHealthAfter;
    const label = clash.winner === 0
      ? special
      : `P${clash.winner} ${special} · ${battleHealthText(winningFighter, winningHealth)} LEFT`;
    row.innerHTML = `
      <span>${escapeHtml(clash.left.name)}</span>
      <b class="${clash.winner ? "win" : ""}">0${index + 1} · ${label}</b>
      <span>${escapeHtml(clash.right.name)}</span>
    `;
    resultGrid.append(row);
  });
  showScreen("result-screen");
  sound.final(battle.winner);
}

function handleSpinAction() {
  sound.arm();
  if (state.phase === "category") spinCategory();
  else if (state.phase === "character") spinCharacter();
  else if (state.phase === "lock") lockCharacter();
}

startGameButton.addEventListener("click", () => startNewGame("pass"));
startBotButton.addEventListener("click", () => startNewGame("bot"));
openOnlineButton.addEventListener("click", () => openOnlineBrowser());
startSandboxButton.addEventListener("click", openSandbox);
sandboxBack.addEventListener("click", returnToModeSelection);
sandboxSideButtons.forEach((button) => button.addEventListener("click", () => setSandboxSide(Number(button.dataset.sandboxSide))));
sandboxRandomTeamButtons.forEach((button) => button.addEventListener("click", () => randomizeSandboxTeam(Number(button.dataset.sandboxRandomTeam))));
sandboxClearTeamButtons.forEach((button) => button.addEventListener("click", () => {
  const side = Number(button.dataset.sandboxClearTeam);
  state.teams[side] = [];
  state.sandboxActiveSide = side;
  renderSandboxRosterState();
  setSandboxSide(side);
  setSandboxStatus(`Team ${side + 1} cleared. Choose three fighters in entry order.`, "building");
}));
$$('[data-sandbox-slot]').forEach((slot) => slot.addEventListener("click", () => {
  removeSandboxFighter(Number(slot.dataset.sandboxTeam), Number(slot.dataset.slotIndex));
}));
sandboxRandomAll.addEventListener("click", randomizeSandboxMatch);
sandboxFilter.addEventListener("change", filterSandboxRoster);
sandboxSearch.addEventListener("input", filterSandboxRoster);
sandboxClearSearch.addEventListener("click", () => {
  sandboxSearch.value = "";
  filterSandboxRoster();
  focusWithoutScroll(sandboxSearch);
});
sandboxStart.addEventListener("click", startSandboxBattle);
spinAction.addEventListener("click", handleSpinAction);
handoffAction.addEventListener("click", continueHandoff);
botRevealAction.addEventListener("click", prepareReveal);
beginBattle.addEventListener("click", playBattle);
skipBattle.addEventListener("click", () => {
  if (!state.battle) return;
  state.battleToken += 1;
  skipBattle.disabled = true;
  sound.stopAll();
  showResult();
});
resetGameButton.addEventListener("click", () => {
  if (state.mode === "online") leaveOnlineMatchToBrowser();
  else if (state.mode === "sandbox") openSandbox();
  else startNewGame(state.mode);
});
reviewLineups.addEventListener("click", prepareReveal);
changeModeButton.addEventListener("click", returnToModeSelection);
onlineBack.addEventListener("click", returnToModeSelection);
createLobbyButton.addEventListener("click", createOnlineLobby);
joinLobbyButton.addEventListener("click", () => joinOnlineLobby(joinCode.value));
refreshLobbiesButton.addEventListener("click", () => openOnlineBrowser({ force: true }));
leaveLobbyButton.addEventListener("click", leaveOnlineMatchToBrowser);
onlineLeaveMatch.addEventListener("click", leaveOnlineMatchToBrowser);
draftLeaveOnline.addEventListener("click", leaveOnlineMatchToBrowser);
copyLobbyCode.addEventListener("click", async () => {
  const code = onlineRoomCode.textContent.trim();
  try {
    await navigator.clipboard.writeText(code);
    showToast(`Lobby code ${code} copied.`);
  } catch {
    showToast(`Lobby code: ${code}`);
  }
});
joinCode.addEventListener("input", () => {
  const normalized = formatLobbyCodeInput(joinCode.value);
  if (joinCode.value !== normalized) joinCode.value = normalized;
  joinCode.setAttribute("aria-invalid", "false");
});
joinCode.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    joinOnlineLobby(joinCode.value);
  }
});
soundToggle.addEventListener("click", () => {
  sound.enabled = !sound.enabled;
  saveSoundPreference();
  updateSoundButton();
  if (sound.enabled) {
    sound.arm();
    sound.tap();
    showToast("Sound effects on");
  } else {
    sound.stopAll();
    showToast("Sound effects muted");
  }
});

document.addEventListener("keydown", (event) => {
  const focusAllowsShortcut = document.activeElement === document.body || document.activeElement?.classList.contains("screen");
  if ((event.code === "Space" || event.code === "Enter") && focusAllowsShortcut) {
    const current = screens.find((screen) => !screen.hidden)?.id;
    const action = {
      "draft-screen": spinAction,
      "handoff-screen": handoffAction,
      "bot-draft-screen": botRevealAction.hidden ? null : botRevealAction,
      "sandbox-screen": sandboxStart,
      "reveal-screen": beginBattle,
    }[current];
    if (action && !action.disabled) {
      event.preventDefault();
      action.click();
    }
  }
});

updateSoundButton();
onlineName.value = readOnlineName() || defaultOnlineName();
