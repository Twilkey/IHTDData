import { STATS_LOADOUT_TAB_MAP } from "./statsLoadout";

function linearCost(baseCost) {
  return (level) => baseCost * level;
}

function powerCost(baseCost, exponent) {
  return (level) => baseCost * Math.pow(level, exponent);
}

function cappedLinearCost(baseCost, capLevel) {
  return (level) => baseCost * Math.min(level, capLevel);
}

function prestigeCost(baseCost, exponent, linearStep = 0.001) {
  return (level) => {
    const breakpointMultiplier = level < 499999 ? 1 : level < 799999 ? 3 : 24;
    return baseCost * Math.pow(level, exponent) * (1 + level * linearStep * breakpointMultiplier);
  };
}

function getSourceItem(sourceTabKey, sourceItemId) {
  if (!sourceTabKey || !sourceItemId) {
    return null;
  }

  const tab = STATS_LOADOUT_TAB_MAP[sourceTabKey];
  if (!tab) {
    return null;
  }

  for (const items of Object.values(tab.data.groups ?? {})) {
    const match = items.find((item) => item.id === sourceItemId);
    if (match) {
      return match;
    }
  }

  return null;
}

function createTier(id, label, benefitValue, costFunction, maxLevel = 999999, sourceTabKey = null, sourceItemId = null) {
  const sourceItem = getSourceItem(sourceTabKey, sourceItemId);

  return Object.freeze({
    id,
    label: sourceItem?.name ?? label,
    benefitValue,
    costFunction,
    maxLevel,
    sourceTabKey,
    sourceItemId,
    statKey: sourceItem?.statKey ?? null,
  });
}

function createResource(id, label, icon, tiers) {
  return Object.freeze({ id, label, icon, tiers: Object.freeze(tiers) });
}

function createCurrency(id, label, icon, resources) {
  return Object.freeze({ id, label, icon, resources: Object.freeze(resources) });
}

