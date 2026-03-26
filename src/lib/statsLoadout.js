import researchData from "../data/research.json";
import spellsData from "../data/spells.json";
import runesData from "../data/runes.json";
import gemsData from "../data/gems.json";
import powerupsData from "../data/powerups.json";
import techData from "../data/tech.json";
import tournamentData from "../data/tournament.json";
import ticketsData from "../data/tickets.json";
import ultimusData from "../data/ultimus.json";
import masteryData from "../data/mastery.json";
import STAT_UNITS from "../data/stat_units.json";
import { schedulePersistLoadoutRuntime } from "./loadoutRuntimeStore";

export const STATS_LOADOUT_SELECTED_TAB_STORAGE_KEY = "ihtddata.statsLoadout.selectedTab";
export const STATS_LOADOUT_PREVIEW_LEVELS_STORAGE_KEY = "ihtddata.statsLoadout.previewLevelsByTab.v1";
export const STATS_LOADOUT_LEVELS_STORAGE_KEY = "ihtddata.statsLoadout.levelsByTab.v1";
export const STATS_LOADOUT_HIDE_MAXED_STORAGE_KEY = "ihtddata.statsLoadout.hideMaxedByTab.v1";

const DEFAULT_PREVIEW_LEVELS = 1;
const DEFAULT_FALLBACK_MAX_LEVEL = 999999;

function normalizeSection(data) {
  const groups = {};

  for (const [groupName, items] of Object.entries(data.groups)) {
    groups[groupName] = items.map((item) => ({
      ...item,
      multiCost: item.multCost ?? item.multiCost,
    }));
  }

  return { ...data, groups };
}

const RAW_TAB_DEFINITIONS = [
  { key: "research", label: "Research", data: normalizeSection(researchData) },
  { key: "spells", label: "Spells", data: normalizeSection(spellsData) },
  { key: "runes", label: "Runes", data: normalizeSection(runesData) },
  { key: "gems", label: "Gems", data: normalizeSection(gemsData) },
  { key: "prestige", label: "Prestige", data: normalizeSection(powerupsData) },
  { key: "technology", label: "Technology", data: normalizeSection(techData) },
  { key: "tournament", label: "Tournament", data: normalizeSection(tournamentData) },
  { key: "tickets", label: "Tickets", data: normalizeSection(ticketsData) },
  { key: "ultimus", label: "Ultimus", data: normalizeSection(ultimusData) },
  { key: "mastery", label: "Mastery", data: normalizeSection(masteryData) },
];

export const STATS_LOADOUT_TABS = Object.freeze(
  RAW_TAB_DEFINITIONS.map(({ key, label, data }) => ({
    key,
    label,
    data,
    menuIcon: data.menuIcon,
  }))
);

export const STATS_LOADOUT_TAB_MAP = Object.freeze(
  Object.fromEntries(STATS_LOADOUT_TABS.map((tab) => [tab.key, tab]))
);

const TAB_KEYS = new Set(STATS_LOADOUT_TABS.map((tab) => tab.key));

const TAB_ITEM_MAP = Object.freeze(
  Object.fromEntries(
    STATS_LOADOUT_TABS.map((tab) => [
      tab.key,
      Object.fromEntries(
        Object.values(tab.data.groups)
          .flat()
          .map((item) => [item.id, item])
      ),
    ])
  )
);

export const CURRENCY_LABELS = Object.freeze({
  prestigePower: "Prestige Power",
  tournamentPoints: "Tournament Points",
  techPoints: "Tech Points",
  weeklyTickets: "Weekly Tickets",
  gems: "Gems",
  tokensBlue: "Blue Tokens",
  tokensGreen: "Green Tokens",
  tokensRed: "Red Tokens",
});

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getItemMaxLevel(item) {
  if (Number.isFinite(item?.maxLevel) && item.maxLevel >= 0) {
    return item.maxLevel;
  }

  return DEFAULT_FALLBACK_MAX_LEVEL;
}

function clampLevel(level, item) {
  return Math.max(0, Math.min(sanitizeInteger(level, 0), getItemMaxLevel(item)));
}

