import heroAttributesData from "../data/hero_attributes.json";
import { normalizeDefaultCombatStyleIdByHero } from "./combatStyles";
import { heroList, heroesData } from "./gameData";
import { schedulePersistLoadoutRuntime } from "./loadoutRuntimeStore";

export const HERO_LOADOUT_STATE_STORAGE_KEY = "ihtddata.heroLoadout.state.v1";

const HERO_ATTRIBUTE_GROUP_KEYS = ["personal", "global"];

export const HERO_ATTRIBUTE_DEFINITIONS = Object.freeze(
  HERO_ATTRIBUTE_GROUP_KEYS.flatMap((groupKey) =>
    (heroAttributesData[groupKey] ?? []).map((attribute) => ({
      ...attribute,
      groupKey,
    }))
  )
);

export const HERO_ATTRIBUTE_IDS = Object.freeze(HERO_ATTRIBUTE_DEFINITIONS.map((attribute) => attribute.id));
export const HERO_ATTRIBUTE_BY_ID = Object.freeze(
  Object.fromEntries(HERO_ATTRIBUTE_DEFINITIONS.map((attribute) => [attribute.id, attribute]))
);

const HERO_BY_ID = Object.freeze(Object.fromEntries(heroList.map((hero) => [hero.id, hero])));

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function getDefaultSelectedHeroId() {
  return heroList[0]?.id ?? "";
}

function normalizeAttributeLevelsByHero(rawAttributeLevelsByHero) {
  const normalized = {};

  heroList.forEach((hero) => {
    const rawLevels = isObject(rawAttributeLevelsByHero?.[hero.id]) ? rawAttributeLevelsByHero[hero.id] : {};
    const nextLevels = {};

    HERO_ATTRIBUTE_DEFINITIONS.forEach((attribute) => {
      const nextLevel = clamp(toInteger(rawLevels[attribute.id], 0), 0, attribute.maxLevel ?? Number.MAX_SAFE_INTEGER);
      if (nextLevel > 0) {
        nextLevels[attribute.id] = nextLevel;
      }
    });

    normalized[hero.id] = nextLevels;
  });

  return normalized;
}

function normalizePreviewLevelsByHero(rawPreviewLevelsByHero) {
  return Object.fromEntries(
    heroList.map((hero) => [hero.id, Math.max(1, toInteger(rawPreviewLevelsByHero?.[hero.id], 1))])
  );
}

function normalizeHideMaxedByHero(rawHideMaxedByHero) {
  return Object.fromEntries(
    heroList.map((hero) => [hero.id, Boolean(rawHideMaxedByHero?.[hero.id])])
  );
}

function normalizeRankByHero(rawRankByHero) {
  return Object.fromEntries(
    heroList.map((hero) => [hero.id, Math.max(0, toInteger(rawRankByHero?.[hero.id], 0))])
  );
}

function normalizeLevelByHero(rawLevelByHero) {
  return Object.fromEntries(
    heroList.map((hero) => [hero.id, Math.max(0, toInteger(rawLevelByHero?.[hero.id], 0))])
  );
}

function normalizeMasteryLevelByHero(rawMasteryLevelByHero) {
  return Object.fromEntries(
    heroList.map((hero) => {
      const maxLevel = hero.masteryExp?.maxLevel ?? 0;
      return [hero.id, clamp(toInteger(rawMasteryLevelByHero?.[hero.id], 0), 0, maxLevel)];
    })
  );
}

function normalizeDefaultCombatStylesByHero(rawDefaultCombatStyleIdByHero) {
  return normalizeDefaultCombatStyleIdByHero(rawDefaultCombatStyleIdByHero);
}

export function normalizeHeroLoadoutState(rawState) {
  const selectedHeroId = typeof rawState?.selectedHeroId === "string" && heroList.some((hero) => hero.id === rawState.selectedHeroId)
    ? rawState.selectedHeroId
    : getDefaultSelectedHeroId();

  return {
    selectedHeroId,
    previewLevelsByHero: normalizePreviewLevelsByHero(rawState?.previewLevelsByHero),
    hideMaxedByHero: normalizeHideMaxedByHero(rawState?.hideMaxedByHero),
    rankByHero: normalizeRankByHero(rawState?.rankByHero),
    levelByHero: normalizeLevelByHero(rawState?.levelByHero),
    masteryLevelByHero: normalizeMasteryLevelByHero(rawState?.masteryLevelByHero),
    defaultCombatStyleIdByHero: normalizeDefaultCombatStylesByHero(rawState?.defaultCombatStyleIdByHero),
    attributeLevelsByHero: normalizeAttributeLevelsByHero(rawState?.attributeLevelsByHero),
  };
}

