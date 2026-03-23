import { Suspense, lazy, useState, useMemo, useEffect, useLayoutEffect, useRef, createContext, useContext } from "react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

import { heroesData, mapsData, getInitialMapSpotsById, mergeMapsWithSpots, normalizeMapSpots, parseMapSpotsByIdFromJsonText } from "./lib/gameData";
import challengesData from "./data/challenges.json";
import enemyHpData from "./data/enemy_hp.json";
import researchData from "./data/research.json";
import spellsData from "./data/spells.json";
import powerupsData from "./data/powerups.json";
import gemsData from "./data/gems.json";
import masteryData from "./data/mastery.json";
import playerBgData from "./data/player_backgrounds.json";
import playerIconsData from "./data/player_icons.json";
import techData from "./data/tech.json";
import ticketsData from "./data/tickets.json";
import tournamentData from "./data/tournament.json";
import ultimusData from "./data/ultimus.json";
import runesData from "./data/runes.json";
import heroAttributesData from "./data/hero_attributes.json";
import tournamentBracketsData from "./data/tournament_brackets.json";
import STAT_UNITS from "./data/stat_units.json";
import techTreeDisplayData from "./data/tech_tree_display.json";
import immortalBossData from "./data/immortal_boss.json";
import wavePerksData from "./data/wave_perks.json";
import { hydrateLoadoutRuntime, LOADOUT_RUNTIME_CHANGED_EVENT, persistLoadoutRuntime, schedulePersistLoadoutRuntime, getCurrentSavedLoadoutSelections, getCurrentScopedSavedLoadoutId, removeSavedLoadoutIdFromSelections } from "./lib/loadoutRuntimeStore";
import {
  deleteSavedLoadout,
  getSavedLoadout,
  listSavedLoadouts,
  loadSavedLoadoutIntoWorkingState,
  saveWorkingLoadoutAsRecord,
  saveWorkingLoadoutChanges,
  startFreshWorkingLoadout,
  updateSavedLoadout,
} from "./lib/loadoutSavedRepository";
import { buildActiveLoadoutScope, buildComparableLoadoutScopePayload, createComparableLoadoutScopePayload, getLoadoutScopeDisplayName, LOADOUT_RECORD_SCOPE_FULL } from "./lib/loadoutScope";
import { readMapLoadoutBuilderMode } from "./lib/mapLoadout";
import { costAtLevel as getUpgradeCostAtLevel } from "./lib/statsLoadout";

const loadSecondaryViews = () => import("./views/secondaryViews.jsx");
const HomeView = lazy(() => loadSecondaryViews().then((module) => ({ default: module.HomeView })));
const BracketsView = lazy(() => loadSecondaryViews().then((module) => ({ default: module.BracketsView })));
const BattlepassExpView = lazy(() => loadSecondaryViews().then((module) => ({ default: module.BattlepassExpView })));
const MapPerksView = lazy(() => loadSecondaryViews().then((module) => ({ default: module.MapPerksView })));
const loadMiscViews = () => import("./views/miscViews.jsx");
const ChallengesView = lazy(() => loadMiscViews().then((module) => ({ default: module.ChallengesView })));
const PlayerIconsView = lazy(() => loadMiscViews().then((module) => ({ default: module.PlayerIconsView })));
const PlayerBackgroundsView = lazy(() => loadMiscViews().then((module) => ({ default: module.PlayerBackgroundsView })));
const WavePerksView = lazy(() => loadMiscViews().then((module) => ({ default: module.WavePerksView })));
const loadCalculatorViews = () => import("./views/calculatorViews.jsx");
const CombatStylesView = lazy(() => loadCalculatorViews().then((module) => ({ default: module.CombatStylesView })));
const EnemyHpView = lazy(() => loadCalculatorViews().then((module) => ({ default: module.EnemyHpView })));
const ResourceOptimizerView = lazy(() => loadCalculatorViews().then((module) => ({ default: module.ResourceOptimizerView })));
const loadAppDataViews = () => import("./views/appDataViews.jsx");
const AllHeroesRoute = lazy(() => loadAppDataViews().then((module) => ({ default: module.AllHeroesRoute })));
const AllSynergiesRoute = lazy(() => loadAppDataViews().then((module) => ({ default: module.AllSynergiesRoute })));
const AllMilestonesRoute = lazy(() => loadAppDataViews().then((module) => ({ default: module.AllMilestonesRoute })));
const AllMapsRoute = lazy(() => loadAppDataViews().then((module) => ({ default: module.AllMapsRoute })));
const loadBuilderViews = () => import("./views/loadoutBuilderViews.jsx");
const LoadoutBuilderView = lazy(() => loadBuilderViews().then((module) => ({ default: module.LoadoutBuilderView })));
const StatsLoadoutView = lazy(() => loadBuilderViews().then((module) => ({ default: module.StatsLoadoutView })));
const HeroLoadoutView = lazy(() => loadBuilderViews().then((module) => ({ default: module.HeroLoadoutView })));
const PlayerLoadoutView = lazy(() => loadBuilderViews().then((module) => ({ default: module.PlayerLoadoutView })));
const StatsHubView = lazy(() => loadBuilderViews().then((module) => ({ default: module.StatsHubView })));
const SavesView = lazy(() => loadBuilderViews().then((module) => ({ default: module.SavesView })));
const CoordFinderView = lazy(() => loadBuilderViews().then((module) => ({ default: module.CoordFinderView })));
const loadSimulatorViews = () => import("./views/simulatorViews.jsx");
const StatSimulatorView = lazy(() => loadSimulatorViews().then((module) => ({ default: module.StatSimulatorView })));

function normalizeSection(data) {
  const groups = {};
  for (const [groupName, items] of Object.entries(data.groups)) {
    groups[groupName] = items.map((item) => ({
      ...item,
      multiCost: item.multCost ?? item.multiCost,
      hasLinearMult: item.hasLinearMult ?? data.hasLinearMult ?? false,
    }));
  }
  return { ...data, groups };
}

const SECTIONS = [
  { key: "research", data: normalizeSection(researchData) },
  { key: "spells", data: normalizeSection(spellsData) },
  { key: "runes", data: normalizeSection(runesData) },
  { key: "gems", data: normalizeSection(gemsData) },
  { key: "powerups", data: normalizeSection(powerupsData) },
  { key: "tech", data: normalizeSection(techData) },
  { key: "tournament", data: normalizeSection(tournamentData) },
  { key: "tickets", data: normalizeSection(ticketsData) },
  { key: "ultimus", data: normalizeSection(ultimusData) },
  { key: "mastery", data: normalizeSection(masteryData) },
];

const SECTION_MAP = Object.fromEntries(SECTIONS.map((section) => [section.key, section]));
const MAP_LOADOUT_ROUTE_TO_MODE = Object.freeze({
  loadoutBuilderPlacement: "hero",
  loadoutBuilderPerks: "perks",
  loadoutBuilderSpell: "spell",
});
const MAP_LOADOUT_ROUTE_KEYS = new Set(["loadoutBuilder", ...Object.keys(MAP_LOADOUT_ROUTE_TO_MODE)]);

function getMapLoadoutModeFromRoute(activeKey, storage = localStorage) {
  if (activeKey === "loadoutBuilder") {
    return readMapLoadoutBuilderMode(storage);
  }

  return MAP_LOADOUT_ROUTE_TO_MODE[activeKey] ?? "hero";
}

const REWARD_UNIT_SYMBOL = Object.fromEntries(
  Object.values(STAT_UNITS).map((value) => [value.label.toLowerCase(), value.unit])
);
const HERO_GOLD_COST_BASE_COST = heroesData.levelCostFormula.baseCost;
const HERO_GOLD_COST_MILESTONE_LEVELS = new Set(
  (heroesData.heroes ?? []).flatMap((hero) => (hero.milestones ?? []).map((milestone) => milestone.requirement))
);
const HERO_GOLD_COST_SOURCES = [
  { key: "tickets", label: "Tickets", icon: "_ticket.png", statAmt: 0.5, maxLevel: 25 },
  { key: "runes", label: "Runes", icon: "_rune_2.png", statAmt: 0.5, maxLevel: 10 },
  { key: "ultimus", label: "Ultimus", icon: "token_red.png", statAmt: 0.5, maxLevel: 10 },
  { key: "mastery", label: "Mastery", icon: "_mastery_2.png", statAmt: 0.5, maxLevel: 10 },
];
const HERO_ATTRIBUTE_LIST = [...heroAttributesData.personal, ...heroAttributesData.global];

const NAV_GROUPS = [
  {
    label: "Upgrades",
    items: [
      { key: "research" },
      { key: "spells" },
      { key: "runes" },
      { key: "gems" },
      { key: "powerups" },
      { key: "tech" },
      { key: "tournament" },
      { key: "tickets" },
      { key: "ultimus" },
      { key: "mastery" },
    ],
  },
  {
    label: "Hero Data",
    items: [
      { key: "allHeroes", label: "All Heroes", menuIcon: "_heroHelm.png" },
      { key: "synergies", label: "Synergies", menuIcon: "_synergy.png", iconFilter: "invert(60%) sepia(100%) saturate(400%) hue-rotate(90deg) brightness(1.2)" },
      { key: "milestones", label: "Milestones", menuIcon: "_star 3610.png" },
      { key: "rankExp", label: "Rank Exp", menuIcon: "_killExp.png" },
      { key: "attributes", label: "Attributes", menuIcon: "_attributePoints_0.png" },
      { key: "combatStyles", label: "Combat Styles", menuIcon: "icon_scale.png" },
    ],
  },
  {
    label: "PvP",
    items: [
      { key: "brackets",         label: "Tournament Brackets", menuIcon: "Icon_Trophy_0.png" },
      { key: "immortalBrackets", label: "Immortal Brackets",   menuIcon: "Icon_Trophy_0.png" },
    ],
  },
  {
    label: "Maps",
    items: [
      { key: "allMaps", label: "All Maps", menuIcon: "Icon_Map_0.png" },
      { key: "mapPerks", label: "Map Perks", menuIcon: "_starEmpty_0.png" },
    ],
  },
  {
    label: "Loadout",
    items: [
      { key: "statsHub", label: "Stats Hub", menuIcon: "_attributePoints_0.png" },
      {
        key: "loadoutBuilderMenu",
        label: "Map Loadouts",
        children: [
          { key: "loadoutBuilderPlacement", label: "Placement Loadout", menuIcon: "tower2.png" },
          { key: "loadoutBuilderPerks", label: "Map Perks Loadout", menuIcon: "_starEmpty_0.png" },
          { key: "loadoutBuilderSpell", label: "Spell Loadout", menuIcon: "_energy.png" },
        ],
      },
      { key: "heroLoadout", label: "Hero Loadout", menuIcon: "_heroHelm.png" },
      { key: "statsLoadout", label: "Upgrades Loadout", menuIcon: "_heroes.png" },
      { key: "playerLoadout", label: "Player Loadout", menuIcon: "_background.png" },
      { key: "saves", label: "Saves", menuIcon: "Icon_Trophy_0.png" },
    ],
  },
  {
    label: "Simulator",
    items: [
      { key: "statSimulator", label: "Stat Simulator", menuIcon: "_attributePoints_0.png" },
      { key: "resourceOptimizer", label: "Resource Optimizer", menuIcon: "_coin.png" },
    ],
  },
  {
    label: "Misc",
    items: [
      { key: "battpassExp", label: "Battlepass Exp", menuIcon: "_battlepass.png" },
      { key: "wavePerks", label: "Wave Perks", menuIcon: "flagSword.png" },
      { key: "challenges", label: "Challenges", menuIcon: "_starBlue.png" },
      { key: "playerIcons", label: "Player Icons", menuIcon: "icon_inforound.png" },
      { key: "playerBackgrounds", label: "Player Backgrounds", menuIcon: "_prestigeBg.png" },
    ],
  },
  {
    label: "Calculators",
    items: [
      { key: "rankRequired",  label: "Rank Required",    menuIcon: "_attributePoints_0.png" },
      { key: "enemyHp",       label: "Enemy HP",         menuIcon: "_bosses.png" },
      { key: "heroGoldCost",  label: "Hero Gold Cost",   menuIcon: "_gold.png" },
      { key: "ultimusTokens", label: "Ultimus Tokens",   menuIcon: "ultimusBoss.png" },
    ],
  },
  {
    label: "Admin",
    items: [{ key: "coordFinder", label: "Coord Finder", menuIcon: "_edit.png" }],
  },
];

const ADMIN_ROUTE_KEYS = new Set(["coordFinder"]);

function isLocalhostAdminHost() {
  const hostname = window.location.hostname.toLowerCase();
  return import.meta.env.DEV
    || hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname === "[::1]";
}

const BIG_SUFFIXES = (() => {
  const suffixes = ["", "K", "M", "B", "T"];
  for (const first of "abcd") {
    for (const second of "abcdefghijklmnopqrstuvwxyz") {
      suffixes.push(first + second);
    }
  }
  return suffixes;
})();

function formatBigNum(n, notation = "scientific") {
  if (n !== null && typeof n === "object" && "logValue" in n) {
    const logValue = n.logValue;
    if (!isFinite(logValue)) return logValue > 0 ? "∞" : "0";
    const exponent = Math.floor(logValue);
    const mantissa = Math.pow(10, logValue - exponent);
    if (notation === "letters") {
      const tier = Math.floor(exponent / 3);
      if (tier > 0 && tier < BIG_SUFFIXES.length) {
        return (mantissa * Math.pow(10, exponent - tier * 3)).toFixed(2) + BIG_SUFFIXES[tier];
      }
    }
    return `${mantissa.toFixed(2)}e${exponent}`;
  }
  if (typeof n === "bigint") {
    if (n <= 0n) return n === 0n ? "0" : "-" + formatBigNum(-n, notation);
    const s = n.toString();
    const exp = s.length - 1;
    if (exp < 15) {
      n = Number(n); // safe — falls through to Number path below
    } else {
      const mantissa = parseFloat(s[0] + (s.length > 1 ? "." + s.slice(1, 8) : ""));
      const tier = Math.floor(exp / 3);
      if (notation === "letters" && tier > 0 && tier < BIG_SUFFIXES.length) {
        return (mantissa * Math.pow(10, exp - tier * 3)).toFixed(2) + BIG_SUFFIXES[tier];
      }
      return `${mantissa.toFixed(2)}e${exp}`;
    }
  }
  if (!isFinite(n)) return "∞";
  if (n === 0) return "0";
  const sign = n < 0 ? "-" : "";
  const absolute = Math.abs(n);
  const tier = Math.max(0, Math.floor(Math.log10(Math.max(1, absolute)) / 3));
  if (tier === 0) return sign + absolute.toFixed(0);
  if (tier <= 4) return sign + (absolute / Math.pow(1000, tier)).toFixed(2) + BIG_SUFFIXES[tier];
  if (notation === "scientific") {
    const exponent = Math.floor(Math.log10(absolute));
    const mantissa = absolute / Math.pow(10, exponent);
    return `${sign}${mantissa.toFixed(2)}e${exponent}`;
  }
  if (tier >= BIG_SUFFIXES.length) return "∞";
  return sign + (absolute / Math.pow(1000, tier)).toFixed(2) + BIG_SUFFIXES[tier];
}

const CURRENCY_LABELS = {
  prestigePower: "Prestige Power",
  tournamentPoints: "Tournament Points",
  techPoints: "Tech Points",
  weeklyTickets: "Weekly Tickets",
  gems: "Gems",
  tokensBlue: "Blue Tokens",
  tokensGreen: "Green Tokens",
  tokensRed: "Red Tokens",
};

function spellCostEntry(level, item) {
  if (level === 16 && item.tier2Unlock) {
    return { type: "unlock", currency: item.tier2Unlock.currency, amount: item.tier2Unlock.amount };
  }
  if (level === 21 && item.tier3Unlock) {
    return { type: "unlock", currency: item.tier3Unlock.currency, amount: item.tier3Unlock.amount };
  }

  const { baseCost, base15, base20, multCost, noBreakpointMult } = item;
  if (level === 1) return { type: "energy", cost: BigInt(Math.round(baseCost)) };

  let tierIndex;
  let base;

  if (level <= 15) {
    tierIndex = level - 1;
    base = tierIndex < 10 ? baseCost : baseCost * 2;
  } else if (level >= 17 && level <= 20) {
    tierIndex = level - 1;
    base = base15;
  } else {
    tierIndex = level - 1;
    base = base20;
  }

  const breakpointMult = noBreakpointMult ? 1 : tierIndex < 3 ? 1 : tierIndex < 6 ? 2 : 6;
  const cost = BigInt(Math.round(base)) * BigInt(Math.round(multCost)) ** BigInt(tierIndex + 1) * BigInt(breakpointMult);
  return { type: "energy", cost };
}

const NotationContext = createContext("scientific");

function useFmt() {
  const notation = useContext(NotationContext);
  return (n) => formatBigNum(n, notation);
}

function Badge({ children, color }) {
  return (
    <span style={{
      background: color + "22",
      color,
      border: `1px solid ${color}44`,
      borderRadius: 4,
      padding: "1px 7px",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.04em",
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function getIconUrl(filename) {
  return new URL(`./images/Icons/${filename}`, import.meta.url).href;
}

function getPerkUnit(name) {
  if (name.includes("%")) return "%";
  if (/chance|synergy|speed|cooldown|bonus|effect|group|damage|power|exp|gold|energy|active play/i.test(name)) return "%";
  return "";
}

function rewardUnitSym(rewardUnit) {
  return REWARD_UNIT_SYMBOL[rewardUnit?.toLowerCase()] ?? "";
}

function computeTotalCost(item, sectionFormula) {
  const formula = item.costFormula ?? sectionFormula;
  const { baseCost, multiCost, maxLevel, stopCostIncreaseAt } = item;

  if (baseCost === undefined || maxLevel === undefined) return null;
  if (formula === "none") return null;

  if (formula === "spell") {
    let total = 0n;
    for (let level = 1; level <= maxLevel; level += 1) {
      const entry = spellCostEntry(level, item);
      if (entry.type === "energy") total += entry.cost;
    }
    return total;
  }

  if (formula === "hero_attr") {
    const breakpointOne = Math.round(maxLevel * 0.5);
    const breakpointTwo = Math.round(maxLevel * 0.8);
    const sumRange = (start, end) => (end >= start ? ((end - start + 1) * (start + end)) / 2 : 0);
    return Math.round(baseCost * sumRange(1, breakpointOne - 1) + 1.25 * baseCost * sumRange(breakpointOne, breakpointTwo - 1) + 1.875 * baseCost * sumRange(breakpointTwo, maxLevel));
  }

  const intInputs = Number.isInteger(baseCost) && (multiCost === undefined || Number.isInteger(multiCost));

  if (intInputs) {
    const baseCostBig = BigInt(baseCost);
    const multiCostBig = multiCost !== undefined ? BigInt(multiCost) : 1n;
    const maxLevelBig = BigInt(maxLevel);

    switch (formula) {
      case "flat":
        return baseCostBig * maxLevelBig;

      case "rank_linear":
        return (baseCostBig * maxLevelBig * (maxLevelBig + 1n)) / 2n;

      case "power": {
        if (item.hasLinearMult) break;
        const breakpointOne = BigInt(Math.ceil(maxLevel * 0.5));
        const breakpointTwo = BigInt(Math.ceil(maxLevel * 0.8));
        const sumRange = (start, end) => (end >= start ? ((end - start + 1n) * (start + end)) / 2n : 0n);
        if (!multiCost || multiCost === 1) {
          return baseCostBig * (sumRange(1n, breakpointOne - 1n) + 3n * sumRange(breakpointOne, breakpointTwo - 1n) + 24n * sumRange(breakpointTwo, maxLevelBig));
        }
        let total = 0n;
        for (let level = 1n; level <= maxLevelBig; level += 1n) {
          const breakpointMult = level >= breakpointTwo ? 24n : level >= breakpointOne ? 3n : 1n;
          total += baseCostBig * level ** multiCostBig * breakpointMult;
        }
        return total;
      }

      case "exponential":
      case "exponential_endgame": {
        if (item.hasLinearMult) break;
        const breakpointOne = BigInt(Math.ceil(maxLevel * 0.5));
        const breakpointTwo = BigInt(Math.ceil(maxLevel * 0.8));
        if (!multiCost || multiCost === 1) {
          const countOne = breakpointOne > 1n ? breakpointOne - 1n : 0n;
          const countTwo = breakpointTwo > breakpointOne ? breakpointTwo - breakpointOne : 0n;
          const countThree = maxLevelBig >= breakpointTwo ? maxLevelBig - breakpointTwo + 1n : 0n;
          return baseCostBig * (countOne + 3n * countTwo + 24n * countThree);
        }
        const geometric = (start, end) => end < start ? 0n : multiCostBig ** (start - 1n) * (multiCostBig ** (end - start + 1n) - 1n) / (multiCostBig - 1n);
        try {
          return baseCostBig * (geometric(1n, breakpointOne - 1n) + 3n * geometric(breakpointOne, breakpointTwo - 1n) + 24n * geometric(breakpointTwo, maxLevelBig));
        } catch {
          break;
        }
      }

      case "capped_linear": {
        const cap = stopCostIncreaseAt !== undefined ? BigInt(Math.round(stopCostIncreaseAt)) : maxLevelBig;
        if (maxLevelBig <= cap) return (baseCostBig * maxLevelBig * (maxLevelBig + 1n)) / 2n;
        return baseCostBig * (((cap * (cap + 1n)) / 2n) + (maxLevelBig - cap) * cap);
      }

      default:
        return baseCostBig * maxLevelBig;
    }
  }

  switch (formula) {
    case "flat":
      return baseCost * maxLevel;

    case "rank_linear":
      return (baseCost * maxLevel * (maxLevel + 1)) / 2;

    case "power": {
      const breakpointOne = maxLevel * 0.5;
      const breakpointTwo = maxLevel * 0.8;
      const exponent = multiCost ?? 1;
      if (maxLevel > 10000) {
        const integral = (start, end) => {
          const first = (Math.pow(end, exponent + 1) - Math.pow(start, exponent + 1)) / (exponent + 1);
          const second = 0.001 * (Math.pow(end, exponent + 2) - Math.pow(start, exponent + 2)) / (exponent + 2);
          return first + second;
        };
        return baseCost * (integral(0, breakpointOne) + 3 * integral(breakpointOne, breakpointTwo) + 24 * integral(breakpointTwo, maxLevel));
      }
      let total = 0;
      for (let index = 0; index < maxLevel; index += 1) {
        const level = index + 1;
        const breakpointMult = level >= breakpointTwo ? 24 : level >= breakpointOne ? 3 : 1;
        const linearMult = item.hasLinearMult && level > 1 ? 1 + level * 0.001 : 1;
        total += baseCost * Math.pow(level, exponent) * breakpointMult * linearMult;
      }
      return total;
    }

    case "exponential":
    case "exponential_endgame": {
      const breakpointOne = Math.ceil(maxLevel * 0.5);
      const breakpointTwo = Math.ceil(maxLevel * 0.8);
      if (item.hasLinearMult) {
        let total = 0;
        for (let level = 1; level <= maxLevel; level += 1) {
          const breakpointMult = level >= breakpointTwo ? 24 : level >= breakpointOne ? 3 : 1;
          const linearMult = level > 1 ? 1 + level * 0.001 : 1;
          total += baseCost * Math.pow(multiCost ?? 1, level - 1) * breakpointMult * linearMult;
        }
        return total;
      }
      const geometric = (start, end) => {
        if (end < start) return 0;
        if (!multiCost || multiCost === 1) return end - start + 1;
        return Math.pow(multiCost, start - 1) * (Math.pow(multiCost, end - start + 1) - 1) / (multiCost - 1);
      };
      return baseCost * (geometric(1, breakpointOne - 1) + 3 * geometric(breakpointOne, breakpointTwo - 1) + 24 * geometric(breakpointTwo, maxLevel));
    }

    case "capped_linear": {
      const cap = stopCostIncreaseAt ?? maxLevel;
      if (maxLevel <= cap) return (baseCost * maxLevel * (maxLevel + 1)) / 2;
      return baseCost * (((cap * (cap + 1)) / 2) + (maxLevel - cap) * cap);
    }

    default:
      return baseCost * maxLevel;
  }
}

function CostModal({ item, sectionFormula, onClose }) {
  const fmt = useFmt();
  const formula = item.costFormula ?? sectionFormula;
  const maxLevel = Math.max(1, item.maxLevel ?? 1);
  const displayedMaxLevel = Math.min(maxLevel, 50);
  const isSpellFormula = formula === "spell";
  const totalCost = computeTotalCost(item, sectionFormula);
  const hasStatValue = typeof item.statAmt === "number" && Boolean(item.statKey);
  const hasBaseStat = typeof item.baseAmt === "number";

  const rows = useMemo(() => {
    const nextRows = [];
    let cumulativeCost = typeof totalCost === "bigint" ? 0n : 0;

    for (let level = 1; level <= displayedMaxLevel; level += 1) {
      let costLabel = "-";
      let cumulativeLabel = "-";

      if (item.baseCost !== undefined && formula !== "none") {
        if (isSpellFormula) {
          const entry = spellCostEntry(level, item);
          if (entry.type === "unlock") {
            costLabel = `${fmt(entry.amount)} ${CURRENCY_LABELS[entry.currency] ?? entry.currency}`;
          } else {
            cumulativeCost += entry.cost;
            costLabel = fmt(entry.cost);
            cumulativeLabel = fmt(cumulativeCost);
          }
        } else {
          const levelCost = getUpgradeCostAtLevel(level, item, sectionFormula);
          cumulativeCost = typeof cumulativeCost === "bigint" || typeof levelCost === "bigint"
            ? BigInt(cumulativeCost) + BigInt(levelCost)
            : cumulativeCost + levelCost;
          costLabel = fmt(levelCost);
          cumulativeLabel = fmt(cumulativeCost);
        }
      }

      let bonusLabel = "-";
      if (hasStatValue) {
        const totalStatValue = isProgressiveItem(item)
          ? progressiveTotal(item.statAmt, level)
          : (hasBaseStat ? item.baseAmt + item.statAmt * level : item.statAmt * level);
        bonusLabel = formatStatTotal(totalStatValue, item.statKey, fmt);
      } else if (typeof item.reward === "number") {
        const rewardValue = hasBaseStat ? item.baseAmt + item.reward * level : item.reward * level;
        bonusLabel = `${fmt(rewardValue)}${rewardUnitSym(item.rewardUnit)}`;
      }

      nextRows.push({
        level,
        costLabel,
        cumulativeLabel,
        bonusLabel,
      });
    }

    return nextRows;
  }, [displayedMaxLevel, fmt, formula, hasBaseStat, hasStatValue, isSpellFormula, item, sectionFormula, totalCost]);

  const summaryStatLabel = hasStatValue
    ? formatStat(item.statAmt, item.statKey)
    : typeof item.reward === "number"
      ? `${fmt(item.reward)}${rewardUnitSym(item.rewardUnit)}`
      : null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(event) => event.stopPropagation()} className="modal-box" style={{ background: colors.bg, border: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", width: "100%", maxWidth: 760, maxHeight: "88vh" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {item.icon ? <img src={getIconUrl(item.icon)} alt="" style={{ width: 40, height: 40, objectFit: "contain", flexShrink: 0 }} /> : null}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: colors.text }}>{item.name}</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                {summaryStatLabel ? <span style={{ fontSize: 12, color: colors.positive, fontWeight: 700 }}>Per level {summaryStatLabel}</span> : null}
                {item.maxLevel != null ? <span style={{ fontSize: 12, color: colors.muted }}>Max level {fmt(item.maxLevel)}</span> : null}
                {item.waveReq != null ? <span style={{ fontSize: 12, color: colors.accent }}>Requirement {fmt(item.waveReq)}</span> : null}
                {totalCost != null ? <span style={{ fontSize: 12, color: colors.gold }}>Total cost {fmt(totalCost)}</span> : null}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: colors.muted, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ padding: "16px 20px", overflow: "auto", display: "grid", gap: 12 }}>
          {displayedMaxLevel < maxLevel ? (
            <div style={{ fontSize: 12, color: colors.muted }}>Showing the first {fmt(displayedMaxLevel)} levels of {fmt(maxLevel)}.</div>
          ) : null}

          <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: colors.panel, position: "sticky", top: 0 }}>
                <tr>
                  <th style={{ padding: "8px 12px", textAlign: "left", color: colors.muted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${colors.border}` }}>Level</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", color: colors.gold, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${colors.border}` }}>Cost</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", color: colors.text, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${colors.border}` }}>Total Cost</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", color: colors.positive, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${colors.border}` }}>Bonus</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.level} style={{ background: index % 2 === 0 ? "transparent" : `${colors.panel}66` }}>
                    <td style={{ padding: "8px 12px", color: colors.accent, fontWeight: 700 }}>Level {fmt(row.level)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: colors.gold, fontFamily: "monospace" }}>{row.costLabel}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: colors.text, fontFamily: "monospace" }}>{row.cumulativeLabel}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: colors.positive, fontWeight: 700 }}>{row.bonusLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// RANK EXP FORMULA  (replaces 6000-row sheet)
// ─────────────────────────────────────────────
function rankExpForLevel(lvl) {
  let v = 1000 * Math.pow(lvl - 1, 3);
  if (lvl > 2)    v *= (1 + lvl          * 0.05);
  if (lvl > 100)  v *= (1 + (lvl - 100)  * 0.02);
  if (lvl > 250)  v *= (1 + (lvl - 250)  * 0.01);
  if (lvl > 400)  v *= (1 + (lvl - 400)  * 0.01);
  if (lvl > 500)  v *= (1 + (lvl - 500)  * 0.01);
  if (lvl > 1000) v *= (1 + (lvl - 1000) * 0.01);
  if (lvl > 1500) v *= (1 + (lvl - 1500) * 0.02);
  if (lvl > 2000) v *= (1 + (lvl - 2000) * 0.03);
  if (lvl > 2500) v *= (1 + (lvl - 2500) * 0.05);
  if (lvl > 3000) v *= (1 + (lvl - 3000) * 0.07);
  if (lvl > 3500) v *= (1 + (lvl - 3500) * 0.10);
  if (lvl > 4250) v *= (1 + (lvl - 4250) * 0.13);
  if (lvl > 4500) v *= (1 + (lvl - 4500) * 0.15);
  if (lvl > 4750) v *= (1 + (lvl - 4750) * 0.20);
  if (lvl > 5000) v *= (1 + (lvl - 5000) * 0.25);
  if (lvl > 5250) v *= (1 + (lvl - 5250) * 0.30);
  if (lvl > 5500) v *= (1 + (lvl - 5500) * 0.40);
  if (lvl > 6000) v *= (1 + (lvl - 6000) * 0.50);
  return Math.round(v);
}

function RankExpView() {
  const fmt = useFmt();
  const [startInput, setStartInput] = useState("1");
  const [endInput, setEndInput] = useState("150");
  const [range, setRange] = useState({ start: 1, end: 150 });
  const [sortDir, setSortDir] = useState("asc");

  function clampLevel(value, fallback) {
    return Math.max(1, Number.parseInt(value, 10) || fallback);
  }

  function applyRange() {
    const nextStart = clampLevel(startInput, 1);
    const nextEndRaw = clampLevel(endInput, nextStart);
    const nextEnd = Math.max(nextStart, nextEndRaw);

    setStartInput(String(nextStart));
    setEndInput(String(nextEnd));
    setRange({ start: nextStart, end: nextEnd });
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      applyRange();
    }
  }

  const { rows, totalExp } = useMemo(() => {
    const nextRows = [];
    let cumulative = 0;

    for (let level = range.start; level <= range.end; level += 1) {
      const required = rankExpForLevel(level);
      cumulative += required;
      nextRows.push({ level, required, cumulative });
    }

    return {
      rows: nextRows,
      totalExp: nextRows.reduce((sum, row) => sum + row.required, 0),
    };
  }, [range]);

  const displayRows = useMemo(() => {
    const nextRows = [...rows];
    nextRows.sort((left, right) => (sortDir === "asc" ? left.level - right.level : right.level - left.level));
    return nextRows;
  }, [rows, sortDir]);

  const inputStyle = {
    background: "#0f2640",
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    color: colors.text,
    padding: "6px 10px",
    fontSize: 14,
    fontFamily: "inherit",
    width: 96,
    textAlign: "center",
    outline: "none",
  };
  const thMuted = {
    padding: "8px 12px",
    color: colors.muted,
    fontWeight: 700,
    fontSize: 11,
    textAlign: "right",
    borderBottom: `1px solid ${colors.border}`,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  };
  const thSortable = {
    ...thMuted,
    textAlign: "left",
    cursor: "pointer",
    userSelect: "none",
  };

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("_killExp.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Rank Exp</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Experience required for each rank level from the in-app formula.</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Levels</span>
        <input
          type="number"
          min={1}
          value={startInput}
          onChange={(event) => setStartInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={applyRange}
          style={inputStyle}
        />
        <span style={{ color: colors.muted, fontSize: 13 }}>to</span>
        <input
          type="number"
          min={1}
          value={endInput}
          onChange={(event) => setEndInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={applyRange}
          style={inputStyle}
        />
        <button
          onClick={applyRange}
          style={{
            background: colors.accent,
            color: "#000",
            border: "none",
            borderRadius: 6,
            padding: "6px 18px",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
            fontFamily: "inherit",
          }}
        >
          Apply
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "inline-block", background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 16px" }}>
          <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total Exp (Levels {range.start}-{range.end})</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.positive, fontFamily: "monospace" }}>{fmt(totalExp)}</div>
        </div>
      </div>

      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: colors.panel }}>
              <th onClick={() => setSortDir((current) => (current === "asc" ? "desc" : "asc"))} style={thSortable}>Level{sortDir === "asc" ? " ▲" : " ▼"}</th>
              <th style={thMuted}>Exp Required</th>
              <th style={thMuted}>Cumulative Exp</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, index) => (
              <tr key={row.level} style={{ background: index % 2 === 0 ? "transparent" : colors.panel + "60" }}>
                <td style={{ padding: "8px 12px", color: colors.text, fontWeight: 700 }}>Rank {row.level}</td>
                <td style={{ padding: "8px 12px", color: colors.gold, textAlign: "right", fontFamily: "monospace" }}>{fmt(row.required)}</td>
                <td style={{ padding: "8px 12px", color: colors.positive, textAlign: "right", fontFamily: "monospace" }}>{fmt(row.cumulative)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STAT DISPLAY HELPERS
// ─────────────────────────────────────────────
function formatStat(statAmt, statKey) {
  const info = STAT_UNITS[statKey];
  if (!info) return `+${statAmt}`;
  const { unit, negate } = info;
  const sign = negate ? "−" : "+";
  if (unit === "%") return `${sign}${statAmt}%`;
  if (unit === "x") return `×${statAmt}`;
  return `${sign}${statAmt} ${unit}`;
}

function formatStatTotal(totalAmt, statKey, fmt) {
  const info = STAT_UNITS[statKey];
  const unit = info?.unit ?? "";
  const negate = info?.negate ?? false;
  const formatted = fmt(totalAmt);
  const sign = negate ? "−" : "+";
  if (unit === "%") return `${sign}${formatted}%`;
  if (unit === "x") return `×${formatted}`;
  if (unit) return `${sign}${formatted} ${unit}`;
  return `${sign}${formatted}`;
}

function isProgressiveItem(item) {
  return item.formulaType === "progressive";
}

// Total stat at level N for a progressive item: statAmt × N × (N+1) / 2
function progressiveTotal(statAmt, level) {
  return statAmt * level * (level + 1) / 2;
}


// ─────────────────────────────────────────────
// COLORS  — based on in-game UI palette
// ─────────────────────────────────────────────
const colors = {
  bg:        "#1a3a5c",   // medium navy — matches game's blue background
  panel:     "#152e4a",   // slightly darker navy for header / tab bar
  border:    "#2a5a8a",   // visible but soft blue border
  accent:    "#f5921e",   // game orange (active tab / highlights)
  accentDim: "#7a440e",   // dim orange for group labels
  text:      "#e0f0ff",   // bright light-blue white body text
  muted:     "#7aaacf",   // lighter steel-blue for labels
  positive:  "#2ecc71",   // green for cumulative / positive values
  header:    "#1e4878",   // card background — lighter blue
  bannerBg:  "#2a5c96",   // section-group banner background
  bannerText:"#ffffff",   // section-group banner text
  gold:      "#ffd040",   // gold / currency colour
};

const ASTRAL_COLORS = {
  damage:  "#e05555",
  gold:    "#ffd040",
  exp:     "#4488ee",
  energy:  "#2ecc71",
  boss:    "#aa2020",
  skills:  "#33cccc",
  misc:    "#1a8c1a",
};

const ASTRAL_BATTLEGROUND_MAP = mapsData.maps.find((map) => map.id === "astral_battleground") ?? null;
const ASTRAL_ROTATION_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;
const ASTRAL_ROTATION_ANCHOR_MS = new Date(2026, 2, 19, 19, 0, 0, 0).getTime();
const ASTRAL_HELPFUL_NEGATIVE_KEYS = new Set(["skillCooldown", "spellCooldown"]);
const IMMORTAL_BOSS_NEXT_START_MS = new Date(2026, 2, 23, 18, 0, 0, 0).getTime();
const IMMORTAL_BOSS_INTERVAL_PATTERN_MS = [4 * 24 * 60 * 60 * 1000, 3 * 24 * 60 * 60 * 1000];
const IMMORTAL_BOSS_ROTATION_ITEMS = [
  { key: "none", label: "None", accentColor: "#7aaacf" },
  { key: "melee", label: "Melee", accentColor: "#e05555" },
  { key: "mage", label: "Mage", accentColor: "#7d7cff" },
  { key: "range", label: "Range", accentColor: "#2ecc71" },
];
const COMMUNITY_EVENT_NEXT_START_MS = new Date(2026, 2, 22, 18, 49, 0, 0).getTime();
const COMMUNITY_EVENT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const COMMUNITY_EVENT_ROTATION_ITEMS = [
  {
    key: "killAliensShadows",
    label: "Kill Aliens/Shadows",
    accentColor: "#f5921e",
    effects: [
      { label: "Focus", value: "Defeat Alien and Shadow enemies" },
      { label: "Typical rewards", value: "Alien Tech and Shadow Rune progress" },
    ],
  },
  {
    key: "gemsSpent",
    label: "Gems Spent",
    accentColor: "#33cccc",
    effects: [
      { label: "Focus", value: "Spend gems anywhere in the run" },
      { label: "Best fit", value: "Large upgrade or unlock pushes" },
    ],
  },
  {
    key: "enemyKills",
    label: "Enemy Kills",
    accentColor: "#2ecc71",
    effects: [
      { label: "Focus", value: "Any enemy kill counts toward progress" },
      { label: "Best fit", value: "High-wave farming and dense spawn maps" },
    ],
  },
  {
    key: "bpExperience",
    label: "BP Experience",
    accentColor: "#c58cff",
    effects: [
      { label: "Focus", value: "Gain battlepass experience" },
      { label: "Best fit", value: "Battlepass quests and passive BP gain" },
    ],
  },
];

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function formatAstralCountdown(ms) {
  if (ms <= 0) {
    return "0m";
  }

  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}m`);
  }

  return parts.join(" ");
}