export const RESOURCE_OPTIMIZER_CURRENCIES = Object.freeze([
  createCurrency("energy", "Energy", "_energy.png", [
    createResource("gold", "Gold", "_coin.png", [
      createTier("energy-gold-1", "Level I", 5, linearCost(5), 999999, "research", "kill_gold_i"),
      createTier("energy-gold-2", "Level II", 10, linearCost(75), 999999, "research", "kill_gold_ii"),
      createTier("energy-gold-3", "Level III", 25, linearCost(1000), 999999, "research", "kill_gold_iii"),
      createTier("energy-gold-4", "Level IV", 50, linearCost(10000), 999999, "research", "kill_gold_iv"),
      createTier("energy-gold-5", "Level V", 75, linearCost(100000), 999999, "research", "kill_gold_v"),
      createTier("energy-gold-6", "Level VI", 100, powerCost(1.5e12, 3), 999999, "research", "kill_gold_vi"),
    ]),
    createResource("damage", "Damage", "_dps.png", [
      createTier("energy-damage-1", "Level I", 5, linearCost(5), 999999, "research", "damage_i"),
      createTier("energy-damage-2", "Level II", 10, linearCost(75), 999999, "research", "damage_ii"),
      createTier("energy-damage-3", "Level III", 25, linearCost(1000), 999999, "research", "damage_iii"),
      createTier("energy-damage-4", "Level IV", 50, linearCost(10000), 999999, "research", "damage_iv"),
      createTier("energy-damage-5", "Level V", 75, linearCost(100000), 999999, "research", "damage_v"),
      createTier("energy-damage-6", "Level VI", 100, powerCost(1.5e12, 3), 999999, "research", "damage_vi"),
    ]),
    createResource("prestige", "Prestige", "_planet.png", [
      createTier("energy-prestige-1", "Level I", 10, linearCost(10), 999999, "research", "prestige_power_i"),
      createTier("energy-prestige-2", "Level II", 25, linearCost(150), 999999, "research", "prestige_power_ii"),
      createTier("energy-prestige-3", "Level III", 50, linearCost(2500), 999999, "research", "prestige_power_iii"),
      createTier("energy-prestige-4", "Level IV", 75, linearCost(40000), 999999, "research", "prestige_power_iv"),
      createTier("energy-prestige-5", "Level V", 100, powerCost(2.5e10, 3), 999999, "research", "prestige_power_v"),
    ]),
  ]),
  createCurrency("prestige", "Prestige", "_prestigePower.png", [
    createResource("gold", "Gold", "_coin.png", [
      createTier("prestige-gold-1", "Level I", 5, prestigeCost(500, 1.1), 999999, "prestige", "kill_gold_i"),
      createTier("prestige-gold-2", "Level II", 10, prestigeCost(100000, 1.2), 999999, "prestige", "kill_gold_ii"),
      createTier("prestige-gold-3", "Level III", 25, prestigeCost(2e9, 1.3), 999999, "prestige", "kill_gold_iii"),
      createTier("prestige-gold-4", "Level IV", 50, prestigeCost(5e12, 1.4), 999999, "prestige", "kill_gold_iv"),
      createTier("prestige-gold-5", "Level V", 75, prestigeCost(1e17, 1.5), 999999, "prestige", "kill_gold_v"),
      createTier("prestige-gold-6", "Level VI", 100, prestigeCost(1e24, 2), 999999, "prestige", "kill_gold_vi"),
    ]),
    createResource("damage", "Damage", "_dps.png", [
      createTier("prestige-damage-1", "Level I", 5, prestigeCost(500, 1.1), 999999, "prestige", "damage_i"),
      createTier("prestige-damage-2", "Level II", 10, prestigeCost(100000, 1.2), 999999, "prestige", "damage_ii"),
      createTier("prestige-damage-3", "Level III", 25, prestigeCost(2e9, 1.3), 999999, "prestige", "damage_iii"),
      createTier("prestige-damage-4", "Level IV", 50, prestigeCost(5e12, 1.4), 999999, "prestige", "damage_iv"),
      createTier("prestige-damage-5", "Level V", 75, prestigeCost(1e17, 1.5), 999999, "prestige", "damage_v"),
      createTier("prestige-damage-6", "Level VI", 100, prestigeCost(1e28, 3), 999999, "prestige", "damage_vi"),
    ]),
  ]),
  createCurrency("tech", "Tech", "_techPts_2.png", [
    createResource("gold", "Gold", "_coin.png", [
      createTier("tech-gold-1", "Level I", 10, cappedLinearCost(2, 25), 999999, "technology", "kill_gold_i"),
      createTier("tech-gold-2", "Level II", 50, cappedLinearCost(50, 25), 999999, "technology", "kill_gold_ii"),
    ]),
    createResource("damage", "Damage", "_dps.png", [
      createTier("tech-damage-1", "Level I", 10, cappedLinearCost(1, 25), 999999, "technology", "damage_i"),
      createTier("tech-damage-2", "Level II", 50, cappedLinearCost(50, 25), 999999, "technology", "damage_ii"),
    ]),
  ]),
  createCurrency("tournament", "Tournament", "_tournPts.png", [
    createResource("gold", "Gold", "_coin.png", [
      createTier("tournament-gold-1", "Level I", 10, cappedLinearCost(50, 2000), 999999, "tournament", "kill_gold_i"),
      createTier("tournament-gold-2", "Level II", 25, cappedLinearCost(1500, 67), 999999, "tournament", "kill_gold_ii"),
    ]),
    createResource("damage", "Damage", "_dps.png", [
      createTier("tournament-damage-1", "Level I", 10, cappedLinearCost(50, 2000), 999999, "tournament", "damage_i"),
      createTier("tournament-damage-2", "Level II", 25, cappedLinearCost(1500, 67), 999999, "tournament", "damage_ii"),
    ]),
  ]),
  createCurrency("tickets", "Tickets", "_ticket.png", [
    createResource("gold", "Gold", "_coin.png", [
      createTier("tickets-gold-1", "Level I", 5, () => 5, 999999, "tickets", "kill_gold_i"),
      createTier("tickets-gold-2", "Level II", 350, () => 300, 999999, "tickets", "kill_gold_ii"),
      createTier("tickets-gold-3", "Level III", 1250, () => 1000, 999999, "tickets", "kill_gold_iii"),
    ]),
    createResource("damage", "Damage", "_dps.png", [
      createTier("tickets-damage-1", "Level I", 5, () => 5, 999999, "tickets", "damage_i"),
      createTier("tickets-damage-2", "Level II", 350, () => 300, 999999, "tickets", "damage_ii"),
      createTier("tickets-damage-3", "Level III", 1250, () => 1000, 999999, "tickets", "damage_iii"),
    ]),
  ]),
]);

export const RESOURCE_OPTIMIZER_CURRENCY_MAP = Object.freeze(
  Object.fromEntries(RESOURCE_OPTIMIZER_CURRENCIES.map((currency) => [currency.id, currency]))
);

export function getResourceOptimizerCurrency(currencyId) {
  return RESOURCE_OPTIMIZER_CURRENCY_MAP[currencyId] ?? RESOURCE_OPTIMIZER_CURRENCIES[0] ?? null;
}

