import { animeCharacters } from "./data/anime.js?v=20260809-3";
import { dcCharacters, marvelCharacters } from "./data/comics.js?v=20260809-3";
import { menaceCharacters } from "./data/menaces.js?v=20260809-3";
import { videoGameCharacters } from "./data/video-games.js?v=20260809-3";
import {
  CATEGORY_WEIGHTS,
  chooseWeighted,
  formatHealth,
  formatPower,
  powerScore,
  powerTier,
  powerToHealth,
  randomIndex,
  resolveBattle,
} from "./game-logic.js?v=20260809-3";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const REDUCED_MOTION_AUDIO_SCALE = 0.035;

const categories = [
  { id: "anime", label: "ANIME", weight: CATEGORY_WEIGHTS.anime, roster: animeCharacters, center: 45 },
  { id: "marvel", label: "MARVEL", weight: CATEGORY_WEIGHTS.marvel, roster: marvelCharacters, center: 135 },
  { id: "dc", label: "DC", weight: CATEGORY_WEIGHTS.dc, roster: dcCharacters, center: 225 },
  { id: "games", label: "VIDEO GAME LEGENDS", weight: CATEGORY_WEIGHTS.games, roster: videoGameCharacters, center: 297 },
  { id: "menace", label: "FICTION & TOON MENACES", weight: CATEGORY_WEIGHTS.menace, roster: menaceCharacters, center: 342 },
];

