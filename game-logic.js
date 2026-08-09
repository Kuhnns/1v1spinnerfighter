export const CATEGORY_WEIGHTS = Object.freeze({
  anime: 0.25,
  marvel: 0.25,
  dc: 0.25,
  games: 0.15,
  menace: 0.1,
});

const POWER_PATTERN = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i;
const COMPACT_SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

/** Numeric combat tiers. `Human: 0` is accepted for the one supplied durability outlier. */
export const STRENGTH_DURABILITY_TIERS = Object.freeze({
  Human: 0,
  Building: 1,
  "City Block": 2,
  Town: 3,
  City: 4,
  Country: 5,
  Continent: 6,
  Planetary: 7,
  Universal: 8,
  Multiversal: 9,
  Outerversal: 10,
  Boundless: 11,
});

// Each higher Strength tier receives one fewer draw ticket. This keeps every
// fighter possible while making stronger forms progressively rarer inside the
// category that the wheel already selected.
export const STRENGTH_DRAW_TICKETS = Object.freeze({
  Human: 12,
  Building: 11,
  "City Block": 10,
  Town: 9,
  City: 8,
  Country: 7,
  Continent: 6,
  Planetary: 5,
  Universal: 4,
  Multiversal: 3,
  Outerversal: 2,
  Boundless: 1,
});

export const SPEED_TIERS = Object.freeze({
  Human: 1,
  "Peak Human": 2,
  Superhuman: 3,
  Subsonic: 4,
  Transonic: 5,
  Supersonic: 6,
  Hypersonic: 7,
  "Sub-Relativistic": 8,
  Relativistic: 9,
  "Speed of Light": 10,
  "Faster than Light": 11,
  "Massively FTL": 12,
  Omnipresent: 13,
});

export const DAMAGE_PERCENTAGES = Object.freeze({
  threeOrMoreTiersLower: 3,
  twoTiersLower: 8,
  oneTierLower: 15,
  equal: 25,
  oneTierHigher: 40,
  twoTiersHigher: 65,
  threeOrMoreTiersHigher: 100,
});

export const MAX_HEALTH_PERCENT = 100;

function invalidPower(power) {
  return new TypeError(`Invalid power value: ${String(power)}`);
}

function parseHealth(value, allowZero = false) {
  if (value === Infinity || value === "Infinity") return Infinity;

  if (typeof value === "bigint") {
    if (value < 0n || (!allowZero && value === 0n)) throw invalidPower(value);
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
      throw invalidPower(value);
    }
    return BigInt(value);
  }

  const raw = String(value).trim();
  const match = raw.match(POWER_PATTERN);
  if (!match) throw invalidPower(value);

  const whole = match[1];
  const fraction = match[2] || "";
  const exponent = Number(match[3] || 0);
  if (!Number.isSafeInteger(exponent)) throw invalidPower(value);

  const significantDigits = `${whole}${fraction}`.replace(/^0+/, "") || "0";
  let health = BigInt(significantDigits);
  const decimalShift = exponent - fraction.length;

  if (decimalShift >= 0) {
    health *= 10n ** BigInt(decimalShift);
  } else {
    const divisor = 10n ** BigInt(-decimalShift);
    if (health % divisor !== 0n) throw invalidPower(value);
    health /= divisor;
  }

  if (health < 0n || (!allowZero && health === 0n)) throw invalidPower(value);
  return health;
}

/** Convert a roster power into exact combat health. Finite health is always a BigInt. */
export function powerToHealth(power) {
  return parseHealth(power);
}

/** Convert combat health back to the string shape used by fighter cards. */
export function healthToPowerString(health) {
  const parsed = parseHealth(health, true);
  return parsed === Infinity ? "Infinity" : parsed.toString();
}

export function powerScore(power) {
  const health = powerToHealth(power);
  if (health === Infinity) return Infinity;

  const digits = health.toString();
  const leadingDigits = digits.slice(0, 15);
  const leadingValue = Number(leadingDigits) / 10 ** (leadingDigits.length - 1);
  return digits.length - 1 + Math.log10(leadingValue);
}