function getPatternOffsetMs(pattern, stepsAheadFromNext) {
  let total = 0;

  for (let index = 0; index < stepsAheadFromNext; index += 1) {
    total += pattern[index % pattern.length];
  }

  return total;
}

function getUpcomingCycleSnapshot({ items, currentIndex, nextStartMs, getOffsetMs, now = Date.now() }) {
  if (!items.length) {
    return null;
  }

  const orderedEntries = Array.from({ length: items.length }, (_, offset) => {
    const item = items[(currentIndex + offset) % items.length];

    if (offset === 0) {
      return {
        item,
        isActive: true,
        timeUntilInactive: Math.max(0, nextStartMs - now),
      };
    }

    const activationMs = nextStartMs + getOffsetMs(offset - 1);
    return {
      item,
      isActive: false,
      timeUntilActive: Math.max(0, activationMs - now),
    };
  });

  return {
    currentItem: items[currentIndex],
    nextItem: items[(currentIndex + 1) % items.length],
    timeUntilNextChange: Math.max(0, nextStartMs - now),
    orderedEntries,
  };
}

function HeaderRotationPopover({ isMobile, title, accentColor, currentLabel, nextLabel, countdownMs, children }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonBorderColor = `${accentColor}77`;
  const buttonBackground = `linear-gradient(135deg, ${accentColor}30 0%, rgba(10, 24, 41, 0.78) 100%)`;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <div ref={rootRef} className="app-header-toolbar__group" style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen((current) => !current)}
        style={{
          minWidth: isMobile ? "100%" : 250,
          maxWidth: isMobile ? "100%" : 320,
          display: "grid",
          gap: 4,
          padding: "8px 12px",
          borderRadius: 14,
          border: `1px solid ${buttonBorderColor}`,
          background: buttonBackground,
          color: colors.text,
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
          boxShadow: isOpen ? `0 0 0 1px ${accentColor}55, 0 14px 34px rgba(0,0,0,0.25)` : "0 10px 24px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span className="app-header-toolbar__label" style={{ color: accentColor }}>{title}</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{isOpen ? "Hide" : "Open"}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: colors.text, lineHeight: 1.1 }}>{currentLabel}</div>
        <div style={{ fontSize: 11, color: colors.muted, lineHeight: 1.15 }}>
          {nextLabel} in <span style={{ color: accentColor, fontWeight: 800 }}>{formatAstralCountdown(countdownMs)}</span>
        </div>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: isMobile ? "min(100vw - 24px, 360px)" : 420,
            maxHeight: "min(70vh, 640px)",
            overflowY: "auto",
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 26%, ${colors.bg} 100%)`,
            boxShadow: "0 28px 70px rgba(0,0,0,0.4)",
            padding: 14,
            zIndex: 250,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function getAstralRotationSnapshot(now = Date.now()) {
  const variants = [...(ASTRAL_BATTLEGROUND_MAP?.astralVariants ?? [])].sort((left, right) => left.enumValue - right.enumValue);
  if (!variants.length) {
    return null;
  }

  const anchorIndex = variants.findIndex((variant) => variant.enumName === "skills");
  const baseIndex = anchorIndex >= 0 ? anchorIndex : 0;
  const elapsedSegments = Math.floor((now - ASTRAL_ROTATION_ANCHOR_MS) / ASTRAL_ROTATION_INTERVAL_MS);
  const currentIndex = positiveModulo(baseIndex + elapsedSegments, variants.length);
  const currentSegmentStart = ASTRAL_ROTATION_ANCHOR_MS + elapsedSegments * ASTRAL_ROTATION_INTERVAL_MS;
  const currentSegmentEnd = currentSegmentStart + ASTRAL_ROTATION_INTERVAL_MS;
  const orderedEntries = Array.from({ length: variants.length }, (_, offset) => {
    const variantIndex = (currentIndex + offset) % variants.length;
    const variant = variants[variantIndex];
    const isActive = offset === 0;
    const nextStart = isActive ? currentSegmentStart : currentSegmentStart + offset * ASTRAL_ROTATION_INTERVAL_MS;

    return {
      variant,
      isActive,
      nextStart,
      nextEnd: nextStart + ASTRAL_ROTATION_INTERVAL_MS,
      timeUntilActive: Math.max(0, nextStart - now),
      timeUntilInactive: isActive ? Math.max(0, currentSegmentEnd - now) : null,
    };
  });

  return {
    currentVariant: variants[currentIndex],
    nextVariant: variants[(currentIndex + 1) % variants.length],
    currentSegmentStart,
    currentSegmentEnd,
    timeUntilNextVariant: Math.max(0, currentSegmentEnd - now),
    orderedEntries,
  };
}

function getImmortalBossRotationSnapshot(now = Date.now()) {
  return getUpcomingCycleSnapshot({
    items: IMMORTAL_BOSS_ROTATION_ITEMS,
    currentIndex: 0,
    nextStartMs: IMMORTAL_BOSS_NEXT_START_MS,
    getOffsetMs: (stepsAheadFromNext) => getPatternOffsetMs(IMMORTAL_BOSS_INTERVAL_PATTERN_MS, stepsAheadFromNext),
    now,
  });
}

function getImmortalBossLeagueEffects(rotationKey) {
  if (rotationKey === "none") {
    return [
      { label: "Bronze", value: "No immunities" },
      { label: "Silver / Gold", value: "No class penalty" },
      { label: "Diamond", value: "No class disabled" },
    ];
  }

  const classLabel = rotationKey.charAt(0).toUpperCase() + rotationKey.slice(1);
  return [
    { label: "Bronze", value: `${classLabel} heroes unaffected` },
    { label: "Silver / Gold", value: `${classLabel} heroes deal -50% damage` },
    { label: "Diamond", value: `${classLabel} heroes cannot attack` },
  ];
}

function getCommunityEventSnapshot(now = Date.now()) {
  return getUpcomingCycleSnapshot({
    items: COMMUNITY_EVENT_ROTATION_ITEMS,
    currentIndex: COMMUNITY_EVENT_ROTATION_ITEMS.length - 1,
    nextStartMs: COMMUNITY_EVENT_NEXT_START_MS,
    getOffsetMs: (stepsAheadFromNext) => stepsAheadFromNext * COMMUNITY_EVENT_INTERVAL_MS,
    now,
  });
}

function AstralRotationWidget({ isMobile, now }) {
  const rotation = useMemo(() => getAstralRotationSnapshot(now), [now]);

  if (!rotation) {
    return null;
  }

  const currentColor = ASTRAL_COLORS[rotation.currentVariant.enumName] ?? colors.accent;

  return (
    <HeaderRotationPopover
      isMobile={isMobile}
      title="Astral Rotation"
      accentColor={currentColor}
      currentLabel={rotation.currentVariant.displayName}
      nextLabel={rotation.nextVariant.displayName}
      countdownMs={rotation.timeUntilNextVariant}
    >
      <div style={{ display: "grid", gap: 3, marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>Astral Battleground</div>
        <div style={{ fontSize: 12, color: colors.muted }}>
          Active group: <span style={{ color: currentColor, fontWeight: 800 }}>{rotation.currentVariant.displayName}</span>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {rotation.orderedEntries.map((entry) => {
          const accentColor = ASTRAL_COLORS[entry.variant.enumName] ?? colors.accent;
          const timingLabel = entry.isActive
            ? `Ends in ${formatAstralCountdown(entry.timeUntilInactive ?? 0)}`
            : `Active in ${formatAstralCountdown(entry.timeUntilActive)}`;

          return (
            <div
              key={entry.variant.enumName}
              style={{
                borderRadius: 12,
                border: `1px solid ${entry.isActive ? `${accentColor}88` : colors.border}`,
                background: entry.isActive ? `${accentColor}18` : "rgba(8, 17, 29, 0.18)",
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: accentColor }}>{entry.variant.displayName}</div>
                  <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{timingLabel}</div>
                </div>
                <div style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: entry.isActive ? accentColor : colors.muted }}>
                  {entry.isActive ? "Active Now" : "Upcoming"}
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {entry.variant.effects.map((effect, effectIndex) => {
                  const isPenalty = ASTRAL_HELPFUL_NEGATIVE_KEYS.has(effect.statKey) ? effect.amount > 0 : effect.amount < 0;
                  const sign = effect.amount > 0 ? "+" : "";
                  const unit = effect.unit === "pct" ? "%" : effect.unit === "flat" ? "" : ` ${effect.unit}`;

                  return (
                    <div key={`${entry.variant.enumName}-${effectIndex}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", paddingTop: effectIndex === 0 ? 0 : 6, borderTop: effectIndex === 0 ? "none" : `1px solid ${colors.border}33` }}>
                      <span style={{ fontSize: 12, color: colors.muted }}>{effect.statLabel}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: isPenalty ? "#ff8f8f" : colors.positive, textAlign: "right" }}>
                        {sign}{effect.amount}{unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </HeaderRotationPopover>
  );
}

