import spellsData from "../data/spells.json";
import { mapsData } from "./gameData";
import { schedulePersistLoadoutRuntime } from "./loadoutRuntimeStore";

export const MAP_LOADOUT_BUILDER_MODE_STORAGE_KEY = "ihtddata.mapLoadout.builderMode";
export const MAP_LOADOUT_STATE_STORAGE_KEY = "ihtddata.mapLoadout.state.v1";

const DEFAULT_BUILDER_MODE = "hero";
const VALID_BUILDER_MODES = new Set(["hero", "perks", "spell"]);
const DEFAULT_SPELL_MODE = "manual";
const VALID_SPELL_MODES = new Set([DEFAULT_SPELL_MODE, "active", "boss"]);
const MAX_EQUIPPED_PERKS = 5;
const MAX_ACTIVE_SPELLS = 5;
const MAX_BONUS_PLACEMENTS_PER_ID = 3;

const RAW_SPELL_GROUPS = spellsData.groups ?? {};

export const MAP_SPELL_GROUPS = Object.freeze(
  Object.entries(RAW_SPELL_GROUPS).map(([groupName, spells]) => ({
    id: groupName,
    label: groupName,
    spells: spells.map((spell) => ({ ...spell })),
  }))
);

export const MAP_SPELL_DEFINITIONS = Object.freeze(MAP_SPELL_GROUPS.flatMap((group) => group.spells));
export const MAP_SPELL_DEFINITION_BY_ID = Object.freeze(
  Object.fromEntries(MAP_SPELL_DEFINITIONS.map((spell) => [spell.id, spell]))
);
export const MAP_SPELL_MODE_OPTIONS = Object.freeze([
  { id: "manual", label: "Manual" },
  { id: "active", label: "Active" },
  { id: "boss", label: "Boss" },
]);

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

function createDefaultPerkState(perk) {
  return {
    unlocked: Boolean(perk.isDefault),
    equipped: Boolean(perk.isDefault),
    level: 0,
  };
}

function createDefaultSpellState() {
  return {
    level: 0,
    mode: DEFAULT_SPELL_MODE,
  };
}

function createDefaultSpellLoadout() {
  return {
    activeSpellIds: [],
    spellStatesById: Object.fromEntries(
      MAP_SPELL_DEFINITIONS.map((spell) => [spell.id, createDefaultSpellState()])
    ),
  };
}

function createDefaultPlacementBonusLevelMap() {
  return Object.fromEntries(
    (mapsData.placementBonuses ?? []).map((bonus) => [bonus.id, 0])
  );
}

export function getPerkUpgradeStepCost(perk, targetLevel) {
  const upgradeCost = perk.upgradeCost ?? perk.baseCost ?? 0;
  return targetLevel <= 5 ? upgradeCost : upgradeCost * 2;
}

export function getPerkTotalCost(perk, state) {
  const unlockCost = state.unlocked && !perk.isDefault ? (perk.unlockCost ?? 0) : 0;
  let total = unlockCost;

  for (let level = 1; level <= state.level; level += 1) {
    total += getPerkUpgradeStepCost(perk, level);
  }

  return total;
}

export function getPerkCurrentBonus(perk, level) {
  return (perk.baseAmt ?? 0) + (perk.statAmt ?? 0) * level;
}

export function getPlacementBonusStepCost(bonus, targetLevel) {
  const breakpoint = bonus.breakpoint ?? mapsData.placementCostFormula?.breakpoint ?? 5;
  return targetLevel <= breakpoint ? (bonus.baseCost ?? 0) : (bonus.upgradeCostHigh ?? bonus.baseCost ?? 0);
}

export function getPlacementBonusTotalCost(bonus, level) {
  let total = 0;
  for (let currentLevel = 1; currentLevel <= level; currentLevel += 1) {
    total += getPlacementBonusStepCost(bonus, currentLevel);
  }
  return total;
}

export function getPlacementBonusValue(bonus, level) {
  return (bonus.statAmt ?? 0) * level;
}