/** Format original power or changing battle health without converting the BigInt to Number. */
export function formatHealth(health) {
  const parsed = parseHealth(health, true);
  if (parsed === Infinity) return "∞ BOUNDLESS";
  if (parsed < 1000n) return parsed.toLocaleString("en-US");

  const digits = parsed.toString();
  const exponent = digits.length - 1;
  const group = Math.floor(exponent / 3);

  if (group < COMPACT_SUFFIXES.length) {
    const wholeDigits = digits.length - group * 3;
    let compact = digits.slice(0, wholeDigits);
    const firstDecimal = digits[wholeDigits];
    if (wholeDigits === 1 && firstDecimal && firstDecimal !== "0") compact += `.${firstDecimal}`;
    return `${compact}${COMPACT_SUFFIXES[group]}`;
  }

  const decimal = digits[1] && digits[1] !== "0" ? `.${digits[1]}` : "";
  return `${digits[0]}${decimal}e${exponent}`;
}

export function formatPower(power) {
  return formatHealth(powerToHealth(power));
}

export function powerTier(power) {
  const score = powerScore(power);
  if (score === Infinity) return "boundless";
  if (score >= 90) return "outer";
  if (score >= 40) return "multiversal";
  if (score >= 18) return "cosmic";
  if (score >= 9) return "titan";
  return "elite";
}

function compareHealth(left, right) {
  if (left === right) return 0;
  if (left === Infinity) return 1;
  if (right === Infinity) return -1;
  return left > right ? 1 : -1;
}

const FINITE_MISMATCH_RULES = Object.freeze([
  { severity: "soloed", verdict: "total-mismatch", numerator: 1000n, denominator: 1n },
  { severity: "brutal", verdict: "overwhelming-win", numerator: 10n, denominator: 1n },
  { severity: "dominant", verdict: "decisive-win", numerator: 2n, denominator: 1n },
  { severity: "edge", verdict: "narrow-edge", numerator: 5n, denominator: 4n },
]);

/**
 * Classify a clash without lossy Number conversion. Finite ratio boundaries are:
 * fair < 1.25x, edge < 2x, dominant < 10x, brutal < 1000x, soloed >= 1000x.
 */
export function classifyPowerMismatch(leftPower, rightPower) {
  const left = parseHealth(leftPower);
  const right = parseHealth(rightPower);
  const comparison = compareHealth(left, right);

  if (left === Infinity && right === Infinity) {
    return {
      severity: "fair",
      verdict: "boundless-nullification",
      stronger: 0,
      powerGap: 0n,
    };
  }

  if (left === Infinity || right === Infinity) {
    return {
      severity: "soloed",
      verdict: "boundless-overmatch",
      stronger: left === Infinity ? 1 : 2,
      powerGap: Infinity,
    };
  }

  if (comparison === 0) {
    return {
      severity: "fair",
      verdict: "dead-even",
      stronger: 0,
      powerGap: 0n,
    };
  }

  const strongerPower = comparison > 0 ? left : right;
  const weakerPower = comparison > 0 ? right : left;
  const powerGap = strongerPower - weakerPower;
  const rule = FINITE_MISMATCH_RULES.find(
    ({ numerator, denominator }) => strongerPower * denominator >= weakerPower * numerator,
  );

  return {
    severity: rule?.severity || "fair",
    verdict: rule?.verdict || "photo-finish",
    stronger: comparison > 0 ? 1 : 2,
    powerGap,
  };
}

export function sortTeam(team) {
  if (!Array.isArray(team)) throw new TypeError("Team must be an array.");
  return team
    .map((fighter, index) => ({ fighter, health: powerToHealth(fighter.power), index }))
    .sort((left, right) => compareHealth(right.health, left.health) || left.index - right.index)
    .map(({ fighter }) => fighter);
}

const BOUNDLESS_TIER = STRENGTH_DURABILITY_TIERS.Boundless;
const MAX_CLASH_EVENTS = 256;