function normalizeTabLevels(tabKey, rawLevels) {
  const itemMap = TAB_ITEM_MAP[tabKey] ?? {};
  const nextLevels = {};

  if (!isObject(rawLevels)) {
    return nextLevels;
  }

  for (const [itemId, item] of Object.entries(itemMap)) {
    const level = clampLevel(rawLevels[itemId], item);
    if (level > 0) {
      nextLevels[itemId] = level;
    }
  }

  return nextLevels;
}

export function normalizeStatsLoadoutState(rawState) {
  const selectedTab = TAB_KEYS.has(rawState?.selectedTab) ? rawState.selectedTab : STATS_LOADOUT_TABS[0]?.key ?? "research";
  const previewLevelsByTab = {};
  const levelsByTab = {};
  const hideMaxedByTab = {};

  for (const tab of STATS_LOADOUT_TABS) {
    const rawPreview = rawState?.previewLevelsByTab?.[tab.key];
    previewLevelsByTab[tab.key] = Math.max(1, sanitizeInteger(rawPreview, DEFAULT_PREVIEW_LEVELS));
    levelsByTab[tab.key] = normalizeTabLevels(tab.key, rawState?.levelsByTab?.[tab.key]);
    hideMaxedByTab[tab.key] = Boolean(rawState?.hideMaxedByTab?.[tab.key]);
  }

  return {
    selectedTab,
    previewLevelsByTab,
    levelsByTab,
    hideMaxedByTab,
  };
}

export function readStatsLoadoutState(storage = localStorage) {
  let previewLevelsByTab = {};
  let levelsByTab = {};
  let hideMaxedByTab = {};

  try {
    const parsedPreview = JSON.parse(storage.getItem(STATS_LOADOUT_PREVIEW_LEVELS_STORAGE_KEY) ?? "{}");
    if (isObject(parsedPreview)) {
      previewLevelsByTab = parsedPreview;
    }
  } catch {
    previewLevelsByTab = {};
  }

  try {
    const parsedLevels = JSON.parse(storage.getItem(STATS_LOADOUT_LEVELS_STORAGE_KEY) ?? "{}");
    if (isObject(parsedLevels)) {
      levelsByTab = parsedLevels;
    }
  } catch {
    levelsByTab = {};
  }

  try {
    const parsedHideMaxed = JSON.parse(storage.getItem(STATS_LOADOUT_HIDE_MAXED_STORAGE_KEY) ?? "{}");
    if (isObject(parsedHideMaxed)) {
      hideMaxedByTab = parsedHideMaxed;
    }
  } catch {
    hideMaxedByTab = {};
  }

  return normalizeStatsLoadoutState({
    selectedTab: storage.getItem(STATS_LOADOUT_SELECTED_TAB_STORAGE_KEY),
    previewLevelsByTab,
    levelsByTab,
    hideMaxedByTab,
  });
}

export function writeStatsLoadoutState(state, storage = localStorage) {
  const normalized = normalizeStatsLoadoutState(state);

  storage.setItem(STATS_LOADOUT_SELECTED_TAB_STORAGE_KEY, normalized.selectedTab);
  storage.setItem(STATS_LOADOUT_PREVIEW_LEVELS_STORAGE_KEY, JSON.stringify(normalized.previewLevelsByTab));
  storage.setItem(STATS_LOADOUT_LEVELS_STORAGE_KEY, JSON.stringify(normalized.levelsByTab));
  storage.setItem(STATS_LOADOUT_HIDE_MAXED_STORAGE_KEY, JSON.stringify(normalized.hideMaxedByTab));
  schedulePersistLoadoutRuntime(storage);
}

export function getStatsLoadoutBonusTotals(levelsByTab) {
  const totals = {};

  for (const tab of STATS_LOADOUT_TABS) {
    const currentLevels = levelsByTab?.[tab.key] ?? {};

    for (const item of getTabItems(tab.key)) {
      if (item.statAmt == null || !item.statKey) {
        continue;
      }

      const level = clampLevel(currentLevels[item.id], item);
      if (level <= 0) {
        continue;
      }

      totals[item.statKey] = (totals[item.statKey] ?? 0) + item.statAmt * level;
    }
  }

  return totals;
}

