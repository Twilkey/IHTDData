import combatStylesData from "../data/combat_styles.json";
import { heroList } from "./gameData";

export const COMBAT_STYLE_FALLBACK_ID = "balanced";

const COMBAT_STYLE_STAT_KEY_MAP = Object.freeze({
  damage: "damage",
  attSpeed: "attackSpeed",
  attackSpeed: "attackSpeed",
  range: "range",
  critChance: "critChance",
  critDmg: "critDamage",
  critDamage: "critDamage",
  skillCd: "skillCooldown",
  skillCooldown: "skillCooldown",
  skillDuration: "skillDuration",
  skillPower: "skillPower",
  skillPower2: "skillPower",
  masteryPower: "masteryPower",
  killGold: "killGold",
  killExp: "rankExpBonus",
  rankExp: "rankExpBonus",
  superCritChance: "superCritChance",
  superCritDmg: "superCritDamage",
  ultraCritChance: "ultraCritChance",
  ultraCritDmg: "ultraCritDamage",
  superGoldAmt: "superGoldAmount",
  superGoldChance: "superGoldChance",
  superExpChance: "superExpChance",
  superExpAmt: "superExpAmount",
  ultraGoldChance: "ultraGoldChance",
  ultraExpChance: "ultraExpChance",
  instantSkillChance: "instantSkillChance",
  instantSpell: "instantSpellChance",
  synergyBonus: "synergyBonus",
  milestoneBonus: "milestoneBonus",
  splashDamage: "splashDamage",
  bossDamage: "bossDamage",
  bossExp: "bossExp",
  bossGold: "bossGold",
  energyIncome: "energyIncome",
});

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export const COMBAT_STYLE_DEFINITIONS = Object.freeze(
  (combatStylesData.styles ?? []).map((style) => ({
    ...style,
    bonuses: Array.isArray(style.bonuses) ? style.bonuses.map((bonus) => ({ ...bonus })) : [],
  }))
);

export const COMBAT_STYLE_BY_ID = Object.freeze(
  Object.fromEntries(COMBAT_STYLE_DEFINITIONS.map((style) => [style.id, style]))
);

export function getCombatStyle(styleId) {
  return COMBAT_STYLE_BY_ID[styleId] ?? COMBAT_STYLE_BY_ID[COMBAT_STYLE_FALLBACK_ID] ?? null;
}

export function normalizeCombatStyleId(rawStyleId, fallbackId = COMBAT_STYLE_FALLBACK_ID) {
  const styleId = typeof rawStyleId === "string" ? rawStyleId.trim() : "";
  if (styleId && COMBAT_STYLE_BY_ID[styleId]) {
    return styleId;
  }

  return COMBAT_STYLE_BY_ID[fallbackId] ? fallbackId : COMBAT_STYLE_FALLBACK_ID;
}

export function normalizeCombatStyleStatKey(statKey) {
  return COMBAT_STYLE_STAT_KEY_MAP[statKey] ?? statKey ?? null;
}

export function isCombatStyleUnlocked(styleOrId, rank) {
  const style = typeof styleOrId === "string" ? getCombatStyle(styleOrId) : styleOrId;
  const currentRank = Number.parseInt(rank, 10) || 0;
  return currentRank >= (style?.rankReq ?? 0);
}

export function normalizeDefaultCombatStyleIdByHero(rawDefaultCombatStyleIdByHero) {
  return Object.fromEntries(
    heroList.map((hero) => {
      const rawStyleId = typeof rawDefaultCombatStyleIdByHero?.[hero.id] === "string"
        ? rawDefaultCombatStyleIdByHero[hero.id].trim()
        : "";

      return [hero.id, COMBAT_STYLE_BY_ID[rawStyleId] ? rawStyleId : COMBAT_STYLE_FALLBACK_ID];
    })
  );
}

export function getStoredDefaultCombatStyleId(defaultCombatStyleIdByHero, heroId) {
  const rawStyleId = typeof defaultCombatStyleIdByHero?.[heroId] === "string"
    ? defaultCombatStyleIdByHero[heroId].trim()
    : "";

  return COMBAT_STYLE_BY_ID[rawStyleId] ? rawStyleId : COMBAT_STYLE_FALLBACK_ID;
}

export function getDefaultPlacementCombatStyleId(defaultCombatStyleIdByHero, heroId) {
  return getStoredDefaultCombatStyleId(defaultCombatStyleIdByHero, heroId) || COMBAT_STYLE_FALLBACK_ID;
}

export function collectCombatStyleEntries(styleId, options = {}) {
  const {
    currentRank,
    heroId = null,
    system = "combatStyle",
    sourceType = "combatStyle",
    sourceId = styleId,
    sourceLabel,
    personalGroupLabel = "Combat Style Personal",
    globalGroupLabel = "Combat Style Global",
  } = options;
  const style = getCombatStyle(styleId);

  if (!style || !isCombatStyleUnlocked(style, currentRank)) {
    return [];
  }

  return style.bonuses
    .map((bonus, index) => {
      const statKey = normalizeCombatStyleStatKey(bonus?.stat);
      const amount = Number(bonus?.amount);
      if (!statKey || !Number.isFinite(amount) || amount === 0) {
        return null;
      }

      const scope = bonus?.isGlobal ? "global" : "personal";
      return {
        statKey,
        amount,
        valueType: bonus?.isPercent ? "percent" : "flat",
        system,
        sourceType,
        sourceId: `${String(sourceId ?? style.id)}:${index}`,
        sourceLabel: sourceLabel ?? style.name,
        groupLabel: scope === "global" ? globalGroupLabel : personalGroupLabel,
        scope,
        heroId,
        styleId: style.id,
        styleName: style.name,
        rankReq: style.rankReq ?? 0,
      };
    })
    .filter(Boolean);
}

export function isCombatStyleStateObject(value) {
  return isObject(value);
}