function tierLookup(tiers, value) {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  const match = Object.entries(tiers).find(([label]) => label.toLocaleLowerCase("en-US") === normalized);
  return match?.[1];
}

function parseCombatTier(value, stat, minimum, maximum, tiers) {
  let tier;
  if (typeof value === "number") {
    tier = value;
  } else if (typeof value === "string" && value.trim()) {
    tier = /^\d+$/.test(value.trim()) ? Number(value) : tierLookup(tiers, value);
  }
  if (!Number.isInteger(tier) || tier < minimum || tier > maximum) {
    throw new TypeError(`${stat} must be a valid tier from ${minimum} to ${maximum}.`);
  }
  return tier;
}

/** Validate and normalize the three combat stats on a decorated fighter record. */
export function getCombatStats(fighter) {
  if (!fighter || typeof fighter !== "object") throw new TypeError("Fighter must be an object.");
  return {
    strength: parseCombatTier(fighter.strength, "Strength", 1, BOUNDLESS_TIER, STRENGTH_DURABILITY_TIERS),
    durability: parseCombatTier(fighter.durability, "Durability", 0, BOUNDLESS_TIER, STRENGTH_DURABILITY_TIERS),
    speed: parseCombatTier(fighter.speed, "Speed", 1, SPEED_TIERS.Omnipresent, SPEED_TIERS),
  };
}

/** Return percentage points removed by one normal attack. */
export function calculateDamagePercent(strength, durability) {
  const strengthTier = parseCombatTier(
    strength,
    "Strength",
    1,
    BOUNDLESS_TIER,
    STRENGTH_DURABILITY_TIERS,
  );
  const durabilityTier = parseCombatTier(
    durability,
    "Durability",
    0,
    BOUNDLESS_TIER,
    STRENGTH_DURABILITY_TIERS,
  );

  if (durabilityTier === BOUNDLESS_TIER && strengthTier < BOUNDLESS_TIER) return 0;

  const gap = strengthTier - durabilityTier;
  if (gap <= -3) return DAMAGE_PERCENTAGES.threeOrMoreTiersLower;
  if (gap === -2) return DAMAGE_PERCENTAGES.twoTiersLower;
  if (gap === -1) return DAMAGE_PERCENTAGES.oneTierLower;
  if (gap === 0) return DAMAGE_PERCENTAGES.equal;
  if (gap === 1) return DAMAGE_PERCENTAGES.oneTierHigher;
  if (gap === 2) return DAMAGE_PERCENTAGES.twoTiersHigher;
  return DAMAGE_PERCENTAGES.threeOrMoreTiersHigher;
}

function parsePercentHealth(value, side) {
  const accepted = typeof value === "number"
    || typeof value === "bigint"
    || (typeof value === "string" && value.trim() !== "");
  const health = accepted ? Number(value) : Number.NaN;
  if (!Number.isFinite(health) || health < 0 || health > MAX_HEALTH_PERCENT) {
    throw new TypeError(`${side} health must be a finite percentage from 0 to ${MAX_HEALTH_PERCENT}.`);
  }
  return health;
}

function validateCombatRandom(random) {
  if (typeof random !== "function") throw new TypeError("The combat RNG must be a function.");
}

function combatCoinFlip(random) {
  const unit = random();
  if (typeof unit !== "number" || !Number.isFinite(unit)) {
    throw new TypeError("The combat RNG must return a finite number.");
  }
  return Math.min(Math.max(unit, 0), 0.999999999999) < 0.5 ? 1 : 2;
}

