import { COMBAT_STYLE_FALLBACK_ID, normalizeCombatStyleId } from "./combatStyles";
import { heroList, mapsData } from "./gameData";
import { readHeroLoadoutState, writeHeroLoadoutState } from "./heroLoadout";
import { LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY } from "./loadoutBuilderSave";
import { schedulePersistLoadoutRuntime } from "./loadoutRuntimeStore";

export const STAT_SIMULATOR_STATE_STORAGE_KEY = "ihtddata.statSimulator.state.v1";
export const STAT_SIMULATOR_SUPPORT_ROW_COUNT = 10;

export const STAT_SIMULATOR_LOADOUT_SOURCE_KEYS = Object.freeze([
  "statsLoadout",
  "playerLoadout",
  "mapLoadout",
  "heroAttributes",
]);

export const STAT_SIMULATOR_MANUAL_STAT_FIELDS = Object.freeze([
  { key: "damage", label: "Damage" },
  { key: "attackSpeed", label: "Attack Speed" },
  { key: "critChance", label: "Crit Chance" },
  { key: "critDamage", label: "Crit Damage" },
  { key: "superCritChance", label: "Super Crit Chance" },
  { key: "superCritDamage", label: "Super Crit Damage" },
  { key: "ultraCritChance", label: "Ultra Crit Chance" },
  { key: "ultraCritDamage", label: "Ultra Crit Damage" },
  { key: "killGold", label: "Kill Gold" },
  { key: "bossGold", label: "Boss Gold" },
]);

export const STAT_SIMULATOR_SKILL_EFFECT_FIELDS = Object.freeze([
  { key: "damage", label: "DMG" },
  { key: "attackSpeed", label: "Att Speed" },
  { key: "critChance", label: "Crit Chance" },
  { key: "critDamage", label: "Crit Dmg" },
  { key: "superCritChance", label: "Super Chance" },
  { key: "superCritDamage", label: "Super Dmg" },
  { key: "ultraCritChance", label: "Ultra Chance" },
  { key: "ultraCritDamage", label: "Ultra Dmg" },
]);

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDefaultMapId() {
  return mapsData.maps.find((map) => map.name === "Island Hideout")?.id ?? mapsData.maps[0]?.id ?? "";
}

function createDefaultManualStats() {
  return Object.fromEntries(STAT_SIMULATOR_MANUAL_STAT_FIELDS.map((field) => [field.key, 0]));
}

function createDefaultSkillEffects() {
  return Object.fromEntries(STAT_SIMULATOR_SKILL_EFFECT_FIELDS.map((field) => [field.key, 0]));
}

function createSupportRow(index) {
  return {
    id: `slot-${index + 1}`,
    enabled: index < 6,
    heroId: heroList[index]?.id ?? "",
    combatStyleId: COMBAT_STYLE_FALLBACK_ID,
    extraSynergy: 0,
    skillEffects: createDefaultSkillEffects(),
  };
}

function normalizeSkillEffects(rawSkillEffects) {
  return Object.fromEntries(
    STAT_SIMULATOR_SKILL_EFFECT_FIELDS.map((field) => [field.key, toNumber(rawSkillEffects?.[field.key], 0)])
  );
}

function normalizeSupportRows(rawSupportRows) {
  return Array.from({ length: STAT_SIMULATOR_SUPPORT_ROW_COUNT }, (_, index) => {
    const fallback = createSupportRow(index);
    const rawRow = rawSupportRows?.[index];
    const heroId = typeof rawRow?.heroId === "string" && heroList.some((hero) => hero.id === rawRow.heroId)
      ? rawRow.heroId
      : fallback.heroId;

    return {
      id: fallback.id,
      enabled: rawRow?.enabled == null ? fallback.enabled : Boolean(rawRow.enabled),
      heroId,
      combatStyleId: normalizeCombatStyleId(rawRow?.combatStyleId, fallback.combatStyleId),
      extraSynergy: toNumber(rawRow?.extraSynergy, 0),
      skillEffects: normalizeSkillEffects(rawRow?.skillEffects),
    };
  });
}

function normalizeLoadoutSources(rawSources) {
  return Object.fromEntries(
    STAT_SIMULATOR_LOADOUT_SOURCE_KEYS.map((key) => [key, Boolean(rawSources?.[key])])
  );
}

function normalizeManualStats(rawManualStats) {
  return Object.fromEntries(
    STAT_SIMULATOR_MANUAL_STAT_FIELDS.map((field) => [field.key, toNumber(rawManualStats?.[field.key], 0)])
  );
}

export function normalizeStatSimulatorState(rawState) {
  const focusHeroId = typeof rawState?.focusHeroId === "string" && heroList.some((hero) => hero.id === rawState.focusHeroId)
    ? rawState.focusHeroId
    : heroList[0]?.id ?? "";

  return {
    highestHeroTier: typeof rawState?.highestHeroTier === "string" && rawState.highestHeroTier.trim()
      ? rawState.highestHeroTier.trim()
      : "Supreme",
    milestone: Math.max(0, toInteger(rawState?.milestone, 10000)),
    synergyTier: typeof rawState?.synergyTier === "string" && rawState.synergyTier.trim()
      ? rawState.synergyTier.trim()
      : "Tier9",
    synergyEvent: rawState?.synergyEvent == null ? true : Boolean(rawState.synergyEvent),
    researchSynergyEffectsLevel: Math.max(0, toInteger(rawState?.researchSynergyEffectsLevel, 5)),
    techSynergyEffectsLevel: Math.max(0, toInteger(rawState?.techSynergyEffectsLevel, 5)),
    selectedMapId: typeof rawState?.selectedMapId === "string" && mapsData.maps.some((map) => map.id === rawState.selectedMapId)
      ? rawState.selectedMapId
      : getDefaultMapId(),
    runesMapPerksPercent: toNumber(rawState?.runesMapPerksPercent, 30),
    ultimusMapPerksPercent: toNumber(rawState?.ultimusMapPerksPercent, 30),
    focusHeroId,
    focusHeroRank: Math.max(0, toInteger(rawState?.focusHeroRank, 0)),
    focusHeroLevel: Math.max(0, toInteger(rawState?.focusHeroLevel, 1)),
    focusHeroMasteryLevel: Math.max(0, toInteger(rawState?.focusHeroMasteryLevel, 0)),
    focusCombatStyleId: normalizeCombatStyleId(rawState?.focusCombatStyleId, COMBAT_STYLE_FALLBACK_ID),
    loadoutSources: normalizeLoadoutSources(rawState?.loadoutSources),
    manualStats: normalizeManualStats(rawState?.manualStats),
    supportRows: normalizeSupportRows(rawState?.supportRows),
  };
}

