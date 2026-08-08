export const CATEGORY_WEIGHTS = Object.freeze({
  anime: 0.3,
  marvel: 0.3,
  dc: 0.3,
  menace: 0.1,
});

const POWER_PATTERN = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i;
const COMPACT_SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

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

export function sortTeam(team) {
  if (!Array.isArray(team)) throw new TypeError("Team must be an array.");
  return team
    .map((fighter, index) => ({ fighter, health: powerToHealth(fighter.power), index }))
    .sort((left, right) => compareHealth(right.health, left.health) || left.index - right.index)
    .map(({ fighter }) => fighter);
}

/**
 * Resolve one endurance clash. Optional health arguments allow an already-damaged
 * survivor to face the next opponent while leaving the fighter records immutable.
 */
export function resolveClash(
  left,
  right,
  leftHealth = powerToHealth(left.power),
  rightHealth = powerToHealth(right.power),
) {
  const leftBefore = parseHealth(leftHealth);
  const rightBefore = parseHealth(rightHealth);

  if (leftBefore === Infinity && rightBefore === Infinity) {
    return {
      left,
      right,
      leftHealthBefore: leftBefore,
      rightHealthBefore: rightBefore,
      leftHealthAfter: 0n,
      rightHealthAfter: 0n,
      leftEliminated: true,
      rightEliminated: true,
      eliminated: { left: true, right: true },
      winner: 0,
      reason: "boundless-nullification",
    };
  }

  if (leftBefore === Infinity) {
    return {
      left,
      right,
      leftHealthBefore: leftBefore,
      rightHealthBefore: rightBefore,
      leftHealthAfter: Infinity,
      rightHealthAfter: 0n,
      leftEliminated: false,
      rightEliminated: true,
      eliminated: { left: false, right: true },
      winner: 1,
      reason: "boundless-win",
    };
  }

  if (rightBefore === Infinity) {
    return {
      left,
      right,
      leftHealthBefore: leftBefore,
      rightHealthBefore: rightBefore,
      leftHealthAfter: 0n,
      rightHealthAfter: Infinity,
      leftEliminated: true,
      rightEliminated: false,
      eliminated: { left: true, right: false },
      winner: 2,
      reason: "boundless-win",
    };
  }

  const comparison = compareHealth(leftBefore, rightBefore);
  if (comparison === 0) {
    return {
      left,
      right,
      leftHealthBefore: leftBefore,
      rightHealthBefore: rightBefore,
      leftHealthAfter: 0n,
      rightHealthAfter: 0n,
      leftEliminated: true,
      rightEliminated: true,
      eliminated: { left: true, right: true },
      winner: 0,
      reason: "equal-power",
    };
  }

  const leftWins = comparison > 0;
  return {
    left,
    right,
    leftHealthBefore: leftBefore,
    rightHealthBefore: rightBefore,
    leftHealthAfter: leftWins ? leftBefore - rightBefore : 0n,
    rightHealthAfter: leftWins ? 0n : rightBefore - leftBefore,
    leftEliminated: !leftWins,
    rightEliminated: leftWins,
    eliminated: { left: !leftWins, right: leftWins },
    winner: leftWins ? 1 : 2,
    reason: "greater-power",
  };
}

function survivorRecord(state) {
  return {
    ...state.fighter,
    health: state.health,
    maxHealth: state.maxHealth,
    remainingPower: healthToPowerString(state.health),
  };
}

function totalHealth(survivors) {
  if (survivors.some((survivor) => survivor.health === Infinity)) return Infinity;
  return survivors.reduce((sum, survivor) => sum + survivor.health, 0n);
}

/**
 * Run a sorted, winner-stays-on endurance battle. A full 3v3 produces between
 * three and five timeline entries because every clash eliminates at least one fighter.
 */
export function resolveBattle(teamOne, teamTwo) {
  const sortedOne = sortTeam(teamOne);
  const sortedTwo = sortTeam(teamTwo);
  const statesOne = sortedOne.map((fighter) => {
    const health = powerToHealth(fighter.power);
    return { fighter, health, maxHealth: health };
  });
  const statesTwo = sortedTwo.map((fighter) => {
    const health = powerToHealth(fighter.power);
    return { fighter, health, maxHealth: health };
  });

  const timeline = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < statesOne.length && rightIndex < statesTwo.length) {
    const leftState = statesOne[leftIndex];
    const rightState = statesTwo[rightIndex];
    const outcome = resolveClash(leftState.fighter, rightState.fighter, leftState.health, rightState.health);

    leftState.health = outcome.leftHealthAfter;
    rightState.health = outcome.rightHealthAfter;
    if (outcome.leftEliminated) leftIndex += 1;
    if (outcome.rightEliminated) rightIndex += 1;

    timeline.push({
      round: timeline.length + 1,
      leftIndex: outcome.leftEliminated ? leftIndex - 1 : leftIndex,
      rightIndex: outcome.rightEliminated ? rightIndex - 1 : rightIndex,
      ...outcome,
      nextLeftIndex: leftIndex,
      nextRightIndex: rightIndex,
      remainingOne: statesOne.length - leftIndex,
      remainingTwo: statesTwo.length - rightIndex,
    });
  }

  const survivorsOne = statesOne.slice(leftIndex).map(survivorRecord);
  const survivorsTwo = statesTwo.slice(rightIndex).map(survivorRecord);
  const remainingHealthOne = totalHealth(survivorsOne);
  const remainingHealthTwo = totalHealth(survivorsTwo);
  const scoreOne = timeline.filter((clash) => clash.winner === 1).length;
  const scoreTwo = timeline.filter((clash) => clash.winner === 2).length;
  const winner = survivorsOne.length > 0 ? 1 : survivorsTwo.length > 0 ? 2 : 0;

  return {
    sortedOne,
    sortedTwo,
    timeline,
    clashes: timeline,
    scoreOne,
    scoreTwo,
    winner,
    isDraw: winner === 0,
    survivorsOne,
    survivorsTwo,
    survivors: { playerOne: survivorsOne, playerTwo: survivorsTwo },
    remainingHealthOne,
    remainingHealthTwo,
    remainingHealth: { playerOne: remainingHealthOne, playerTwo: remainingHealthTwo },
  };
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