function outcomeCopy(events, winner, reason, winnerHealth, blitzType, blitzAttacker) {
  if (reason === "boundless-nullification") {
    return { severity: "fair", verdict: "boundless-nullification", stronger: 0, powerGap: 0 };
  }
  if (reason === "mutual-immunity") {
    return { severity: "fair", verdict: "mutual-immunity", stronger: 0, powerGap: 0 };
  }

  const overwhelmingKnockout = events.some((event) => event.type === "attack" && event.oneShot);
  if (overwhelmingKnockout) {
    return { severity: "soloed", verdict: "total-mismatch", stronger: winner, powerGap: null };
  }
  if (winner === blitzAttacker && blitzType === "extreme-blitz") {
    return { severity: "brutal", verdict: "extreme-blitz", stronger: winner, powerGap: null };
  }
  if (winner === blitzAttacker && blitzType === "speed-blitz") {
    return { severity: "dominant", verdict: "speed-blitz", stronger: winner, powerGap: null };
  }
  if (winnerHealth >= 75) {
    return { severity: "dominant", verdict: "decisive-win", stronger: winner, powerGap: null };
  }
  if (winnerHealth >= 40) {
    return { severity: "edge", verdict: "narrow-edge", stronger: winner, powerGap: null };
  }
  return { severity: "fair", verdict: "photo-finish", stronger: winner, powerGap: null };
}

/**
 * Resolve one automatic percentage-health duel.
 *
 * `events` contains every simultaneous clash and individual hit in display order,
 * while the top-level health fields summarize the complete one-on-one matchup.
 */