export function formatStatPerLevel(statAmt, statKey) {
  if (statAmt == null || !statKey) {
    return "-";
  }

  const info = STAT_UNITS[statKey];
  if (!info) {
    return `+${statAmt}`;
  }

  if (info.unit === "%") {
    return `+${statAmt}%`;
  }

  if (info.unit === "x") {
    return `x${statAmt}`;
  }

  return `+${statAmt} ${info.unit}`;
}

export function formatStatTotal(totalAmt, statKey, formatValue = (value) => String(value)) {
  if (totalAmt == null || !statKey) {
    return "-";
  }

  const info = STAT_UNITS[statKey];
  const formatted = formatValue(totalAmt);

  if (!info) {
    return `+${formatted}`;
  }

  if (info.unit === "%") {
    return `+${formatted}%`;
  }

  if (info.unit === "x") {
    return `x${formatted}`;
  }

  return `+${formatted} ${info.unit}`;
}

export function getTabItems(tabKey) {
  return Object.values(TAB_ITEM_MAP[tabKey] ?? {});
}

export function spellCostEntry(level, item) {
  if (level === 16 && item.tier2Unlock) {
    return { type: "unlock", currency: item.tier2Unlock.currency, amount: item.tier2Unlock.amount };
  }

  if (level === 21 && item.tier3Unlock) {
    return { type: "unlock", currency: item.tier3Unlock.currency, amount: item.tier3Unlock.amount };
  }

  const { baseCost, base15, base20, multCost, noBreakpointMult } = item;

  if (level === 1) {
    return { type: "energy", cost: BigInt(Math.round(baseCost)) };
  }

  let tierIdx;
  let base;

  if (level <= 15) {
    tierIdx = level - 1;
    base = tierIdx < 10 ? baseCost : baseCost * 2;
  } else if (level >= 17 && level <= 20) {
    tierIdx = level - 1;
    base = base15;
  } else {
    tierIdx = level - 1;
    base = base20;
  }

  const bpMult = noBreakpointMult ? 1 : (tierIdx < 3 ? 1 : tierIdx < 6 ? 2 : 6);
  const cost = BigInt(Math.round(base))
    * BigInt(Math.round(multCost)) ** BigInt(tierIdx + 1)
    * BigInt(bpMult);

  return { type: "energy", cost };
}

function usesBigInt(item, sectionFormula) {
  if (item.hasLinearMult) return false;
  const formula = item.costFormula ?? sectionFormula;
  if (formula === "spell") {
    return true;
  }

  if (formula === "hero_attr" || formula === "none") {
    return false;
  }

  return Number.isInteger(item.baseCost)
    && (item.multiCost === undefined || Number.isInteger(item.multiCost));
}

function prestigeBreakpointMult(level, maxLevel) {
  const bp1 = Math.ceil(maxLevel * 0.5);
  const bp2 = Math.ceil(maxLevel * 0.8);
  return level >= bp2 ? 24 : level >= bp1 ? 3 : 1;
}