function getDefaultState() {
  const perksByMap = Object.fromEntries(
    mapsData.maps.map((map) => [
      map.id,
      Object.fromEntries((map.perks ?? []).map((perk) => [perk.id, createDefaultPerkState(perk)])),
    ])
  );

  const placementBonusLevelsByMap = Object.fromEntries(
    mapsData.maps.map((map) => [map.id, createDefaultPlacementBonusLevelMap()])
  );

  const placementBonusPlacementsByMap = Object.fromEntries(
    mapsData.maps.map((map) => [
      map.id,
      Object.fromEntries((map.spots ?? []).map((spot) => [spot.id, null])),
    ])
  );

  const spellLoadoutsByMap = Object.fromEntries(
    mapsData.maps.map((map) => [map.id, createDefaultSpellLoadout()])
  );

  return {
    builderMode: DEFAULT_BUILDER_MODE,
    perksByMap,
    placementBonusLevelsByMap,
    placementBonusPlacementsByMap,
    spellLoadoutsByMap,
  };
}

function normalizePerksByMap(rawPerksByMap) {
  const perksByMap = {};

  for (const map of mapsData.maps) {
    const rawMapState = isObject(rawPerksByMap?.[map.id]) ? rawPerksByMap[map.id] : {};
    const normalizedMapState = {};
    let equippedCount = 0;

    for (const perk of map.perks ?? []) {
      const fallback = createDefaultPerkState(perk);
      const rawPerkState = isObject(rawMapState?.[perk.id]) ? rawMapState[perk.id] : {};
      const unlocked = rawPerkState.unlocked === undefined ? fallback.unlocked : Boolean(rawPerkState.unlocked);
      let equipped = rawPerkState.equipped === undefined ? fallback.equipped : Boolean(rawPerkState.equipped);
      const level = clamp(toInteger(rawPerkState.level, fallback.level), 0, perk.maxLevel ?? 0);

      if (!unlocked) {
        equipped = false;
      }

      if (equipped && equippedCount >= MAX_EQUIPPED_PERKS) {
        equipped = false;
      }

      if (equipped) {
        equippedCount += 1;
      }

      normalizedMapState[perk.id] = { unlocked, equipped, level };
    }

    perksByMap[map.id] = normalizedMapState;
  }

  return perksByMap;
}

function normalizePlacementBonusLevelMap(rawLevels) {
  return Object.fromEntries(
    (mapsData.placementBonuses ?? []).map((bonus) => [
      bonus.id,
      clamp(toInteger(rawLevels?.[bonus.id], 0), 0, bonus.maxLevel ?? 0),
    ])
  );
}

function normalizePlacementBonusLevelsByMap(rawLevelsByMap, legacyRawLevels) {
  const legacyLevels = isObject(legacyRawLevels) ? normalizePlacementBonusLevelMap(legacyRawLevels) : null;

  return Object.fromEntries(
    mapsData.maps.map((map) => {
      const rawLevels = isObject(rawLevelsByMap?.[map.id]) ? rawLevelsByMap[map.id] : legacyLevels;
      return [map.id, normalizePlacementBonusLevelMap(rawLevels)];
    })
  );
}

function normalizePlacementBonusPlacements(rawPlacementsByMap, placementBonusLevelsByMap) {
  const normalizedPlacements = {};

  for (const map of mapsData.maps) {
    const rawPlacements = isObject(rawPlacementsByMap?.[map.id]) ? rawPlacementsByMap[map.id] : {};
    const nextMapPlacements = {};
    const counts = {};
    const mapBonusLevels = placementBonusLevelsByMap[map.id] ?? createDefaultPlacementBonusLevelMap();

    for (const spot of map.spots ?? []) {
      const candidate = typeof rawPlacements[spot.id] === "string" ? rawPlacements[spot.id] : null;
      const bonus = (mapsData.placementBonuses ?? []).find((item) => item.id === candidate);
      const level = bonus ? mapBonusLevels[bonus.id] ?? 0 : 0;

      if (!bonus || level < 1 || (counts[bonus.id] ?? 0) >= MAX_BONUS_PLACEMENTS_PER_ID) {
        nextMapPlacements[spot.id] = null;
        continue;
      }

      counts[bonus.id] = (counts[bonus.id] ?? 0) + 1;
      nextMapPlacements[spot.id] = bonus.id;
    }

    normalizedPlacements[map.id] = nextMapPlacements;
  }

  return normalizedPlacements;
}