export function resolveClash(
  left,
  right,
  leftHealth = MAX_HEALTH_PERCENT,
  rightHealth = MAX_HEALTH_PERCENT,
  random = Math.random,
) {
  validateCombatRandom(random);
  const leftStats = getCombatStats(left);
  const rightStats = getCombatStats(right);
  const leftHealthBefore = parsePercentHealth(leftHealth, "Left");
  const rightHealthBefore = parsePercentHealth(rightHealth, "Right");
  let leftCurrent = leftHealthBefore;
  let rightCurrent = rightHealthBefore;
  const events = [];
  const speedGap = Math.abs(leftStats.speed - rightStats.speed);
  const speedAdvantage = leftStats.speed === rightStats.speed ? 0 : leftStats.speed > rightStats.speed ? 1 : 2;
  const leftAttackDamage = calculateDamagePercent(leftStats.strength, rightStats.durability);
  const rightAttackDamage = calculateDamagePercent(rightStats.strength, leftStats.durability);
  const bothFullyBoundless = leftStats.strength === BOUNDLESS_TIER
    && leftStats.durability === BOUNDLESS_TIER
    && rightStats.strength === BOUNDLESS_TIER
    && rightStats.durability === BOUNDLESS_TIER;
  let firstAttacker = 0;
  let blitzType = null;
  let openingAttackCount = 0;
  let powerClash = false;

  function finish(reason) {
    const leftEliminated = leftCurrent <= 0;
    const rightEliminated = rightCurrent <= 0;
    const winner = leftEliminated === rightEliminated ? 0 : leftEliminated ? 2 : 1;
    const winnerHealth = winner === 1 ? leftCurrent : winner === 2 ? rightCurrent : 0;
    return {
      left,
      right,
      leftStats,
      rightStats,
      leftHealthBefore,
      rightHealthBefore,
      leftHealthAfter: leftCurrent,
      rightHealthAfter: rightCurrent,
      leftEliminated,
      rightEliminated,
      eliminated: { left: leftEliminated, right: rightEliminated },
      winner,
      reason,
      events,
      firstAttacker,
      speedGap,
      speedAdvantage,
      blitzType,
      openingAttackCount,
      powerClash,
      boundlessClash: reason === "boundless-nullification",
      stalemate: reason === "mutual-immunity",
      ...outcomeCopy(events, winner, reason, winnerHealth, blitzType, speedAdvantage),
    };
  }

  if (bothFullyBoundless) {
    const before = { left: leftCurrent, right: rightCurrent };
    leftCurrent = 0;
    rightCurrent = 0;
    events.push({
      step: 1,
      type: "boundless-clash",
      attacker: 0,
      defender: 0,
      leftHealthBefore: before.left,
      rightHealthBefore: before.right,
      leftHealthAfter: leftCurrent,
      rightHealthAfter: rightCurrent,
      doubleKo: true,
    });
    return finish("boundless-nullification");
  }

  if (leftAttackDamage === 0 && rightAttackDamage === 0) {
    events.push({
      step: 1,
      type: "stalemate",
      attacker: 0,
      defender: 0,
      leftHealthBefore: leftCurrent,
      rightHealthBefore: rightCurrent,
      leftHealthAfter: leftCurrent,
      rightHealthAfter: rightCurrent,
      reason: "mutual-immunity",
    });
    return finish("mutual-immunity");
  }

  function attack(attacker, opening = false, blitzHit = 0) {
    const beforeLeft = leftCurrent;
    const beforeRight = rightCurrent;
    const defender = attacker === 1 ? 2 : 1;
    const normalDamage = attacker === 1 ? leftAttackDamage : rightAttackDamage;
    const defenderHealth = defender === 1 ? leftCurrent : rightCurrent;
    const damage = Math.min(defenderHealth, normalDamage);
    if (defender === 1) leftCurrent = Math.max(0, leftCurrent - damage);
    else rightCurrent = Math.max(0, rightCurrent - damage);
    events.push({
      step: events.length + 1,
      type: "attack",
      attacker,
      defender,
      damage,
      damagePercent: normalDamage,
      immune: normalDamage === 0,
      oneShot: normalDamage === DAMAGE_PERCENTAGES.threeOrMoreTiersHigher,
      opening,
      blitzType: opening && openingAttackCount > 1 ? blitzType : null,
      blitzHit: opening && openingAttackCount > 1 ? blitzHit : 0,
      blitzHits: opening && openingAttackCount > 1 ? openingAttackCount : 0,
      leftHealthBefore: beforeLeft,
      rightHealthBefore: beforeRight,
      leftHealthAfter: leftCurrent,
      rightHealthAfter: rightCurrent,
    });
  }

  if (leftStats.speed === rightStats.speed && leftStats.strength === rightStats.strength) {
    powerClash = true;
    const damageToLeft = rightAttackDamage / 2;
    const damageToRight = leftAttackDamage / 2;
    const actualDamageToLeft = Math.min(leftCurrent, damageToLeft);
    const actualDamageToRight = Math.min(rightCurrent, damageToRight);
    const beforeLeft = leftCurrent;
    const beforeRight = rightCurrent;
    leftCurrent = Math.max(0, leftCurrent - actualDamageToLeft);
    rightCurrent = Math.max(0, rightCurrent - actualDamageToRight);

    // A low-health direct API call can make an ordinary clash mathematically lethal
    // to both. Preserve the rule that only the full Boundless clash produces a double KO.
    if (leftCurrent === 0 && rightCurrent === 0) {
      firstAttacker = combatCoinFlip(random);
      if (firstAttacker === 1) leftCurrent = 0.5;
      else rightCurrent = 0.5;
    }

    events.push({
      step: 1,
      type: "power-clash",
      attacker: 0,
      defender: 0,
      leftDamage: beforeLeft - leftCurrent,
      rightDamage: beforeRight - rightCurrent,
      leftNormalDamage: rightAttackDamage,
      rightNormalDamage: leftAttackDamage,
      damageMultiplier: 0.5,
      leftHealthBefore: beforeLeft,
      rightHealthBefore: beforeRight,
      leftHealthAfter: leftCurrent,
      rightHealthAfter: rightCurrent,
    });

    if (leftCurrent === 0 || rightCurrent === 0) return finish("knockout");
    if (!firstAttacker) firstAttacker = combatCoinFlip(random);
  } else if (speedAdvantage === 0) {
    firstAttacker = combatCoinFlip(random);
  } else {
    firstAttacker = speedAdvantage;
  }

  if (speedGap >= 6) {
    openingAttackCount = 3;
    blitzType = "extreme-blitz";
  } else if (speedGap >= 4) {
    openingAttackCount = 2;
    blitzType = "speed-blitz";
  } else {
    openingAttackCount = 1;
  }

  for (let hit = 1; hit <= openingAttackCount && leftCurrent > 0 && rightCurrent > 0; hit += 1) {
    attack(firstAttacker, !powerClash, hit);
  }

  let nextAttacker = firstAttacker === 1 ? 2 : 1;
  while (leftCurrent > 0 && rightCurrent > 0 && events.length < MAX_CLASH_EVENTS) {
    attack(nextAttacker);
    nextAttacker = nextAttacker === 1 ? 2 : 1;
  }

  if (leftCurrent > 0 && rightCurrent > 0) {
    events.push({
      step: events.length + 1,
      type: "stalemate",
      attacker: 0,
      defender: 0,
      leftHealthBefore: leftCurrent,
      rightHealthBefore: rightCurrent,
      leftHealthAfter: leftCurrent,
      rightHealthAfter: rightCurrent,
      reason: "safety-limit",
    });
    return finish("mutual-immunity");
  }

  return finish("knockout");
}