export function costAtLevel(level, item, sectionFormula) {
  const formula = item.costFormula ?? sectionFormula;
  const { baseCost, multiCost, stopCostIncreaseAt } = item;

  if (!baseCost || formula === "none") {
    return 0n;
  }

  if (formula === "spell") {
    const entry = spellCostEntry(level, item);
    return entry.type === "energy" ? entry.cost : 0n;
  }

  if (formula === "hero_attr") {
    const maxLevel = item.maxLevel ?? DEFAULT_FALLBACK_MAX_LEVEL;
    const breakpointOne = Math.round(maxLevel * 0.5);
    const breakpointTwo = Math.round(maxLevel * 0.8);
    const multiplier = level >= breakpointTwo ? 1.875 : level >= breakpointOne ? 1.25 : 1;
    return Math.floor(baseCost * level * multiplier);
  }

  if (usesBigInt(item, sectionFormula)) {
    const bc = BigInt(baseCost);
    const mc = multiCost !== undefined ? BigInt(multiCost) : 1n;
    const lv = BigInt(level);

    switch (formula) {
      case "flat":
        return bc;
      case "rank_linear":
        return bc * lv;
      case "power":
        return bc * lv ** mc;
      case "exponential":
      case "exponential_endgame":
        return bc * mc ** (lv - 1n);
      case "capped_linear": {
        const cap = stopCostIncreaseAt !== undefined ? BigInt(Math.round(stopCostIncreaseAt)) : lv;
        return bc * (lv < cap ? lv : cap);
      }
      default:
        return bc;
    }
  }

  const exponentLevel = level - 1;
  switch (formula) {
    case "flat":
      return baseCost;
    case "rank_linear":
      return baseCost * level;
    case "power": {
      const itemMaxLevel = item.maxLevel ?? DEFAULT_FALLBACK_MAX_LEVEL;
      const bpMult = item.hasLinearMult ? prestigeBreakpointMult(level, itemMaxLevel) : 1;
      const linMult = item.hasLinearMult && itemMaxLevel > 999 && level > 1 ? 1 + level * 0.001 : 1;
      return baseCost * Math.pow(level, multiCost ?? 1) * bpMult * linMult;
    }
    case "exponential":
    case "exponential_endgame": {
      const itemMaxLevel = item.maxLevel ?? DEFAULT_FALLBACK_MAX_LEVEL;
      const bpMult = item.hasLinearMult ? prestigeBreakpointMult(level, itemMaxLevel) : 1;
      const linMult = item.hasLinearMult && itemMaxLevel > 999 && level > 1 ? 1 + level * 0.001 : 1;
      return baseCost * Math.pow(multiCost ?? 1, exponentLevel) * bpMult * linMult;
    }
    case "capped_linear":
      return baseCost * Math.min(level, stopCostIncreaseAt ?? level);
    default:
      return baseCost;
  }
}

export function buildUpgradePreview(item, sectionFormula, currentLevel, previewLevels) {
  const safeCurrentLevel = clampLevel(currentLevel, item);
  const safePreviewLevels = Math.max(1, sanitizeInteger(previewLevels, DEFAULT_PREVIEW_LEVELS));
  const maxLevel = getItemMaxLevel(item);
  const projectedLevel = Math.min(maxLevel, safeCurrentLevel + safePreviewLevels);
  const levelsToBuy = Math.max(0, projectedLevel - safeCurrentLevel);
  const canCalculateCost = (item.costFormula ?? sectionFormula) !== "none" && item.baseCost !== undefined;

  const currentState = item.statAmt != null && item.statKey
    ? item.statAmt * safeCurrentLevel
    : null;
  const projectedState = item.statAmt != null && item.statKey
    ? item.statAmt * projectedLevel
    : null;
  const previewGain = item.statAmt != null && item.statKey
    ? item.statAmt * levelsToBuy
    : null;

  let previewCost = canCalculateCost ? (usesBigInt(item, sectionFormula) ? 0n : 0) : null;
  const previewUnlocks = [];

  if (levelsToBuy > 0 && canCalculateCost) {
    for (let level = safeCurrentLevel + 1; level <= projectedLevel; level += 1) {
      if ((item.costFormula ?? sectionFormula) === "spell") {
        const entry = spellCostEntry(level, item);
        if (entry.type === "energy") {
          previewCost += entry.cost;
        } else {
          previewUnlocks.push({ ...entry, level });
        }
      } else {
        previewCost += costAtLevel(level, item, sectionFormula);
      }
    }
  }

  let nextCost = null;
  if (safeCurrentLevel < maxLevel && canCalculateCost) {
    if ((item.costFormula ?? sectionFormula) === "spell") {
      nextCost = spellCostEntry(safeCurrentLevel + 1, item);
    } else {
      nextCost = { type: "cost", cost: costAtLevel(safeCurrentLevel + 1, item, sectionFormula) };
    }
  }

  return {
    currentLevel: safeCurrentLevel,
    projectedLevel,
    maxLevel,
    levelsToBuy,
    currentState,
    projectedState,
    previewGain,
    previewCost,
    previewUnlocks,
    nextCost,
    canCalculateCost,
  };
}