export function getResourceOptimizerResource(currencyId, resourceId) {
  const currency = getResourceOptimizerCurrency(currencyId);
  if (!currency) {
    return null;
  }

  return currency.resources.find((resource) => resource.id === resourceId) ?? currency.resources[0] ?? null;
}

export function parseResourceOptimizerNumber(rawValue) {
  const normalized = String(rawValue ?? "")
    .replace(/,/g, "")
    .trim()
    .toUpperCase();

  if (!normalized) {
    return 0;
  }

  if (normalized.includes("E")) {
    const scientificValue = Number(normalized);
    return Number.isFinite(scientificValue) && scientificValue > 0 ? scientificValue : 0;
  }

  let multiplier = 1;
  let scalar = normalized;

  if (scalar.endsWith("K")) {
    multiplier = 1e3;
    scalar = scalar.slice(0, -1);
  } else if (scalar.endsWith("M")) {
    multiplier = 1e6;
    scalar = scalar.slice(0, -1);
  } else if (scalar.endsWith("B")) {
    multiplier = 1e9;
    scalar = scalar.slice(0, -1);
  } else if (scalar.endsWith("T")) {
    multiplier = 1e12;
    scalar = scalar.slice(0, -1);
  }

  const numericValue = Number.parseFloat(scalar);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return numericValue * multiplier;
}

export function formatResourceOptimizerInput(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }

  if (Math.abs(value - Math.round(value)) > 0.000001) {
    return String(value);
  }

  return Math.round(value).toLocaleString("en-US");
}

function clampWholeNumber(value, maxLevel) {
  const parsed = Math.max(0, Math.floor(parseResourceOptimizerNumber(value)));
  return Math.min(parsed, maxLevel);
}

export function normalizeResourceOptimizerRows(rows, resource) {
  const tiers = resource?.tiers ?? [];

  return tiers.map((tier, index) => {
    const current = rows?.[index];
    const level = clampWholeNumber(current?.level ?? 0, tier.maxLevel);
    return {
      enabled: current?.enabled !== false,
      level,
      levelInput: current?.levelInput != null ? String(current.levelInput) : formatResourceOptimizerInput(level),
    };
  });
}

export function createDefaultResourceOptimizerRows(resource) {
  return normalizeResourceOptimizerRows([], resource);
}

export function optimizeResourceLevels(resource, rows, budget) {
  const normalizedRows = normalizeResourceOptimizerRows(rows, resource);
  const workingLevels = normalizedRows.map((row) => row.level);
  let remainingBudget = Math.max(0, Number(budget) || 0);

  while (remainingBudget > 0) {
    let bestTierIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestTierCost = 0;

    for (let index = 0; index < normalizedRows.length; index += 1) {
      const row = normalizedRows[index];
      const tier = resource.tiers[index];

      if (!row.enabled || !tier || workingLevels[index] >= tier.maxLevel) {
        continue;
      }

      const nextLevel = workingLevels[index] + 1;
      const nextCost = tier.costFunction(nextLevel);

      if (!Number.isFinite(nextCost) || nextCost <= 0 || nextCost > remainingBudget) {
        continue;
      }

      const denominator = 100 + workingLevels[index] * tier.benefitValue;
      const score = tier.benefitValue / denominator / nextCost;

      if (score > bestScore) {
        bestScore = score;
        bestTierIndex = index;
        bestTierCost = nextCost;
      }
    }

    if (bestTierIndex === -1) {
      break;
    }

    workingLevels[bestTierIndex] += 1;
    remainingBudget -= bestTierCost;
  }

  const resultRows = normalizedRows.map((row, index) => ({
    enabled: row.enabled,
    currentLevel: row.level,
    optimalLevel: workingLevels[index],
    buyAmount: workingLevels[index] - row.level,
  }));

  const budgetSpent = Math.max(0, budget - remainingBudget);

  return {
    rows: resultRows,
    budgetSpent,
    budgetRemaining: Math.max(0, remainingBudget),
  };
}

export function getResourceOptimizerLoadoutLevel(levelsByTab, tier) {
  if (!tier?.sourceTabKey || !tier?.sourceItemId) {
    return 0;
  }

  const tabLevels = levelsByTab?.[tier.sourceTabKey] ?? {};
  const nextLevel = Number.parseInt(tabLevels[tier.sourceItemId], 10);
  return Number.isFinite(nextLevel) ? Math.max(0, nextLevel) : 0;
}