export function readStatSimulatorState(storage = localStorage) {
  let parsedState = {};

  try {
    parsedState = JSON.parse(storage.getItem(STAT_SIMULATOR_STATE_STORAGE_KEY) ?? "{}");
  } catch {
    parsedState = {};
  }

  return normalizeStatSimulatorState(parsedState);
}

export function writeStatSimulatorState(state, storage = localStorage) {
  storage.setItem(STAT_SIMULATOR_STATE_STORAGE_KEY, JSON.stringify(normalizeStatSimulatorState(state)));
}

export function updateSimulatorSupportRow(state, rowId, updater) {
  return normalizeStatSimulatorState({
    ...state,
    supportRows: state.supportRows.map((row) => (row.id === rowId ? updater(row) : row)),
  });
}

export function sumSupportSkillEffects(supportRows) {
  return Object.fromEntries(
    STAT_SIMULATOR_SKILL_EFFECT_FIELDS.map((field) => [
      field.key,
      (supportRows ?? []).reduce((sum, row) => sum + (row?.enabled ? toNumber(row.skillEffects?.[field.key], 0) : 0), 0),
    ])
  );
}

export function sumSupportExtraSynergy(supportRows) {
  return (supportRows ?? []).reduce((sum, row) => sum + (row?.enabled ? toNumber(row.extraSynergy, 0) : 0), 0);
}

export function importSimulatorScenarioFromLoadout(state, storage = localStorage) {
  const heroLoadoutState = readHeroLoadoutState(storage);
  const focusHeroId = heroLoadoutState.selectedHeroId || state.focusHeroId;

  return normalizeStatSimulatorState({
    ...state,
    selectedMapId: storage.getItem(LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY) ?? state.selectedMapId,
    focusHeroId,
    focusHeroRank: heroLoadoutState.rankByHero?.[focusHeroId] ?? state.focusHeroRank,
    focusHeroLevel: heroLoadoutState.levelByHero?.[focusHeroId] ?? state.focusHeroLevel,
    focusHeroMasteryLevel: heroLoadoutState.masteryLevelByHero?.[focusHeroId] ?? state.focusHeroMasteryLevel,
    focusCombatStyleId: heroLoadoutState.defaultCombatStyleIdByHero?.[focusHeroId] ?? state.focusCombatStyleId,
  });
}

export function pushSimulatorFocusHeroToLoadout(state, storage = localStorage) {
  const normalizedState = normalizeStatSimulatorState(state);
  const currentState = readHeroLoadoutState(storage);
  const heroId = normalizedState.focusHeroId;

  writeHeroLoadoutState({
    ...currentState,
    selectedHeroId: heroId,
    rankByHero: {
      ...currentState.rankByHero,
      [heroId]: normalizedState.focusHeroRank,
    },
    levelByHero: {
      ...currentState.levelByHero,
      [heroId]: normalizedState.focusHeroLevel,
    },
    masteryLevelByHero: {
      ...currentState.masteryLevelByHero,
      [heroId]: normalizedState.focusHeroMasteryLevel,
    },
    defaultCombatStyleIdByHero: {
      ...currentState.defaultCombatStyleIdByHero,
      [heroId]: normalizedState.focusCombatStyleId,
    },
  }, storage);
}

export function pushSimulatorMapToLoadout(state, storage = localStorage) {
  const normalizedState = normalizeStatSimulatorState(state);
  storage.setItem(LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY, normalizedState.selectedMapId ?? "");
  schedulePersistLoadoutRuntime(storage);
}

export function createStatSimulatorDraftState() {
  return normalizeStatSimulatorState({
    highestHeroTier: "Supreme",
    milestone: 10000,
    synergyTier: "Tier9",
    synergyEvent: true,
    researchSynergyEffectsLevel: 5,
    techSynergyEffectsLevel: 5,
    selectedMapId: getDefaultMapId(),
    runesMapPerksPercent: 30,
    ultimusMapPerksPercent: 30,
    focusHeroId: heroList[0]?.id ?? "",
    focusHeroRank: 0,
    focusHeroLevel: 1,
    focusHeroMasteryLevel: 0,
    focusCombatStyleId: COMBAT_STYLE_FALLBACK_ID,
    loadoutSources: {
      statsLoadout: false,
      playerLoadout: false,
      mapLoadout: false,
      heroAttributes: false,
    },
    manualStats: createDefaultManualStats(),
    supportRows: Array.from({ length: STAT_SIMULATOR_SUPPORT_ROW_COUNT }, (_, index) => createSupportRow(index)),
  });
}