function survivorRecord(state) {
  return {
    ...state.fighter,
    health: state.health,
    maxHealth: MAX_HEALTH_PERCENT,
    remainingPercent: state.health,
    remainingPower: String(state.health),
  };
}

function totalHealth(survivors) {
  return survivors.reduce((sum, survivor) => sum + survivor.health, 0);
}

/**
 * Run a winner-stays-on endurance battle in the teams' drafted order. The
 * `sortedOne` and `sortedTwo` names remain as compatibility aliases only.
 */
export function resolveBattle(teamOne, teamTwo, random = Math.random) {
  if (!Array.isArray(teamOne) || !Array.isArray(teamTwo)) throw new TypeError("Teams must be arrays.");
  if (teamOne.length === 0 || teamTwo.length === 0) throw new RangeError("Each team needs at least one fighter.");
  validateCombatRandom(random);

  const sortedOne = [...teamOne];
  const sortedTwo = [...teamTwo];
  const statesOne = sortedOne.map((fighter) => ({
    fighter,
    health: MAX_HEALTH_PERCENT,
    hasFought: false,
  }));
  const statesTwo = sortedTwo.map((fighter) => ({
    fighter,
    health: MAX_HEALTH_PERCENT,
    hasFought: false,
  }));

  const timeline = [];
  const events = [];
  let leftIndex = 0;
  let rightIndex = 0;
  let stalemate = false;

  while (leftIndex < statesOne.length && rightIndex < statesTwo.length) {
    const round = timeline.length + 1;
    const activeLeftIndex = leftIndex;
    const activeRightIndex = rightIndex;
    const leftState = statesOne[activeLeftIndex];
    const rightState = statesTwo[activeRightIndex];
    const leftLastStand = activeLeftIndex === statesOne.length - 1 && !leftState.hasFought;
    const rightLastStand = activeRightIndex === statesTwo.length - 1 && !rightState.hasFought;
    const outcome = resolveClash(
      leftState.fighter,
      rightState.fighter,
      leftState.health,
      rightState.health,
      random,
    );

    leftState.hasFought = true;
    rightState.hasFought = true;
    leftState.health = outcome.leftHealthAfter;
    rightState.health = outcome.rightHealthAfter;
    if (outcome.leftEliminated) leftIndex += 1;
    if (outcome.rightEliminated) rightIndex += 1;

    const clash = {
      round,
      leftIndex: activeLeftIndex,
      rightIndex: activeRightIndex,
      leftLastStand,
      rightLastStand,
      leftIsLastFighter: activeLeftIndex === statesOne.length - 1,
      rightIsLastFighter: activeRightIndex === statesTwo.length - 1,
      presentation: { leftLastStand, rightLastStand },
      ...outcome,
      nextLeftIndex: leftIndex,
      nextRightIndex: rightIndex,
      remainingOne: statesOne.length - leftIndex,
      remainingTwo: statesTwo.length - rightIndex,
    };
    timeline.push(clash);
    outcome.events.forEach((event) => {
      events.push({
        ...event,
        sequence: events.length + 1,
        round,
        leftIndex: activeLeftIndex,
        rightIndex: activeRightIndex,
        leftLastStand,
        rightLastStand,
      });
    });

    if (outcome.stalemate) {
      stalemate = true;
      break;
    }
  }

  const survivorsOne = statesOne.slice(leftIndex).map(survivorRecord);
  const survivorsTwo = statesTwo.slice(rightIndex).map(survivorRecord);
  const remainingHealthOne = totalHealth(survivorsOne);
  const remainingHealthTwo = totalHealth(survivorsTwo);
  const scoreOne = timeline.filter((clash) => clash.winner === 1).length;
  const scoreTwo = timeline.filter((clash) => clash.winner === 2).length;
  const winner = !stalemate && survivorsOne.length > 0 ? 1 : !stalemate && survivorsTwo.length > 0 ? 2 : 0;

  return {
    sortedOne,
    sortedTwo,
    lineupOne: sortedOne,
    lineupTwo: sortedTwo,
    timeline,
    clashes: timeline,
    events,
    actionTimeline: events,
    scoreOne,
    scoreTwo,
    winner,
    isDraw: winner === 0,
    stalemate,
    survivorsOne,
    survivorsTwo,
    survivors: { playerOne: survivorsOne, playerTwo: survivorsTwo },
    remainingHealthOne,
    remainingHealthTwo,
    remainingHealth: { playerOne: remainingHealthOne, playerTwo: remainingHealthTwo },
  };
}