export function readHeroLoadoutState(storage = localStorage) {
  let parsedState = {};

  try {
    parsedState = JSON.parse(storage.getItem(HERO_LOADOUT_STATE_STORAGE_KEY) ?? "{}");
  } catch {
    parsedState = {};
  }

  return normalizeHeroLoadoutState(parsedState);
}

export function writeHeroLoadoutState(state, storage = localStorage) {
  storage.setItem(HERO_LOADOUT_STATE_STORAGE_KEY, JSON.stringify(normalizeHeroLoadoutState(state)));
  schedulePersistLoadoutRuntime(storage);
}

export function getHeroAttributeTierMultiplier(attribute, targetLevel) {
  const maxLevel = attribute.maxLevel ?? 0;
  const breakpointOne = Math.round(maxLevel * 0.5);
  const breakpointTwo = Math.round(maxLevel * 0.8);

  if (targetLevel >= breakpointTwo) {
    return 1.875;
  }

  if (targetLevel >= breakpointOne) {
    return 1.25;
  }

  return 1;
}

export function getHeroAttributeLevelCost(attribute, targetLevel) {
  return Math.round((attribute.baseCost ?? 0) * targetLevel * getHeroAttributeTierMultiplier(attribute, targetLevel));
}

export function getHeroAttributePurchaseCost(attribute, currentLevel, additionalLevels) {
  const safeCurrentLevel = clamp(toInteger(currentLevel, 0), 0, attribute.maxLevel ?? Number.MAX_SAFE_INTEGER);
  const safeAdditionalLevels = Math.max(0, toInteger(additionalLevels, 0));
  const targetLevel = Math.min(safeCurrentLevel + safeAdditionalLevels, attribute.maxLevel ?? Number.MAX_SAFE_INTEGER);

  let total = 0;
  for (let level = safeCurrentLevel + 1; level <= targetLevel; level += 1) {
    total += getHeroAttributeLevelCost(attribute, level);
  }

  return total;
}

export function getHeroAttributeTotalValue(attribute, level) {
  const safeLevel = clamp(toInteger(level, 0), 0, attribute.maxLevel ?? Number.MAX_SAFE_INTEGER);

  if (!safeLevel) {
    return 0;
  }

  if (attribute.statKey === "progressiveRankExp") {
    return (safeLevel * (safeLevel + 1)) / 2;
  }

  return (attribute.statAmt ?? 0) * safeLevel;
}

export function getHeroAttributePreview(attribute, currentLevel, previewLevels) {
  const safeCurrentLevel = clamp(toInteger(currentLevel, 0), 0, attribute.maxLevel ?? Number.MAX_SAFE_INTEGER);
  const safePreviewLevels = Math.max(1, toInteger(previewLevels, 1));
  const projectedLevel = Math.min(safeCurrentLevel + safePreviewLevels, attribute.maxLevel ?? Number.MAX_SAFE_INTEGER);

  return {
    currentLevel: safeCurrentLevel,
    projectedLevel,
    previewLevels: safePreviewLevels,
    currentValue: getHeroAttributeTotalValue(attribute, safeCurrentLevel),
    projectedValue: getHeroAttributeTotalValue(attribute, projectedLevel),
    previewCost: getHeroAttributePurchaseCost(attribute, safeCurrentLevel, safePreviewLevels),
  };
}

export function getHeroUnlockWave(hero) {
  const candidates = [
    hero?.unlockWave,
    hero?.waveReq,
    hero?.waveRequirement,
    hero?.unlock?.wave,
  ];

  for (const candidate of candidates) {
    const parsed = toInteger(candidate, Number.NaN);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export function getHeroMasteryExpCost(heroOrHeroId, targetLevel) {
  const hero = typeof heroOrHeroId === "string"
    ? HERO_BY_ID[heroOrHeroId] ?? null
    : heroOrHeroId;

  if (!hero?.masteryExp?.baseAmount) {
    return 0;
  }

  const safeLevel = Math.max(1, toInteger(targetLevel, 0));
  const formulaBreakpoints = heroesData?.masteryExpFormula?.breakpoints ?? [];
  let multiplier = 1;
  for (const breakpoint of formulaBreakpoints) {
    if (safeLevel >= (breakpoint?.atLevel ?? Number.MAX_SAFE_INTEGER)) {
      multiplier *= breakpoint?.multIncremental ?? 1;
    }
  }

  return Math.round((hero.masteryExp.baseAmount ?? 0) * 24 * safeLevel * multiplier);
}