const screens = $$(".screen");
const startGameButton = $("#start-game");
const soundToggle = $("#sound-toggle");
const draftOverline = $("#draft-overline");
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
const p1Lineup = $("#p1-lineup");
const p2Lineup = $("#p2-lineup");
const p1Total = $("#p1-total");
const p2Total = $("#p2-total");
const beginBattle = $("#begin-battle");
const battleScoreOne = $("#battle-score-one");
const battleScoreTwo = $("#battle-score-two");
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
};

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

  reelTick(index) {
    if (index % 2 === 0) this.tone(320 + (index % 7) * 25, 0.035, { type: "triangle", volume: 0.012 });
  }

  reveal(power) {
    const score = powerScore(power);
    const base = score === Infinity ? 180 : Math.min(720, 180 + score * 5);
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

  impact(powerOne, powerTwo, severity = "fair") {
    const topScore = Math.max(powerScore(powerOne), powerScore(powerTwo));
    const intensity = topScore === Infinity ? 1 : Math.min(1, topScore / 100);
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

  lock(power) {
    const score = powerScore(power);
    const base = score === Infinity ? 520 : Math.min(620, 210 + score * 4);
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

function randomUnit() {
  if (window.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return value[0] / 4294967296;
  }
  return Math.random();
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

function healthPercent(current, maximum) {
  if (current === Infinity && maximum === Infinity) return 100;
  if (current === 0n || maximum === 0n) return 0;
  const tenths = Number((current * 1000n) / maximum) / 10;
  return Math.max(1, Math.min(100, tenths));
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
  const tier = powerTier(character.power);
  const card = document.createElement("article");
  card.className = "fighter-card";
  card.dataset.tier = tier;
  if (character.categoryId) card.dataset.category = character.categoryId;
  if (healthState) card.classList.add("has-health");
  const healthMarkup = healthState
    ? `
      <div class="battle-health" role="progressbar" aria-label="${escapeHtml(character.name)} health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${healthPercent(healthState.current, healthState.maximum)}" aria-valuetext="${escapeHtml(`${formatHealth(healthState.current)} remaining`)}">
        <div class="battle-health-copy">
          <span>HEALTH REMAINING</span>
          <strong data-health-value>${escapeHtml(formatHealth(healthState.current))}</strong>
        </div>
        <div class="battle-health-track"><span data-health-fill style="width: ${healthPercent(healthState.current, healthState.maximum)}%"></span></div>
      </div>
    `
    : `
      <div class="power-readout" title="Fan-made power value: ${escapeHtml(character.power)}">
        <span>POWER LEVEL</span>
        <strong>${escapeHtml(formatPower(character.power))}</strong>
      </div>
    `;
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
  const power = document.createElement("strong");
  power.textContent = formatPower(character.power);
  card.append(portrait, source, name, form, power);
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
  value.textContent = formatHealth(health);
  progress.setAttribute("aria-valuenow", String(percent));
  progress.setAttribute("aria-valuetext", `${formatHealth(health)} remaining`);
  card.classList.toggle("is-exhausted", eliminated);
  card.classList.toggle("is-survivor", !eliminated);
}

function lineupCard(character, rank) {
  const tier = powerTier(character.power);
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
    <strong class="lineup-power">${escapeHtml(formatPower(character.power))}</strong>
  `;
  hydratePortrait(card, character);
  return card;
}

function lockedPickCard(character) {
  const tier = powerTier(character.power);
  const card = document.createElement("div");
  card.className = "locked-pick";
  card.style.setProperty("--tier", tierColors[tier]);
  card.innerHTML = `
    <div class="mini-avatar" data-portrait>${escapeHtml(initials(character.name))}</div>
    <div><b>${escapeHtml(character.name)}</b><small>${escapeHtml(formatPower(character.power))}</small></div>
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
}

function startNewGame() {
  sound.stopAll();
  sound.arm();
  sound.tap();
  resetState();
  renderDraft();
  showScreen("draft-screen");
}

function renderDraft() {
  const team = state.teams[state.activePlayer];
  draftOverline.textContent = `PLAYER ${state.activePlayer + 1} · PRIVATE DRAFT`;
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
  else sound.reveal(category.id === "menace" ? "1e30" : "1e12");
}

async function spinCharacter() {
  if (state.busy || state.phase !== "character" || !state.selectedCategory) return;
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
  const cycle = () => {
    const preview = pool[randomIndex(pool.length, randomUnit())];
    reelName.textContent = preview.name.toUpperCase();
    reelForm.textContent = preview.form;
    sound.reelTick(tick);
    tick += 1;
  };
  cycle();
  const interval = window.setInterval(cycle, motionTime(72, 20));
  await wait(motionTime(1740, 90));
  window.clearInterval(interval);

  reelStage.hidden = true;
  revealStage.hidden = false;
  try {
    draftCardMount.replaceChildren(fighterCard(state.selectedCharacter, `P${state.activePlayer + 1} · 0${state.teams[state.activePlayer].length + 1}`));
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
  sound.reveal(state.selectedCharacter.power);
  if (category.id === "games") sound.arcade();
}

async function lockCharacter() {
  if (state.busy || state.phase !== "lock" || !state.selectedCharacter) return;
  state.busy = true;
  spinAction.disabled = true;
  sound.lock(state.selectedCharacter.power);
  const team = state.teams[state.activePlayer];
  team.push(state.selectedCharacter);
  state.used.add(state.selectedCharacter.id);
  renderLockedOnly();
  spinResult.textContent = `${state.selectedCharacter.name} locked into slot ${team.length}.`;
  await wait(motionTime(520, 40));

  if (team.length < 3) {
    renderDraft();
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
  const highest = team.reduce((best, character) => (powerScore(character.power) > powerScore(best.power) ? character : best));
  return `PEAK ${formatPower(highest.power)}`;
}

function prepareReveal() {
  sound.stopAll();
  state.battle = resolveBattle(state.teams[0], state.teams[1]);
  p1Lineup.replaceChildren(...state.battle.sortedOne.map((character, index) => lineupCard(character, index + 1)));
  p2Lineup.replaceChildren(...state.battle.sortedTwo.map((character, index) => lineupCard(character, index + 1)));
  p1Total.textContent = peakLabel(state.battle.sortedOne);
  p2Total.textContent = peakLabel(state.battle.sortedTwo);
  showScreen("reveal-screen");
  sound.reveal(
    powerScore(state.battle.sortedOne[0].power) > powerScore(state.battle.sortedTwo[0].power)
      ? state.battle.sortedOne[0].power
      : state.battle.sortedTwo[0].power,
  );
}

function setVerdict(clash) {
  clashVerdict.className = "clash-verdict";
  clashVerdict.dataset.severity = clash.severity;
  clashVerdict.style.removeProperty("--winner-color");
  const eyebrow = $("span", clashVerdict);
  const headline = $("strong", clashVerdict);

  if (clash.reason === "boundless-nullification") {
    clashVerdict.classList.add("is-null");
    eyebrow.textContent = "BOUNDLESS × BOUNDLESS";
    headline.textContent = "MUTUAL NULLIFICATION — BOTH CANCELLED";
    battleAnnouncer.textContent = headline.textContent;
    return;
  }
  if (clash.winner === 0) {
    clashVerdict.classList.add("is-null");
    eyebrow.textContent = `${formatHealth(clash.leftHealthBefore)} = ${formatHealth(clash.rightHealthBefore)}`;
    headline.textContent = "EQUAL HEALTH — DOUBLE KNOCKOUT";
    battleAnnouncer.textContent = headline.textContent;
    return;
  }

  clashVerdict.classList.add("is-win");
  const winner = clash.winner === 1 ? clash.left : clash.right;
  const winnerBefore = clash.winner === 1 ? clash.leftHealthBefore : clash.rightHealthBefore;
  const loserBefore = clash.winner === 1 ? clash.rightHealthBefore : clash.leftHealthBefore;
  const winnerAfter = clash.winner === 1 ? clash.leftHealthAfter : clash.rightHealthAfter;
  const verdict = clash.verdict === "boundless-overmatch" ? "BOUNDLESS SOLO" : severityCopy[clash.severity] || "VICTORY";
  clashVerdict.style.setProperty("--winner-color", clash.winner === 1 ? "var(--p1)" : "var(--p2)");
  eyebrow.textContent = `${formatHealth(winnerBefore)} − ${formatHealth(loserBefore)}`;
  headline.textContent = `${verdict} · ${winner.name.toUpperCase()} HOLDS ${formatHealth(winnerAfter)} HEALTH`;
  battleAnnouncer.textContent = headline.textContent;
  if (clash.severity === "brutal" || clash.severity === "soloed") {
    defeatStamp.textContent = clash.severity === "soloed" ? "SOLOED" : "BRUTAL";
    clashArena.classList.add("show-defeat");
  }
}

async function playBattle() {
  if (!state.battle) prepareReveal();
  const token = ++state.battleToken;
  showScreen("battle-screen");
  battleScoreOne.textContent = String(state.battle.sortedOne.length);
  battleScoreTwo.textContent = String(state.battle.sortedTwo.length);
  clashTotal.textContent = `/ ${String(state.battle.timeline.length).padStart(2, "0")}`;
  skipBattle.disabled = false;
  sound.stopAll();
  sound.battleStart();

  for (let index = 0; index < state.battle.timeline.length; index += 1) {
    if (token !== state.battleToken) return;
    const clash = state.battle.timeline[index];
    const leftMaximum = powerToHealth(clash.left.power);
    const rightMaximum = powerToHealth(clash.right.power);
    const leftContinuing = clash.leftHealthBefore !== leftMaximum;
    const rightContinuing = clash.rightHealthBefore !== rightMaximum;
    clashNumber.textContent = `0${index + 1}`;
    battleScoreOne.textContent = String(state.battle.sortedOne.length - clash.leftIndex);
    battleScoreTwo.textContent = String(state.battle.sortedTwo.length - clash.rightIndex);
    battleCardOne.replaceChildren(fighterCard(
      clash.left,
      leftContinuing ? "P1 · SURVIVOR" : `P1 · #${clash.leftIndex + 1}`,
      { current: clash.leftHealthBefore, maximum: leftMaximum },
    ));
    battleCardTwo.replaceChildren(fighterCard(
      clash.right,
      rightContinuing ? "P2 · SURVIVOR" : `P2 · #${clash.rightIndex + 1}`,
      { current: clash.rightHealthBefore, maximum: rightMaximum },
    ));
    clashArena.classList.remove("is-loaded", "is-impact", "show-defeat", ...severityClasses);
    clashArena.style.removeProperty("--winner-color");
    if (clash.winner) clashArena.style.setProperty("--winner-color", clash.winner === 1 ? "var(--p1)" : "var(--p2)");
    clashArena.classList.add(`severity-${clash.severity}`);
    defeatStamp.textContent = "";
    battleAnnouncer.textContent = "";
    clashVerdict.className = "clash-verdict";
    delete clashVerdict.dataset.severity;
    clashVerdict.style.removeProperty("--winner-color");
    $("span", clashVerdict).textContent = "POWER READINGS LOCKED";
    $("strong", clashVerdict).textContent = "PREPARE FOR IMPACT";
    void clashArena.offsetWidth;
    requestAnimationFrame(() => clashArena.classList.add("is-loaded"));
    sound.charge(clash.severity);

    await wait(motionTime(760, 45));
    if (token !== state.battleToken) return;
    clashArena.classList.add("is-impact");
    sound.impact(clash.leftHealthBefore, clash.rightHealthBefore, clash.severity);

    await wait(motionTime(690, 45));
    if (token !== state.battleToken) return;
    updateCardHealth(battleCardOne, clash.leftHealthAfter, clash.leftEliminated);
    updateCardHealth(battleCardTwo, clash.rightHealthAfter, clash.rightEliminated);
    setVerdict(clash);
    battleScoreOne.textContent = String(clash.remainingOne);
    battleScoreTwo.textContent = String(clash.remainingTwo);
    if (clash.reason === "boundless-nullification") sound.nullify();
    else {
      sound.drain(true);
      sound.defeat(clash.severity, clash.winner);
    }

    await wait(motionTime(1280, 55));
  }

  if (token !== state.battleToken) return;
  await wait(motionTime(420, 25));
  showResult();
}

function showResult() {
  state.battleToken += 1;
  const battle = state.battle;
  const isDraw = battle.winner === 0;
  resultKicker.textContent = isDraw ? "FINAL VERDICT · COMPLETE STALEMATE" : "FINAL VERDICT · FIGHTERS LEFT";
  resultTitle.textContent = isDraw ? "THE BATTLE DRAWS" : `PLAYER ${battle.winner} WINS`;
  resultTitle.style.color = isDraw ? "var(--paper)" : battle.winner === 1 ? "var(--p1)" : "var(--p2)";
  resultScore.textContent = `${battle.survivorsOne.length} — ${battle.survivorsTwo.length}`;
  if (isDraw) {
    resultCopy.textContent = "Every fighter is exhausted or cancelled. No health remains on either side.";
  } else {
    const survivors = battle.winner === 1 ? battle.survivorsOne : battle.survivorsTwo;
    const lead = survivors[0];
    const reserveCount = Math.max(0, survivors.length - 1);
    resultCopy.textContent = `${lead.name} finishes with ${formatHealth(lead.health)} health${reserveCount ? ` and ${reserveCount} fighter${reserveCount === 1 ? "" : "s"} still in reserve` : ""}.`;
  }

  resultGrid.replaceChildren();
  battle.timeline.forEach((clash, index) => {
    const row = document.createElement("div");
    row.className = "result-row";
    row.dataset.severity = clash.severity;
    const label = clash.reason === "boundless-nullification"
      ? "NULLIFIED"
      : clash.winner === 0
        ? "DOUBLE KO"
        : `P${clash.winner} ${severityCopy[clash.severity]} · ${formatHealth(clash.winner === 1 ? clash.leftHealthAfter : clash.rightHealthAfter)} LEFT`;
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

startGameButton.addEventListener("click", startNewGame);
spinAction.addEventListener("click", handleSpinAction);
handoffAction.addEventListener("click", continueHandoff);
beginBattle.addEventListener("click", playBattle);
skipBattle.addEventListener("click", () => {
  if (!state.battle) return;
  state.battleToken += 1;
  skipBattle.disabled = true;
  sound.stopAll();
  showResult();
});
resetGameButton.addEventListener("click", startNewGame);
reviewLineups.addEventListener("click", prepareReveal);
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
      "start-screen": startGameButton,
      "draft-screen": spinAction,
      "handoff-screen": handoffAction,
      "reveal-screen": beginBattle,
    }[current];
    if (action && !action.disabled) {
      event.preventDefault();
      action.click();
    }
  }
});

updateSoundButton();