function normalizeSpellState(spellDefinition, rawSpellState) {
  return {
    level: clamp(toInteger(rawSpellState?.level, 0), 0, spellDefinition.maxLevel ?? 0),
    mode: VALID_SPELL_MODES.has(rawSpellState?.mode) ? rawSpellState.mode : DEFAULT_SPELL_MODE,
  };
}

function normalizeSpellLoadout(rawSpellLoadout) {
  const nextSpellStatesById = {};

  MAP_SPELL_DEFINITIONS.forEach((spell) => {
    nextSpellStatesById[spell.id] = normalizeSpellState(
      spell,
      isObject(rawSpellLoadout?.spellStatesById?.[spell.id])
        ? rawSpellLoadout.spellStatesById[spell.id]
        : undefined
    );
  });

  const seenSpellIds = new Set();
  const activeSpellIds = [];
  const rawActiveSpellIds = Array.isArray(rawSpellLoadout?.activeSpellIds)
    ? rawSpellLoadout.activeSpellIds
    : [];

  rawActiveSpellIds.forEach((spellId) => {
    if (
      typeof spellId !== "string"
      || seenSpellIds.has(spellId)
      || !MAP_SPELL_DEFINITION_BY_ID[spellId]
      || activeSpellIds.length >= MAX_ACTIVE_SPELLS
    ) {
      return;
    }

    seenSpellIds.add(spellId);
    activeSpellIds.push(spellId);
  });

  return {
    activeSpellIds,
    spellStatesById: nextSpellStatesById,
  };
}

function normalizeSpellLoadoutsByMap(rawSpellLoadoutsByMap) {
  return Object.fromEntries(
    mapsData.maps.map((map) => [map.id, normalizeSpellLoadout(rawSpellLoadoutsByMap?.[map.id])])
  );
}

export function normalizeMapLoadoutState(rawState) {
  const defaults = getDefaultState();
  const builderMode = VALID_BUILDER_MODES.has(rawState?.builderMode) ? rawState.builderMode : defaults.builderMode;
  const placementBonusLevelsByMap = normalizePlacementBonusLevelsByMap(
    rawState?.placementBonusLevelsByMap,
    rawState?.placementBonusLevels
  );

  return {
    builderMode,
    perksByMap: normalizePerksByMap(rawState?.perksByMap),
    placementBonusLevelsByMap,
    placementBonusPlacementsByMap: normalizePlacementBonusPlacements(rawState?.placementBonusPlacementsByMap, placementBonusLevelsByMap),
    spellLoadoutsByMap: normalizeSpellLoadoutsByMap(rawState?.spellLoadoutsByMap),
  };
}

export function readMapLoadoutState(storage = localStorage) {
  let parsedState = {};

  try {
    parsedState = JSON.parse(storage.getItem(MAP_LOADOUT_STATE_STORAGE_KEY) ?? "{}");
  } catch {
    parsedState = {};
  }

  return normalizeMapLoadoutState({
    ...parsedState,
    builderMode: storage.getItem(MAP_LOADOUT_BUILDER_MODE_STORAGE_KEY) ?? parsedState.builderMode,
  });
}

export function writeMapLoadoutState(state, storage = localStorage) {
  const normalized = normalizeMapLoadoutState(state);
  storage.setItem(MAP_LOADOUT_BUILDER_MODE_STORAGE_KEY, normalized.builderMode);
  storage.setItem(MAP_LOADOUT_STATE_STORAGE_KEY, JSON.stringify({
    perksByMap: normalized.perksByMap,
    placementBonusLevelsByMap: normalized.placementBonusLevelsByMap,
    placementBonusPlacementsByMap: normalized.placementBonusPlacementsByMap,
    spellLoadoutsByMap: normalized.spellLoadoutsByMap,
  }));
  schedulePersistLoadoutRuntime(storage);
}