const AUTOMATED_TEAM_SIZE = 3;

export function characterDrawWeight(fighter) {
  const minimumTier = STRENGTH_DURABILITY_TIERS.Human;
  const maximumTier = STRENGTH_DURABILITY_TIERS.Boundless;
  const strength = fighter?.strength;
  if (!Number.isInteger(strength) || strength < minimumTier || strength > maximumTier) {
    throw new TypeError(`Fighter ${fighter?.id || "(unknown)"} must have an integer Strength tier from ${minimumTier} to ${maximumTier}.`);
  }
  return maximumTier + 1 - strength;
}

/** Select one fighter after normalizing Strength-based tickets within the supplied pool. */
export function chooseStrengthWeightedCharacter(roster, unit = Math.random()) {
  if (!Array.isArray(roster) || roster.length === 0) {
    throw new RangeError("Character draw requires at least one fighter.");
  }
  if (typeof unit !== "number" || !Number.isFinite(unit)) {
    throw new TypeError("Character draw unit must be a finite number.");
  }

  const weights = roster.map(characterDrawWeight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const target = Math.min(Math.max(unit, 0), 0.999999999999) * totalWeight;
  let cursor = 0;
  for (let index = 0; index < roster.length; index += 1) {
    cursor += weights[index];
    if (target < cursor) return roster[index];
  }
  return roster[roster.length - 1];
}

function validateDraftCategories(categories) {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new TypeError("Categories must be a non-empty array.");
  }

  const categoryIds = new Set();
  categories.forEach((category, categoryIndex) => {
    if (!category || typeof category !== "object") {
      throw new TypeError(`Category at index ${categoryIndex} must be an object.`);
    }
    if (typeof category.id !== "string" || !category.id.trim()) {
      throw new TypeError(`Category at index ${categoryIndex} must have a non-empty id.`);
    }
    if (categoryIds.has(category.id)) throw new TypeError(`Duplicate category id: ${category.id}`);
    categoryIds.add(category.id);
    if (typeof category.label !== "string" || !category.label.trim()) {
      throw new TypeError(`Category ${category.id} must have a non-empty label.`);
    }
    if (typeof category.weight !== "number" || !Number.isFinite(category.weight) || category.weight < 0) {
      throw new TypeError(`Category ${category.id} must have a finite, non-negative weight.`);
    }
    if (!Array.isArray(category.roster)) throw new TypeError(`Category ${category.id} must have a roster array.`);
    category.roster.forEach((fighter, fighterIndex) => {
      if (!fighter || typeof fighter !== "object") {
        throw new TypeError(`Fighter at ${category.id}[${fighterIndex}] must be an object.`);
      }
      if (typeof fighter.id !== "string" || !fighter.id.trim()) {
        throw new TypeError(`Fighter at ${category.id}[${fighterIndex}] must have a non-empty id.`);
      }
      characterDrawWeight(fighter);
    });
  });
}