function ImmortalBossRotationWidget({ isMobile, now }) {
  const rotation = useMemo(() => getImmortalBossRotationSnapshot(now), [now]);

  if (!rotation) {
    return null;
  }

  const currentColor = rotation.currentItem.accentColor;

  return (
    <HeaderRotationPopover
      isMobile={isMobile}
      title="Immortal Boss"
      accentColor={currentColor}
      currentLabel={rotation.currentItem.label}
      nextLabel={rotation.nextItem.label}
      countdownMs={rotation.timeUntilNextChange}
    >
      <div style={{ display: "grid", gap: 3, marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>Immortal Boss Immunity Rotation</div>
        <div style={{ fontSize: 12, color: colors.muted }}>
          Tuesdays and Saturdays · unlocks at wave {immortalBossData.availability.unlockWave.toLocaleString()}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        {immortalBossData.leagues.map((league) => (
          <div key={league.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "8px 10px", borderRadius: 10, border: `1px solid ${league.color}55`, background: `${league.color}14` }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: league.color }}>{league.name}</span>
            <span style={{ fontSize: 12, color: colors.text, textAlign: "right" }}>{league.id === 1 ? "No immunity" : league.id === 4 ? "Immune class disabled" : "Immune class -50% damage"}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {rotation.orderedEntries.map((entry) => {
          const timingLabel = entry.isActive
            ? `Changes in ${formatAstralCountdown(entry.timeUntilInactive ?? 0)}`
            : `Active in ${formatAstralCountdown(entry.timeUntilActive)}`;

          return (
            <div
              key={entry.item.key}
              style={{
                borderRadius: 12,
                border: `1px solid ${entry.isActive ? `${entry.item.accentColor}88` : colors.border}`,
                background: entry.isActive ? `${entry.item.accentColor}18` : "rgba(8, 17, 29, 0.18)",
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: entry.item.accentColor }}>{entry.item.label}</div>
                  <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{timingLabel}</div>
                </div>
                <div style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: entry.isActive ? entry.item.accentColor : colors.muted }}>
                  {entry.isActive ? "Current" : "Upcoming"}
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {getImmortalBossLeagueEffects(entry.item.key).map((effect, effectIndex) => (
                  <div key={`${entry.item.key}-${effect.label}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", paddingTop: effectIndex === 0 ? 0 : 6, borderTop: effectIndex === 0 ? "none" : `1px solid ${colors.border}33` }}>
                    <span style={{ fontSize: 12, color: colors.muted }}>{effect.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: effect.value.includes("No") || effect.value.includes("unaffected") ? colors.positive : "#ffb08f", textAlign: "right" }}>{effect.value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </HeaderRotationPopover>
  );
}

function CommunityEventRotationWidget({ isMobile, now }) {
  const rotation = useMemo(() => getCommunityEventSnapshot(now), [now]);

  if (!rotation) {
    return null;
  }

  const currentColor = rotation.currentItem.accentColor;

  return (
    <HeaderRotationPopover
      isMobile={isMobile}
      title="Community Event"
      accentColor={currentColor}
      currentLabel={rotation.currentItem.label}
      nextLabel={rotation.nextItem.label}
      countdownMs={rotation.timeUntilNextChange}
    >
      <div style={{ display: "grid", gap: 3, marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>Community Event Rotation</div>
        <div style={{ fontSize: 12, color: colors.muted }}>Weekly event cycle with one focus objective active at a time.</div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {rotation.orderedEntries.map((entry) => {
          const timingLabel = entry.isActive
            ? `Changes in ${formatAstralCountdown(entry.timeUntilInactive ?? 0)}`
            : `Active in ${formatAstralCountdown(entry.timeUntilActive)}`;

          return (
            <div
              key={entry.item.key}
              style={{
                borderRadius: 12,
                border: `1px solid ${entry.isActive ? `${entry.item.accentColor}88` : colors.border}`,
                background: entry.isActive ? `${entry.item.accentColor}18` : "rgba(8, 17, 29, 0.18)",
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: entry.item.accentColor }}>{entry.item.label}</div>
                  <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{timingLabel}</div>
                </div>
                <div style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: entry.isActive ? entry.item.accentColor : colors.muted }}>
                  {entry.isActive ? "Current" : "Upcoming"}
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {entry.item.effects.map((effect, effectIndex) => (
                  <div key={`${entry.item.key}-${effect.label}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", paddingTop: effectIndex === 0 ? 0 : 6, borderTop: effectIndex === 0 ? "none" : `1px solid ${colors.border}33` }}>
                    <span style={{ fontSize: 12, color: colors.muted }}>{effect.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: colors.text, textAlign: "right" }}>{effect.value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </HeaderRotationPopover>
  );
}

function RotationEventsBar({ isMobile }) {
  const [now, setNow] = useState(() => Date.now());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsExpanded(false);
    }
  }, [isMobile]);

  const eventWidgets = (
    <>
      <AstralRotationWidget isMobile={isMobile} now={now} />
      <ImmortalBossRotationWidget isMobile={isMobile} now={now} />
      <CommunityEventRotationWidget isMobile={isMobile} now={now} />
    </>
  );

  if (!isMobile) {
    return eventWidgets;
  }

  return (
    <div style={{ width: "100%", display: "grid", gap: 10 }}>
      <button
        onClick={() => setIsExpanded((current) => !current)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "9px 12px",
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          background: "linear-gradient(135deg, rgba(245, 146, 30, 0.18) 0%, rgba(10, 24, 41, 0.82) 100%)",
          color: colors.text,
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <span className="app-header-toolbar__label" style={{ color: colors.accent }}>Event Rotations</span>
          <span style={{ fontSize: 12, color: colors.muted }}>Show Astral, Immortal Boss, and Community Event timers</span>
        </span>
        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: colors.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>{isExpanded ? "Hide" : "Show"}</span>
      </button>

      {isExpanded && (
        <div style={{ display: "grid", gap: 10 }}>
          {eventWidgets}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
function AllSynergiesView() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("both");
  const [tier,  setTier]  = useState(new Set());
  const [hero,  setHero]  = useState("all");

  const allSynergies = useMemo(() => {
    const out = [];
    for (const hero of heroesData.heroes ?? []) {
      for (const s of hero.synergies ?? []) {
        out.push({ hero, synergy: s });
      }
    }
    return out;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSynergies.filter(({ hero: h, synergy }) => {
      if (scope !== "both" && synergy.scope !== scope) return false;
      if (tier.size > 0 && !tier.has(synergy.tier)) return false;
      if (hero  !== "all"  && h.id          !== hero)   return false;
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        synergy.description.toLowerCase().includes(q) ||
        synergy.name.toLowerCase().includes(q) ||
        synergy.type.toLowerCase().includes(q) ||
        [synergy.hero1, synergy.hero2, synergy.hero3].filter(Boolean).some(p => p.toLowerCase().includes(q))
      );
    });
  }, [query, scope, tier, hero, allSynergies]);

  const thStyle = { padding: "8px 12px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" };

  return (
    <div>
      <SearchBar value={query} onChange={setQuery} placeholder="Search by hero, bonus, or required hero…" />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <ScopeFilter value={scope} onChange={setScope} />
        <TierFilter  value={tier}  onChange={setTier} />
        <HeroDropdown value={hero} onChange={setHero} />
      </div>
      <div style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>
      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ position: "sticky", top: 0, background: colors.panel, zIndex: 1 }}>
            <tr>
              <th style={thStyle}>Hero</th>
              <th style={thStyle}>Tier</th>
              <th style={thStyle}>Rank Req</th>
              <th style={thStyle}>Required Heroes</th>
              <th style={thStyle}>Bonus</th>
              <th style={thStyle}>Scope</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ hero, synergy }, i) => {
              const rc = RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common;
              const tc = TIER_COLORS[synergy.tier] ?? TIER_COLORS.I;
              const partners = [synergy.hero1, synergy.hero2, synergy.hero3].filter(Boolean);
              return (
                <tr key={`${hero.id}-${synergy.synergyLevel}`} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 5, background: rc.bg, border: `1px solid ${rc.border}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {hero.heroIcon && <img src={getIconUrl(hero.heroIcon)} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />}
                      </div>
                      <span style={{ color: colors.text, fontWeight: 600, whiteSpace: "nowrap" }}>{hero.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text, borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{synergy.tier}</span>
                  </td>
                  <td style={{ padding: "8px 12px", color: colors.gold, fontWeight: 600 }}>{synergy.rankRequired > 0 ? synergy.rankRequired : "—"}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {partners.map(p => (
                        <span key={p} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "1px 7px", fontSize: 11, color: colors.text, textTransform: "capitalize" }}>{p}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 5, background: synergy.bgColor + "44", border: `1px solid ${synergy.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        <img src={getIconUrl(synergy.icon)} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
                      </div>
                      <span style={{ color: colors.text }}>{synergy.description}</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <Badge color={synergy.scope === "global" ? colors.positive : colors.accent}>{synergy.scope}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: colors.muted, fontSize: 14 }}>No synergies match your search.</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ALL MILESTONES VIEW
// ─────────────────────────────────────────────
function AllMilestonesView() {
  const [query,    setQuery]    = useState("");
  const [scope,    setScope]    = useState("both");
  const [minReq,   setMinReq]   = useState("");
  const [maxReq,   setMaxReq]   = useState("");

  const allMilestones = useMemo(() => {
    const out = [];
    for (const hero of heroesData.heroes ?? []) {
      for (const m of hero.milestones ?? []) {
        out.push({ hero, milestone: m });
      }
    }
    return out;
  }, []);

  const filtered = useMemo(() => {
    const q   = query.trim().toLowerCase();
    const min = minReq !== "" ? parseInt(minReq) : null;
    const max = maxReq !== "" ? parseInt(maxReq) : null;
    return allMilestones.filter(({ hero, milestone }) => {
      if (scope !== "both" && milestone.scope !== scope) return false;
      if (min !== null && milestone.requirement < min) return false;
      if (max !== null && milestone.requirement > max) return false;
      if (!q) return true;
      return (
        hero.name.toLowerCase().includes(q) ||
        milestone.description.toLowerCase().includes(q) ||
        milestone.name.toLowerCase().includes(q) ||
        milestone.type.toLowerCase().includes(q)
      );
    });
  }, [query, scope, minReq, maxReq, allMilestones]);

  const thStyle = { padding: "8px 12px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" };

  const reqInputStyle = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "5px 10px", fontSize: 13, fontFamily: "inherit",
    width: 90, textAlign: "center", outline: "none",
  };

  return (
    <div>
      <SearchBar value={query} onChange={setQuery} placeholder="Search by hero or bonus…" />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <ScopeFilter value={scope} onChange={setScope} />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Req Level</span>
          <input type="number" placeholder="Min" value={minReq} onChange={e => setMinReq(e.target.value)} style={reqInputStyle} />
          <span style={{ color: colors.muted, fontSize: 13 }}>–</span>
          <input type="number" placeholder="Max" value={maxReq} onChange={e => setMaxReq(e.target.value)} style={reqInputStyle} />
          {(minReq || maxReq) && (
            <button onClick={() => { setMinReq(""); setMaxReq(""); }} style={{ background: "none", border: "none", color: colors.muted, fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>
      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ position: "sticky", top: 0, background: colors.panel, zIndex: 1 }}>
            <tr>
              <th style={thStyle}>Hero</th>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Req Level</th>
              <th style={thStyle}>Bonus</th>
              <th style={thStyle}>Scope</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ hero, milestone }, i) => {
              const rc = RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common;
              return (
                <tr key={`${hero.id}-${milestone.milestone}`} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 5, background: rc.bg, border: `1px solid ${rc.border}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {hero.heroIcon && <img src={getIconUrl(hero.heroIcon)} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />}
                      </div>
                      <span style={{ color: colors.text, fontWeight: 600, whiteSpace: "nowrap" }}>{hero.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px", color: colors.accent, fontWeight: 700 }}>{milestone.milestone}</td>
                  <td style={{ padding: "8px 12px", color: colors.gold, fontWeight: 600 }}>{milestone.requirement.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 5, background: milestone.bgColor + "44", border: `1px solid ${milestone.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        <img src={getIconUrl(milestone.icon)} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
                      </div>
                      <span style={{ color: colors.text }}>{milestone.description}</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <Badge color={milestone.scope === "global" ? colors.positive : colors.accent}>{milestone.scope}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: colors.muted, fontSize: 14 }}>No milestones match your search.</div>
        )}
      </div>
    </div>
  );
}

const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Supreme"];

const RARITY_COLORS = {
  Common:    { bg: "#3a3a3a", border: "#c0bfc0", text: "#d8d8d8" },
  Uncommon:  { bg: "#1a3a1a", border: "#4dd44d", text: "#80e880" },
  Rare:      { bg: "#1a3535", border: "#33d4d5", text: "#66e0e1" },
  Epic:      { bg: "#1a2e50", border: "#5090d8", text: "#80b4f0" },
  Legendary: { bg: "#1a2240", border: "#4a7acc", text: "#80aaee" },
  Mythic:    { bg: "#4a2a10", border: "#f09040", text: "#ffbe80" },
  Supreme:   { bg: "#7a2020", border: "#ff8080", text: "#ffc4c4" },
};

const TIER_COLORS = {
  I:   { bg: "#1a3a1a", border: "#4dd44d", text: "#80e880" },
  II:  { bg: "#1a3535", border: "#33d4d5", text: "#66e0e1" },
  III: { bg: "#1a2e50", border: "#5090d8", text: "#80b4f0" },
  IV:  { bg: "#3a1a5a", border: "#a060e0", text: "#c090ff" },
  V:   { bg: "#4a2a10", border: "#f09040", text: "#ffbe80" },
  VI:  { bg: "#5a1a1a", border: "#ff6060", text: "#ffaaaa" },
};

function HeroModal({ hero, onClose }) {
  const [tab, setTab] = useState("milestones");
  const [mxpStart, setMxpStart] = useState(1);
  const [mxpEnd,   setMxpEnd]   = useState(10);
  const [mxpStartInput, setMxpStartInput] = useState("1");
  const [mxpEndInput,   setMxpEndInput]   = useState("10");
  const rc = RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common;

  const tabStyle = (key) => ({
    flex: 1, padding: "10px 0", background: "none", border: "none",
    borderBottom: tab === key ? `2px solid ${colors.accent}` : `2px solid transparent`,
    color: tab === key ? colors.accent : colors.muted,
    fontFamily: "inherit", fontWeight: tab === key ? 700 : 500,
    fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase",
    cursor: "pointer", transition: "color 0.15s",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div style={{
        background: colors.bg, border: `1px solid ${rc.border}`,
        borderRadius: 12, width: "100%", maxWidth: 680,
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        boxShadow: `0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px ${rc.border}22`,
      }}>

        {/* ── Hero Header ── */}
        <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${colors.border}`, display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{
            width: 64, height: 64, flexShrink: 0, borderRadius: 10,
            background: rc.bg, border: `2px solid ${rc.border}`,
            display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          }}>
            {hero.heroIcon
              ? <img src={getIconUrl(hero.heroIcon)} alt={hero.name} style={{ width: 60, height: 60, objectFit: "contain" }} />
              : <span style={{ fontSize: 24, fontWeight: 800, color: "#ffffff99" }}>{hero.name.charAt(0)}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: colors.text, letterSpacing: "0.04em" }}>{hero.name}</span>
              <Badge color={rc.border}>{hero.rarity}</Badge>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: hero.baseStats ? 6 : 0 }}>
              <span style={{ fontSize: 12, color: colors.muted, textTransform: "capitalize", fontWeight: 600 }}>{hero.class}</span>
            </div>
            {hero.baseStats && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { label: "Damage",    value: hero.baseStats.damage },
                  { label: "DPS",       value: hero.baseStats.dps },
                  { label: "Atk Speed", value: hero.baseStats.attackSpeed !== undefined ? `${hero.baseStats.attackSpeed}s` : undefined },
                  { label: "Range",     value: hero.baseStats.range },
                ].filter(s => s.value !== undefined).map(s => (
                  <div key={s.label} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "3px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.gold }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: colors.muted, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 4px", flexShrink: 0 }}>✕</button>
        </div>

        {/* ── Skill Block ── */}
        {hero.skill && (
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${colors.border}`, background: colors.panel + "88" }}>
            <div style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 700 }}>Skill</div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              {hero.skill.icon && (
                <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, background: "#0f2640", border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <img src={getIconUrl(hero.skill.icon)} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ color: colors.accent, fontWeight: 800, fontSize: 15 }}>{hero.skill.name}</span>
                  <span style={{ fontSize: 12, color: colors.muted, background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "1px 8px" }}>
                    {hero.skill.cooldown}s cooldown
                  </span>
                </div>
                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.5, marginBottom: 6 }}>{hero.skill.description}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {hero.skill.powerDescription && (
                    <div style={{ fontSize: 12, color: colors.muted }}>
                      <span style={{ color: colors.positive, fontWeight: 600 }}>Power: </span>{hero.skill.powerDescription}
                    </div>
                  )}
                  {hero.skill.durationDescription && (
                    <div style={{ fontSize: 12, color: colors.muted }}>
                      <span style={{ color: colors.gold, fontWeight: 600 }}>Duration: </span>{hero.skill.durationDescription}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Mastery Block ── */}
        {hero.masteryDescription && (
          <div style={{ padding: "10px 20px", borderBottom: `1px solid ${colors.border}` }}>
            <span style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginRight: 8 }}>Mastery</span>
            <span style={{ fontSize: 13, color: colors.text, lineHeight: 1.5 }}>{hero.masteryDescription}</span>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: `1px solid ${colors.border}`, flexShrink: 0, padding: "0 20px" }}>
          <button style={tabStyle("milestones")} onClick={() => setTab("milestones")}>
            Milestones <span style={{ fontSize: 11, opacity: 0.7 }}>({hero.milestones?.length ?? 0})</span>
          </button>
          <button style={tabStyle("synergies")} onClick={() => setTab("synergies")}>
            Synergies <span style={{ fontSize: 11, opacity: 0.7 }}>({hero.synergies?.length ?? 0})</span>
          </button>
          {hero.masteryExp && (
            <button style={tabStyle("masteryExp")} onClick={() => setTab("masteryExp")}>Mastery Exp</button>
          )}
        </div>

        {/* ── Tab Content ── */}
        <div style={{ overflowY: "auto", flex: 1 }}>

          {tab === "milestones" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, background: colors.panel }}>
                <tr>
                  {["#", "Req Level", "Bonus", "Scope"].map(h => (
                    <th key={h} style={{ padding: "8px 14px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(hero.milestones ?? []).map((m, i) => (
                  <tr key={m.milestone} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                    <td style={{ padding: "8px 14px", color: colors.accent, fontWeight: 700, fontSize: 14 }}>{m.milestone}</td>
                    <td style={{ padding: "8px 14px", color: colors.gold, fontWeight: 600 }}>{m.requirement.toLocaleString()}</td>
                    <td style={{ padding: "8px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: m.bgColor + "44", border: `1px solid ${m.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                          <img src={getIconUrl(m.icon)} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
                        </div>
                        <span style={{ color: colors.text }}>{m.description}</span>
                      </div>
                    </td>
                    <td style={{ padding: "8px 14px" }}>
                      <Badge color={m.scope === "global" ? colors.positive : colors.accent}>{m.scope}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "synergies" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, background: colors.panel }}>
                <tr>
                  {["Tier", "Rank Req", "Required Heroes", "Bonus", "Scope"].map(h => (
                    <th key={h} style={{ padding: "8px 14px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(hero.synergies ?? []).map((s, i) => {
                  const tc = TIER_COLORS[s.tier] ?? TIER_COLORS.I;
                  const partners = [s.hero1, s.hero2, s.hero3].filter(Boolean);
                  return (
                    <tr key={s.synergyLevel} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                      <td style={{ padding: "8px 14px" }}>
                        <span style={{ background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text, borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{s.tier}</span>
                      </td>
                      <td style={{ padding: "8px 14px", color: colors.gold, fontWeight: 600 }}>{s.rankRequired > 0 ? s.rankRequired : "—"}</td>
                      <td style={{ padding: "8px 14px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {partners.map(p => (
                            <span key={p} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "1px 7px", fontSize: 11, color: colors.text, textTransform: "capitalize" }}>{p}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "8px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: s.bgColor + "44", border: `1px solid ${s.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                            <img src={getIconUrl(s.icon)} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
                          </div>
                          <span style={{ color: colors.text }}>{s.description}</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 14px" }}>
                        <Badge color={s.scope === "global" ? colors.positive : colors.accent}>{s.scope}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {tab === "masteryExp" && (() => {
            const { baseAmount } = hero.masteryExp;
            const formula = heroesData.masteryExpFormula;
            const bps = formula?.breakpoints ?? [];

            function getMult(L) {
              let m = 1.0;
              for (const bp of bps) if (L >= bp.atLevel) m *= bp.multIncremental;
              return m;
            }
            function expAt(L) { return Math.round(baseAmount * 24 * L * getMult(L)); }

            const rows = [];
            let running = 0;
            for (let L = 1; L <= 10; L++) {
              const exp = expAt(L);
              running += exp;
              rows.push({ L, exp, running, repeat: false });
            }
            const repeatExp = expAt(11);
            rows.push({ L: 11, exp: repeatExp, running: null, repeat: true });

            const thS = { padding: "8px 14px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" };
            const total1to10 = rows.filter(r => !r.repeat).reduce((s, r) => s + r.exp, 0);
            const clamp = (v) => Math.max(1, Math.min(10, v));
            const s = clamp(mxpStart), e = clamp(Math.max(mxpEnd, mxpStart));
            const rangeTotal = rows.filter(r => !r.repeat && r.L >= s && r.L <= e).reduce((acc, r) => acc + r.exp, 0);
            const inputS = { background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.text, padding: "5px 8px", fontSize: 13, fontFamily: "inherit", width: 60, textAlign: "center", outline: "none" };
            function commitMxpStart() { const v = clamp(parseInt(mxpStartInput) || 1); setMxpStart(v); setMxpStartInput(String(v)); if (v > mxpEnd) { setMxpEnd(v); setMxpEndInput(String(v)); } }
            function commitMxpEnd()   { const v = clamp(Math.max(parseInt(mxpEndInput) || 1, mxpStart)); setMxpEnd(v); setMxpEndInput(String(v)); }
            return (<>
              <div style={{ padding: "12px 20px", borderBottom: `1px solid ${colors.border}`, background: colors.panel + "88" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total (1–10): </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: colors.gold }}>{total1to10.toLocaleString()}</span>
                  </div>
                  <div style={{ width: 1, height: 24, background: colors.border }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: colors.muted }}>From</span>
                    <input type="number" value={mxpStartInput} min={1} max={10} style={inputS}
                      onChange={e => setMxpStartInput(e.target.value)}
                      onBlur={commitMxpStart}
                      onKeyDown={e => e.key === "Enter" && commitMxpStart()} />
                    <span style={{ fontSize: 12, color: colors.muted }}>to</span>
                    <input type="number" value={mxpEndInput} min={1} max={10} style={inputS}
                      onChange={e => setMxpEndInput(e.target.value)}
                      onBlur={commitMxpEnd}
                      onKeyDown={e => e.key === "Enter" && commitMxpEnd()} />
                    <span style={{ fontSize: 12, color: colors.muted }}>= </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: colors.positive }}>{rangeTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ position: "sticky", top: 0, background: colors.panel }}>
                  <tr>
                    <th style={thS}>Level</th>
                    <th style={{ ...thS, textAlign: "right" }}>Exp Required</th>
                    <th style={{ ...thS, textAlign: "right" }}>Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.L} style={{ background: r.repeat ? colors.accentDim + "33" : i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                      <td style={{ padding: "8px 14px", color: r.repeat ? colors.accent : colors.text, fontWeight: 700 }}>
                        {r.repeat ? "Repeat" : r.L}
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: colors.gold, fontWeight: 600 }}>{r.exp.toLocaleString()}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: r.repeat ? colors.muted : colors.positive, fontWeight: 600 }}>
                        {r.repeat ? "∞" : r.running.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>);
          })()}

        </div>
      </div>
    </div>
  );
}

function HeroCard({ hero, onClick }) {
  const fmt = useFmt();
  const rc = RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common;
  return (
    <div onClick={onClick} style={{
      background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: 12,
      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      display: "flex",
      gap: 12,
      alignItems: "center",
      cursor: "pointer",
      transition: "border-color 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = rc.border}
      onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}
    >
      {/* Hero icon */}
      <div style={{
        width: 52, height: 52, flexShrink: 0, borderRadius: 8,
        background: rc.bg, border: `2px solid ${rc.border}`,
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}>
        {hero.heroIcon
          ? <img src={getIconUrl(hero.heroIcon)} alt={hero.name} style={{ width: 48, height: 48, objectFit: "contain" }} />
          : <span style={{ fontSize: 20, fontWeight: 800, color: "#ffffff99", textTransform: "uppercase", userSelect: "none" }}>{hero.name.charAt(0)}</span>
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
          <span style={{ color: colors.text, fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{hero.name}</span>
          <Badge color={rc.border}>{hero.rarity}</Badge>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: colors.muted, textTransform: "capitalize" }}>{hero.class}</span>
        </div>
        {hero.skill && (
          <div style={{ fontSize: 12, color: colors.muted }}>
            <span style={{ color: colors.accent, fontWeight: 600 }}>{hero.skill.name}</span>
            <span style={{ marginLeft: 6 }}>· {hero.skill.cooldown}s CD</span>
          </div>
        )}
        {hero.baseStats && (
          <div style={{ display: "flex", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
            {hero.baseStats.damage   !== undefined && <span style={{ fontSize: 11, color: colors.muted }}>DMG <span style={{ color: colors.gold, fontWeight: 700 }}>{hero.baseStats.damage}</span></span>}
            {hero.baseStats.attackSpeed !== undefined && <span style={{ fontSize: 11, color: colors.muted }}>SPD <span style={{ color: colors.gold, fontWeight: 700 }}>{hero.baseStats.attackSpeed}s</span></span>}
            {hero.baseStats.range    !== undefined && <span style={{ fontSize: 11, color: colors.muted }}>RNG <span style={{ color: colors.gold, fontWeight: 700 }}>{hero.baseStats.range}</span></span>}
          </div>
        )}
        {hero.unlockCost !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <img src={getIconUrl("_energy.png")} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} />
            <span style={{ fontSize: 13, color: colors.muted }}>Unlock: </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: colors.positive }}>{fmt(hero.unlockCost)}</span>
            <span style={{ fontSize: 13, color: colors.muted }}>·</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: colors.positive }}>{fmt(hero.unlockCost * 3)}</span>
            <span style={{ fontSize: 13, color: colors.muted }}>·</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: colors.positive }}>{fmt(hero.unlockCost * 9)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AllHeroesView() {
  const [selectedHero, setSelectedHero] = useState(null);
  const heroes = heroesData.heroes ?? [];

  // Group by rarity, preserving RARITY_ORDER
  const grouped = RARITY_ORDER.reduce((acc, r) => {
    const list = heroes.filter(h => h.rarity === r).sort((a, b) => a.order - b.order);
    if (list.length) acc[r] = list;
    return acc;
  }, {});

  // Any rarities not in RARITY_ORDER go at the end
  heroes.forEach(h => {
    if (!RARITY_ORDER.includes(h.rarity) && !grouped[h.rarity]) {
      grouped[h.rarity] = heroes.filter(x => x.rarity === h.rarity).sort((a, b) => a.order - b.order);
    }
  });

  return (
    <div>
      {Object.entries(grouped).map(([rarity, list]) => {
        const rc = RARITY_COLORS[rarity] ?? RARITY_COLORS.Common;
        return (
          <div key={rarity} style={{ marginBottom: 32 }}>
            <div style={{
              background: `linear-gradient(180deg, ${rc.bg}cc 0%, ${rc.bg}88 100%)`,
              border: `1px solid ${rc.border}`,
              borderRadius: 8,
              padding: "8px 20px",
              marginBottom: 14,
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: rc.text, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
                {rarity}
              </span>
            </div>
            <div className="hero-grid">
              {list.map(hero => <HeroCard key={hero.id} hero={hero} onClick={() => setSelectedHero(hero)} />)}
            </div>
          </div>
        );
      })}
      {selectedHero && <HeroModal hero={selectedHero} onClose={() => setSelectedHero(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// HERO GOLD COST VIEW
// ─────────────────────────────────────────────
function HeroGoldCostView() {
  const fmt = useFmt();
  const isMobile = useIsMobile();

  const STORAGE_KEY = "heroGoldCostInputs";
  const saved = useMemo(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }, []);

  const [startInput,    setStartInput]    = useState(saved.start        ?? "1");
  const [endInput,      setEndInput]      = useState(saved.end          ?? "10000");
  const [milestoneOnly, setMilestoneOnly] = useState(saved.milestoneOnly === "true");
  const [upgInputs,     setUpgInputs]     = useState(() => {
    const defaults = Object.fromEntries(HERO_GOLD_COST_SOURCES.map(s => [s.key, "0"]));
    return { ...defaults, ...(saved.upgrades || {}) };
  });

  const [isLoading, setIsLoading] = useState(false);

  const [params, setParams] = useState(() => {
    const start = Math.max(1, parseInt(saved.start) || 1);
    const end   = Math.max(start + 1, Math.min(parseInt(saved.end) || 10000, 50000));
    const upgrades = Object.fromEntries(HERO_GOLD_COST_SOURCES.map(s => [s.key, Math.min(Math.max(parseInt((saved.upgrades || {})[s.key]) || 0, 0), s.maxLevel)]));
    return { start, end, milestoneOnly: saved.milestoneOnly === "true", upgrades };
  });

  function clampUpg(val, max) { return Math.min(Math.max(parseInt(val) || 0, 0), max); }
  function setUpgInput(key, val) { setUpgInputs(prev => ({ ...prev, [key]: val })); }

  function apply() {
    const start = Math.max(1, parseInt(startInput) || 1);
    const end   = Math.max(start + 1, Math.min(parseInt(endInput) || 10000, 50000));
    const upgrades = Object.fromEntries(HERO_GOLD_COST_SOURCES.map(s => [s.key, clampUpg(upgInputs[s.key], s.maxLevel)]));
    setStartInput(String(start));
    setEndInput(String(end));
    setUpgInputs(Object.fromEntries(Object.entries(upgrades).map(([k, v]) => [k, String(v)])));
    const newParams = { start, end, milestoneOnly, upgrades };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ start: String(start), end: String(end), milestoneOnly: String(milestoneOnly), upgrades: Object.fromEntries(Object.entries(upgrades).map(([k, v]) => [k, String(v)])) }));
    setIsLoading(true);
    setTimeout(() => { setParams(newParams); setIsLoading(false); }, 30);
  }

  function clearAll() {
    setStartInput("1"); setEndInput("10000"); setMilestoneOnly(false);
    setUpgInputs(Object.fromEntries(HERO_GOLD_COST_SOURCES.map(s => [s.key, "0"])));
    setParams({ start: 1, end: 10000, milestoneOnly: false, upgrades: Object.fromEntries(HERO_GOLD_COST_SOURCES.map(s => [s.key, 0])) });
    localStorage.removeItem(STORAGE_KEY);
  }

  function handleKeyDown(e) { if (e.key === "Enter") apply(); }

  // Compute cost table using BigInt arithmetic
  const rows = useMemo(() => {
    const { start, end, milestoneOnly, upgrades } = params;
    // Original multiplier: 1.065 = 1065/1000
    const origNum = 1065n, origDen = 1000n;
    // Reduced multiplier via BigInt fractions.
    // Each source contributes (1 - level * statAmt / 100) to the factor.
    // statAmt is % per level (e.g. 0.5 means 0.5% per level).
    // Using scale DSCALE=200: contribution = (200 - level * statAmt*2) / 200
    // statAmt*2 is always an integer for statAmt in multiples of 0.5.
    const DSCALE = 200n;
    const contribs = HERO_GOLD_COST_SOURCES.map(s => BigInt(upgrades[s.key]) * BigInt(Math.round(s.statAmt * 2)));
    const factorNum = contribs.reduce((prod, c) => prod * (DSCALE - c), 1n);
    const factorDen = DSCALE ** BigInt(HERO_GOLD_COST_SOURCES.length);
    const redNum = 1000n * factorDen + 65n * factorNum;
    const redDen = 1000n * factorDen;

    function nextCost(prev, multNum, multDen) {
      // round((prev + BASE_COST) * multNum / multDen)
      const base = BigInt(HERO_GOLD_COST_BASE_COST);
      return (2n * (prev + base) * multNum + multDen) / (2n * multDen);
    }

    let origCost = BigInt(HERO_GOLD_COST_BASE_COST);
    let redCost  = BigInt(HERO_GOLD_COST_BASE_COST);
    let origCum  = 0n;
    let redCum   = 0n;
    const result = [];

    for (let lv = 1; lv <= end; lv++) {
      if (lv >= start && (!milestoneOnly || HERO_GOLD_COST_MILESTONE_LEVELS.has(lv))) {
        result.push({ level: lv, origCost, origCum, redCost, redCum, isMilestone: HERO_GOLD_COST_MILESTONE_LEVELS.has(lv) });
      }
      origCum  += origCost;
      redCum   += redCost;
      origCost  = nextCost(origCost, origNum, origDen);
      redCost   = nextCost(redCost,  redNum,  redDen);
    }
    return result;
  }, [params]);

  const hasReduction = HERO_GOLD_COST_SOURCES.some(s => (parseInt(upgInputs[s.key]) || 0) > 0);
  const redFactor   = HERO_GOLD_COST_SOURCES.reduce((f, s) => f * (1 - (parseInt(upgInputs[s.key]) || 0) * s.statAmt / 100), 1);

  const smallInput = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "5px 8px", fontSize: 13, fontFamily: "inherit",
    width: 68, textAlign: "center", outline: "none",
  };

  const sortedMilestoneLevels = useMemo(() => [...HERO_GOLD_COST_MILESTONE_LEVELS].sort((a, b) => a - b), []);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("_gold.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Hero Gold Cost</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Gold to level up heroes, with and without upgrade reductions</div>
        </div>
      </div>

      {/* Input tile */}
      <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>

          {/* Left: Range + milestone toggle */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: colors.text, marginBottom: 10 }}>Level Range</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>From</span>
                <input type="number" min={1} max={9999} value={startInput} onChange={e => setStartInput(e.target.value)} onKeyDown={handleKeyDown}
                  style={{ ...smallInput, width: 80 }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>To (max 50,000)</span>
                <input type="number" min={2} max={50000} value={endInput} onChange={e => setEndInput(e.target.value)} onKeyDown={handleKeyDown}
                  style={{ ...smallInput, width: 80 }} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 6 }}>
              <input type="checkbox" checked={milestoneOnly} onChange={e => setMilestoneOnly(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer", accentColor: colors.accent }} />
              <span style={{ fontSize: 13, color: colors.text }}>Milestone levels only</span>
            </label>
            <div style={{ fontSize: 11, color: colors.muted, paddingLeft: 24, lineHeight: 1.5 }}>
              {sortedMilestoneLevels.join("  ·  ")}
            </div>
          </div>

          {/* Right: Upgrade reductions */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: colors.text, marginBottom: 10, display: "flex", alignItems: "center" }}>
              Hero Level Cost Upgrades
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                <button onClick={() => setUpgInputs(Object.fromEntries(HERO_GOLD_COST_SOURCES.map(s => [s.key, String(s.maxLevel)])))}
                  style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}44`, color: colors.accent, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Max</button>
                <button onClick={() => setUpgInputs(Object.fromEntries(HERO_GOLD_COST_SOURCES.map(s => [s.key, "0"])))}
                  style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.muted, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Clear</button>
              </div>
            </div>
            {HERO_GOLD_COST_SOURCES.map(s => {
              const val = parseInt(upgInputs[s.key]) || 0;
              const over = val > s.maxLevel;
              const pct = (val * s.statAmt).toFixed(1);
              return (
                <div key={s.key} style={{ marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img src={getIconUrl(s.icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: colors.muted, minWidth: 60 }}>{s.label}</span>
                    <input type="number" min={0} max={s.maxLevel} value={upgInputs[s.key]} onChange={e => setUpgInput(s.key, e.target.value)} onKeyDown={handleKeyDown}
                      style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                    <span style={{ fontSize: 11, color: colors.muted }}>/ {s.maxLevel}</span>
                    <span style={{ fontSize: 11, color: parseFloat(pct) > 0 ? colors.positive : colors.muted, marginLeft: "auto" }}>
                      {parseFloat(pct) > 0 ? `−${pct}%` : "0%"}
                    </span>
                  </div>
                  {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {s.maxLevel}</div>}
                </div>
              );
            })}
            <div style={{ borderTop: `1px solid ${colors.border}44`, marginTop: 6, paddingTop: 6 }}>
              <span style={{ fontSize: 12, color: colors.muted }}>Total reduction: </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: hasReduction ? colors.positive : colors.muted }}>
                {hasReduction ? `−${((1 - redFactor) * 100).toFixed(2)}%` : "0%"}
              </span>
            </div>
          </div>
        </div>

        {/* Apply + Clear */}
        <div style={{ display: "flex", gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${colors.border}`, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={apply} style={{ background: colors.accent, color: "#000", border: "none", borderRadius: 6, padding: "8px 24px", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>Apply</button>
          <button onClick={clearAll} style={{ background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>Clear</button>
          <span style={{ fontSize: 11, color: "#e0a020", marginLeft: 4 }}>⚠ Large level ranges (e.g. 1–50,000) may take a moment to calculate.</span>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "28px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 6 }}>Calculating…</div>
            <div style={{ fontSize: 12, color: colors.muted }}>Computing gold costs, please wait.</div>
          </div>
        </div>
      )}

      {/* Row count */}
      <div style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>
        Showing {rows.length} level{rows.length !== 1 ? "s" : ""} · Levels {params.start}–{params.end}
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: colors.header }}>
              <th style={{ padding: "8px 12px", textAlign: "left",  color: colors.muted,     fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>Level</th>
              <th style={{ padding: "8px 12px", textAlign: "right", color: colors.gold,       fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>Cost</th>
              <th style={{ padding: "8px 12px", textAlign: "right", color: colors.gold,       fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>Cumulative</th>
              <th style={{ padding: "8px 12px", textAlign: "right", color: colors.positive,   fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>Cost (Reduced)</th>
              <th style={{ padding: "8px 12px", textAlign: "right", color: colors.positive,   fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>Cumulative (Reduced)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isEven     = i % 2 === 0;
              const highlight  = row.isMilestone && !params.milestoneOnly;
              const sameValues = !hasReduction;
              return (
                <tr key={row.level} style={{ background: highlight ? colors.accent + "11" : (isEven ? "transparent" : colors.panel + "88") }}>
                  <td style={{ padding: "6px 12px", color: highlight ? colors.accent : colors.text, fontWeight: highlight ? 700 : 400, borderBottom: `1px solid ${colors.border}22`, whiteSpace: "nowrap" }}>
                    {row.level}
                    {highlight && <span style={{ marginLeft: 6, fontSize: 10, color: colors.accent, background: colors.accent + "22", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>MILESTONE</span>}
                  </td>
                  <td style={{ padding: "6px 12px", textAlign: "right", color: colors.gold,   fontFamily: "monospace", borderBottom: `1px solid ${colors.border}22` }}>{fmt(row.origCost)}</td>
                  <td style={{ padding: "6px 12px", textAlign: "right", color: colors.muted,  fontFamily: "monospace", borderBottom: `1px solid ${colors.border}22` }}>{fmt(row.origCum)}</td>
                  <td style={{ padding: "6px 12px", textAlign: "right", color: sameValues ? colors.gold    : colors.positive, fontFamily: "monospace", borderBottom: `1px solid ${colors.border}22` }}>{fmt(row.redCost)}</td>
                  <td style={{ padding: "6px 12px", textAlign: "right", color: sameValues ? colors.muted   : colors.positive, fontFamily: "monospace", borderBottom: `1px solid ${colors.border}22` }}>{fmt(row.redCum)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ATTRIBUTES VIEW
// ─────────────────────────────────────────────
function AttributesView() {
  const fmt = useFmt();
  const isMobile = useIsMobile();
  const [modalAttr, setModalAttr] = useState(null);

  const groups = [
    { key: "personal", label: "Attributes (Personal)", desc: "Applies to the individual hero only." },
    { key: "global",   label: "Attributes (Global)",   desc: "Affects all heroes globally." },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("_attributePoints_0.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Attributes</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Attribute point upgrades per hero</div>
        </div>
      </div>

      {groups.map(group => (
        <div key={group.key} style={{ marginBottom: 36 }}>
          {/* Group header */}
          <div style={{
            background: `linear-gradient(180deg, #3a6eb0 0%, ${colors.bannerBg} 100%)`,
            border: `1px solid #4a7ec0`,
            borderRadius: 8, padding: "8px 20px", marginBottom: 14,
            textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: colors.bannerText, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{group.label}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>{group.desc}</div>
          </div>

          {/* Attribute cards — 2 col desktop, 1 col mobile */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 8 }}>
            {(heroAttributesData[group.key] ?? []).map(attr => {
              const statLine   = attr.statAmt !== undefined && attr.statKey
                ? isProgressiveItem(attr)
                  ? `+${attr.statAmt} × level (progressive)`
                  : `${formatStat(attr.statAmt, attr.statKey)} per level`
                : null;
              const maxLvl     = attr.maxLevel;
              const totalCost  = maxLvl != null ? fmt(computeTotalCost(attr, "hero_attr")) : null;
              const maxBenefit = maxLvl != null && attr.statAmt !== undefined && attr.statKey
                ? formatStatTotal(isProgressiveItem(attr) ? progressiveTotal(attr.statAmt, maxLvl) : attr.statAmt * maxLvl, attr.statKey, fmt) : null;
              const iconBg     = attr.bgColor     ?? "#1a4a8a";
              const iconBorder = attr.borderColor ?? colors.border;

              return (
                <div key={attr.id} onClick={() => setModalAttr(attr)}
                  style={{
                    background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8, padding: 12,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    display: "flex", gap: 12, alignItems: "center",
                    cursor: "pointer", transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}
                >
                  {/* Icon box */}
                  <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: iconBg, border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {attr.icon
                      ? <img src={getIconUrl(attr.icon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
                      : <span style={{ fontSize: 20, fontWeight: 800, color: "#ffffff99", textTransform: "uppercase", userSelect: "none" }}>{attr.name.charAt(0)}</span>
                    }
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Row 1: name + rank badge */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 3 }}>
                      <span style={{ color: colors.text, fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{attr.name}</span>
                      {attr.rankReq > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                          background: "#0f2640", border: `1px solid #2a5a8a`,
                          color: "#7aaacf", whiteSpace: "nowrap", flexShrink: 0,
                        }}>Rank {attr.rankReq.toLocaleString()}+</span>
                      )}
                    </div>

                    {/* Row 2: stat per level */}
                    {statLine && (
                      <div style={{ color: colors.positive, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{statLine}</div>
                    )}

                    {/* Row 3: cost info */}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, color: colors.muted }}>Base <span style={{ color: colors.gold, fontWeight: 700 }}>{attr.baseCost.toLocaleString()} × lvl</span></span>
                      {totalCost != null && (
                        <span style={{ fontSize: 13, color: colors.muted }}>Total <span style={{ color: colors.gold, fontWeight: 700 }}>{totalCost}</span></span>
                      )}
                      {maxBenefit && (
                        <span style={{ fontSize: 13, color: colors.muted }}>Max <span style={{ color: colors.positive, fontWeight: 700 }}>{maxBenefit}</span></span>
                      )}
                      {maxLvl == null && (
                        <span style={{ fontSize: 13, color: colors.muted }}>Levels <span style={{ color: colors.accent, fontWeight: 700 }}>∞</span></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {modalAttr && (
        <CostModal item={modalAttr} sectionFormula="hero_attr" onClose={() => setModalAttr(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAPS VIEW
// ─────────────────────────────────────────────
function MapModal({ map, onClose, mapPerkMult = 1 }) {
  const hasVariants = map.astralVariants?.length > 0;
  const [tab, setTab] = useState("perks");
  const [variantIdx, setVariantIdx] = useState(0);
  const [groupLevels, setGroupLevels] = useState(() => {
    try { return JSON.parse(localStorage.getItem("astral_group_levels") ?? "{}"); } catch { return {}; }
  });
  const setGroupLevel = (enumName, val) => {
    const next = { ...groupLevels, [enumName]: val };
    setGroupLevels(next);
    localStorage.setItem("astral_group_levels", JSON.stringify(next));
  };
  const totalUnlock      = map.perks.reduce((sum, p) => sum + (p.unlockCost ?? 0), 0);
  const totalUpgrades    = map.perks.reduce((sum, p) => {
    const bp = 5, uc = p.upgradeCost ?? p.baseCost;
    return sum + uc * Math.min(p.maxLevel, bp) + uc * 2 * Math.max(0, p.maxLevel - bp);
  }, 0);
  const grandTotal       = totalUnlock + totalUpgrades;
  const totalPlacement   = (mapsData.placementBonuses ?? []).reduce((sum, b) =>
    sum + b.baseCost * b.breakpoint + b.upgradeCostHigh * (b.maxLevel - b.breakpoint), 0);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, width: "100%", maxWidth: 560, height: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Modal header */}
        <div style={{ borderBottom: `1px solid ${colors.border}`, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, position: "relative", backgroundImage: `url(${getIconUrl(map.icon)})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,25,45,0.82)", pointerEvents: "none" }} />
          <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: colors.text }}>{map.name}</div>
            {map.waveRequirement > 0
              ? <div style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>Wave {map.waveRequirement.toLocaleString()} · {map.gemsToUnlock.toLocaleString()} Gems to unlock</div>
              : <div style={{ fontSize: 12, color: colors.positive, marginTop: 3 }}>Available from start</div>
            }
            <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
              {[
                { label: "Map Perks",  value: grandTotal },
                { label: "Placement",  value: totalPlacement },
                { label: "Total",      value: grandTotal + totalPlacement, highlight: true },
              ].map(({ label, value, highlight }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: highlight ? colors.accent : colors.gold }}>{value.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: colors.muted, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
          {[{ key: "perks", label: "Map Perks" }, { key: "placement", label: "Placement" }, ...(hasVariants ? [{ key: "variants", label: "Variants" }] : [])].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, background: "none", border: "none", borderBottom: tab === t.key ? `2px solid ${colors.accent}` : "2px solid transparent",
              color: tab === t.key ? colors.accent : colors.muted, fontFamily: "inherit", fontWeight: 700,
              fontSize: 13, padding: "10px 0", cursor: "pointer", transition: "color 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 0 }}>
          {tab === "perks" && <>
            {/* Perk list */}
            {map.perks.map(perk => {
              const unit = getPerkUnit(perk.name);
              const bp = 5;
              const uc = perk.upgradeCost ?? perk.baseCost;
              const rows = [];
              rows.push({ level: "Unlock", cost: perk.unlockCost ?? null, cumulative: perk.unlockCost ?? 0, bonus: perk.baseAmt });
              let cum = perk.unlockCost ?? 0;
              for (let lvl = 1; lvl <= perk.maxLevel; lvl++) {
                const stepCost = lvl <= bp ? uc : uc * 2;
                cum += stepCost;
                rows.push({ level: lvl, cost: stepCost, cumulative: cum, bonus: perk.baseAmt + perk.statAmt * lvl });
              }
              const thStyle = { padding: "5px 8px", color: colors.muted, fontWeight: 700, fontSize: 12, borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.05em", textTransform: "uppercase" };
              return (
                <div key={perk.id} style={{ paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${colors.border}40` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>{perk.name}</span>
                      {perk.isDefault && <Badge color={colors.positive}>Default</Badge>}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {perk.waveReq > 0 && <Badge color={colors.accent}>Wave {(perk.waveReq / 1000).toFixed(0)}K</Badge>}
                      <Badge color={colors.muted}>Max Lv {perk.maxLevel}</Badge>
                    </div>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: colors.panel }}>
                        <th style={{ ...thStyle, textAlign: "left"  }}>Level</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Total Cost</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>
                          Bonus{mapPerkMult > 1.0001 ? <span style={{ color: colors.positive, fontWeight: 400 }}> ×{mapPerkMult.toFixed(2)}</span> : ""}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const boosted = r.bonus * mapPerkMult;
                        const boostedStr = Number.isInteger(Math.round(boosted * 10) / 10)
                          ? String(Math.round(boosted))
                          : boosted.toFixed(1);
                        return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "50" }}>
                          <td style={{ padding: "4px 8px", color: r.level === "Unlock" ? colors.muted : colors.accent, fontWeight: 600 }}>{r.level}</td>
                          <td style={{ padding: "4px 8px", textAlign: "right", color: r.cost ? colors.gold : colors.muted, fontFamily: "monospace" }}>{r.cost ?? "—"}</td>
                          <td style={{ padding: "4px 8px", textAlign: "right", color: colors.text, fontFamily: "monospace" }}>{r.cumulative}</td>
                          <td style={{ padding: "4px 8px", textAlign: "right", color: colors.positive, fontWeight: 600 }}>{boostedStr}{unit}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {map.negativePerk && (() => {
              const np = map.negativePerk;
              const unit = getPerkUnit(np.name);
              return (
                <div style={{ paddingTop: 14, marginTop: 4, borderTop: `1px solid #e0555533` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#e05555" }}>{np.name}</span>
                    <Badge color="#e05555">Penalty</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: colors.muted }}>
                    Per level <span style={{ color: "#e05555", fontWeight: 600 }}>{np.statAmt}{unit}</span>
                  </div>
                </div>
              );
            })()}
          </>}

          {tab === "variants" && hasVariants && (() => {
            const variant = map.astralVariants[variantIdx];
            const accentColor = ASTRAL_COLORS[variant.enumName] ?? "#b47aff";
            const groupPerk = map.perks.find(p => p.id.includes(variant.enumName));
            const rawGroupLv = parseInt(groupLevels[variant.enumName]) || 0;
            const groupLv = groupPerk ? Math.min(Math.max(0, rawGroupLv), groupPerk.maxLevel) : 0;
            const groupMult = groupPerk ? (1 + groupLv * groupPerk.statAmt / 100) : 1;
            const groupBonus = groupPerk ? groupLv * groupPerk.statAmt : 0;
            return (
              <>
                {/* Variant pill switcher */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {map.astralVariants.map((v, i) => {
                    const c = ASTRAL_COLORS[v.enumName] ?? "#b47aff";
                    const active = i === variantIdx;
                    return (
                      <button key={v.enumValue} onClick={() => setVariantIdx(i)} style={{
                        padding: "5px 12px", borderRadius: 20,
                        border: `1px solid ${active ? c : c + "44"}`,
                        background: active ? c + "55" : c + "11",
                        color: active ? "#fff" : c + "99",
                        fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", transition: "all 0.15s",
                      }}>{v.displayName.replace(/ Day$/i, "")}</button>
                    );
                  })}
                </div>
                {/* Selected variant effects */}
                <div style={{ padding: "12px 14px", background: colors.header, borderRadius: 8, border: `1px solid ${colors.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: accentColor, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{variant.displayName.replace(/ Day$/i, "")}</div>
                  {/* Group perk level input */}
                  {groupPerk && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${colors.border}40` }}>
                      <span style={{ fontSize: 12, color: colors.muted, flex: 1 }}>{groupPerk.name} Level</span>
                      <input
                        type="number"
                        min={0}
                        max={groupPerk.maxLevel}
                        value={groupLevels[variant.enumName] ?? ""}
                        onChange={e => setGroupLevel(variant.enumName, e.target.value)}
                        style={{
                          width: 52, background: colors.panel, border: `1px solid ${rawGroupLv > groupPerk.maxLevel ? "#e05555" : colors.border}`,
                          borderRadius: 6, color: colors.text, fontFamily: "inherit", fontSize: 13, padding: "3px 6px", textAlign: "center",
                        }}
                      />
                      <span style={{ fontSize: 12, color: colors.muted }}>/ {groupPerk.maxLevel}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: groupBonus > 0 ? accentColor : colors.muted, minWidth: 52, textAlign: "right" }}>
                        {groupBonus > 0 ? `+${groupBonus}% all` : "no bonus"}
                      </span>
                    </div>
                  )}
                  {variant.effects.map((ef, i) => {
                    const negativIsGood = new Set(["skillCooldown", "spellCooldown"]);
                    const isDebuff = negativIsGood.has(ef.statKey) ? ef.amount > 0 : ef.amount < 0;
                    const sign = ef.amount > 0 ? "+" : "";
                    const unitStr = ef.unit === "pct" ? "%" : "";
                    const rawAmt = isDebuff ? ef.amount : ef.amount * mapPerkMult * groupMult;
                    const displayAmt = Number.isInteger(Math.round(rawAmt * 10) / 10) ? Math.round(rawAmt) : parseFloat(rawAmt.toFixed(1));
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < variant.effects.length - 1 ? `1px solid ${colors.border}30` : "none" }}>
                        <span style={{ fontSize: 13, color: colors.muted }}>{ef.statLabel}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isDebuff ? "#e05555" : colors.positive }}>{sign}{displayAmt}{unitStr}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: colors.muted, fontStyle: "italic" }}>Astral Battleground groups rotate every 3 days.</div>
              </>
            );
          })()}

          {tab === "placement" && (() => {
            const bonuses = mapsData.placementBonuses ?? [];
            const thStyle = { padding: "4px 8px", color: colors.muted, fontWeight: 700, fontSize: 11, borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.05em", textTransform: "uppercase" };
            return (
              <>
                {bonuses.map(b => {
                  const unit = getPerkUnit(b.name);
                  const rows = [];
                  let cum = 0;
                  for (let lvl = 1; lvl <= b.maxLevel; lvl++) {
                    const stepCost = lvl <= b.breakpoint ? b.baseCost : b.upgradeCostHigh;
                    cum += stepCost;
                    rows.push({ level: lvl, cost: stepCost, cumulative: cum, bonus: b.statAmt * lvl });
                  }
                  return (
                    <div key={b.id} style={{ paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${colors.border}40` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{b.name}</span>
                        <Badge color={colors.muted}>Max Lv {b.maxLevel}</Badge>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: colors.panel }}>
                            <th style={{ ...thStyle, textAlign: "left"  }}>Level</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Total Cost</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Bonus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={r.level} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "50" }}>
                              <td style={{ padding: "4px 8px", color: colors.accent, fontWeight: 600 }}>{r.level}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", color: colors.gold, fontFamily: "monospace" }}>{r.cost}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", color: colors.text, fontFamily: "monospace" }}>{r.cumulative}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", color: b.statAmt < 0 ? "#e05555" : colors.positive, fontWeight: 600 }}>{b.statAmt < 0 ? "" : "+"}{r.bonus}{unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function MapCard({ map, onClick, isMobile, mapPerkMult = 1 }) {
  const isLocked = map.waveRequirement > 0;
  const iconUrl = getIconUrl(map.icon);
  const hasVariants = map.astralVariants?.length > 0;
  const [variantIdx, setVariantIdx] = useState(0);

  return (
    <div onClick={onClick} style={{
      border: `1px solid ${colors.border}`, borderRadius: 10, overflow: "hidden", cursor: "pointer",
      transition: "border-color 0.15s, box-shadow 0.15s",
      backgroundImage: `url(${iconUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      position: "relative",
      display: "flex", flexDirection: "column",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.boxShadow = `0 0 14px ${colors.accent}33`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Dark overlay so text stays readable */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,25,45,0.72)", pointerEvents: "none" }} />

      {/* Content sits above overlay — stacked on mobile, side-by-side on desktop */}
      <div style={{ position: "relative", zIndex: 1, padding: "16px", display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, flex: 1 }}>

        {/* Header block: name + unlock requirements */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: isMobile ? "none" : "0 0 160px" }}>
          <div style={{ fontWeight: 900, fontSize: isMobile ? 18 : 21, color: colors.text, lineHeight: 1.2 }}>{map.name}</div>
          {isLocked
            ? <>
                <Badge color={colors.accent}>Wave: {map.waveRequirement.toLocaleString()}</Badge>
                <Badge color="#e06aaa">Gems: {map.gemsToUnlock.toLocaleString()}</Badge>
              </>
            : <Badge color={colors.positive}>Available from start</Badge>
          }
          {hasVariants && <Badge color="#b47aff">Perks rotate Mon &amp; Thurs</Badge>}
        </div>

        {/* Divider — horizontal on mobile, vertical on desktop */}
        <div style={isMobile
          ? { height: 1, background: `${colors.border}60` }
          : { width: 1, background: `${colors.border}60`, flexShrink: 0 }
        } />

        {/* Perks / variants */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasVariants ? (() => {
            const variant = map.astralVariants[variantIdx];
            return (
              <>
                {/* Pill switcher */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }} onClick={e => e.stopPropagation()}>
                  {map.astralVariants.map((v, i) => {
                    const c = ASTRAL_COLORS[v.enumName] ?? "#b47aff";
                    const active = i === variantIdx;
                    return (
                      <button key={v.enumValue} onClick={() => setVariantIdx(i)} style={{
                        padding: "4px 10px", borderRadius: 20,
                        border: `1px solid ${active ? c : c + "44"}`,
                        background: active ? c + "55" : c + "11",
                        color: active ? "#fff" : c + "99",
                        fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", lineHeight: 1.4,
                      }}>{v.displayName.replace(/ Day$/i, "")}</button>
                    );
                  })}
                </div>
                {/* Effects */}
                {variant.effects.map((ef, i) => {
                  const isLast = i === variant.effects.length - 1;
                  const sign = ef.amount > 0 ? "+" : "";
                  const unitStr = ef.unit === "pct" ? "%" : "";
                  const col = isLast ? "#e05555" : colors.positive;
                  const rawAmt = isLast ? ef.amount : ef.amount * mapPerkMult;
                  const displayAmt = Number.isInteger(Math.round(rawAmt * 10) / 10) ? Math.round(rawAmt) : parseFloat(rawAmt.toFixed(1));
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 15, color: col }}>{ef.statLabel}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: col, flexShrink: 0 }}>{sign}{displayAmt}{unitStr}</span>
                    </div>
                  );
                })}
              </>
            );
          })() : (() => {
            const defaults = map.perks.filter(p => p.isDefault);
            return (
              <>
                <div style={{ fontSize: 13, fontWeight: 800, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Default Perks</div>
                {defaults.length === 0
                  ? <span style={{ fontSize: 15, color: colors.muted, fontStyle: "italic" }}>None</span>
                  : defaults.map(perk => {
                      const unit = getPerkUnit(perk.name);
                      const boosted = perk.baseAmt * mapPerkMult;
                      const boostedStr = Number.isInteger(Math.round(boosted * 10) / 10) ? String(Math.round(boosted)) : boosted.toFixed(1);
                      return (
                        <div key={perk.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 15, color: colors.positive }}>{perk.name}</span>
                          <span style={{ fontSize: 15, color: colors.positive, fontWeight: 700, flexShrink: 0 }}>{boostedStr}{unit}</span>
                        </div>
                      );
                    })
                }
                {map.negativePerk && (() => {
                  const unit = getPerkUnit(map.negativePerk.name);
                  return (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 15, color: "#e05555" }}>{map.negativePerk.name}</span>
                      <span style={{ fontSize: 15, color: "#e05555", fontWeight: 700, flexShrink: 0 }}>{map.negativePerk.statAmt}{unit}</span>
                    </div>
                  );
                })()}
              </>
            );
          })()}
        </div>

      </div>
      <div style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${colors.border}40`, padding: "6px 16px", textAlign: "center" }}>
        <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.05em" }}>Click for details</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
const MAP_PERK_UPGRADE_SOURCES = [
  { id: "runes", label: "Runes", statAmt: 2, maxLevel: 15, icon: "_rune_2.png" },
  { id: "mastery", label: "Mastery", statAmt: 5, maxLevel: 5, icon: "_mastery_2.png" },
  { id: "ultimus", label: "Ultimus", statAmt: 2, maxLevel: 15, icon: "token_red.png" },
];

function AllMapsView() {
  const [selectedMap, setSelectedMap] = useState(null);
  const isMobile = useIsMobile();

  const [mpLevels, setMpLevels] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mapPerkUpgrades"));
      if (saved && typeof saved === "object") return { runes: "", mastery: "", ultimus: "", ...saved };
    } catch {
      return { runes: "", mastery: "", ultimus: "" };
    }
    return { runes: "", mastery: "", ultimus: "" };
  });

  function setMpLevel(id, val) {
    setMpLevels(prev => {
      const next = { ...prev, [id]: val };
      localStorage.setItem("mapPerkUpgrades", JSON.stringify(next));
      return next;
    });
  }

  function setAllMax() {
    const next = Object.fromEntries(MAP_PERK_UPGRADE_SOURCES.map(u => [u.id, String(u.maxLevel)]));
    localStorage.setItem("mapPerkUpgrades", JSON.stringify(next));
    setMpLevels(next);
  }

  function isOverMax(id) {
    const src = MAP_PERK_UPGRADE_SOURCES.find(u => u.id === id);
    const n = parseInt(mpLevels[id]);
    return !isNaN(n) && mpLevels[id] !== "" && n > src.maxLevel;
  }

  const [wave35k, setWave35k] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mapPerkWave35k")) ?? false; } catch { return false; }
  });

  function toggleWave35k(val) {
    setWave35k(val);
    localStorage.setItem("mapPerkWave35k", JSON.stringify(val));
  }

  const mapPerkMult = MAP_PERK_UPGRADE_SOURCES.reduce((acc, upg) => {
    const lv = Math.min(Math.max(0, parseInt(mpLevels[upg.id]) || 0), upg.maxLevel);
    return acc * (1 + upg.statAmt * lv / 100);
  }, 1) * (wave35k ? 1.10 : 1);

  const hasBoost = mapPerkMult > 1.0001;
  const multDisplay = `+${((mapPerkMult - 1) * 100).toFixed(2)}%`;

  const smallInput = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "5px 8px", fontSize: 13, fontFamily: "inherit",
    width: 68, textAlign: "center", outline: "none",
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>All Maps</div>
        <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Click a map to see full perk details</div>
      </div>

      {/* Map Perk Upgrade Sources */}
      <div style={{ marginBottom: 20, display: "inline-block", minWidth: isMobile ? "100%" : 320 }}>
        <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>Map Perk Upgrades</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={setAllMax} style={{
                background: colors.accent + "22", border: `1px solid ${colors.accent}44`,
                color: colors.accent, borderRadius: 6, padding: "2px 12px",
                fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}>Max</button>
              <button onClick={() => { const z = { runes: "", mastery: "", ultimus: "" }; setMpLevels(z); localStorage.setItem("mapPerkUpgrades", JSON.stringify(z)); toggleWave35k(false); }} style={{
                background: "transparent", border: `1px solid ${colors.border}`,
                color: colors.muted, borderRadius: 6, padding: "2px 12px",
                fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}>Clear</button>
            </div>
          </div>

          {MAP_PERK_UPGRADE_SOURCES.map(upg => {
            const over = isOverMax(upg.id);
            const lv = Math.min(Math.max(0, parseInt(mpLevels[upg.id]) || 0), upg.maxLevel);
            const pct = upg.statAmt * lv;
            return (
              <div key={upg.id} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: colors.muted, minWidth: 70 }}>{upg.label}</span>
                  <input type="number" min={0} max={upg.maxLevel}
                    value={mpLevels[upg.id]}
                    onChange={e => setMpLevel(upg.id, e.target.value)}
                    style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }}
                  />
                  <span style={{ fontSize: 12, color: colors.muted }}>/ {upg.maxLevel}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: pct > 0 ? colors.positive : colors.muted, marginLeft: "auto" }}>+{pct}%</span>
                </div>
                {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 78 }}>Max is {upg.maxLevel}</div>}
              </div>
            );
          })}

          {/* Wave 35k checkbox */}
          <div style={{ marginBottom: 7 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={wave35k} onChange={e => toggleWave35k(e.target.checked)}
                style={{ width: 15, height: 15, cursor: "pointer", accentColor: colors.accent }} />
              <span style={{ fontSize: 13, color: colors.muted }}>Wave 35k+ Challenge on all 7 Maps</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: wave35k ? colors.positive : colors.muted, marginLeft: "auto" }}>+10%</span>
            </label>
          </div>

          <div style={{ borderTop: `1px solid ${colors.border}44`, marginTop: 6, paddingTop: 6 }}>
            <span style={{ fontSize: 13, color: colors.muted }}>Total bonus: </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: hasBoost ? colors.positive : colors.muted }}>{multDisplay}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 20, gridAutoRows: "minmax(200px, auto)" }}>
        {mapsData.maps.map(map => <MapCard key={map.id} map={map} isMobile={isMobile} mapPerkMult={mapPerkMult} onClick={() => setSelectedMap(map)} />)}
      </div>
      {selectedMap && <MapModal map={selectedMap} onClose={() => setSelectedMap(null)} mapPerkMult={mapPerkMult} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// RANK REQUIRED CALCULATOR
// ─────────────────────────────────────────────
function attrPointsForLevels(attr, targetLevel) {
  if (!targetLevel || targetLevel <= 0) return 0;
  const ml  = attr.maxLevel ?? 999999;
  const bp1 = Math.round(ml * 0.5);
  const bp2 = Math.round(ml * 0.8);
  const sumRange = (a, b) => b >= a ? (b - a + 1) * (a + b) / 2 : 0;
  const e1 = Math.min(bp1 - 1, targetLevel);
  const e2 = Math.min(bp2 - 1, targetLevel);
  return Math.round(
    attr.baseCost       * sumRange(1,    e1) +
    1.25  * attr.baseCost * sumRange(bp1,  e2) +
    1.875 * attr.baseCost * sumRange(bp2,  targetLevel)
  );
}

function rankForPoints(points) {
  if (points <= 0) return 1;
  return Math.ceil((-1 + Math.sqrt(1 + 8 * (points + 1))) / 2);
}

function RankRequiredView() {
  const fmt = useFmt();
  const isMobile = useIsMobile();
  const allAttrs = HERO_ATTRIBUTE_LIST;

  const RR_STORAGE_KEY = "rankRequiredLevels";

  const [levels, setLevels] = useState(() => {
    const defaults = Object.fromEntries(allAttrs.map(a => [a.id, ""]));
    try {
      const saved = JSON.parse(localStorage.getItem(RR_STORAGE_KEY));
      if (saved && typeof saved === "object") return { ...defaults, ...saved };
    } catch {
      return defaults;
    }
    return defaults;
  });

  function setLevel(id, val) {
    setLevels(prev => {
      const next = { ...prev, [id]: val };
      localStorage.setItem(RR_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const totalPoints = useMemo(() => {
    return allAttrs.reduce((sum, attr) => {
      const target = Math.min(parseInt(levels[attr.id]) || 0, attr.maxLevel ?? 999999);
      return sum + attrPointsForLevels(attr, target);
    }, 0);
  }, [allAttrs, levels]);

  const minRank    = rankForPoints(totalPoints);
  const rankExp    = rankExpForLevel(minRank);
  const hasInputs  = totalPoints > 0;

  const groups = [
    { key: "personal", label: "Personal Attributes" },
    { key: "global",   label: "Global Attributes" },
  ];

  function isInvalid(val, maxLvl) {
    const n = parseInt(val);
    if (val === "" || isNaN(n)) return false;
    return n < 0 || n > maxLvl;
  }

  function handleBlur(id, val, maxLvl) {
    const n = parseInt(val);
    if (val === "" || isNaN(n)) return;
    const clamped = Math.max(0, Math.min(n, maxLvl));
    setLevel(id, String(clamped));
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("_attributePoints_0.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Rank Required</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Enter your desired attribute levels to find the minimum rank needed.</div>
        </div>
      </div>

      {/* Result bar */}
      <div style={{ marginBottom: 24, background: colors.panel, border: `1px solid ${hasInputs ? colors.accent : colors.border}`, borderRadius: 10, padding: "16px 20px", display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Points Needed</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.gold }}>{totalPoints.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Minimum Rank</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: hasInputs ? colors.accent : colors.muted }}>{hasInputs ? minRank.toLocaleString() : "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>EXP to Reach Rank</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: hasInputs ? colors.positive : colors.muted }}>{hasInputs ? fmt(rankExp) : "—"}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => setLevels(prev => {
            const next = { ...prev };
            allAttrs.forEach(a => { if ((a.maxLevel ?? 999999) < 999999) next[a.id] = String(a.maxLevel); });
            return next;
          })} style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}66`, borderRadius: 6, color: colors.accent, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
            Max All
          </button>
          {hasInputs && (
            <button onClick={() => { const empty = Object.fromEntries(allAttrs.map(a => [a.id, ""])); setLevels(empty); localStorage.removeItem(RR_STORAGE_KEY); }}
              style={{ background: "none", border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.muted, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Attribute groups */}
      {groups.map(group => (
        <div key={group.key} style={{ marginBottom: 28 }}>
          <div style={{
            background: `linear-gradient(180deg, #3a6eb0 0%, ${colors.bannerBg} 100%)`,
            border: `1px solid #4a7ec0`, borderRadius: 8, padding: "8px 20px", marginBottom: 14,
            textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: colors.bannerText, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{group.label}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 8 }}>
            {(heroAttributesData[group.key] ?? []).map(attr => {
              const iconBg     = attr.bgColor     ?? "#1a4a8a";
              const iconBorder = attr.borderColor ?? colors.border;
              const maxLvl     = attr.maxLevel ?? 999999;
              const val        = levels[attr.id] ?? "";
              const invalid    = isInvalid(val, maxLvl);
              const target     = invalid ? 0 : Math.min(parseInt(val) || 0, maxLvl);
              const cost       = attrPointsForLevels(attr, target);
              const hasVal     = target > 0;

              return (
                <div key={attr.id} style={{
                  background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`,
                  border: `1px solid ${hasVal ? colors.accent + "88" : colors.border}`,
                  borderRadius: 8, padding: 12,
                  display: "flex", gap: 12, alignItems: "center",
                }}>
                  <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, background: iconBg, border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {attr.icon
                      ? <img src={getIconUrl(attr.icon)} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
                      : <span style={{ fontSize: 16, fontWeight: 800, color: "#ffffff99" }}>{attr.name.charAt(0)}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 4 }}>{attr.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <input
                        type="number" min={0} max={maxLvl}
                        placeholder={maxLvl >= 999999 ? "Level" : `Max: ${maxLvl}`}
                        value={val}
                        onChange={e => setLevel(attr.id, e.target.value)}
                        onBlur={e => handleBlur(attr.id, e.target.value, maxLvl)}
                        style={{
                          background: "#0f2640",
                          border: `1px solid ${invalid ? "#e05555" : hasVal ? colors.accent : colors.border}`,
                          borderRadius: 6, color: invalid ? "#e05555" : colors.text,
                          padding: "7px 10px", fontSize: 14, fontFamily: "inherit",
                          width: 110, textAlign: "center", outline: "none",
                        }}
                      />
                      {invalid && (
                        <span style={{ fontSize: 11, color: "#e05555" }}>Max {maxLvl}</span>
                      )}
                      {maxLvl < 999999 && (
                        <button onClick={() => setLevel(attr.id, String(maxLvl))} style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}66`, borderRadius: 5, color: colors.accent, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>Max</button>
                      )}
                      {hasVal && !invalid && (
                        <span style={{ fontSize: 12, color: colors.gold }}>{cost.toLocaleString()} pts</span>
                      )}
                    </div>
                  </div>
                  {attr.rankReq > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#0f2640", border: `1px solid #2a5a8a`, color: "#7aaacf", whiteSpace: "nowrap", flexShrink: 0 }}>
                      Rank {attr.rankReq.toLocaleString()}+
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// ULTIMUS TOKENS CALCULATOR
// ─────────────────────────────────────────────
function UltimusTokensView() {
  const isMobile = useIsMobile();

  const STORAGE_KEY = "ultimusTokensInputs";
  const saved = useMemo(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }, []);

  const [waveInput,     setWaveInput]     = useState(saved.wave     ?? "10000");
  const [prestigeInput, setPrestigeInput] = useState(saved.prestige ?? "0");
  const [techInput,     setTechInput]     = useState(saved.tech     ?? "0");
  const [tournInput,    setTournInput]    = useState(saved.tourn    ?? "0");
  const [gemsInput,     setGemsInput]     = useState(saved.gems     ?? "0");
  const [masteryInput,  setMasteryInput]  = useState(saved.mastery  ?? "0");
  const [chalChecked,   setChalChecked]   = useState(saved.chal === "true");
  const [iconChecked,   setIconChecked]   = useState(saved.icon === "true");
  const [bgChecked,     setBgChecked]     = useState(saved.bg   === "true");
  const [wpStacksInput, setWpStacksInput] = useState(saved.wpStacks ?? "0");

  const [params, setParams] = useState(() => ({
    wave:     Math.max(1, parseInt(saved.wave) || 10000),
    prestige: Math.min(Math.max(0, parseInt(saved.prestige) || 0), 10),
    tech:     Math.min(Math.max(0, parseInt(saved.tech)     || 0), 10),
    tourn:    Math.min(Math.max(0, parseInt(saved.tourn)    || 0), 10),
    gems:     Math.min(Math.max(0, parseInt(saved.gems)     || 0), 10),
    mastery:  Math.min(Math.max(0, parseInt(saved.mastery)  || 0), 5),
    chal: saved.chal === "true", icon: saved.icon === "true", bg: saved.bg === "true",
    wpStacks: Math.min(Math.max(0, parseInt(saved.wpStacks) || 0), 1),
  }));

  // WPE levels — shared localStorage key with Enemy HP / Wave Perks pages
  const [wpeLevels, setWpeLevels] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem("wavePerkEffectLevels")); if (s && typeof s === "object") return s; } catch { return Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, ""])); }
    return Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, ""]));
  });
  function setWpeLevel(key, val) {
    setWpeLevels(prev => { const next = { ...prev, [key]: val }; localStorage.setItem("wavePerkEffectLevels", JSON.stringify(next)); return next; });
  }
  const [snowLevel, setSnowLevelState] = useState(() => { try { return localStorage.getItem("wavePerkSnowLevel") ?? ""; } catch { return ""; } });
  function updateSnowLevel(val) { setSnowLevelState(val); localStorage.setItem("wavePerkSnowLevel", val); }
  const [mapSelection, setMapSelection] = useState(saved.mapSel ?? "none"); // "none" | "snow" | "astral"
  const [astralBossLevel, setAstralBossLevelState] = useState(() => {
    try { const g = JSON.parse(localStorage.getItem("astral_group_levels")); return g?.boss ?? ""; } catch { return ""; }
  });
  function updateAstralBossLevel(val) {
    setAstralBossLevelState(val);
    try { const g = JSON.parse(localStorage.getItem("astral_group_levels")) || {}; localStorage.setItem("astral_group_levels", JSON.stringify({ ...g, boss: val })); } catch { localStorage.setItem("astral_group_levels", JSON.stringify({ boss: val })); }
  }
  const [mpLevels] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem("mapPerkUpgrades")); if (s && typeof s === "object") return s; } catch { return { runes: "", mastery: "", ultimus: "" }; }
    return { runes: "", mastery: "", ultimus: "" };
  });

  function clamp(val, max) { return Math.min(Math.max(parseInt(val) || 0, 0), max); }

  function apply() {
    const next = {
      wave:     Math.max(1, parseInt(waveInput) || 1),
      prestige: clamp(prestigeInput, 10), tech:    clamp(techInput,     10),
      tourn:    clamp(tournInput,    10), gems:    clamp(gemsInput,     10),
      mastery:  clamp(masteryInput,  5),
      chal: chalChecked, icon: iconChecked, bg: bgChecked,
      wpStacks: clamp(wpStacksInput, 1),
    };
    setWaveInput(String(next.wave));
    setPrestigeInput(String(next.prestige)); setTechInput(String(next.tech));
    setTournInput(String(next.tourn));       setGemsInput(String(next.gems));
    setMasteryInput(String(next.mastery));   setWpStacksInput(String(next.wpStacks));
    setParams(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      wave: String(next.wave), prestige: String(next.prestige), tech: String(next.tech),
      tourn: String(next.tourn), gems: String(next.gems), mastery: String(next.mastery),
      chal: String(next.chal), icon: String(next.icon), bg: String(next.bg), wpStacks: String(next.wpStacks),
      mapSel: mapSelection,
    }));
  }

  function clear() {
    setWaveInput("10000"); setPrestigeInput("0"); setTechInput("0"); setTournInput("0");
    setGemsInput("0"); setMasteryInput("0"); setChalChecked(false); setIconChecked(false);
    setBgChecked(false); setWpStacksInput("0");
    setParams({ wave: 10000, prestige: 0, tech: 0, tourn: 0, gems: 0, mastery: 0, chal: false, icon: false, bg: false, wpStacks: 0 });
    localStorage.removeItem(STORAGE_KEY);
  }

  function handleKeyDown(e) { if (e.key === "Enter") apply(); }

  const result = useMemo(() => {
    const mapPerkMult = MAP_PERK_UPGRADE_SOURCES.reduce((acc, upg) => {
      const lv = Math.min(Math.max(0, parseInt(mpLevels[upg.id]) || 0), upg.maxLevel);
      return acc * (1 + upg.statAmt * lv / 100);
    }, 1);
    const snLv = Math.min(Math.max(0, parseInt(snowLevel) || 0), SNOW_FORT_WPE.maxLevel);
    const snowBonus = mapSelection === "snow" && snLv > 0 ? (SNOW_FORT_WPE.baseAmt + SNOW_FORT_WPE.statAmt * snLv) / 100 * mapPerkMult : 0;
    const astralBossLv = Math.min(Math.max(0, parseInt(astralBossLevel) || 0), 10);
    const astralBonus = mapSelection === "astral" ? 0.10 * (1 + astralBossLv * 10 / 100) : 0;
    const wpeMult = WAVE_PERK_EFFECT_SOURCES.reduce((acc, s) => {
      const lv = Math.min(Math.max(0, parseInt(wpeLevels[s.key]) || 0), s.maxLevel);
      return acc * (1 + lv * s.statAmt / 100);
    }, 1) * (1 + snowBonus);

    const baseTokens = Math.pow((Math.max(params.wave, 5000) - 5000) / 1000 + 1, 2) + 4;
    const mult =
      (1 + params.prestige * 0.15) *
      (1 + params.tech     * 0.05) *
      (1 + params.tourn    * 0.05) *
      (1 + params.gems     * 0.05) *
      (1 + params.mastery  * 0.10) *
      (params.chal ? 1.25 : 1) *
      (params.icon ? 1.25 : 1) *
      (params.bg   ? 1.25 : 1) *
      (1 + 0.1 * params.wpStacks * wpeMult) *
      (1 + astralBonus);

    return { baseTokens, mult, finalTokens: Math.round(baseTokens * mult), wpeMult, astralBonus };
  }, [params, wpeLevels, snowLevel, mpLevels, mapSelection, astralBossLevel]);

  const smallInput = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "5px 8px", fontSize: 13, fontFamily: "inherit",
    width: 68, textAlign: "center", outline: "none",
  };

  const upgrades = [
    { key: "prestige", icon: "_prestigePower.png", label: "Prestige",   val: prestigeInput, set: setPrestigeInput, max: 10, rate: 0.15 },
    { key: "tech",     icon: "_techPts_2.png", label: "Sup. Tech",  val: techInput,     set: setTechInput,     max: 10, rate: 0.05 },
    { key: "tourn",    icon: "_tournPts.png",  label: "Tournament", val: tournInput,    set: setTournInput,    max: 10, rate: 0.05 },
    { key: "gems",     icon: "_gem_2.png",     label: "Gems",       val: gemsInput,     set: setGemsInput,     max: 10, rate: 0.05 },
    { key: "mastery",  icon: "_mastery_2.png", label: "Mastery",    val: masteryInput,  set: setMasteryInput,  max: 5,  rate: 0.10 },
  ];

  const checkboxes = [
    { key: "chal", checked: chalChecked, set: setChalChecked, label: "Challenge: Ultimus Kills",     icon: "_boss.png" },
    { key: "icon", checked: iconChecked, set: setIconChecked, label: "Leaderboard Icon (Tech 14)",   icon: "_star.png" },
    { key: "bg",   checked: bgChecked,   set: setBgChecked,   label: "Background: Kill Ultimus",     icon: "killsUltimus.png" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("ultimusBoss.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Ultimus Tokens</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Token rewards from killing the Ultimus Boss</div>
        </div>
      </div>

      {/* Wave input */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Wave</span>
          <input type="number" min={1} value={waveInput} onChange={e => setWaveInput(e.target.value)} onKeyDown={handleKeyDown}
            style={{ ...smallInput, width: 110, fontSize: 14, padding: "7px 10px" }} />
        </div>
        {(parseInt(waveInput) || 0) < 5000 && (
          <div style={{ fontSize: 12, color: colors.gold, paddingBottom: 8 }}>Below wave 5000 — base tokens minimum is 5</div>
        )}
      </div>

      {/* Input tiles side by side */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: isMobile ? "wrap" : "nowrap" }}>
      <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 14px", flex: "0 0 auto", width: "50%" }}>
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <img src={getIconUrl("_token.png")} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: colors.text }}>Token Multipliers</span>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <button onClick={() => { setPrestigeInput("10"); setTechInput("10"); setTournInput("10"); setGemsInput("10"); setMasteryInput("5"); setWpStacksInput("1"); setChalChecked(true); setIconChecked(true); setBgChecked(true); }}
              style={{ background: colors.accent+"22", border: `1px solid ${colors.accent}44`, color: colors.accent, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Max</button>
            <button onClick={() => { setPrestigeInput("0"); setTechInput("0"); setTournInput("0"); setGemsInput("0"); setMasteryInput("0"); setWpStacksInput("0"); setChalChecked(false); setIconChecked(false); setBgChecked(false); }}
              style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.muted, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Clear</button>
          </div>
        </div>

        {/* Level upgrades */}
        {upgrades.map(({ key, icon, label, val, set, max, rate }) => {
          const over = (parseInt(val) || 0) > max;
          const pct  = (parseInt(val) || 0) * rate * 100;
          return (
            <div key={key} style={{ marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={getIconUrl(icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: colors.muted, minWidth: 110 }}>{label}</span>
                <input type="number" min={0} max={max} value={val} onChange={e => set(e.target.value)} onKeyDown={handleKeyDown}
                  style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                <span style={{ fontSize: 11, color: colors.muted }}>/ {max}</span>
                <span style={{ fontSize: 11, color: pct > 0 ? colors.positive : colors.muted, marginLeft: "auto" }}>×{(1 + (parseInt(val)||0) * rate).toFixed(2)}</span>
              </div>
              {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {max}</div>}
            </div>
          );
        })}

        {/* Wave Perk Stacks */}
        {(() => {
          const over = (parseInt(wpStacksInput) || 0) > 1;
          const stacks = Math.min(parseInt(wpStacksInput) || 0, 1);
          const wpMult = 1 + 0.1 * stacks * result.wpeMult;
          return (
            <div style={{ marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={getIconUrl("_wavePerkWaves2.png")} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: colors.muted, minWidth: 110 }}>Wave Perk Stacks</span>
                <input type="number" min={0} max={1} value={wpStacksInput} onChange={e => setWpStacksInput(e.target.value)} onKeyDown={handleKeyDown}
                  style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                <span style={{ fontSize: 11, color: colors.muted }}>/ 1</span>
                <span style={{ fontSize: 11, color: stacks > 0 ? colors.positive : colors.muted, marginLeft: "auto" }}>×{wpMult.toFixed(2)}</span>
              </div>
              {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is 1</div>}
              {stacks > 0 && <div style={{ fontSize: 10, color: colors.muted, paddingLeft: 26, marginTop: 2 }}>WPE mult: ×{result.wpeMult.toFixed(3)}</div>}
            </div>
          );
        })()}

        {/* Checkbox multipliers */}
        <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: 8, paddingTop: 10 }}>
          {checkboxes.map(({ key, checked, set, label, icon }) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
              <img src={getIconUrl(icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: colors.muted, flex: 1 }}>{label}</span>
              <input type="checkbox" checked={checked} onChange={e => set(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: checked ? colors.positive : colors.muted, minWidth: 40, textAlign: "right" }}>
                {checked ? "×1.25" : "×1.00"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* WPE tile */}
      <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 14px", flex: "1" }}>
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <img src={getIconUrl("flagSword.png")} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: colors.text }}>Wave Perk Effect Upgrades</span>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <button onClick={() => { const next = Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, String(s.maxLevel)])); setWpeLevels(next); localStorage.setItem("wavePerkEffectLevels", JSON.stringify(next)); updateSnowLevel(String(SNOW_FORT_WPE.maxLevel)); }}
              style={{ background: colors.accent+"22", border: `1px solid ${colors.accent}44`, color: colors.accent, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Max</button>
            <button onClick={() => { const next = Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, ""])); setWpeLevels(next); localStorage.setItem("wavePerkEffectLevels", JSON.stringify(next)); updateSnowLevel(""); }}
              style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.muted, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Clear</button>
          </div>
        </div>
        {WAVE_PERK_EFFECT_SOURCES.map(s => {
          const lv = parseInt(wpeLevels[s.key]) || 0;
          const over = lv > s.maxLevel;
          return (
            <div key={s.key} style={{ marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={getIconUrl(s.icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: colors.muted, minWidth: 110 }}>{s.label}</span>
                <input type="number" min={0} max={s.maxLevel} value={wpeLevels[s.key] ?? ""} onChange={e => setWpeLevel(s.key, e.target.value)} onKeyDown={handleKeyDown}
                  style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                <span style={{ fontSize: 11, color: colors.muted }}>/ {s.maxLevel}</span>
                <span style={{ fontSize: 11, color: colors.positive, marginLeft: "auto" }}>×{(1 + Math.min(lv, s.maxLevel) * s.statAmt / 100).toFixed(2)}</span>
              </div>
              {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {s.maxLevel}</div>}
            </div>
          );
        })}
        {/* Map selection */}
        <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${colors.border}44` }}>
          <div style={{ fontSize: 11, color: colors.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Active Map</div>
          <div style={{ display: "flex", gap: 12 }}>
            {[{ key: "snow", label: "Snow Fort", icon: "icon_snow.png" }, { key: "astral", label: "Astral Battleground", icon: "icon_astral.png" }].map(({ key, label, icon }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={mapSelection === key} onChange={e => setMapSelection(e.target.checked ? key : "none")} style={{ width: 14, height: 14, cursor: "pointer" }} />
                <img src={getIconUrl(icon)} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} />
                <span style={{ fontSize: 12, color: colors.muted }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Snow Fort */}
        {(() => {
          const inactive = mapSelection !== "snow";
          const over = snowLevel !== "" && parseInt(snowLevel) > SNOW_FORT_WPE.maxLevel;
          const snLv = Math.min(Math.max(0, parseInt(snowLevel) || 0), SNOW_FORT_WPE.maxLevel);
          const snRaw = snLv > 0 ? (SNOW_FORT_WPE.baseAmt + SNOW_FORT_WPE.statAmt * snLv) / 100 * (MAP_PERK_UPGRADE_SOURCES.reduce((acc, upg) => acc * (1 + upg.statAmt * Math.min(Math.max(0, parseInt(mpLevels[upg.id]) || 0), upg.maxLevel) / 100), 1)) : 0;
          return (
            <div style={{ marginBottom: 7, opacity: inactive ? 0.4 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={getIconUrl("icon_snow.png")} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: colors.muted, minWidth: 110 }}>Snow Fort</span>
                <input type="number" min={0} max={SNOW_FORT_WPE.maxLevel} value={snowLevel} onChange={e => updateSnowLevel(e.target.value)} onKeyDown={handleKeyDown}
                  style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                <span style={{ fontSize: 11, color: colors.muted }}>/ {SNOW_FORT_WPE.maxLevel}</span>
                <span style={{ fontSize: 11, color: inactive ? colors.muted : colors.positive, marginLeft: "auto" }}>×{(1 + (inactive ? 0 : snRaw)).toFixed(2)}</span>
              </div>
              {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {SNOW_FORT_WPE.maxLevel}</div>}
            </div>
          );
        })()}

        {/* Astral Boss Day */}
        {(() => {
          const inactive = mapSelection !== "astral";
          const over = astralBossLevel !== "" && parseInt(astralBossLevel) > 10;
          const lv = Math.min(Math.max(0, parseInt(astralBossLevel) || 0), 10);
          const bonus = 0.10 * (1 + lv * 10 / 100);
          return (
            <div style={{ marginBottom: 7, opacity: inactive ? 0.4 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={getIconUrl("icon_astral.png")} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: colors.muted, minWidth: 110 }}>Astral Boss Day</span>
                <input type="number" min={0} max={10} value={astralBossLevel} onChange={e => updateAstralBossLevel(e.target.value)} onKeyDown={handleKeyDown}
                  style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                <span style={{ fontSize: 11, color: colors.muted }}>/ 10</span>
                <span style={{ fontSize: 11, color: inactive ? colors.muted : colors.positive, marginLeft: "auto" }}>×{(1 + (inactive ? 0 : bonus)).toFixed(2)}</span>
              </div>
              {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is 10</div>}
              {!inactive && <div style={{ fontSize: 10, color: colors.muted, paddingLeft: 26, marginTop: 2 }}>Base +10% × Boss Group (1 + {lv}×10%)</div>}
            </div>
          );
        })()}

        <div style={{ borderTop: `1px solid ${colors.border}44`, marginTop: 6, paddingTop: 6 }}>
          <span style={{ fontSize: 11, color: colors.muted }}>WPE Multiplier: </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: result.wpeMult > 1.001 ? colors.positive : colors.muted }}>×{result.wpeMult.toFixed(3)}</span>
        </div>
      </div>
      </div>

      {/* Apply / Clear */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button onClick={apply} style={{
          background: colors.accent, color: "#000", border: "none", borderRadius: 6,
          padding: "8px 24px", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit",
        }}>Apply</button>
        <button onClick={clear} style={{
          background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 6,
          padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
        }}>Clear</button>
      </div>

      {/* Result cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "Base Tokens",     value: Math.round(result.baseTokens).toLocaleString(), color: colors.text, sub: `Wave ${params.wave}` },
          { label: "Total Multiplier", value: `×${result.mult.toFixed(4)}`,           color: colors.accent },
          { label: "Final Tokens",    value: result.finalTokens.toLocaleString(),     color: colors.gold,   big: true },
        ].map(({ label, value, color, sub, big }) => (
          <div key={label} style={{
            background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10,
            padding: "20px 16px", textAlign: "center", display: "flex", flexDirection: "column", gap: 6,
          }}>
            <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            {sub && <div style={{ fontSize: 11, color: colors.muted }}>{sub}</div>}
            <div style={{ fontSize: big ? 28 : 22, fontWeight: 800, color, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ENEMY HP CALCULATOR
// ─────────────────────────────────────────────
function LegacyEnemyHpView() {
  const fmt = useFmt();
  const isMobile = useIsMobile();

  const { enemy_hp_scaling, enemy_hp } = enemyHpData.playerStats;
  const wave_skip = enemyHpData.wave_skip_chance;

  const STORAGE_KEY = "enemyHpInputs";
  const savedInputs = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  }, []);

  const [waveInput,        setWaveInput]        = useState(savedInputs.wave        ?? "100");
  const [masteryInput,     setMasteryInput]     = useState(savedInputs.mastery     ?? "0");
  const [ultimusInput,     setUltimusInput]     = useState(savedInputs.ultimus     ?? "0");
  const [researchInput,    setResearchInput]    = useState(savedInputs.research    ?? "0");
  const [techInput,        setTechInput]        = useState(savedInputs.tech        ?? "0");
  const [runesInput,       setRunesInput]       = useState(savedInputs.runes       ?? "0");
  const [tournSkipInput,   setTournSkipInput]   = useState(savedInputs.tournSkip   ?? "0");
  const [runesSkipInput,   setRunesSkipInput]   = useState(savedInputs.runesSkip   ?? "0");
  const [playerIconChecked, setPlayerIconChecked] = useState(savedInputs.playerIcon === "true");
  const [wpStacksInput,    setWpStacksInput]    = useState(savedInputs.wpStacks    ?? "0");
  // WPE levels — shared localStorage key with Wave Perks page
  const [wpeLevels, setWpeLevels] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("wavePerkEffectLevels"));
      if (saved && typeof saved === "object") {
        const defaults = Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, ""]));
        return { ...defaults, ...saved };
      }
    } catch {
      return Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, ""]));
    }
    return Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, ""]));
  });

  function setWpeLevel(key, val) {
    setWpeLevels(prev => {
      const next = { ...prev, [key]: val };
      localStorage.setItem("wavePerkEffectLevels", JSON.stringify(next));
      return next;
    });
  }

  const [snowLevel, setSnowLevelState] = useState(() => {
    try { return localStorage.getItem("wavePerkSnowLevel") ?? ""; } catch { return ""; }
  });
  function updateSnowLevel(val) {
    setSnowLevelState(val);
    localStorage.setItem("wavePerkSnowLevel", val);
  }
  const [mpLevels, setMpLevels] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mapPerkUpgrades"));
      if (saved && typeof saved === "object") return { runes: "", mastery: "", ultimus: "", ...saved };
    } catch {
      return { runes: "", mastery: "", ultimus: "" };
    }
    return { runes: "", mastery: "", ultimus: "" };
  });
  function setMpLevel(id, val) {
    setMpLevels(prev => {
      const next = { ...prev, [id]: val };
      localStorage.setItem("mapPerkUpgrades", JSON.stringify(next));
      return next;
    });
  }

  const [params, setParams] = useState(() => {
    const w = Math.max(1, parseInt(savedInputs.wave) || 100);
    return { wave: w, mastery: parseInt(savedInputs.mastery) || 0, ultimus: parseInt(savedInputs.ultimus) || 0,
             research: parseInt(savedInputs.research) || 0, tech: parseInt(savedInputs.tech) || 0,
             runes: parseInt(savedInputs.runes) || 0, tournSkip: parseInt(savedInputs.tournSkip) || 0,
             runesSkip: parseInt(savedInputs.runesSkip) || 0,
             playerIcon: savedInputs.playerIcon === "true", wpStacks: parseInt(savedInputs.wpStacks) || 0 };
  });

  function clamp(val, max) { return Math.min(Math.max(parseInt(val) || 0, 0), max); }

  function apply() {
    const wave      = Math.max(1, parseInt(waveInput) || 1);
    const mastery   = clamp(masteryInput,   enemy_hp_scaling.sources[0].maxLevel);
    const ultimus   = clamp(ultimusInput,   enemy_hp_scaling.sources[1].maxLevel);
    const research  = clamp(researchInput,  enemy_hp.sources[0].maxLevel);
    const tech      = clamp(techInput,      enemy_hp.sources[1].maxLevel);
    const runes     = clamp(runesInput,     enemy_hp.sources[2].maxLevel);
    const tournSkip = clamp(tournSkipInput, wave_skip.sources[0].maxLevel);
    const runesSkip = clamp(runesSkipInput, wave_skip.sources[1].maxLevel);
    const wpStacks  = clamp(wpStacksInput,  5);
    const next = { wave, mastery, ultimus, research, tech, runes, tournSkip, runesSkip,
                   playerIcon: playerIconChecked, wpStacks };
    setWaveInput(String(wave));
    setMasteryInput(String(mastery));   setUltimusInput(String(ultimus));
    setResearchInput(String(research)); setTechInput(String(tech)); setRunesInput(String(runes));
    setTournSkipInput(String(tournSkip)); setRunesSkipInput(String(runesSkip));
    setWpStacksInput(String(wpStacks));
    setParams(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ wave: String(wave), mastery: String(mastery), ultimus: String(ultimus),
      research: String(research), tech: String(tech), runes: String(runes), tournSkip: String(tournSkip), runesSkip: String(runesSkip),
      playerIcon: String(playerIconChecked), wpStacks: String(wpStacks) }));
  }

  function clear() {
    setWaveInput("100"); setMasteryInput("0"); setUltimusInput("0");
    setResearchInput("0"); setTechInput("0"); setRunesInput("0");
    setTournSkipInput("0"); setRunesSkipInput("0");
    setPlayerIconChecked(false); setWpStacksInput("0");
    setParams({ wave: 100, mastery: 0, ultimus: 0, research: 0, tech: 0, runes: 0, tournSkip: 0, runesSkip: 0, playerIcon: false, wpStacks: 0 });
    localStorage.removeItem(STORAGE_KEY);
  }

  function handleKeyDown(e) { if (e.key === "Enter") apply(); }

  const result = useMemo(() => {
    const { startHp, moduloRates, waveRangeScales, enemyMultipliers } = enemyHpData;

    function getWaveRangeScale(w) {
      for (const entry of waveRangeScales) {
        if (entry.maxWave === null || w <= entry.maxWave) return entry.scale;
      }
      return 0.3;
    }
    function getBaseRate(w) {
      if (w % 10 === 0) return moduloRates.mod10;
      if (w % 5  === 0) return moduloRates.mod5;
      return moduloRates.default;
    }
    // simulate returns BigInt for manageable waves, or {logValue: number} when hp
    // exceeds Number.MAX_SAFE_INTEGER (at which point +4 is negligible vs hp,
    // so log-space accumulation is accurate and runs in microseconds).
    function simulate(targetWave, num12) {
      const SAFE = Number.MAX_SAFE_INTEGER;
      let hp = startHp;
      for (let w = 2; w <= targetWave; w++) {
        hp = Math.round((hp + 4) * (getBaseRate(w) * getWaveRangeScale(w) * num12 + 1));
        if (hp >= SAFE) {
          // Switch to log-space; +4/hp < 4.5e-16 relative error per step hereafter
          let logHp = Math.log10(hp);
          for (let i = w + 1; i <= targetWave; i++) {
            logHp += Math.log10(getBaseRate(i) * getWaveRangeScale(i) * num12 + 1);
          }
          return { logValue: logHp };
        }
      }
      return BigInt(Math.round(hp));
    }
    function mobsForWave(w) {
      const d = w % 10;
      return { mobCount: d === 0 ? 19 : 9 + d, hasBoss: d === 0 };
    }

    const num12    = (1 - params.mastery * 0.005) * (1 - params.ultimus * 0.005);
    const ehpMult  = (1 - params.research * enemy_hp.sources[0].amtPerLevel) *
                     (1 - params.tech     * enemy_hp.sources[1].amtPerLevel) *
                     (1 - params.runes    * enemy_hp.sources[2].amtPerLevel);

    const mapPerkMultCalc = MAP_PERK_UPGRADE_SOURCES.reduce((acc, upg) => {
      const lv = Math.min(Math.max(0, parseInt(mpLevels[upg.id]) || 0), upg.maxLevel);
      return acc * (1 + upg.statAmt * lv / 100);
    }, 1);
    const snowLvCalc = Math.min(Math.max(0, parseInt(snowLevel) || 0), SNOW_FORT_WPE.maxLevel);
    const snowBonusCalc = snowLvCalc > 0 ? (SNOW_FORT_WPE.baseAmt + SNOW_FORT_WPE.statAmt * snowLvCalc) / 100 * mapPerkMultCalc : 0;
    const wpeMult = WAVE_PERK_EFFECT_SOURCES.reduce((acc, s) => {
      const lv = Math.min(Math.max(0, parseInt(wpeLevels[s.key]) || 0), s.maxLevel);
      return acc * (1 + lv * s.statAmt / 100);
    }, 1) * (1 + snowBonusCalc);
    const wavePerkEhpBonus = params.wpStacks * (-0.05) * wpeMult;
    const playerIconMult   = params.playerIcon ? 0.9 : 1.0;
    const finalEhpMult     = ehpMult * (1 + wavePerkEhpBonus) * playerIconMult;

    const scalingPct     = (1 - num12)   * 100;
    const ehpPct         = (1 - ehpMult) * 100;
    const wavePerkEhpPct = wavePerkEhpBonus * 100;
    const playerIconPct  = (1 - playerIconMult) * 100;
    const skipChance  = params.tournSkip * wave_skip.sources[0].amtPerLevel +
                        params.runesSkip * wave_skip.sources[1].amtPerLevel;
    const effectiveWave = Math.max(1, Math.floor(params.wave * (1 - skipChance / 100)));

    const hp     = simulate(params.wave,  num12);
    const hpSkip = simulate(effectiveWave, num12);

    const logFinalEhpMult = Math.log10(finalEhpMult);

    function buildTypes(rawHp, wave) {
      const { mobCount, hasBoss } = mobsForWave(wave);
      return [
        { key: "normal", label: "Normal", mult: 1.0,                   count: mobCount },
        { key: "boss",   label: "Boss",   mult: enemyMultipliers.boss,  count: hasBoss ? 1 : 0 },
      ].map(t => {
        let perHp, totalHp;
        if (typeof rawHp === "bigint") {
          const PREC = 1_000_000_000_000n;
          const multBig = BigInt(Math.round(t.mult * finalEhpMult * 1e12));
          perHp   = (rawHp * multBig + PREC / 2n) / PREC;
          totalHp = perHp * BigInt(t.count);
        } else {
          // rawHp is {logValue}
          const logPerHp = rawHp.logValue + Math.log10(t.mult) + logFinalEhpMult;
          perHp   = { logValue: logPerHp };
          totalHp = { logValue: t.count > 0 ? logPerHp + Math.log10(t.count) : -Infinity };
        }
        return { ...t, hp: perHp, totalHp };
      });
    }

    const { mobCount, hasBoss } = mobsForWave(params.wave);
    const { mobCount: mobCountSkip, hasBoss: hasBossSkip } = mobsForWave(effectiveWave);

    function buildSpecialBosses(rawHp) {
      return [
        { key: "goldBoss",       label: "Goblin Hoarders", icon: "goldHoarder.png",    mult: enemyMultipliers.goldBoss },
        { key: "energyBoss",     label: "Power Mages",      icon: "energyBoss.png",     mult: enemyMultipliers.energyBoss },
        { key: "expBoss",        label: "Training Dummy",   icon: "expBoss.png",        mult: enemyMultipliers.expBoss },
        { key: "ultimus",        label: "Ultimus",          icon: "ultimusBoss.png",    mult: enemyMultipliers.ultimusMelee },
        { key: "ultimusSupreme", label: "Supreme Ultimus",  icon: "ultimusSupreme.png", mult: enemyMultipliers.ultimusSupreme },
      ].map(t => {
        let hp;
        if (typeof rawHp === "bigint") {
          const PREC = 1_000_000_000_000n;
          const multBig = BigInt(Math.round(t.mult * finalEhpMult * 1e12));
          hp = (rawHp * multBig + PREC / 2n) / PREC;
        } else {
          hp = { logValue: rawHp.logValue + Math.log10(t.mult) + logFinalEhpMult };
        }
        return { ...t, hp };
      });
    }

    return {
      baseHp: hp,
      types:         buildTypes(hp,     params.wave),
      typesSkip:     buildTypes(hpSkip, effectiveWave),
      specialBosses: buildSpecialBosses(hp),
      specialBossesSkip: buildSpecialBosses(hpSkip),
      scalingPct, ehpPct, wavePerkEhpPct, playerIconPct, skipChance, effectiveWave,
      mobCount, hasBoss, mobCountSkip, hasBossSkip, wpeMult, mapPerkMult: mapPerkMultCalc,
    };
  }, [enemy_hp.sources, params, wave_skip.sources, wpeLevels, snowLevel, mpLevels]);

  const smallInput = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "5px 8px", fontSize: 13, fontFamily: "inherit",
    width: 68, textAlign: "center", outline: "none",
  };
  const typeColors = { normal: "#a3e8b0", boss: "#f87171" };

  return (
    <div>
      {/* Wave input */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Wave</span>
          <input type="number" min={1} value={waveInput} onChange={e => setWaveInput(e.target.value)} onKeyDown={handleKeyDown}
            style={{ ...smallInput, width: 110, fontSize: 14, padding: "7px 10px" }} />
        </div>
      </div>

      {/* Two input tiles */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>

        {/* Left tile: Enemy HP + Scaling + Skip */}
        <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 14px" }}>

          {/* — Enemy HP — */}
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: colors.text }}>Enemy HP</span>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button onClick={() => { setResearchInput(String(enemy_hp.sources[0].maxLevel)); setTechInput(String(enemy_hp.sources[1].maxLevel)); setRunesInput(String(enemy_hp.sources[2].maxLevel)); setPlayerIconChecked(true); setWpStacksInput("5"); }} style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}44`, color: colors.accent, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Max</button>
              <button onClick={() => { setResearchInput("0"); setTechInput("0"); setRunesInput("0"); setPlayerIconChecked(false); setWpStacksInput("0"); }} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.muted, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Clear</button>
            </div>
          </div>
          {[
            { key: "res", icon: "_energy.png",    label: "Research", val: researchInput, set: setResearchInput, max: enemy_hp.sources[0].maxLevel, amtPer: enemy_hp.sources[0].amtPerLevel },
            { key: "tch", icon: "_techPts_2.png", label: "Tech",     val: techInput,     set: setTechInput,     max: enemy_hp.sources[1].maxLevel, amtPer: enemy_hp.sources[1].amtPerLevel },
            { key: "run", icon: "_rune_2.png",    label: "Runes",    val: runesInput,    set: setRunesInput,    max: enemy_hp.sources[2].maxLevel, amtPer: enemy_hp.sources[2].amtPerLevel },
          ].map(({ key, icon, label, val, set, max, amtPer }) => {
            const over = (parseInt(val) || 0) > max;
            const pct = (parseInt(val) || 0) * amtPer * 100;
            return (
              <div key={key} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <img src={getIconUrl(icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: colors.muted, minWidth: 80 }}>{label}</span>
                  <input type="number" min={0} max={max} value={val} onChange={e => set(e.target.value)} onKeyDown={handleKeyDown}
                    style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                  <span style={{ fontSize: 11, color: colors.muted }}>/ {max}</span>
                  <span style={{ fontSize: 11, color: pct > 0 ? colors.positive : colors.muted, marginLeft: "auto" }}>
                    {pct > 0 ? `−${pct.toFixed(1)}%` : "0.0%"}
                  </span>
                </div>
                {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {max}</div>}
              </div>
            );
          })}
          {/* Player Icon checkbox */}
          <div style={{ marginBottom: 7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src={getIconUrl("gems2.png")} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: colors.muted, minWidth: 80 }}>Player Icon</span>
              <input type="checkbox" checked={playerIconChecked} onChange={e => setPlayerIconChecked(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer" }} />
              <span style={{ fontSize: 11, color: playerIconChecked ? colors.positive : colors.muted, marginLeft: "auto" }}>
                {playerIconChecked ? "−10.0%" : "0.0%"}
              </span>
            </div>
          </div>
          {/* Wave Perk Stacks */}
          {(() => {
            const over = (parseInt(wpStacksInput) || 0) > 5;
            return (
              <div style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <img src={getIconUrl("_wavePerkWaves2.png")} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: colors.muted, minWidth: 80 }}>Wave Perk Stacks</span>
                  <input type="number" min={0} max={5} value={wpStacksInput} onChange={e => setWpStacksInput(e.target.value)} onKeyDown={handleKeyDown}
                    style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                  <span style={{ fontSize: 11, color: colors.muted }}>/ 5</span>
                  {(() => {
                    const stacks = Math.min(parseInt(wpStacksInput) || 0, 5);
                    const pct = stacks * 5 * result.wpeMult;
                    return (
                      <span style={{ fontSize: 11, color: stacks > 0 ? colors.positive : colors.muted, marginLeft: "auto" }}>
                        {stacks > 0 ? `−${pct.toFixed(1)}%` : "0.0%"}
                      </span>
                    );
                  })()}
                </div>
                {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is 5</div>}
              </div>
            );
          })()}
          <div style={{ borderTop: `1px solid ${colors.border}44`, marginTop: 6, paddingTop: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: colors.muted }}>Total reduction: </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: result.ehpPct > 0 ? colors.positive : colors.muted }}>
              {result.ehpPct > 0 ? `−${result.ehpPct.toFixed(2)}%` : "0.00%"}
            </span>
          </div>

          {/* — Enemy Scaling — */}
          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: colors.text }}>Enemy Scaling</span>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button onClick={() => { setMasteryInput(String(enemy_hp_scaling.sources[0].maxLevel)); setUltimusInput(String(enemy_hp_scaling.sources[1].maxLevel)); }} style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}44`, color: colors.accent, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Max</button>
              <button onClick={() => { setMasteryInput("0"); setUltimusInput("0"); }} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.muted, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Clear</button>
            </div>
          </div>
          {[
            { key: "mas", icon: "_mastery_2.png", label: "Mastery", val: masteryInput, set: setMasteryInput, max: enemy_hp_scaling.sources[0].maxLevel, amtPer: enemy_hp_scaling.sources[0].amtPerLevel },
            { key: "ult", icon: "token_red.png",  label: "Ultimus", val: ultimusInput, set: setUltimusInput, max: enemy_hp_scaling.sources[1].maxLevel, amtPer: enemy_hp_scaling.sources[1].amtPerLevel },
          ].map(({ key, icon, label, val, set, max, amtPer }) => {
            const over = (parseInt(val) || 0) > max;
            const pct = (parseInt(val) || 0) * amtPer * 100;
            return (
              <div key={key} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <img src={getIconUrl(icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: colors.muted, minWidth: 80 }}>{label}</span>
                  <input type="number" min={0} max={max} value={val} onChange={e => set(e.target.value)} onKeyDown={handleKeyDown}
                    style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                  <span style={{ fontSize: 11, color: colors.muted }}>/ {max}</span>
                  <span style={{ fontSize: 11, color: pct > 0 ? colors.positive : colors.muted, marginLeft: "auto" }}>
                    {pct > 0 ? `−${pct.toFixed(1)}%` : "0.0%"}
                  </span>
                </div>
                {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {max}</div>}
              </div>
            );
          })}
          <div style={{ borderTop: `1px solid ${colors.border}44`, marginTop: 6, paddingTop: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: colors.muted }}>Total reduction: </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: result.scalingPct > 0 ? colors.positive : colors.muted }}>
              {result.scalingPct > 0 ? `−${result.scalingPct.toFixed(2)}%` : "0.00%"}
            </span>
          </div>

          {/* — Enemy Skip Chance — */}
          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: colors.text }}>Enemy Skip Chance</span>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button onClick={() => { setTournSkipInput(String(wave_skip.sources[0].maxLevel)); setRunesSkipInput(String(wave_skip.sources[1].maxLevel)); }} style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}44`, color: colors.accent, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Max</button>
              <button onClick={() => { setTournSkipInput("0"); setRunesSkipInput("0"); }} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.muted, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Clear</button>
            </div>
          </div>
          {[
            { key: "ts", icon: "_tournPts.png", label: "Tournament", val: tournSkipInput, set: setTournSkipInput, max: wave_skip.sources[0].maxLevel, amtPer: wave_skip.sources[0].amtPerLevel },
            { key: "rs", icon: "_rune_2.png",   label: "Runes",      val: runesSkipInput, set: setRunesSkipInput, max: wave_skip.sources[1].maxLevel, amtPer: wave_skip.sources[1].amtPerLevel },
          ].map(({ key, icon, label, val, set, max, amtPer }) => {
            const over = (parseInt(val) || 0) > max;
            const pct = (parseInt(val) || 0) * amtPer * 100;
            return (
              <div key={key} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <img src={getIconUrl(icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: colors.muted, minWidth: 80 }}>{label}</span>
                  <input type="number" min={0} max={max} value={val} onChange={e => set(e.target.value)} onKeyDown={handleKeyDown}
                    style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                  <span style={{ fontSize: 11, color: colors.muted }}>/ {max}</span>
                  <span style={{ fontSize: 11, color: pct > 0 ? colors.gold : colors.muted, marginLeft: "auto" }}>{pct.toFixed(1)}%</span>
                </div>
                {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {max}</div>}
              </div>
            );
          })}
          <div style={{ borderTop: `1px solid ${colors.border}44`, marginTop: 6, paddingTop: 6 }}>
            <span style={{ fontSize: 12, color: colors.muted }}>Skip chance: </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: result.skipChance > 0 ? colors.gold : colors.muted }}>
              {result.skipChance.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Right tile: Wave Perk Effect Upgrades + Map Perk Upgrades */}
        <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 14px" }}>

          {/* — Wave Perk Effect Upgrades — */}
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <img src={getIconUrl("flagSword.png")} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: colors.text }}>Wave Perk Effect Upgrades</span>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button onClick={() => { const next = Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, String(s.maxLevel)])); setWpeLevels(next); localStorage.setItem("wavePerkEffectLevels", JSON.stringify(next)); updateSnowLevel(String(SNOW_FORT_WPE.maxLevel)); }} style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}44`, color: colors.accent, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Max</button>
              <button onClick={() => { const next = Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, ""])); setWpeLevels(next); localStorage.setItem("wavePerkEffectLevels", JSON.stringify(next)); updateSnowLevel(""); }} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.muted, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Clear</button>
            </div>
          </div>
          {WAVE_PERK_EFFECT_SOURCES.map(s => {
            const lv = parseInt(wpeLevels[s.key]) || 0;
            const over = lv > s.maxLevel;
            return (
              <div key={s.key} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <img src={getIconUrl(s.icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: colors.muted, minWidth: 80 }}>{s.label}</span>
                  <input type="number" min={0} max={s.maxLevel} value={wpeLevels[s.key] ?? ""} onChange={e => setWpeLevel(s.key, e.target.value)} onKeyDown={handleKeyDown}
                    style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                  <span style={{ fontSize: 11, color: colors.muted }}>/ {s.maxLevel}</span>
                  <span style={{ fontSize: 11, color: colors.positive, marginLeft: "auto" }}>×{(1 + Math.min(lv, s.maxLevel) * s.statAmt / 100).toFixed(2)}</span>
                </div>
                {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {s.maxLevel}</div>}
              </div>
            );
          })}
          {/* Snow Fort WPE row */}
          {(() => {
            const over = snowLevel !== "" && parseInt(snowLevel) > SNOW_FORT_WPE.maxLevel;
            const snLv = Math.min(Math.max(0, parseInt(snowLevel) || 0), SNOW_FORT_WPE.maxLevel);
            const snRaw = snLv > 0 ? (SNOW_FORT_WPE.baseAmt + SNOW_FORT_WPE.statAmt * snLv) / 100 * result.mapPerkMult : 0;
            return (
              <div style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <img src={getIconUrl("icon_snow.png")} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: colors.muted, minWidth: 80 }}>Snow Fort</span>
                  <input type="number" min={0} max={SNOW_FORT_WPE.maxLevel} value={snowLevel} onChange={e => updateSnowLevel(e.target.value)} onKeyDown={handleKeyDown}
                    style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                  <span style={{ fontSize: 11, color: colors.muted }}>/ {SNOW_FORT_WPE.maxLevel}</span>
                  <span style={{ fontSize: 11, color: colors.positive, marginLeft: "auto" }}>×{(1 + snRaw).toFixed(2)}</span>
                </div>
                {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {SNOW_FORT_WPE.maxLevel}</div>}
              </div>
            );
          })()}
          <div style={{ borderTop: `1px solid ${colors.border}44`, marginTop: 6, paddingTop: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: colors.muted }}>WPE Multiplier: </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: result.wpeMult > 1.001 ? colors.positive : colors.muted }}>×{result.wpeMult.toFixed(2)}</span>
          </div>

          {/* — Map Perk Upgrades — */}
          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <img src={getIconUrl("Icon_Map_0.png")} alt="" style={{ width: 15, height: 15, objectFit: "contain" }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: colors.text }}>Map Perk Upgrades</span>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button onClick={() => { const next = Object.fromEntries(MAP_PERK_UPGRADE_SOURCES.map(u => [u.id, String(u.maxLevel)])); setMpLevels(next); localStorage.setItem("mapPerkUpgrades", JSON.stringify(next)); }} style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}44`, color: colors.accent, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Max</button>
              <button onClick={() => { const next = Object.fromEntries(MAP_PERK_UPGRADE_SOURCES.map(u => [u.id, ""])); setMpLevels(next); localStorage.setItem("mapPerkUpgrades", JSON.stringify(next)); }} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.muted, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Clear</button>
            </div>
          </div>
          {MAP_PERK_UPGRADE_SOURCES.map(upg => {
            const over = mpLevels[upg.id] !== "" && parseInt(mpLevels[upg.id]) > upg.maxLevel;
            const lv = Math.min(Math.max(0, parseInt(mpLevels[upg.id]) || 0), upg.maxLevel);
            return (
              <div key={upg.id} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <img src={getIconUrl(upg.icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: colors.muted, minWidth: 80 }}>{upg.label}</span>
                  <input type="number" min={0} max={upg.maxLevel} value={mpLevels[upg.id]} onChange={e => setMpLevel(upg.id, e.target.value)} onKeyDown={handleKeyDown}
                    style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                  <span style={{ fontSize: 11, color: colors.muted }}>/ {upg.maxLevel}</span>
                  <span style={{ fontSize: 11, color: lv > 0 ? colors.positive : colors.muted, marginLeft: "auto" }}>+{upg.statAmt * lv}%</span>
                </div>
                {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {upg.maxLevel}</div>}
              </div>
            );
          })}
          <div style={{ borderTop: `1px solid ${colors.border}44`, marginTop: 6, paddingTop: 6 }}>
            <span style={{ fontSize: 12, color: colors.muted }}>Map perk multiplier: </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: result.mapPerkMult > 1.0001 ? colors.positive : colors.muted }}>{result.mapPerkMult.toFixed(4)}×</span>
          </div>
        </div>
      </div>

      {/* Apply + Clear */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button onClick={apply} style={{
          background: colors.accent, color: "#000", border: "none", borderRadius: 6,
          padding: "8px 24px", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit",
        }}>Apply</button>
        <button onClick={clear} style={{
          background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 6,
          padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
        }}>Clear</button>
      </div>

      {/* Info strip */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Base HP",    value: fmt(result.baseHp),                                                              color: colors.text },
          { label: "Mob Spawns", value: `${result.mobCount} normal${result.hasBoss ? " + 1 boss" : ""}`,                 color: colors.gold },
          ...(result.skipChance > 0 ? [{ label: "Est. Wave (with skip)", value: String(result.effectiveWave), color: colors.accent }] : []),
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "7px 14px" }}>
            <span style={{ fontSize: 11, color: colors.muted }}>{label} </span>
            <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Regular Wave Mobs */}
      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: "14px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Regular Wave Mobs</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
          {result.types.map((type, i) => {
            const isBoss     = type.key === "boss";
            const spawns     = isBoss ? result.hasBoss : true;
            const typeSkip   = result.typesSkip[i];
            const spawnsSkip = isBoss ? result.hasBossSkip : true;
            return (
              <div key={type.key} style={{
                background: colors.panel, border: `1px solid ${spawns ? colors.border : colors.border + "55"}`,
                borderRadius: 10, padding: "16px", textAlign: "center",
                display: "flex", flexDirection: "column", gap: 6, opacity: spawns ? 1 : 0.45,
              }}>
                <div style={{ fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{type.label}</div>
                <div style={{ fontSize: 11, color: colors.muted }}>
                  ×{type.mult} multiplier · {isBoss ? (spawns ? "1 boss" : "×0 waves only") : `${type.count} mobs`}
                </div>
                <div style={{ borderTop: `1px solid ${colors.border}33`, paddingTop: 8 }}>
                  <div style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Wave {params.wave} — Per mob</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: typeColors[type.key], fontFamily: "monospace", lineHeight: 1 }}>{fmt(type.hp)}</div>
                  {spawns && <>
                    <div style={{ fontSize: 11, color: colors.muted, marginTop: 6, marginBottom: 2 }}>Total this wave</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: typeColors[type.key], fontFamily: "monospace", lineHeight: 1 }}>{fmt(type.totalHp)}</div>
                  </>}
                </div>
                {result.skipChance > 0 && (
                  <div style={{ borderTop: `1px solid ${colors.gold}44`, paddingTop: 8, background: colors.gold + "08", borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: colors.gold, marginBottom: 4 }}>Est. Wave {result.effectiveWave} — Per mob</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: typeColors[type.key], fontFamily: "monospace", lineHeight: 1, opacity: 0.85 }}>{fmt(typeSkip.hp)}</div>
                    {spawnsSkip && <>
                      <div style={{ fontSize: 11, color: colors.muted, marginTop: 6, marginBottom: 2 }}>Total this wave</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: typeColors[type.key], fontFamily: "monospace", lineHeight: 1, opacity: 0.85 }}>{fmt(typeSkip.totalHp)}</div>
                    </>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Special Boss tiles */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 10 }}>
        {result.specialBosses.map((boss, i) => {
          const bossSkip = result.specialBossesSkip[i];
          return (
            <div key={boss.key} style={{
              background: colors.panel, border: `1px solid ${colors.border}`,
              borderRadius: 10, padding: "14px 10px", textAlign: "center",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <img src={getIconUrl(boss.icon)} alt="" style={{ width: 112, height: 112, objectFit: "contain", margin: "0 auto" }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, lineHeight: 1.2 }}>{boss.label}</div>
              <div style={{ fontSize: 10, color: colors.muted }}>×{boss.mult.toLocaleString()} mult</div>
              <div style={{ borderTop: `1px solid ${colors.border}33`, paddingTop: 8 }}>
                <div style={{ fontSize: 10, color: colors.muted, marginBottom: 3 }}>Wave {params.wave}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f87171", fontFamily: "monospace", lineHeight: 1 }}>{fmt(boss.hp)}</div>
              </div>
              {result.skipChance > 0 && (
                <div style={{ borderTop: `1px solid ${colors.gold}44`, paddingTop: 6, background: colors.gold + "08", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: colors.gold, marginBottom: 3 }}>Est. Wave {result.effectiveWave}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f87171", fontFamily: "monospace", lineHeight: 1, opacity: 0.85 }}>{fmt(bossSkip.hp)}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// IMMORTAL BRACKETS VIEW
// ─────────────────────────────────────────────
function ImmortalBracketsView() {
  const isMobile = useIsMobile();

  const { leagues, rewardTickets, promotion, immuneModifier, availability } = immortalBossData;
  const rankRanges = rewardTickets.rankPlayerRanges;

  // Upgrade inputs for getTournTrophies
  const [pvpTier,   setPvpTier]   = useState("1");
  const [supTech,   setSupTech]   = useState("0");
  const [gemsTourn, setGemsTourn] = useState("0");
  const [chalSyn,   setChalSyn]   = useState(false);
  const [iapActive, setIapActive] = useState(false);

  const ticketMult = iapActive ? 2 : 1;

  // getTournTrophies multiplier
  const tournMult = (() => {
    let m = 1.0;
    if (chalSyn)   m *= 1.25;
    m *= (1 + (parseInt(supTech)   || 0) * 0.05);
    m *= (1 + (parseInt(gemsTourn) || 0) * 0.10);
    return m;
  })();

  // Per-rank trophies array (8 values, rank 1..8)
  const calcTrophies = useMemo(() => {
    const tier = Math.max(1, parseInt(pvpTier) || 1);
    let maxT = Math.round(1000 * tier * tier * tournMult);
    let minT = Math.max(Math.round(1000 * (tier - 1) * (tier - 1) * tournMult), iapActive ? 200 : 100);
    if (iapActive) { maxT *= 2; minT *= 2; }
    return Array.from({ length: 8 }, (_, i) =>
      Math.round(maxT - i * (maxT - minT) / 7)
    );
  }, [pvpTier, tournMult, iapActive]);

  const inputSm = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "4px 8px", fontSize: 13, fontFamily: "inherit",
    width: 64, textAlign: "center", outline: "none",
  };

  const IMMUNE_LABELS = { immuneMelee: "Melee", immuneMage: "Mage", immuneRange: "Range", none: "None" };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("_boss.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Immortal Brackets</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
            Available {availability.days.join(" & ")} · Unlocks at wave {availability.unlockWave.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Top two tiles */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 18 }}>

        {/* Left tile: Trophy upgrade inputs */}
        <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>Tournament Trophy Upgrades</span>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button onClick={() => { setPvpTier(pvpTier); setSupTech("10"); setGemsTourn("10"); setChalSyn(true); setIapActive(true); }}
                style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}44`, color: colors.accent, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Max</button>
              <button onClick={() => { setSupTech("0"); setGemsTourn("0"); setChalSyn(false); setIapActive(false); }}
                style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.muted, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Clear</button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {/* PvP Tier */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src={getIconUrl("Icon_Trophy_0.png")} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: colors.muted, minWidth: 160 }}>Tournament Tier (1–35)</span>
              <input type="number" min={1} max={35} value={pvpTier} onChange={e => setPvpTier(e.target.value)} style={{ ...inputSm, width: 68 }} />
            </div>

            {/* Numeric upgrades */}
            {[
              { label: "Tech: Tournament Trophies",  icon: "_techPts_2.png", val: supTech,   set: setSupTech,   maxLv: 10, pct: "+5%"  },
              { label: "Gems: Tournament Trophies",  icon: "_gem_2.png",     val: gemsTourn, set: setGemsTourn, maxLv: 10, pct: "+10%" },
            ].map(s => {
              const v    = parseInt(s.val) || 0;
              const over = v > s.maxLv;
              return (
                <div key={s.label}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img src={getIconUrl(s.icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: colors.muted, minWidth: 160 }}>{s.label}</span>
                    <input type="number" min={0} max={s.maxLv} value={s.val} onChange={e => s.set(e.target.value)}
                      style={{ ...inputSm, width: 68, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                    <span style={{ fontSize: 11, color: colors.muted }}>/ {s.maxLv} &nbsp;{s.pct}/lv</span>
                  </div>
                  {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 2, paddingLeft: 26 }}>Max is {s.maxLv}</div>}
                </div>
              );
            })}

            {/* Checkboxes */}
            {[
              { label: "Synergy Challenge",                   sub: "×1.25 trophies",          val: chalSyn,   set: setChalSyn   },
              { label: "2x Tickets and Trophies (Temp or Perm)", sub: "×2 tickets / trophies",          val: iapActive, set: setIapActive },
            ].map(cb => (
              <label key={cb.label} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={cb.val} onChange={e => cb.set(e.target.checked)}
                  style={{ width: 15, height: 15, cursor: "pointer", accentColor: colors.accent, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: colors.text, minWidth: 160 }}>{cb.label}</span>
                <span style={{ fontSize: 11, color: colors.muted }}>({cb.sub})</span>
              </label>
            ))}

            {/* Computed */}
            <div style={{ borderTop: `1px solid ${colors.border}44`, paddingTop: 8, marginTop: 2, display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, color: colors.muted }}>
                Trophy mult: <span style={{ fontSize: 14, fontWeight: 700, color: colors.positive }}>{tournMult.toFixed(3)}×</span>
              </div>
              <div style={{ fontSize: 12, color: colors.muted }}>
                Rank 1: <span style={{ fontSize: 14, fontWeight: 700, color: colors.gold }}>{(calcTrophies[0] ?? 0).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 12, color: colors.muted }}>
                Rank 8: <span style={{ fontSize: 14, fontWeight: 700, color: colors.gold }}>{(calcTrophies[7] ?? 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right tile: Event info */}
        <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Immune Modifier Cycle</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {immuneModifier.cycle.map((m, i) => (
                <span key={i} style={{ fontSize: 12, background: colors.accent + "22", border: `1px solid ${colors.accent}44`, borderRadius: 5, padding: "3px 12px", color: colors.accent, fontWeight: 600 }}>
                  {IMMUNE_LABELS[m] ?? m}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>Rotates each event (Tue → Sat → …)</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Promotion / Demotion</div>
            <div style={{ fontSize: 12, color: colors.text, lineHeight: 1.9 }}>
              <span style={{ color: colors.positive, fontWeight: 700 }}>▲ Promote:</span> Top {promotion.promoteRanks.length} (Ranks {promotion.promoteRanks.join(", ")})<br />
              <span style={{ color: "#e05555", fontWeight: 700 }}>▼ Demote:</span> Rank {promotion.demoteRanks.join(", ")} (last place)<br />
              <span style={{ color: colors.muted }}>Group size: {promotion.leagueSize} players</span>
            </div>
          </div>
        </div>

      </div>

      {/* 2×2 league tiles */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
        {leagues.map(l => {
          const lName   = l.name.replace(" League", "");
          const tickets = rewardTickets.byLeague[lName] ?? [];
          const leagueIcon = { 1: "tourn3.png", 2: "tourn5.png", 3: "tourn7.png", 4: "tourn8.png" }[l.id];
          return (
            <div key={l.id} style={{ background: colors.panel, border: `1px solid ${l.color}55`, borderRadius: 10, overflow: "hidden" }}>
              {/* Tile header */}
              <div style={{ background: l.color + "22", borderBottom: `1px solid ${l.color}55`, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <img src={getIconUrl(leagueIcon)} alt="" style={{ width: 24, height: 24, objectFit: "contain" }} />
                  <span style={{ fontSize: 15, fontWeight: 800, color: l.color }}>{l.name}</span>
                </div>
                <span style={{ fontSize: 11, color: l.immunePenalty > 0 ? "#e05555" : colors.muted }}>
                  {l.immunePenalty > 0 ? `Immune class −${(l.immunePenalty * 100).toFixed(0)}% dmg` : "No immune penalty"}
                </span>
              </div>
              {/* Rank table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: colors.header }}>
                    <th style={{ padding: "6px 12px", textAlign: "center", color: colors.muted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Placement</th>
                    <th style={{ padding: "6px 12px", textAlign: "center", color: colors.muted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}></th>
                    <th style={{ padding: "6px 12px", textAlign: "right", color: colors.muted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>
                      <img src={getIconUrl("_ticket.png")} alt="" style={{ width: 12, height: 12, objectFit: "contain", marginRight: 4, verticalAlign: "middle" }} />
                      Tickets
                    </th>
                    <th style={{ padding: "6px 12px", textAlign: "right", color: colors.gold, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>
                      <img src={getIconUrl("Icon_Trophy_0.png")} alt="" style={{ width: 12, height: 12, objectFit: "contain", marginRight: 4, verticalAlign: "middle" }} />
                      Trophies
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rankRanges.map((range, ri) => {
                    const isPromote = l.id !== leagues[leagues.length - 1].id && promotion.promoteRanks.includes(ri + 1);
                    const isDemote  = l.id !== leagues[0].id && promotion.demoteRanks.includes(ri + 1);
                    return (
                      <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : colors.panel + "80", borderBottom: `1px solid ${colors.border}22` }}>
                        <td style={{ padding: "6px 12px", textAlign: "center", color: isPromote ? colors.positive : isDemote ? "#e05555" : colors.text, fontWeight: isPromote || isDemote ? 700 : 400, whiteSpace: "nowrap" }}>
                          {range}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                          {isPromote && <span style={{ fontSize: 12, color: colors.positive, fontWeight: 700 }}>▲ Promotion</span>}
                          {isDemote  && <span style={{ fontSize: 12, color: "#e05555",       fontWeight: 700 }}>▼ Demotion</span>}
                          {!isPromote && !isDemote && <span style={{ fontSize: 12, color: colors.muted }}>— No Change</span>}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right", color: colors.text }}>
                          {tickets[ri] != null ? (tickets[ri] * ticketMult).toLocaleString() : "—"}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right", color: colors.gold, fontWeight: ri === 0 ? 700 : 400 }}>
                          {(calcTrophies[ri] ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegacyBracketsView() {
  const [waveInput, setWaveInput] = useState("");
  const wave = parseInt(waveInput) || null;

  const activeBracket = wave != null
    ? tournamentBracketsData.brackets.find(b => wave >= b.minWave && (b.maxWave == null || wave <= b.maxWave))
    : null;

  const thS = {
    padding: "9px 12px", color: colors.muted, fontWeight: 700, fontSize: 11,
    textAlign: "right", borderBottom: `1px solid ${colors.border}`,
    letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("Icon_Trophy_0.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Tournament Brackets</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Base trophy rewards by tier and placement.</div>
        </div>
      </div>

      {/* Wave finder */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "12px 16px" }}>
        <span style={{ fontSize: 13, color: colors.muted }}>Your wave:</span>
        <input
          type="number" placeholder="e.g. 5000"
          value={waveInput}
          onChange={e => setWaveInput(e.target.value)}
          style={{ background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.text, padding: "6px 10px", fontSize: 14, fontFamily: "inherit", width: 130, outline: "none" }}
        />
        {activeBracket && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: colors.positive, fontWeight: 700 }}>
              Tier {activeBracket.tier} — {activeBracket.minWave.toLocaleString()}–{activeBracket.maxWave != null ? activeBracket.maxWave.toLocaleString() : "∞"}
            </span>
            <span style={{ fontSize: 13, color: colors.muted }}>
              Rank 1: <span style={{ color: colors.gold, fontWeight: 700 }}>{activeBracket.trophiesPerRank[0].toLocaleString()}</span>
            </span>
            <span style={{ fontSize: 13, color: colors.muted }}>
              Rank 10: <span style={{ color: colors.gold, fontWeight: 700 }}>{activeBracket.trophiesPerRank[9].toLocaleString()}</span>
            </span>
            <span style={{ fontSize: 13, color: colors.muted }}>
              Gems: <span style={{ color: "#e06aaa", fontWeight: 700 }}>{activeBracket.gems.toLocaleString()}</span>
            </span>
          </div>
        )}
        {wave != null && !activeBracket && (
          <span style={{ fontSize: 13, color: colors.muted, fontStyle: "italic" }}>No bracket found for wave {wave.toLocaleString()}</span>
        )}
      </div>

      {/* Table */}
      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 8, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
          <thead style={{ background: colors.panel }}>
            <tr>
              <th style={{ ...thS, textAlign: "left" }}>Tier</th>
              <th style={{ ...thS, textAlign: "left" }}>Wave Range</th>
              {[1,2,3,4,5,6,7,8,9,10].map(r => (
                <th key={r} style={{ ...thS, color: r === 1 ? colors.gold : thS.color }}>#{r}</th>
              ))}
              <th style={{ ...thS, color: "#e06aaa" }}>Gems</th>
            </tr>
          </thead>
          <tbody>
            {tournamentBracketsData.brackets.map((b, i) => {
              const isActive = activeBracket?.tier === b.tier;
              return (
                <tr key={b.tier} style={{
                  background: isActive ? colors.positive + "22" : i % 2 === 0 ? "transparent" : colors.panel + "60",
                  borderBottom: `1px solid ${colors.border}${isActive ? "" : "22"}`,
                  outline: isActive ? `1px solid ${colors.positive}` : "none",
                }}>
                  <td style={{ padding: "8px 12px", fontWeight: 700, color: isActive ? colors.positive : colors.accent, whiteSpace: "nowrap" }}>
                    {isActive ? `▶ Tier ${b.tier}` : `Tier ${b.tier}`}
                  </td>
                  <td style={{ padding: "8px 12px", color: colors.muted, whiteSpace: "nowrap" }}>
                    {b.minWave.toLocaleString()}–{b.maxWave != null ? b.maxWave.toLocaleString() : "∞"}
                  </td>
                  {b.trophiesPerRank.map((t, ri) => (
                    <td key={ri} style={{ padding: "8px 12px", textAlign: "right", color: ri === 0 ? colors.gold : colors.text, fontWeight: ri === 0 ? 700 : 400 }}>
                      {t.toLocaleString()}
                    </td>
                  ))}
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "#e06aaa", fontWeight: 600 }}>{b.gems.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAP PERKS VIEW
// ─────────────────────────────────────────────
const MAP_PERK_START = 25000;
const MAP_PERK_INTERVAL = 1000;

function LegacyMapPerksView() {
  const [startWave, setStartWave] = useState(MAP_PERK_START);
  const [endWave,   setEndWave]   = useState(75000);
  const [startInput, setStartInput] = useState(String(MAP_PERK_START));
  const [endInput,   setEndInput]   = useState("75000");

  const clampWave = (v) => Math.max(MAP_PERK_START, Math.round(v / MAP_PERK_INTERVAL) * MAP_PERK_INTERVAL);

  function commitStart() {
    const v = clampWave(parseInt(startInput) || MAP_PERK_START);
    setStartWave(v);
    setStartInput(v.toLocaleString().replace(/,/g, ""));
    if (v > endWave) { setEndWave(v); setEndInput(String(v)); }
  }
  function commitEnd() {
    const raw = clampWave(parseInt(endInput) || MAP_PERK_START);
    const v = Math.max(raw, startWave);
    setEndWave(v);
    setEndInput(String(v));
  }

  const rows = useMemo(() => {
    const out = [];
    for (let w = startWave; w <= endWave; w += MAP_PERK_INTERVAL) {
      const n = (w - MAP_PERK_START) / MAP_PERK_INTERVAL;
      const granted    = n;
      const cumulative = n * (n + 1) / 2;
      out.push({ wave: w, granted, cumulative });
    }
    return out;
  }, [startWave, endWave]);

  const inputStyle = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "6px 10px", fontSize: 14, fontFamily: "inherit",
    width: 110, textAlign: "center", outline: "none",
  };
  const thStyle = {
    padding: "8px 16px", color: colors.muted, fontWeight: 700, fontSize: 12,
    textAlign: "left", borderBottom: `1px solid ${colors.border}`,
    letterSpacing: "0.06em", textTransform: "uppercase",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("_starEmpty_0.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Map Perks</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Perk points earned per wave milestone (every 1,000 waves from {MAP_PERK_START.toLocaleString()})</div>
        </div>
      </div>

      {/* Wave range filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "12px 16px" }}>
        <span style={{ color: colors.muted, fontSize: 13 }}>From wave</span>
        <input type="number" value={startInput} min={MAP_PERK_START} step={MAP_PERK_INTERVAL}
          onChange={e => setStartInput(e.target.value)}
          onBlur={commitStart}
          onKeyDown={e => e.key === "Enter" && commitStart()}
          style={inputStyle} />
        <span style={{ color: colors.muted, fontSize: 13 }}>to</span>
        <input type="number" value={endInput} min={MAP_PERK_START} step={MAP_PERK_INTERVAL}
          onChange={e => setEndInput(e.target.value)}
          onBlur={commitEnd}
          onKeyDown={e => e.key === "Enter" && commitEnd()}
          style={inputStyle} />
        <span style={{ fontSize: 13, color: colors.muted }}>
          — <span style={{ color: colors.accent, fontWeight: 700 }}>{rows[rows.length - 1]?.cumulative.toLocaleString() ?? 0}</span> total perks at wave {endWave.toLocaleString()}
        </span>
      </div>

      {/* Table */}
      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: colors.panel }}>
            <tr>
              <th style={thStyle}>Wave</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Perks Granted</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Cumulative Perks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.wave} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                <td style={{ padding: "7px 16px", color: colors.accent, fontWeight: 600 }}>{r.wave.toLocaleString()}</td>
                <td style={{ padding: "7px 16px", textAlign: "right", color: r.granted === 0 ? colors.muted : colors.text, fontWeight: r.granted > 0 ? 600 : 400 }}>
                  {r.granted === 0 ? "—" : `+${r.granted}`}
                </td>
                <td style={{ padding: "7px 16px", textAlign: "right", color: colors.gold, fontWeight: 600 }}>
                  {r.cumulative.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CHALLENGES VIEW
// ─────────────────────────────────────────────
function LegacyChallengesView() {
  const bannerStyle = { background: `linear-gradient(180deg, #3a6eb0 0%, ${colors.bannerBg} 100%)`, border: `1px solid #4a7ec0`, borderRadius: 8, padding: "8px 20px", marginBottom: 14, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" };
  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("_starBlue.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Challenges</div>
      </div>
      {Object.entries(challengesData.groups).map(([groupName, items]) => (
        <div key={groupName} style={{ marginBottom: 32 }}>
          <div style={bannerStyle}>
            <span style={{ fontSize: 14, fontWeight: 800, color: colors.bannerText, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{groupName}</span>
          </div>
          <div className="card-grid">
            {items.map(item => (
              <div key={item.id} style={{ background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.2)", display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: item.bgColor, border: `2px solid ${item.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <img src={getIconUrl(item.icon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: colors.text, fontWeight: 700, fontSize: 15, lineHeight: 1.2, marginBottom: 4 }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: colors.muted, marginBottom: 2 }}>
                    Req <span style={{ color: colors.gold, fontWeight: 700 }}>
                      {typeof item.requirement === "string" && item.requirement.includes(":")
                        ? (() => { const [h, m] = item.requirement.split(":").map(Number); return `${h}H ${m}m`; })()
                        : item.requirement.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: colors.muted }}>
                    Reward{" "}<span style={{ color: item.reward < 0 ? colors.positive : colors.accent, fontWeight: 700 }}>{item.reward > 0 ? "+" : ""}{item.reward}{rewardUnitSym(item.rewardUnit)}</span>{" "}{item.rewardUnit}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// PLAYER ICONS VIEW
// ─────────────────────────────────────────────
function LegacyPlayerIconsView() {
  const fmt = useFmt();
  const bannerStyle = { background: `linear-gradient(180deg, #3a6eb0 0%, ${colors.bannerBg} 100%)`, border: `1px solid #4a7ec0`, borderRadius: 8, padding: "8px 20px", marginBottom: 14, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" };
  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("icon_inforound.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Player Icons</div>
      </div>
      {Object.entries(playerIconsData.groups).map(([groupName, items]) => (
        <div key={groupName} style={{ marginBottom: 32 }}>
          <div style={bannerStyle}>
            <span style={{ fontSize: 14, fontWeight: 800, color: colors.bannerText, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{groupName}</span>
          </div>
          <div className="card-grid">
            {items.map(item => (
              <div key={item.id} style={{ background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.2)", display: "flex", gap: 12, alignItems: "center" }}>
                {/* Reward stat icon — left, with colored border */}
                {item.rewardIcon ? (
                  <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: item.rewardBgColor, border: `2px solid ${item.rewardBorderColor}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <img src={getIconUrl(item.rewardIcon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
                  </div>
                ) : (
                  <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: colors.panel, border: `2px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: colors.muted, fontSize: 18 }}>—</span>
                  </div>
                )}
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: colors.text, fontWeight: 700, fontSize: 15, lineHeight: 1.2, marginBottom: 4 }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: colors.muted, marginBottom: 2 }}>
                    Cost <span style={{ color: item.cost === 0 ? colors.positive : colors.gold, fontWeight: 700 }}>{item.cost === 0 ? "Free" : fmt(item.cost)}</span>
                  </div>
                  {item.rewardUnit && (
                    <div style={{ fontSize: 13, color: colors.muted }}>
                      Reward{" "}<span style={{ color: item.reward < 0 ? colors.positive : colors.accent, fontWeight: 700 }}>{item.reward > 0 ? "+" : ""}{item.reward}{rewardUnitSym(item.rewardUnit)}</span>{" "}{item.rewardUnit}
                    </div>
                  )}
                </div>
                {/* Player icon image — right, no border */}
                <img src={getIconUrl(item.icon)} alt={item.name} style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 6, objectFit: "contain" }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// PLAYER BACKGROUNDS VIEW
// ─────────────────────────────────────────────
function LegacyPlayerBackgroundsView() {
  const bannerStyle = { background: `linear-gradient(180deg, #3a6eb0 0%, ${colors.bannerBg} 100%)`, border: `1px solid #4a7ec0`, borderRadius: 8, padding: "8px 20px", marginBottom: 14, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" };
  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("_prestigeBg.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Player Backgrounds</div>
      </div>
      {Object.entries(playerBgData.groups).map(([groupName, items]) => (
        <div key={groupName} style={{ marginBottom: 32 }}>
          <div style={bannerStyle}>
            <span style={{ fontSize: 14, fontWeight: 800, color: colors.bannerText, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{groupName}</span>
          </div>
          <div className="card-grid">
            {items.map(item => (
              <div key={item.id} style={{ position: "relative", backgroundImage: item.background ? `url(${getIconUrl(item.background)})` : "none", backgroundSize: "cover", backgroundPosition: "center", border: `1px solid ${colors.border}`, borderRadius: 8, padding: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.2)", overflow: "hidden" }}>
                {/* Dark overlay so text stays readable */}
                {item.background && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />}
                {/* Card content above the overlay */}
                <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 12, alignItems: "center" }}>
                  {item.icon ? (
                    <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: item.bgColor, border: `2px solid ${item.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      <img src={getIconUrl(item.icon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
                    </div>
                  ) : (
                    <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: colors.panel, border: `2px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: colors.muted, fontSize: 18 }}>—</span>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: colors.text, fontWeight: 700, fontSize: 15, lineHeight: 1.2, marginBottom: 4 }}>{item.name}</div>
                    <div style={{ fontSize: 13, color: colors.muted, marginBottom: 2 }}>
                      Req <span style={{ color: colors.gold, fontWeight: 700 }}>
                        {item.requirement != null
                          ? (typeof item.requirement === "string" && item.requirement.includes(":")
                            ? (() => { const [h, m] = item.requirement.split(":").map(Number); return `${h}H ${m}m`; })()
                            : (typeof item.requirement === "string" ? item.requirement : item.requirement.toLocaleString()))
                          : "—"}
                      </span>
                    </div>
                    {item.rewardUnit && (
                      <div style={{ fontSize: 13, color: colors.muted }}>
                        Reward{" "}<span style={{ color: item.reward < 0 ? colors.positive : colors.accent, fontWeight: 700 }}>{item.reward > 0 ? "+" : ""}{item.reward}{rewardUnitSym(item.rewardUnit)}</span>{" "}{item.rewardUnit}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// WAVE PERK MODAL
// ─────────────────────────────────────────────
function WavePerkModal({ item, multiplier, onClose }) {
  const thStyle = {
    padding: "8px 16px", color: colors.muted, fontWeight: 700, fontSize: 12,
    textAlign: "left", borderBottom: `1px solid ${colors.border}`,
    letterSpacing: "0.06em", textTransform: "uppercase",
  };
  const hasBoost = multiplier > 1.0001;
  const effectiveAmt = item.statAmt * multiplier;

  const rows = useMemo(() => {
    const out = [];
    for (let s = 1; s <= item.maxStacks; s++) {
      out.push({ stacks: s, perStack: effectiveAmt, total: effectiveAmt * s });
    }
    return out;
  }, [item, effectiveAmt]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div className="modal-box" style={{ background: colors.bg, border: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, background: item.bgColor, border: `2px solid ${item.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={getIconUrl(item.icon)} alt="" style={{ width: 30, height: 30, objectFit: "contain" }} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: colors.text }}>{item.name}</div>
              <div style={{ fontSize: 13, color: colors.positive, marginTop: 2 }}>
                {effectiveAmt.toFixed(2)} per stack
                {hasBoost && <span style={{ color: colors.muted }}> (base {item.statAmt})</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: colors.muted, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>✕</button>
        </div>

        {/* Summary */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${colors.border}`, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Max Stacks</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{item.maxStacks}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Max Total</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.gold }}>{(effectiveAmt * item.maxStacks).toFixed(2)}</div>
          </div>
          {hasBoost && (
            <div>
              <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Effect Multiplier</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: colors.accent }}>{multiplier.toFixed(4)}×</div>
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, background: colors.panel }}>
              <tr>
                <th style={thStyle}>Stacks</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Per Stack</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.stacks} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                  <td style={{ padding: "7px 16px", color: colors.accent, fontWeight: 600 }}>{r.stacks}</td>
                  <td style={{ padding: "7px 16px", color: colors.text, textAlign: "right" }}>{r.perStack.toFixed(2)}</td>
                  <td style={{ padding: "7px 16px", color: colors.gold, fontWeight: 600, textAlign: "right" }}>{r.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// WAVE PERKS VIEW
// ─────────────────────────────────────────────
const WAVE_PERK_EFFECT_SOURCES = [
  { key: "runes",      label: "Runes",      statAmt: 2,  maxLevel: 10, icon: "_rune_2.png"    },
  { key: "mastery",    label: "Mastery",    statAmt: 5,  maxLevel: 5,  icon: "_mastery_2.png" },
  { key: "tickets",    label: "Tickets",    statAmt: 2,  maxLevel: 10, icon: "_ticket.png"    },
  { key: "tournament", label: "Tournament", statAmt: 2,  maxLevel: 10, icon: "_tournPts.png"  },
];

// Snow Fort Wave Perk Effect perk: baseAmt=3, statAmt=1, maxLevel=5
const SNOW_FORT_WPE = { baseAmt: 3, statAmt: 1, maxLevel: 5 };

function LegacyWavePerksView() {
  const isMobile = useIsMobile();
  const [selectedPerk, setSelectedPerk] = useState(null);

  const [levels, setLevels] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("wavePerkEffectLevels"));
      if (saved && typeof saved === "object") {
        const defaults = Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, ""]));
        return { ...defaults, ...saved };
      }
    } catch {
      return Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, ""]));
    }
    return Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, ""]));
  });

  const [snowLevel, setSnowLevel] = useState(() => {
    try { return localStorage.getItem("wavePerkSnowLevel") ?? ""; } catch { return ""; }
  });
  // Shared with AllMapsView via same localStorage key
  const [mpLevels, setMpLevels] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mapPerkUpgrades"));
      if (saved && typeof saved === "object") return { runes: "", mastery: "", ultimus: "", ...saved };
    } catch {
      return { runes: "", mastery: "", ultimus: "" };
    }
    return { runes: "", mastery: "", ultimus: "" };
  });

  function setLevel(key, val) {
    setLevels(prev => {
      const next = { ...prev, [key]: val };
      localStorage.setItem("wavePerkEffectLevels", JSON.stringify(next));
      return next;
    });
  }

  function setMpLevel(id, val) {
    setMpLevels(prev => {
      const next = { ...prev, [id]: val };
      localStorage.setItem("mapPerkUpgrades", JSON.stringify(next));
      return next;
    });
  }

  function updateSnowLevel(val) {
    setSnowLevel(val);
    localStorage.setItem("wavePerkSnowLevel", val);
  }

  function isOverMax(key) {
    const src = WAVE_PERK_EFFECT_SOURCES.find(s => s.key === key);
    const n = parseInt(levels[key]);
    return !isNaN(n) && levels[key] !== "" && n > src.maxLevel;
  }

  function isMpOverMax(id) {
    const src = MAP_PERK_UPGRADE_SOURCES.find(u => u.id === id);
    const n = parseInt(mpLevels[id]);
    return !isNaN(n) && mpLevels[id] !== "" && n > src.maxLevel;
  }

  function setAllMax() {
    const next = Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, String(s.maxLevel)]));
    localStorage.setItem("wavePerkEffectLevels", JSON.stringify(next));
    setLevels(next);
    updateSnowLevel(String(SNOW_FORT_WPE.maxLevel));
  }
  function clearAll() {
    const next = Object.fromEntries(WAVE_PERK_EFFECT_SOURCES.map(s => [s.key, ""]));
    localStorage.setItem("wavePerkEffectLevels", JSON.stringify(next));
    setLevels(next);
    updateSnowLevel("");
  }

  const mapPerkMult = MAP_PERK_UPGRADE_SOURCES.reduce((acc, upg) => {
    const lv = Math.min(Math.max(0, parseInt(mpLevels[upg.id]) || 0), upg.maxLevel);
    return acc * (1 + upg.statAmt * lv / 100);
  }, 1);

  const snowLv = Math.min(Math.max(0, parseInt(snowLevel) || 0), SNOW_FORT_WPE.maxLevel);
  const snowRaw = snowLv > 0 ? (SNOW_FORT_WPE.baseAmt + SNOW_FORT_WPE.statAmt * snowLv) / 100 : 0;
  const snowBonus = snowRaw * mapPerkMult;
  const snowOverMax = snowLevel !== "" && parseInt(snowLevel) > SNOW_FORT_WPE.maxLevel;

  const multiplier = WAVE_PERK_EFFECT_SOURCES.reduce((acc, s) => {
    const lv = Math.min(Math.max(0, parseInt(levels[s.key]) || 0), s.maxLevel);
    return acc * (1 + lv * s.statAmt / 100);
  }, 1) * (1 + snowBonus);
  const bonusPct = (multiplier - 1) * 100;
  const hasBoost = multiplier > 1.0001;

  const smallInput = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "5px 8px", fontSize: 13, fontFamily: "inherit",
    width: 68, textAlign: "center", outline: "none",
  };

  const bannerStyle = (rarity) => {
    const rc = RARITY_COLORS[rarity] ?? RARITY_COLORS.Common;
    return { background: `linear-gradient(180deg, ${rc.bg}cc 0%, ${rc.bg}88 100%)`, border: `1px solid ${rc.border}`, borderRadius: 8, padding: "8px 20px", marginBottom: 14, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" };
  };
  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("flagSword.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Wave Perks</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 20, alignItems: "flex-start" }}>
        {/* Wave Perk Effect upgrades + Snow Fort perk */}
        <div style={{ minWidth: isMobile ? "100%" : 320 }}>
          <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>Wave Perk Effect</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={setAllMax} style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}44`, color: colors.accent, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Max</button>
                <button onClick={clearAll} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.muted, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Clear</button>
              </div>
            </div>

            {WAVE_PERK_EFFECT_SOURCES.map(s => {
              const over = isOverMax(s.key);
              const lv = Math.min(Math.max(0, parseInt(levels[s.key]) || 0), s.maxLevel);
              const pct = s.statAmt * lv;
              return (
                <div key={s.key} style={{ marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img src={getIconUrl(s.icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: colors.muted, minWidth: 80 }}>{s.label}</span>
                    <input type="number" min={0} max={s.maxLevel}
                      value={levels[s.key]}
                      onChange={e => setLevel(s.key, e.target.value)}
                      style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }}
                    />
                    <span style={{ fontSize: 12, color: colors.muted }}>/ {s.maxLevel}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: pct > 0 ? colors.positive : colors.muted, marginLeft: "auto" }}>+{pct}%</span>
                  </div>
                  {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {s.maxLevel}</div>}
                </div>
              );
            })}

            <div style={{ marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: colors.muted, minWidth: 80, display: "flex", alignItems: "center", gap: 4 }}>
                  <img src={getIconUrl("icon_snow.png")} alt="" style={{ width: 13, height: 13, objectFit: "contain" }} />
                  Snow Fort
                </span>
                <input type="number" min={0} max={SNOW_FORT_WPE.maxLevel}
                  value={snowLevel}
                  onChange={e => updateSnowLevel(e.target.value)}
                  style={{ ...smallInput, border: `1px solid ${snowOverMax ? "#e05555" : colors.border}`, color: snowOverMax ? "#e05555" : colors.text }}
                />
                <span style={{ fontSize: 12, color: colors.muted }}>/ {SNOW_FORT_WPE.maxLevel}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: snowLv > 0 ? colors.positive : colors.muted, marginLeft: "auto" }}>
                  {snowLv > 0 ? `+${(snowBonus * 100).toFixed(2)}%` : "—"}
                </span>
              </div>
              {snowOverMax && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 88 }}>Max is {SNOW_FORT_WPE.maxLevel}</div>}
              {mapPerkMult > 1.0001 && snowLv > 0 && (
                <div style={{ fontSize: 11, color: colors.muted, marginTop: 2, paddingLeft: 88 }}>
                  base +{(snowRaw * 100).toFixed(0)}% ×{mapPerkMult.toFixed(2)} map perk mult
                </div>
              )}
            </div>

            <div style={{ borderTop: `1px solid ${colors.border}44`, marginTop: 6, paddingTop: 6 }}>
              <span style={{ fontSize: 13, color: colors.muted }}>Total bonus: </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: hasBoost ? colors.positive : colors.muted }}>+{bonusPct.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* Map Perk Upgrades (affects Snow Fort perk value) */}
        <div style={{ minWidth: isMobile ? "100%" : 280 }}>
          <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <img src={getIconUrl("Icon_Map_0.png")} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>Map Perk Upgrades</span>
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                <button onClick={() => { const next = Object.fromEntries(MAP_PERK_UPGRADE_SOURCES.map(u => [u.id, String(u.maxLevel)])); setMpLevels(next); localStorage.setItem("mapPerkUpgrades", JSON.stringify(next)); }} style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}44`, color: colors.accent, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Max</button>
                <button onClick={() => { const next = Object.fromEntries(MAP_PERK_UPGRADE_SOURCES.map(u => [u.id, ""])); setMpLevels(next); localStorage.setItem("mapPerkUpgrades", JSON.stringify(next)); }} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.muted, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Clear</button>
              </div>
            </div>

            {MAP_PERK_UPGRADE_SOURCES.map(upg => {
              const over = isMpOverMax(upg.id);
              const lv = Math.min(Math.max(0, parseInt(mpLevels[upg.id]) || 0), upg.maxLevel);
              const pct = upg.statAmt * lv;
              return (
                <div key={upg.id} style={{ marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img src={getIconUrl(upg.icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: colors.muted, minWidth: 80 }}>{upg.label}</span>
                    <input type="number" min={0} max={upg.maxLevel}
                      value={mpLevels[upg.id]}
                      onChange={e => setMpLevel(upg.id, e.target.value)}
                      style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }}
                    />
                    <span style={{ fontSize: 12, color: colors.muted }}>/ {upg.maxLevel}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: pct > 0 ? colors.positive : colors.muted, marginLeft: "auto" }}>+{pct}%</span>
                  </div>
                  {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {upg.maxLevel}</div>}
                </div>
              );
            })}

            <div style={{ borderTop: `1px solid ${colors.border}44`, marginTop: 6, paddingTop: 6 }}>
              <span style={{ fontSize: 13, color: colors.muted }}>Map perk multiplier: </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: mapPerkMult > 1.0001 ? colors.positive : colors.muted }}>{mapPerkMult.toFixed(4)}×</span>
            </div>
          </div>
        </div>
      </div>

      {wavePerksData.note && (
        <div style={{ fontSize: 13, color: colors.muted, marginBottom: 20, padding: "8px 12px", background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 6 }}>
          {wavePerksData.note}
        </div>
      )}
      {Object.entries(wavePerksData.groups).map(([groupName, items]) => {
        const rc = RARITY_COLORS[groupName] ?? RARITY_COLORS.Common;
        return (
          <div key={groupName} style={{ marginBottom: 32 }}>
            <div style={bannerStyle(groupName)}>
              <span style={{ fontSize: 14, fontWeight: 800, color: rc.text, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{groupName}</span>
            </div>
            <div className="card-grid">
              {items.map(item => (
                <div key={item.id} onClick={() => setSelectedPerk(item)} style={{ background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.2)", display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
                  <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: item.bgColor, border: `2px solid ${item.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <img src={getIconUrl(item.icon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: colors.text, fontWeight: 700, fontSize: 15, lineHeight: 1.2, marginBottom: 4 }}>{item.name}</div>
                    <div style={{ fontSize: 13, color: colors.muted, marginBottom: 2 }}>
                      Per stack <span style={{ color: item.statAmt < 0 ? colors.positive : colors.accent, fontWeight: 700 }}>{(item.statAmt * multiplier).toFixed(2)}</span>
                      {hasBoost && <span style={{ fontSize: 11, color: colors.muted }}> (base {item.statAmt})</span>}
                    </div>
                    <div style={{ fontSize: 13, color: colors.muted }}>
                      Max stacks <span style={{ color: colors.gold, fontWeight: 700 }}>{item.maxStacks}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {selectedPerk && <WavePerkModal item={selectedPerk} multiplier={multiplier} onClose={() => setSelectedPerk(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// TECH TREE VIEW
// ─────────────────────────────────────────────
function SheetView({ sectionData, onOpen }) {
  const fmt = useFmt();
  const groups = Object.entries(sectionData?.groups ?? {});

  return (
    <div>
      {sectionData?.label ? (
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          {sectionData.menuIcon ? (
            <img src={getIconUrl(sectionData.menuIcon)} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
          ) : null}
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>{sectionData.label}</div>
            {sectionData.formulaNote ? <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{sectionData.formulaNote}</div> : null}
          </div>
        </div>
      ) : null}

      {groups.map(([groupName, items]) => (
        <div key={groupName} style={{ marginBottom: 32 }}>
          <div style={{ background: `linear-gradient(180deg, #3a6eb0 0%, ${colors.bannerBg} 100%)`, border: "1px solid #4a7ec0", borderRadius: 8, padding: "8px 20px", marginBottom: 14, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: colors.bannerText, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{groupName}</span>
          </div>

          <div className="card-grid">
            {items.map((item) => {
              const totalCost = computeTotalCost(item, sectionData.costFormula);
              const rewardValue = item.reward ?? item.statAmt;
              const rewardLabel = item.rewardUnit ?? item.statLabel ?? STAT_UNITS[item.statKey]?.label ?? item.statKey ?? null;
              const iconName = item.icon ?? item.rewardIcon ?? sectionData.menuIcon;
              const costValue = item.cost ?? item.baseCost ?? null;
              const requirementValue = item.requirement ?? item.waveReq ?? null;
              const costPrefix = item.costCurrency ?? CURRENCY_LABELS[item.currency] ?? "Cost";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpen(item)}
                  style={{
                    width: "100%",
                    background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: 12,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    color: colors.text,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: item.bgColor ?? item.rewardBgColor ?? colors.panel, border: `2px solid ${item.borderColor ?? item.rewardBorderColor ?? colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {iconName ? <img src={getIconUrl(iconName)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} /> : <span style={{ color: colors.muted, fontSize: 18 }}>-</span>}
                  </div>

                  <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
                    <div style={{ color: colors.text, fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{item.name}</div>

                    {rewardLabel && rewardValue != null ? (
                      <div style={{ fontSize: 13, color: colors.muted }}>
                        Bonus <span style={{ color: Number(rewardValue) < 0 ? colors.positive : colors.accent, fontWeight: 700 }}>{isProgressiveItem(item) ? formatStat(progressiveTotal(Number(item.statAmt) || 0, Number(item.maxLevel) || 0), item.statKey) : `${Number(rewardValue) > 0 ? "+" : ""}${fmt(rewardValue)}${item.reward_type === "percent" ? "%" : rewardUnitSym(rewardLabel)}`}</span> {rewardLabel}
                      </div>
                    ) : null}

                    {item.maxLevel != null ? <div style={{ fontSize: 13, color: colors.muted }}>Max Level {fmt(item.maxLevel)}</div> : null}
                    {costValue != null ? <div style={{ fontSize: 13, color: colors.muted }}>{costPrefix} {fmt(costValue)}</div> : null}
                    {totalCost != null ? <div style={{ fontSize: 13, color: colors.muted }}>Total {costPrefix} {fmt(totalCost)}</div> : null}
                    {requirementValue != null ? <div style={{ fontSize: 13, color: colors.muted }}>Requirement {typeof requirementValue === "number" ? fmt(requirementValue) : requirementValue}</div> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TechTreeGroupAbs({ items, layout, onOpen, containerWidth }) {
  const fmt  = useFmt();
  const cols = layout.cols;

  // Fixed vertical rhythm; horizontal fills the container
  const NODE_H  = 112;
  const ROW_GAP = 52;
  const COL_GAP = 24;
  const rowHeight = NODE_H + ROW_GAP;

  const colWidth = Math.floor(containerWidth / cols);
  const NODE_W   = colWidth - COL_GAP;

  const posById = layout.nodes;
  const maxRow  = Math.max(...Object.values(posById).map(n => n.row));
  const svgW    = containerWidth;
  const svgH    = maxRow * rowHeight - ROW_GAP;

  const cx   = col => (col - 1) * colWidth + colWidth / 2;
  const topY = row => (row - 1) * rowHeight;
  const botY = row => (row - 1) * rowHeight + NODE_H;

  function makeLine(fromId, toId, key) {
    const pp = posById[fromId];
    const cp = posById[toId];
    if (!pp || !cp) return null;
    const x1 = cx(pp.col), y1 = botY(pp.row);
    const x2 = cx(cp.col), y2 = topY(cp.row);
    const midY = (y1 + y2) / 2;
    return (
      <polyline
        key={key}
        points={`${x1},${y1} ${x1},${midY} ${x2},${midY} ${x2},${y2}`}
        fill="none" stroke="#3a6a9a" strokeWidth={2} strokeLinejoin="round"
      />
    );
  }

  const parentLines = items
    .filter(item => item.parent && posById[item.parent] && posById[item.id])
    .map(item => makeLine(item.parent, item.id, `${item.parent}-${item.id}`));

  const extraLines = (layout.extraLines ?? [])
    .map(el => makeLine(el.from, el.to, `extra-${el.from}-${el.to}`));

  return (
    <div style={{ position: "relative", width: svgW, height: svgH }}>
      <svg width={svgW} height={svgH}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
        {parentLines}
        {extraLines}
      </svg>

      {items.map(item => {
        const pos = posById[item.id];
        if (!pos) return null;
        const left       = (pos.col - 1) * colWidth + COL_GAP / 2;
        const top        = (pos.row  - 1) * rowHeight;
        const iconBg     = item.bgColor     ?? "#1a4a8a";
        const iconBorder = item.borderColor ?? colors.border;
        const unlimited  = item.maxLevel >= 999999;
        const maxLvlTxt  = item.maxLevel.toLocaleString();
        const statLine   = item.statAmt !== undefined && item.statKey
          ? formatStat(item.statAmt, item.statKey) : null;
        const maxBonus   = !unlimited && item.statAmt !== undefined && item.statKey
          ? formatStatTotal(item.statAmt * item.maxLevel, item.statKey, fmt) : null;

        return (
          <div key={item.id} onClick={() => onOpen(item)}
            style={{
              position: "absolute", left, top,
              width: NODE_W, minHeight: NODE_H,
              background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`,
              border: `1px solid ${colors.border}`,
              borderRadius: 10, padding: "10px 12px",
              display: "flex", gap: 10, alignItems: "flex-start",
              cursor: "pointer", transition: "border-color 0.15s", boxSizing: "border-box",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}>

            {/* Icon */}
            <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: iconBg, border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: 2 }}>
              {item.icon && <img src={getIconUrl(item.icon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />}
            </div>

            {/* Text */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, lineHeight: 1.3, marginBottom: 3, wordBreak: "break-word" }}>{item.name}</div>
              {statLine && (
                <div style={{ fontSize: 12, color: colors.positive, lineHeight: 1.2, marginBottom: 2 }}>
                  {statLine} / lvl{maxBonus && <span style={{ color: colors.gold, marginLeft: 6 }}>({maxBonus} max)</span>}
                </div>
              )}
              <div style={{ fontSize: 12, color: colors.muted, marginBottom: item.waveReq > 0 ? 4 : 0 }}>
                Max lvl: {maxLvlTxt}
              </div>
              {item.waveReq > 0 && (
                <div style={{ display: "inline-block", background: "#1a2a3a", border: "1px solid #ffaa44", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700, color: "#ffaa44" }}>
                  Unlocks: Wave {item.waveReq.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TechTreeViewAbs({ onOpen }) {
  const [activeTab, setActiveTab] = useState("Tech");
  const isMobile = useIsMobile();
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mobile: use the standard card list
  if (isMobile) {
    return (
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["Tech", "Supreme Tech"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? colors.accent : colors.panel,
                color: activeTab === tab ? "#000" : colors.text,
                border: `1px solid ${activeTab === tab ? colors.accent : colors.border}`,
                borderRadius: 6, padding: "7px 16px", cursor: "pointer",
                fontFamily: "inherit", fontWeight: 700, fontSize: 14,
              }}>
              {tab}
            </button>
          ))}
        </div>
        <SheetView
          sectionData={{ ...SECTION_MAP["tech"].data, groups: { [activeTab]: techData.groups[activeTab] } }}
          onOpen={onOpen}
        />
      </div>
    );
  }

  const layout = techTreeDisplayData[activeTab];
  const items  = techData.groups[activeTab];

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["Tech", "Supreme Tech"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? colors.accent : colors.panel,
              color: activeTab === tab ? "#000" : colors.text,
              border: `1px solid ${activeTab === tab ? colors.accent : colors.border}`,
              borderRadius: 6, padding: "8px 26px", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 700, fontSize: 14,
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tree — fills full content width, measured via ref */}
      <div ref={containerRef} style={{ width: "100%" }}>
        {containerWidth > 0 && (
          <TechTreeGroupAbs
            key={activeTab}
            items={items}
            layout={layout}
            onOpen={onOpen}
            containerWidth={containerWidth}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TECH TREE — FLEX VERSION
// ─────────────────────────────────────────────
function TechNodeCard({ item, onOpen, nodeRef, compact }) {
  const fmt        = useFmt();
  const iconBg     = item.bgColor     ?? "#1a4a8a";
  const iconBorder = item.borderColor ?? colors.border;
  const unlimited  = item.maxLevel >= 999999;
  const maxLvlTxt  = item.maxLevel.toLocaleString();
  const statLine   = item.statAmt !== undefined && item.statKey
    ? formatStat(item.statAmt, item.statKey) : null;
  const maxBonus   = !unlimited && item.statAmt !== undefined && item.statKey
    ? formatStatTotal(item.statAmt * item.maxLevel, item.statKey, fmt) : null;

  if (compact) {
    return (
      <div ref={nodeRef} onClick={() => onOpen(item)}
        style={{
          background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`,
          border: `1px solid ${colors.border}`,
          borderRadius: 10, padding: "8px 6px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          cursor: "pointer", transition: "border-color 0.15s", textAlign: "center",
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent}
        onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}>
        <div style={{ width: 36, height: 36, borderRadius: 6, background: iconBg, border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {item.icon && <img src={getIconUrl(item.icon)} alt="" style={{ width: 24, height: 24, objectFit: "contain" }} />}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: colors.text, lineHeight: 1.3, wordBreak: "break-word" }}>{item.name}</div>
      </div>
    );
  }

  return (
    <div ref={nodeRef} onClick={() => onOpen(item)}
      style={{
        background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`,
        border: `1px solid ${colors.border}`,
        borderRadius: 10, padding: "10px 12px",
        display: "flex", gap: 10, alignItems: "flex-start",
        cursor: "pointer", transition: "border-color 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent}
      onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}>

      <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: iconBg, border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: 2 }}>
        {item.icon && <img src={getIconUrl(item.icon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, lineHeight: 1.3, marginBottom: 3, wordBreak: "break-word" }}>{item.name}</div>
        {statLine && (
          <div style={{ fontSize: 12, color: colors.positive, lineHeight: 1.2, marginBottom: 2 }}>
            {statLine} / lvl{maxBonus && <span style={{ color: colors.gold, marginLeft: 6 }}>({maxBonus} max)</span>}
          </div>
        )}
        <div style={{ fontSize: 12, color: colors.muted, marginBottom: item.waveReq > 0 ? 4 : 0 }}>
          Max lvl: {maxLvlTxt}
        </div>
        {item.waveReq > 0 && (
          <div style={{ display: "inline-block", background: "#1a2a3a", border: "1px solid #ffaa44", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700, color: "#ffaa44" }}>
            Unlocks: Wave {item.waveReq.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

function TechTreeGroup({ items, layout, onOpen }) {
  const cols    = layout.cols;
  const posById = layout.nodes;
  const ROW_GAP = 52;

  // Build rows: array of (cols) slots per row, null = empty, "spanned" = consumed by colSpan
  const maxRow = Math.max(...Object.values(posById).map(n => n.row));
  const rows   = Array.from({ length: maxRow }, (_, ri) => {
    const row = Array(cols).fill(null);
    for (const item of items) {
      const pos = posById[item.id];
      if (pos && pos.row === ri + 1) {
        const span = pos.colSpan ?? 1;
        row[pos.col - 1] = { item, colSpan: span };
        for (let s = 1; s < span; s++) row[pos.col - 1 + s] = "spanned";
      }
    }
    return row;
  });

  // Refs to each rendered node card, keyed by item id
  const nodeRefs     = useRef({});
  const containerRef = useRef(null);
  const [pts, setPts]                   = useState({});
  const [containerWidth, setContainerWidth] = useState(9999);

  // Remeasure lines on resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const compact = containerWidth / cols < 160;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const next = {};
    for (const [id, el] of Object.entries(nodeRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next[id] = { cx: r.left - cr.left + r.width / 2, top: r.top - cr.top, bottom: r.bottom - cr.top };
    }
    // Only update state if positions actually changed — prevents infinite loop
    setPts(prev => {
      const ids = Object.keys(next);
      if (ids.length !== Object.keys(prev).length) return next;
      for (const id of ids) {
        const p = prev[id];
        const n = next[id];
        if (!p || p.cx !== n.cx || p.top !== n.top || p.bottom !== n.bottom) return next;
      }
      return prev;
    });
  }, [containerWidth, items, posById]);

  function makeLine(fromId, toId, key) {
    const p = pts[fromId], c = pts[toId];
    if (!p || !c) return null;
    const midY = (p.bottom + c.top) / 2;
    return (
      <polyline key={key}
        points={`${p.cx},${p.bottom} ${p.cx},${midY} ${c.cx},${midY} ${c.cx},${c.top}`}
        fill="none" stroke="#3a6a9a" strokeWidth={2} strokeLinejoin="round" />
    );
  }

  const svgHeight = Object.values(pts).reduce((m, p) => Math.max(m, p.bottom), 0);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* SVG lines — rendered behind the rows */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: svgHeight, pointerEvents: "none", zIndex: 0 }}>
        {items.filter(i => i.parent).map(i => makeLine(i.parent, i.id, `${i.parent}-${i.id}`))}
        {(layout.extraLines ?? []).map(el => makeLine(el.from, el.to, `extra-${el.from}-${el.to}`))}
      </svg>

      {/* Rows */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: "flex", marginBottom: ri < rows.length - 1 ? ROW_GAP : 0 }}>
            {row.map((slot, ci) => {
              if (slot === "spanned") return null;
              const colSpan = slot?.colSpan ?? 1;
              return (
                <div key={ci} style={{ flex: colSpan, minWidth: 0, padding: "0 8px", display: "flex", justifyContent: "center" }}>
                  {slot?.item && (
                    <div style={{ width: colSpan > 1 ? `${100 / colSpan}%` : "100%" }}>
                      <TechNodeCard
                        item={slot.item}
                        onOpen={onOpen}
                        nodeRef={el => nodeRefs.current[slot.item.id] = el}
                        compact={compact}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function TechTreeView({ onOpen }) {
  const [activeTab, setActiveTab] = useState("Tech");
  const isMobile = useIsMobile();

  const TAB_COLORS = {
    "Tech":         { bg: "#3a6eb0", border: "#4a7ec0", activeBg: colors.accent, activeText: "#000" },
    "Supreme Tech": { bg: "#8b0000", border: "#cc2222", activeBg: "#cc2222",     activeText: "#fff" },
  };

  const sectionTitle = (() => {
    const tc = TAB_COLORS[activeTab];
    return (
      <div style={{ background: `linear-gradient(180deg, ${tc.bg}dd 0%, ${tc.bg}99 100%)`, border: `1px solid ${tc.border}`, borderRadius: 8, padding: "8px 20px", marginBottom: 16, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
          {activeTab}
        </span>
      </div>
    );
  })();

  const tabBar = (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {["Tech", "Supreme Tech"].map(tab => {
        const tc = TAB_COLORS[tab];
        const isActive = activeTab === tab;
        return (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              background: isActive ? tc.activeBg : colors.panel,
              color: isActive ? tc.activeText : colors.text,
              border: `1px solid ${isActive ? tc.border : colors.border}`,
              borderRadius: 6, padding: "8px 26px", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 700, fontSize: 14,
            }}>
            {tab}
          </button>
        );
      })}
    </div>
  );

  if (isMobile) {
    return (
      <div>
        {tabBar}
        {sectionTitle}
        <SheetView
          sectionData={{ ...SECTION_MAP["tech"].data, groups: { [activeTab]: techData.groups[activeTab] } }}
          onOpen={onOpen}
        />
      </div>
    );
  }

  return (
    <div>
      {tabBar}
      {sectionTitle}
      <TechTreeGroup
        key={activeTab}
        items={techData.groups[activeTab]}
        layout={techTreeDisplayData[activeTab]}
        onOpen={onOpen}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────
function Sidebar({ activeKey, onSelect, isOpen, onClose, navGroups }) {
  function itemContainsActiveKey(item, key) {
    if (item.key === key) {
      return true;
    }

    return (item.children ?? []).some((child) => itemContainsActiveKey(child, key));
  }

  const [open, setOpen] = useState(() => {
    const initial = {};
    for (const group of navGroups) {
      initial[group.label] = group.items.some((item) => itemContainsActiveKey(item, activeKey));
      for (const item of group.items) {
        if (item.children?.length) {
          initial[`submenu:${item.key}`] = itemContainsActiveKey(item, activeKey);
        }
      }
    }
    return initial;
  });

  useEffect(() => {
    setOpen((current) => {
      let changed = false;
      const next = { ...current };
      let activeGroupLabel = null;
      let activeSubmenuKey = null;

      for (const group of navGroups) {
        if (group.items.some((item) => itemContainsActiveKey(item, activeKey))) {
          activeGroupLabel = group.label;
          if (!next[group.label]) {
            next[group.label] = true;
            changed = true;
          }
        }

        for (const item of group.items) {
          const submenuKey = `submenu:${item.key}`;
          if (item.children?.length && itemContainsActiveKey(item, activeKey) && !next[submenuKey]) {
            next[submenuKey] = true;
            changed = true;
          }

          if (item.children?.length && itemContainsActiveKey(item, activeKey)) {
            activeSubmenuKey = submenuKey;
          }
        }
      }

      if (activeGroupLabel) {
        for (const group of navGroups) {
          if (group.label !== activeGroupLabel && next[group.label]) {
            next[group.label] = false;
            changed = true;
          }
        }
      }

      if (activeSubmenuKey) {
        for (const group of navGroups) {
          for (const item of group.items) {
            if (!item.children?.length) {
              continue;
            }

            const submenuKey = `submenu:${item.key}`;
            if (submenuKey !== activeSubmenuKey && next[submenuKey]) {
              next[submenuKey] = false;
              changed = true;
            }
          }
        }
      }

      return changed ? next : current;
    });
  }, [activeKey, navGroups]);

  function toggleOpen(key) {
    setOpen((prev) => {
      if (!key.startsWith("submenu:")) {
        const nextValue = !prev[key];
        const next = { ...prev };

        for (const group of navGroups) {
          next[group.label] = false;
        }

        next[key] = nextValue;
        return next;
      }

      const nextValue = !prev[key];
      const next = { ...prev };

      for (const currentKey of Object.keys(prev)) {
        if (currentKey.startsWith("submenu:")) {
          next[currentKey] = false;
        }
      }

      next[key] = nextValue;
      return next;
    });
  }

  function handleSelect(key) {
    onSelect(key);
    onClose?.();
  }

  function renderNavItem(navItem, depth = 0) {
    const sectionData = navItem.key ? SECTION_MAP[navItem.key]?.data : null;
    const label = navItem.label ?? sectionData?.label ?? navItem.key;
    const menuIcon = navItem.menuIcon ?? sectionData?.menuIcon;
    const hasChildren = Boolean(navItem.children?.length);
    const isActive = hasChildren
      ? navItem.children.some((child) => itemContainsActiveKey(child, activeKey))
      : activeKey === navItem.key;
    const submenuKey = `submenu:${navItem.key}`;
    const paddingLeft = 20 + depth * 16;

    if (hasChildren) {
      return (
        <div key={navItem.key}>
          <button
            onClick={() => toggleOpen(submenuKey)}
            style={{
              width: "100%",
              background: isActive ? `linear-gradient(90deg, ${colors.accent}22 0%, transparent 100%)` : "none",
              border: "none",
              borderLeft: isActive ? `3px solid ${colors.accent}` : "3px solid transparent",
              cursor: "pointer",
              padding: `9px 16px 9px ${paddingLeft}px`,
              textAlign: "left",
              color: isActive ? colors.accent : colors.text,
              fontSize: 14,
              fontWeight: isActive ? 700 : 500,
              transition: "color 0.15s, background 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ minWidth: 0 }}>{label}</span>
              {menuIcon ? (
                <img src={getIconUrl(menuIcon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", opacity: isActive ? 1 : 0.6, flexShrink: 0, filter: navItem.iconFilter ?? "none" }} />
              ) : null}
            </span>
            <span style={{ fontSize: 10, opacity: 0.7, flexShrink: 0 }}>{open[submenuKey] ? "▲" : "▼"}</span>
          </button>
          {open[submenuKey] && navItem.children.map((child) => renderNavItem(child, depth + 1))}
        </div>
      );
    }

    return (
      <button
        key={navItem.key}
        onClick={() => handleSelect(navItem.key)}
        style={{
          width: "100%",
          background: isActive ? `linear-gradient(90deg, ${colors.accent}22 0%, transparent 100%)` : "none",
          border: "none",
          borderLeft: isActive ? `3px solid ${colors.accent}` : "3px solid transparent",
          cursor: "pointer",
          padding: `9px 16px 9px ${paddingLeft}px`,
          textAlign: "left",
          color: isActive ? colors.accent : colors.text,
          fontSize: depth > 0 ? 13 : 14,
          fontWeight: isActive ? 700 : 500,
          transition: "color 0.15s, background 0.15s",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>{label}</span>
        {menuIcon && (
          <img src={getIconUrl(menuIcon)} alt="" style={{ width: 20, height: 20, objectFit: "contain", opacity: isActive ? 1 : 0.6, flexShrink: 0, filter: navItem.iconFilter ?? "none" }} />
        )}
      </button>
    );
  }

  return (
    <div className={`sidebar${isOpen ? " open" : ""}`}
      style={{ background: colors.panel, borderRight: `1px solid ${colors.border}`, minHeight: "100%", paddingTop: 8 }}>
      {/* Standalone Home button */}
      {(() => {
        const isActive = activeKey === "home";
        return (
          <button onClick={() => handleSelect("home")}
            style={{ width: "100%", background: isActive ? `linear-gradient(90deg, ${colors.accent}22 0%, transparent 100%)` : "none", border: "none", borderLeft: isActive ? `3px solid ${colors.accent}` : "3px solid transparent", cursor: "pointer", padding: "9px 16px 9px 20px", textAlign: "left", color: isActive ? colors.accent : colors.text, fontSize: 14, fontWeight: isActive ? 700 : 500, transition: "color 0.15s, background 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
            <span>Home</span>
            <img src={getIconUrl("tower2.png")} alt="" style={{ width: 20, height: 20, objectFit: "contain", opacity: isActive ? 1 : 0.6, flexShrink: 0 }} />
          </button>
        );
      })()}
      {navGroups.map((group) => (
        <div key={group.label} style={{ marginBottom: 4 }}>
          <button onClick={() => toggleOpen(group.label)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", color: colors.muted, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {group.label}
            <span style={{ fontSize: 10, opacity: 0.7 }}>{open[group.label] ? "▲" : "▼"}</span>
          </button>
          {open[group.label] && group.items.map((navItem) => renderNavItem(navItem))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [activeKey,    setActiveKey]    = useState(() => {
    const hash = window.location.hash.slice(1);
    const initialKey = hash || localStorage.getItem("activeKey") || "home";
    return initialKey === "loadoutBuilder" ? "loadoutBuilderPlacement" : initialKey;
  });
  const [modalItem,    setModalItem]    = useState(null);
  const [modalFormula, setModalFormula] = useState(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);
  const [notation,     setNotation]     = useState(
    () => localStorage.getItem("notation") ?? "scientific"
  );
  const fmt = useMemo(() => (n) => formatBigNum(n, notation), [notation]);
  const [mapSpotsById, setMapSpotsById] = useState(() => getInitialMapSpotsById());
  const [loadoutImportVersion, setLoadoutImportVersion] = useState(0);
  const [isLoadoutRuntimeReady, setIsLoadoutRuntimeReady] = useState(false);
  const [savedLoadouts, setSavedLoadouts] = useState([]);
  const [currentSavedLoadoutSelections, setCurrentSavedLoadoutSelections] = useState(() => getCurrentSavedLoadoutSelections(localStorage));
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveDraftName, setSaveDraftName] = useState("");
  const [saveDraftDescription, setSaveDraftDescription] = useState("");
  const [saveButtonMessage, setSaveButtonMessage] = useState(null);
  const [saveButtonBusy, setSaveButtonBusy] = useState(false);
  const [workingLoadoutRevision, setWorkingLoadoutRevision] = useState(0);
  const [currentSavedLoadoutComparable, setCurrentSavedLoadoutComparable] = useState(null);
  const isMobile = useIsMobile();
  const lazyFallback = <div style={{ color: colors.muted, padding: "24px 0" }}>Loading view...</div>;
  const editableMaps = useMemo(() => mergeMapsWithSpots(mapsData.maps, mapSpotsById), [mapSpotsById]);
  const isLocalAdmin = useMemo(() => isLocalhostAdminHost(), []);
  const activeLoadoutScope = useMemo(
    () => (void workingLoadoutRevision, buildActiveLoadoutScope(activeKey, localStorage)),
    [activeKey, workingLoadoutRevision]
  );
  const currentSavedLoadoutId = useMemo(
    () => (void currentSavedLoadoutSelections, getCurrentScopedSavedLoadoutId(activeLoadoutScope.scopeId, activeLoadoutScope.scopeContext, localStorage)),
    [activeLoadoutScope, currentSavedLoadoutSelections]
  );
  const currentSavedLoadout = useMemo(
    () => savedLoadouts.find((save) => save.id === currentSavedLoadoutId) ?? null,
    [currentSavedLoadoutId, savedLoadouts]
  );
  const visibleNavGroups = useMemo(
    () => NAV_GROUPS.filter((group) => group.label !== "Admin" || isLocalAdmin),
    [isLocalAdmin]
  );
  const workingLoadoutComparable = useMemo(
    () => (void workingLoadoutRevision, buildComparableLoadoutScopePayload(localStorage, activeLoadoutScope.scopeId, activeLoadoutScope.scopeContext)),
    [activeLoadoutScope, workingLoadoutRevision]
  );
  const isCurrentSavedLoadoutDirty = useMemo(() => {
    if (!currentSavedLoadoutId || !currentSavedLoadoutComparable) {
      return false;
    }

    return JSON.stringify(workingLoadoutComparable) !== JSON.stringify(currentSavedLoadoutComparable);
  }, [currentSavedLoadoutComparable, currentSavedLoadoutId, workingLoadoutComparable]);

  const activeLoadoutScopeLabel = useMemo(
    () => getLoadoutScopeDisplayName(activeLoadoutScope.scopeId, activeLoadoutScope.scopeContext),
    [activeLoadoutScope]
  );
  const compactActiveLoadoutScopeLabel = useMemo(
    () => activeLoadoutScopeLabel.replace(/\s+Page$/, ""),
    [activeLoadoutScopeLabel]
  );
  const saveButtonBaseLabel = activeLoadoutScope.scopeId === LOADOUT_RECORD_SCOPE_FULL
    ? "Loadout"
    : activeLoadoutScope.scopeId === "mapLoadoutMap"
      ? "Map Preset"
      : compactActiveLoadoutScopeLabel;

  const saveButtonLabel = !currentSavedLoadoutId
    ? `Save ${saveButtonBaseLabel}`
    : isCurrentSavedLoadoutDirty
      ? `Save ${saveButtonBaseLabel} Changes`
      : currentSavedLoadout
        ? `${currentSavedLoadout.name} Saved`
        : "Saved";
  const isSaveButtonPassive = Boolean(currentSavedLoadoutId && !isCurrentSavedLoadoutDirty);
  const pageSaveButton = {
    label: saveButtonBusy ? "Saving..." : saveButtonLabel,
    onClick: handleSaveButtonClick,
    busy: saveButtonBusy,
    passive: isSaveButtonPassive,
  };

  useEffect(() => {
    let isCancelled = false;

    async function initializeLoadoutRuntime() {
      try {
        await hydrateLoadoutRuntime(localStorage);
        const nextSavedLoadouts = await listSavedLoadouts();

        if (isCancelled) {
          return;
        }

        setNotation(localStorage.getItem("notation") ?? "scientific");
        setCurrentSavedLoadoutSelections(getCurrentSavedLoadoutSelections(localStorage));
        setSavedLoadouts(nextSavedLoadouts);
        setLoadoutImportVersion((current) => current + 1);
      } catch {
        if (isCancelled) {
          return;
        }
      } finally {
        if (!isCancelled) {
          setIsLoadoutRuntimeReady(true);
        }
      }
    }

    void initializeLoadoutRuntime();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!saveButtonMessage) {
      return undefined;
    }

    const timerId = window.setTimeout(() => setSaveButtonMessage(null), 3000);
    return () => window.clearTimeout(timerId);
  }, [saveButtonMessage]);

  useEffect(() => {
    if (ADMIN_ROUTE_KEYS.has(activeKey) && !isLocalAdmin) {
      setActiveKey("home");
      localStorage.setItem("activeKey", "home");
    }
  }, [activeKey, isLocalAdmin]);

  useEffect(() => {
    function handleRuntimeChanged() {
      setWorkingLoadoutRevision((current) => current + 1);
      setCurrentSavedLoadoutSelections(getCurrentSavedLoadoutSelections(localStorage));
    }

    window.addEventListener(LOADOUT_RUNTIME_CHANGED_EVENT, handleRuntimeChanged);
    return () => window.removeEventListener(LOADOUT_RUNTIME_CHANGED_EVENT, handleRuntimeChanged);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadCurrentSavedPayload() {
      if (!currentSavedLoadoutId) {
        setCurrentSavedLoadoutComparable(null);
        return;
      }

      const record = await getSavedLoadout(currentSavedLoadoutId);
      if (!isCancelled) {
        setCurrentSavedLoadoutComparable(
          record
            ? createComparableLoadoutScopePayload(record.payload, record.scopeId, record.scopeContext)
            : null
        );
      }
    }

    void loadCurrentSavedPayload();
    return () => {
      isCancelled = true;
    };
  }, [activeLoadoutScope, currentSavedLoadoutId, savedLoadouts]);

  async function refreshSavedLoadoutList() {
    const nextSavedLoadouts = await listSavedLoadouts();
    setSavedLoadouts(nextSavedLoadouts);
    return nextSavedLoadouts;
  }

  function refreshCurrentSavedSelections() {
    setCurrentSavedLoadoutSelections(getCurrentSavedLoadoutSelections(localStorage));
  }

  function navigate(key) {
    setActiveKey(key);
    localStorage.setItem("activeKey", key);
    history.pushState({ key }, "", `#${key}`);
  }

  useEffect(() => {
    function onPopState(e) {
      const key = e.state?.key ?? window.location.hash.slice(1) ?? "home";
      setActiveKey(key);
      localStorage.setItem("activeKey", key);
    }
    window.addEventListener("popstate", onPopState);
    // Seed the initial history entry so back works from first page
    history.replaceState({ key: activeKey }, "", `#${activeKey}`);
    return () => window.removeEventListener("popstate", onPopState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNotation(val) {
    setNotation(val);
    localStorage.setItem("notation", val);
    schedulePersistLoadoutRuntime(localStorage);
  }

  function openModal(item, formula) {
    setModalItem(item);
    setModalFormula(formula);
  }

  function handleMapSpotsChange(mapId, nextSpots) {
    setMapSpotsById((current) => ({
      ...current,
      [mapId]: normalizeMapSpots(mapId, nextSpots),
    }));
  }

  function handleMapsJsonHydrate(rawJsonText) {
    setMapSpotsById((current) => parseMapSpotsByIdFromJsonText(rawJsonText, current));
  }

  function openCreateSaveModal() {
    setSaveDraftName(currentSavedLoadout?.name ?? "");
    setSaveDraftDescription(currentSavedLoadout?.description ?? "");
    setIsSaveModalOpen(true);
  }

  async function handleSaveButtonClick() {
    if (!isLoadoutRuntimeReady || saveButtonBusy) {
      return;
    }

    if (!currentSavedLoadoutId) {
      openCreateSaveModal();
      return;
    }

    if (!isCurrentSavedLoadoutDirty) {
      return;
    }

    try {
      setSaveButtonBusy(true);
      await saveWorkingLoadoutChanges(currentSavedLoadoutId, localStorage);
      refreshCurrentSavedSelections();
      await refreshSavedLoadoutList();
      setCurrentSavedLoadoutComparable(buildComparableLoadoutScopePayload(localStorage, activeLoadoutScope.scopeId, activeLoadoutScope.scopeContext));
      setSaveButtonMessage({ type: "success", text: "Saved changes." });
    } catch (error) {
      setSaveButtonMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to save changes." });
    } finally {
      setSaveButtonBusy(false);
    }
  }

  async function handleCreateSaveSubmit() {
    const trimmedName = saveDraftName.trim();
    if (!trimmedName) {
      setSaveButtonMessage({ type: "error", text: "Give the save a name first." });
      return;
    }

    try {
      setSaveButtonBusy(true);
      await saveWorkingLoadoutAsRecord({
        name: trimmedName,
        description: saveDraftDescription,
        scopeId: activeLoadoutScope.scopeId,
        scopeContext: activeLoadoutScope.scopeContext,
      }, localStorage);
      refreshCurrentSavedSelections();
      await refreshSavedLoadoutList();
      setCurrentSavedLoadoutComparable(buildComparableLoadoutScopePayload(localStorage, activeLoadoutScope.scopeId, activeLoadoutScope.scopeContext));
      setIsSaveModalOpen(false);
      setSaveButtonMessage({ type: "success", text: "Saved loadout." });
    } catch (error) {
      setSaveButtonMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to save that loadout." });
    } finally {
      setSaveButtonBusy(false);
    }
  }

  async function handleLoadSavedLoadout(saveId) {
    const record = await loadSavedLoadoutIntoWorkingState(saveId, localStorage);
    refreshCurrentSavedSelections();
    setCurrentSavedLoadoutComparable(buildComparableLoadoutScopePayload(localStorage, record.scopeId, record.scopeContext));
    setNotation(localStorage.getItem("notation") ?? "scientific");
    setLoadoutImportVersion((current) => current + 1);
    return record;
  }

  async function handleUpdateSavedLoadout(saveId, updates) {
    const record = await updateSavedLoadout(saveId, updates);
    await refreshSavedLoadoutList();
    refreshCurrentSavedSelections();
    return record;
  }

  async function handleDeleteSavedLoadout(saveId) {
    await deleteSavedLoadout(saveId);

    if (removeSavedLoadoutIdFromSelections(saveId, localStorage)) {
      await persistLoadoutRuntime(localStorage);
    }

    refreshCurrentSavedSelections();
    if (currentSavedLoadoutId === saveId) {
      setCurrentSavedLoadoutComparable(null);
    }
    await refreshSavedLoadoutList();
  }

  async function handleStartFreshSave() {
    await startFreshWorkingLoadout(localStorage);
    refreshCurrentSavedSelections();
    setCurrentSavedLoadoutComparable(null);
    setNotation(localStorage.getItem("notation") ?? "scientific");
    setLoadoutImportVersion((current) => current + 1);
  }

  async function handleImportComplete(summary) {
    await refreshSavedLoadoutList();

    if (currentSavedLoadoutId && summary.updatedIds.includes(currentSavedLoadoutId)) {
      await handleLoadSavedLoadout(currentSavedLoadoutId);
      return;
    }

    refreshCurrentSavedSelections();
  }

  const activeSection = SECTION_MAP[activeKey];

  if (!isLoadoutRuntimeReady) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: colors.bg, color: colors.text, fontFamily: "'Exo 2', 'Rajdhani', 'Segoe UI', sans-serif" }}>
        <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.panel, boxShadow: "0 18px 60px rgba(0,0,0,0.28)" }}>
          Loading saved loadouts...
        </div>
      </div>
    );
  }

  return (
    <NotationContext.Provider value={notation}>
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", fontFamily: "'Exo 2', 'Rajdhani', 'Segoe UI', sans-serif", color: colors.text, background: colors.bg }}>

      {/* Header */}
      <div className="app-header-shell" style={{ background: colors.panel, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        {isMobile && (
          <button onClick={() => setDrawerOpen(o => !o)}
            className="app-header-shell__menu-button"
            style={{ color: colors.text }}>
            ☰
          </button>
        )}
  <div className="app-header-shell__brand" style={{ padding: "14px 0" }} onClick={() => navigate("home")}>
          <div style={{ fontSize: 17, fontWeight: 900, color: colors.accent, letterSpacing: "0.06em", textTransform: "uppercase", textShadow: "0 0 12px rgba(245,146,30,0.4)" }}>Idle Hero TD</div>
          <div style={{ fontSize: 11, color: colors.muted, marginTop: 1, letterSpacing: "0.04em" }}>Game Data Reference · v15.04</div>
        </div>
        <div className="app-header-toolbar">
          <RotationEventsBar isMobile={isMobile} />
          <div className="app-header-toolbar__group">
            <span className="app-header-toolbar__label" style={{ color: colors.muted }}>Notation</span>
            <div className="app-header-toolbar__segmented" style={{ borderColor: colors.border }}>
              {[
                { val: "scientific", label: "Scientific", example: "1.23e15" },
                { val: "letters", label: "Letters", example: "aa, ab..." },
              ].map(({ val, label, example }) => {
                const isActive = notation === val;
                return (
                  <button
                    key={val}
                    onClick={() => handleNotation(val)}
                    className={`app-header-toolbar__segment${isActive ? " app-header-toolbar__segment--active" : ""}`}
                    style={{
                      background: isActive ? colors.accent : "transparent",
                      color: isActive ? "#08111d" : colors.text,
                    }}
                  >
                    <span className="app-header-toolbar__segment-label">{label}</span>
                    <span className="app-header-toolbar__segment-example" style={{ color: isActive ? "rgba(8, 17, 29, 0.78)" : colors.muted }}>{example}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div style={{ display: "flex", flex: 1, position: "relative" }}>

        {/* Backdrop for mobile drawer */}
        {isMobile && drawerOpen && (
          <div onClick={() => setDrawerOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 199 }} />
        )}

        <Sidebar
          activeKey={activeKey}
          onSelect={key => navigate(key)}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          navGroups={visibleNavGroups}
        />

        {/* Main content */}
        <div style={{ flex: 1, padding: isMobile ? "16px" : "28px", overflowY: "auto", minWidth: 0 }}>
          {activeSection && activeKey !== "tech" && (
            <SheetView
              sectionData={activeSection.data}
              onOpen={item => openModal(item, activeSection.data.costFormula)}
            />
          )}
          {activeKey === "tech" && (
            <TechTreeView onOpen={item => openModal(item, SECTION_MAP["tech"].data.costFormula)} />
          )}
          {activeKey === "allHeroes"  && (
            <Suspense fallback={lazyFallback}>
              <AllHeroesRoute colors={colors} Badge={Badge} getIconUrl={getIconUrl} />
            </Suspense>
          )}
          {activeKey === "synergies"  && (
            <Suspense fallback={lazyFallback}>
              <AllSynergiesRoute colors={colors} Badge={Badge} getIconUrl={getIconUrl} />
            </Suspense>
          )}
          {activeKey === "milestones" && (
            <Suspense fallback={lazyFallback}>
              <AllMilestonesRoute colors={colors} Badge={Badge} getIconUrl={getIconUrl} />
            </Suspense>
          )}
          {activeKey === "rankExp"    && <RankExpView />}
          {activeKey === "attributes"   && <AttributesView />}
          {activeKey === "combatStyles" && (
            <Suspense fallback={lazyFallback}>
              <CombatStylesView colors={colors} isMobile={isMobile} />
            </Suspense>
          )}
          {activeKey === "rankRequired" && <RankRequiredView />}
          {activeKey === "enemyHp"      && (
            <Suspense fallback={lazyFallback}>
              <EnemyHpView colors={colors} fmt={fmt} getIconUrl={getIconUrl} isMobile={isMobile} />
            </Suspense>
          )}
          {activeKey === "resourceOptimizer" && (
            <Suspense fallback={lazyFallback}>
              <ResourceOptimizerView colors={colors} fmt={fmt} getIconUrl={getIconUrl} isMobile={isMobile} />
            </Suspense>
          )}
          {activeKey === "home"       && (
            <Suspense fallback={lazyFallback}>
              <HomeView
                colors={colors}
                getIconUrl={getIconUrl}
                isMobile={isMobile}
                isAdmin={isLocalAdmin}
                onNavigate={key => { setActiveKey(key); localStorage.setItem("activeKey", key); }}
              />
            </Suspense>
          )}
          {activeKey === "brackets"   && (
            <Suspense fallback={lazyFallback}>
              <BracketsView
                colors={colors}
                getIconUrl={getIconUrl}
                tournamentBracketsData={tournamentBracketsData}
              />
            </Suspense>
          )}
          {activeKey === "allMaps"    && (
            <Suspense fallback={lazyFallback}>
              <AllMapsRoute colors={colors} Badge={Badge} getIconUrl={getIconUrl} />
            </Suspense>
          )}
          {activeKey === "mapPerks"   && (
            <Suspense fallback={lazyFallback}>
              <MapPerksView colors={colors} getIconUrl={getIconUrl} />
            </Suspense>
          )}
          {MAP_LOADOUT_ROUTE_KEYS.has(activeKey) && (
            <Suspense fallback={lazyFallback}>
              <LoadoutBuilderView
                key={`loadout-builder-${loadoutImportVersion}`}
                colors={colors}
                getIconUrl={getIconUrl}
                fmt={fmt}
                maps={editableMaps}
                heroes={heroesData.heroes}
                savedLoadouts={savedLoadouts}
                currentSavedLoadoutId={currentSavedLoadoutId}
                onLoadSave={handleLoadSavedLoadout}
                onDeleteSave={handleDeleteSavedLoadout}
                onUpdateSave={handleUpdateSavedLoadout}
                onImportComplete={handleImportComplete}
                forcedBuilderMode={getMapLoadoutModeFromRoute(activeKey)}
                saveButton={pageSaveButton}
                onNavigate={key => { setActiveKey(key); localStorage.setItem("activeKey", key); }}
              />
            </Suspense>
          )}
          {activeKey === "heroLoadout" && (
            <Suspense fallback={lazyFallback}>
              <HeroLoadoutView
                key={`hero-loadout-${loadoutImportVersion}`}
                colors={colors}
                getIconUrl={getIconUrl}
                fmt={fmt}
                heroes={heroesData.heroes}
                savedLoadouts={savedLoadouts}
                currentSavedLoadoutId={currentSavedLoadoutId}
                onLoadSave={handleLoadSavedLoadout}
                onDeleteSave={handleDeleteSavedLoadout}
                onImportComplete={handleImportComplete}
                saveButton={pageSaveButton}
              />
            </Suspense>
          )}
          {activeKey === "statsLoadout" && (
            <Suspense fallback={lazyFallback}>
              <StatsLoadoutView
                key={`stats-loadout-${loadoutImportVersion}`}
                colors={colors}
                getIconUrl={getIconUrl}
                fmt={fmt}
                savedLoadouts={savedLoadouts}
                currentSavedLoadoutId={currentSavedLoadoutId}
                onLoadSave={handleLoadSavedLoadout}
                onDeleteSave={handleDeleteSavedLoadout}
                onImportComplete={handleImportComplete}
                saveButton={pageSaveButton}
              />
            </Suspense>
          )}
          {activeKey === "playerLoadout" && (
            <Suspense fallback={lazyFallback}>
              <PlayerLoadoutView
                key={`player-loadout-${loadoutImportVersion}`}
                colors={colors}
                getIconUrl={getIconUrl}
                fmt={fmt}
                savedLoadouts={savedLoadouts}
                currentSavedLoadoutId={currentSavedLoadoutId}
                onLoadSave={handleLoadSavedLoadout}
                onDeleteSave={handleDeleteSavedLoadout}
                onImportComplete={handleImportComplete}
                saveButton={pageSaveButton}
              />
            </Suspense>
          )}
          {activeKey === "saves" && (
            <Suspense fallback={lazyFallback}>
              <SavesView
                colors={colors}
                saves={savedLoadouts}
                currentSavedLoadoutSelections={currentSavedLoadoutSelections}
                onLoadSave={handleLoadSavedLoadout}
                onDeleteSave={handleDeleteSavedLoadout}
                onStartFreshSave={handleStartFreshSave}
                onImportComplete={handleImportComplete}
              />
            </Suspense>
          )}
          {activeKey === "statsHub" && (
            <Suspense fallback={lazyFallback}>
              <StatsHubView
                key={`stats-hub-${loadoutImportVersion}`}
                colors={colors}
                fmt={fmt}
                getIconUrl={getIconUrl}
                heroes={heroesData.heroes}
              />
            </Suspense>
          )}
          {activeKey === "statSimulator" && (
            <Suspense fallback={lazyFallback}>
              <StatSimulatorView
                colors={colors}
                getIconUrl={getIconUrl}
              />
            </Suspense>
          )}
          {activeKey === "coordFinder" && isLocalAdmin && (
            <Suspense fallback={lazyFallback}>
              <CoordFinderView
                colors={colors}
                getIconUrl={getIconUrl}
                maps={editableMaps}
                heroes={heroesData.heroes}
                onMapSpotsChange={handleMapSpotsChange}
                onMapsJsonHydrate={handleMapsJsonHydrate}
                onNavigate={key => { setActiveKey(key); localStorage.setItem("activeKey", key); }}
              />
            </Suspense>
          )}
          {activeKey === "battpassExp" && (
            <Suspense fallback={lazyFallback}>
              <BattlepassExpView colors={colors} fmt={fmt} />
            </Suspense>
          )}
          {activeKey === "wavePerks" && (
            <Suspense fallback={lazyFallback}>
              <WavePerksView
                colors={colors}
                getIconUrl={getIconUrl}
                isMobile={isMobile}
                rarityColors={RARITY_COLORS}
                mapPerkUpgradeSources={MAP_PERK_UPGRADE_SOURCES}
              />
            </Suspense>
          )}
          {activeKey === "challenges" && (
            <Suspense fallback={lazyFallback}>
              <ChallengesView colors={colors} getIconUrl={getIconUrl} />
            </Suspense>
          )}
          {activeKey === "playerIcons" && (
            <Suspense fallback={lazyFallback}>
              <PlayerIconsView colors={colors} getIconUrl={getIconUrl} fmt={fmt} />
            </Suspense>
          )}
          {activeKey === "playerBackgrounds" && (
            <Suspense fallback={lazyFallback}>
              <PlayerBackgroundsView colors={colors} getIconUrl={getIconUrl} />
            </Suspense>
          )}
          {activeKey === "heroGoldCost" && <HeroGoldCostView />}
          {activeKey === "ultimusTokens" && <UltimusTokensView />}
          {activeKey === "immortalBrackets" && <ImmortalBracketsView />}
        </div>

      </div>

      {modalItem && (
        <CostModal
          item={modalItem}
          sectionFormula={modalFormula}
          onClose={() => setModalItem(null)}
        />
      )}
      {isSaveModalOpen && (
        <div onClick={() => setIsSaveModalOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(3,8,18,0.78)", backdropFilter: "blur(8px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "100%", maxWidth: 620, borderRadius: 18, border: `1px solid ${colors.border}`, background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 26%, ${colors.bg} 100%)`, boxShadow: "0 24px 80px rgba(0,0,0,0.42)", overflow: "hidden" }}>
            <div style={{ padding: 20, borderBottom: `1px solid ${colors.border}`, display: "grid", gap: 4 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Save {saveButtonBaseLabel}</div>
              <div style={{ fontSize: 13, color: colors.muted }}>Create a saved record for {activeLoadoutScopeLabel.toLowerCase()} so it can be loaded, exported, and imported later.</div>
            </div>
            <div style={{ padding: 20, display: "grid", gap: 14 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Name</span>
                <input value={saveDraftName} onChange={(event) => setSaveDraftName(event.target.value)} placeholder="Example: Tournament Push" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 14px", fontFamily: "inherit", fontSize: 14 }} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Description</span>
                <textarea value={saveDraftDescription} onChange={(event) => setSaveDraftDescription(event.target.value)} placeholder="Optional notes about the build, map, or use case." rows={4} style={{ resize: "vertical", background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 14px", fontFamily: "inherit", fontSize: 14 }} />
              </label>
              <div style={{ display: "flex", justifyContent: "end", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => setIsSaveModalOpen(false)} style={{ background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>Cancel</button>
                <button onClick={handleCreateSaveSubmit} style={{ background: colors.accent, color: "#08111d", border: `1px solid ${colors.accent}`, borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>Save {saveButtonBaseLabel}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </NotationContext.Provider>
  );
}