export function readMapLoadoutBuilderMode(storage = localStorage) {
  const mode = storage.getItem(MAP_LOADOUT_BUILDER_MODE_STORAGE_KEY);
  return VALID_BUILDER_MODES.has(mode) ? mode : DEFAULT_BUILDER_MODE;
}

export function writeMapLoadoutBuilderMode(mode, storage = localStorage) {
  storage.setItem(
    MAP_LOADOUT_BUILDER_MODE_STORAGE_KEY,
    VALID_BUILDER_MODES.has(mode) ? mode : DEFAULT_BUILDER_MODE
  );
  schedulePersistLoadoutRuntime(storage);
}

export function countEquippedPerks(perkStateById) {
  return Object.values(perkStateById ?? {}).filter((state) => state.equipped).length;
}

export function countPlacementBonusCopies(placementsBySpot, bonusId) {
  return Object.values(placementsBySpot ?? {}).filter((placedId) => placedId === bonusId).length;
}

export function canEquipMorePerks(perkStateById) {
  return countEquippedPerks(perkStateById) < MAX_EQUIPPED_PERKS;
}

export function countActiveSpells(spellLoadout) {
  return Array.isArray(spellLoadout?.activeSpellIds) ? spellLoadout.activeSpellIds.length : 0;
}

export function isSpellActive(spellLoadout, spellId) {
  return Array.isArray(spellLoadout?.activeSpellIds) && spellLoadout.activeSpellIds.includes(spellId);
}

export function getSpellModeValue(value) {
  return VALID_SPELL_MODES.has(value) ? value : DEFAULT_SPELL_MODE;
}

export function activateSpellInLoadout(spellLoadout, spellId) {
  const normalizedLoadout = normalizeSpellLoadout(spellLoadout);
  if (!MAP_SPELL_DEFINITION_BY_ID[spellId] || normalizedLoadout.activeSpellIds.includes(spellId) || normalizedLoadout.activeSpellIds.length >= MAX_ACTIVE_SPELLS) {
    return normalizedLoadout;
  }

  return normalizeSpellLoadout({
    ...normalizedLoadout,
    activeSpellIds: [...normalizedLoadout.activeSpellIds, spellId],
  });
}

export function deactivateSpellInLoadout(spellLoadout, spellId) {
  const normalizedLoadout = normalizeSpellLoadout(spellLoadout);
  return normalizeSpellLoadout({
    ...normalizedLoadout,
    activeSpellIds: normalizedLoadout.activeSpellIds.filter((activeSpellId) => activeSpellId !== spellId),
  });
}

export function updateSpellLevelInLoadout(spellLoadout, spellId, nextLevel) {
  const spell = MAP_SPELL_DEFINITION_BY_ID[spellId];
  const normalizedLoadout = normalizeSpellLoadout(spellLoadout);
  if (!spell) {
    return normalizedLoadout;
  }

  return normalizeSpellLoadout({
    ...normalizedLoadout,
    spellStatesById: {
      ...normalizedLoadout.spellStatesById,
      [spellId]: {
        ...normalizedLoadout.spellStatesById[spellId],
        level: clamp(toInteger(nextLevel, 0), 0, spell.maxLevel ?? 0),
      },
    },
  });
}

export function updateSpellModeInLoadout(spellLoadout, spellId, nextMode) {
  const spell = MAP_SPELL_DEFINITION_BY_ID[spellId];
  const normalizedLoadout = normalizeSpellLoadout(spellLoadout);
  if (!spell) {
    return normalizedLoadout;
  }

  return normalizeSpellLoadout({
    ...normalizedLoadout,
    spellStatesById: {
      ...normalizedLoadout.spellStatesById,
      [spellId]: {
        ...normalizedLoadout.spellStatesById[spellId],
        mode: getSpellModeValue(nextMode),
      },
    },
  });
}

export { MAX_EQUIPPED_PERKS, MAX_ACTIVE_SPELLS, MAX_BONUS_PLACEMENTS_PER_ID };