function validateUsedIds(usedIds) {
  if (!(usedIds instanceof Set)) throw new TypeError("Used fighter ids must be provided as a Set.");
  usedIds.forEach((id) => {
    if (typeof id !== "string" || !id.trim()) throw new TypeError("Every used fighter id must be a non-empty string.");
  });
}

function nextDraftUnit(random) {
  const unit = random();
  if (typeof unit !== "number" || !Number.isFinite(unit)) {
    throw new TypeError("The automated-draft RNG must return a finite number.");
  }
  return Math.min(Math.max(unit, 0), 0.999999999999);
}

function unusedUniqueRoster(roster, usedIds) {
  const seen = new Set();
  return roster.filter((fighter) => {
    if (usedIds.has(fighter.id) || seen.has(fighter.id)) return false;
    seen.add(fighter.id);
    return true;
  });
}

/**
 * Draw exactly three fighters using category odds first and Strength tickets second.
 *
 * Exhausted categories are removed and the remaining positive weights are
 * renormalized for each pick. The injected RNG is called exactly twice per pick:
 * once for its category and once for its fighter. The supplied used-id Set and
 * all category/roster records remain untouched.
 */
export function draftAutomatedTeam(categories, usedIds = new Set(), random = Math.random) {
  validateDraftCategories(categories);
  validateUsedIds(usedIds);
  if (typeof random !== "function") throw new TypeError("The automated-draft RNG must be a function.");

  const locallyUsed = new Set(usedIds);
  const selectableIds = new Set();
  categories.forEach((category) => {
    if (category.weight <= 0) return;
    category.roster.forEach((fighter) => {
      if (!locallyUsed.has(fighter.id)) selectableIds.add(fighter.id);
    });
  });
  if (selectableIds.size < AUTOMATED_TEAM_SIZE) {
    throw new RangeError(`Automated draft requires at least ${AUTOMATED_TEAM_SIZE} unused fighters in positive-weight categories.`);
  }

  const team = [];
  while (team.length < AUTOMATED_TEAM_SIZE) {
    const eligible = categories
      .map((category) => ({
        category,
        roster: unusedUniqueRoster(category.roster, locallyUsed),
      }))
      .filter(({ category, roster }) => category.weight > 0 && roster.length > 0);
    const totalWeight = eligible.reduce((sum, { category }) => sum + category.weight, 0);
    if (!eligible.length || !Number.isFinite(totalWeight) || totalWeight <= 0) {
      throw new RangeError("Automated draft ran out of selectable weighted fighters.");
    }

    const categoryTarget = nextDraftUnit(random) * totalWeight;
    let cursor = 0;
    let selected = eligible[eligible.length - 1];
    for (const option of eligible) {
      cursor += option.category.weight;
      if (categoryTarget < cursor) {
        selected = option;
        break;
      }
    }

    const fighter = chooseStrengthWeightedCharacter(selected.roster, nextDraftUnit(random));
    locallyUsed.add(fighter.id);
    team.push({
      ...fighter,
      categoryId: selected.category.id,
      categoryLabel: selected.category.label,
    });
  }

  return team;
}

export function chooseWeighted(items, unit = Math.random()) {
  const clamped = Math.min(Math.max(unit, 0), 0.999999999999);
  let cursor = 0;
  for (const item of items) {
    cursor += item.weight;
    if (clamped < cursor) return item;
  }
  return items[items.length - 1];
}

export function randomIndex(length, unit = Math.random()) {
  if (!Number.isInteger(length) || length <= 0) throw new RangeError("Roster must contain at least one fighter.");
  return Math.floor(Math.min(Math.max(unit, 0), 0.999999999999) * length);
}
