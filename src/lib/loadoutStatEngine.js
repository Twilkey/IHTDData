import { collectCombatStyleEntries, getDefaultPlacementCombatStyleId } from "./combatStyles";
import { HERO_ATTRIBUTE_DEFINITIONS, getHeroAttributeTotalValue } from "./heroLoadout";
import { mapsData } from "./gameData";
import { getPerkCurrentBonus } from "./mapLoadout";
import { getPlayerLoadoutPurchasedEntries } from "./playerLoadout";
import { getItemMaxLevel, getTabItems, STATS_LOADOUT_TAB_MAP, STATS_LOADOUT_TABS } from "./statsLoadout";

export const HERO_STAT_BONUS_ALIASES = Object.freeze({
  damage: ["damage", "strength"],
  attackSpeed: ["attackSpeed", "attack_speed", "agility"],
  range: ["range", "hawk_eyes"],
  critChance: ["critChance", "crit_chance", "precision"],
  critDamage: ["critDamage", "crit_damage", "power"],
  skillPower: ["skillPower", "skill_power", "enchanted"],
  skillCooldown: ["skillCooldown", "skill_cooldown", "accelerate"],
  superCritChance: ["superCritChance", "super_crit_chance"],
  superCritDamage: ["superCritDamage", "super_crit_damage"],
  ultraCritChance: ["ultraCritChance", "ultra_crit_chance"],
  ultraCritDamage: ["ultraCritDamage", "ultra_crit_damage"],
});

export const HERO_EFFECT_KEY_MAP = Object.freeze({
  damage: "damage",
  damage2: "damage",
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
  killGold: "killGold",
  killGold2: "killGold",
  killExp: "rankExpBonus",
  rankExp: "rankExpBonus",
  progressiveRankExp: "rankExpBonus",
  superCritChance: "superCritChance",
  superCritDmg: "superCritDamage",
  damage_i_bonus: "damage",
  damage_ii_bonus: "damage",
  crit_damage_max: "critDamage",
  ultraCritDmg: "ultraCritDamage",
  goldSuperAmount: "superGoldAmount",
  superGoldAmt: "superGoldAmount",
  goldSuperChance: "superGoldChance",
  superGoldChance: "superGoldChance",
  expSuperChance: "superExpChance",
  kill_gold_i_bonus: "killGold",
  kill_gold_ii_bonus: "killGold",
  superExpChance: "superExpChance",
  expSuperAmount: "superExpAmount",
  rank_exp_pct: "rankExpBonus",
  rank_exp_bonus: "rankExpBonus",
  superExpAmt: "superExpAmount",
  energySuperChance: "superEnergyChance",
  superEnergyChance: "superEnergyChance",
  energySuperAmount: "superEnergyAmount",
  superEnergyAmt: "superEnergyAmount",
  goldUltraChance: "ultraGoldChance",
  ultraGoldChance: "ultraGoldChance",
  goldUltraAmount: "ultraGoldAmount",
  battlepass_exp: "battlepassExp",
  ultraGoldAmt: "ultraGoldAmount",
  boss_exp: "bossExp",
  boss_exp_max: "bossExp",
  expUltraChance: "ultraExpChance",
  boss_gold: "bossGold",
  boss_gold_max: "bossGold",
  ultraExpChance: "ultraExpChance",
  expUltraAmount: "ultraExpAmount",
  energyUltraChance: "ultraEnergyChance",
  ultraEnergyChance: "ultraEnergyChance",
  energyUltraAmount: "ultraEnergyAmount",
  energyIncome: "energyIncome",
  goblin_hoarder_gold: "goblinHoarderGold",
  battlepassExp: "battlepassExp",
  power_mage_energy: "powerMageEnergy",
  bossExp: "bossExp",
  training_dummy_exp: "trainingDummyExp",
  bossGold: "bossGold",
  bossDmg: "bossDamage",
  bossDamage: "bossDamage",
  prestige_power: "prestigePower",
  prestige_i_bonus: "prestigePower",
  ultraBossDmg: "ultraBossDamage",
  extra_boss_chance: "extraBossChance",
  ultraBossDamage: "ultraBossDamage",
  instantSkillChance: "instantSkillChance",
  instantSpell_powerPlant: "instantSpellPowerPlant",
  power_mage_spawns: "powerMageSpawns",
  instantSpell_timeWarp: "instantSpellTimeWarp",
  power_mage_cooldown: "powerMageCooldown",
  instantRagsToRiches: "instantRagsToRiches",
  goblinHoarderGold: "goblinHoarderGold",
  powerMageEnergy: "powerMageEnergy",
  tournament_trophies: "tournamentTrophies",
  trainingDummyExp: "trainingDummyExp",
  alienTech: "alienTech",
  rune_rarity_chance: "runeRarityChance",
  enemy_hp: "enemyHp",
  enemy_hp_max: "enemyHp",
  shadowRunes: "shadowRunes",
  extraBossChance: "extraBossChance",
  active_play_duration: "activePlayDuration",
  mimicBossChance: "mimicBossChance",
  active_play_reward: "activePlayBonus",
  trainerSpawns: "trainerSpawns",
  wave_perk_effect: "wavePerkBonus",
  bossRushSkip: "bossRushSkip",
  goblin_hoarder_spawns: "goblinHoarderSpawns",
  powerMageSpawns: "powerMageSpawns",
  ultimus_tokens: "ultimusTokens",
  powerMageCooldown: "powerMageCooldown",
  powerMageGoldenChance: "powerMageGoldenChance",
  prestigePower: "prestigePower",
  tournamentTrophies: "tournamentTrophies",
  runeRarityChance: "runeRarityChance",
  enemyHp: "enemyHp",
  enemyMoveSpeed: "enemyMoveSpeed",
  activePlayDuration: "activePlayDuration",
  adBonusReward: "adBonusReward",
  goblinHoarderCooldown: "goblinHoarderCooldown",
  goblinHoarderSpawns: "goblinHoarderSpawns",
  ultimusTokens: "ultimusTokens",
});

function snakeToCamelStatKey(statKey) {
  return String(statKey ?? "").replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export const HERO_STAT_LABELS = Object.freeze({
  damage: "Damage",
  damageMultiplier: "Damage Multiplier",
  attackSpeed: "Attack Speed",
  range: "Range",
  dps: "DPS",
  critChance: "Crit Chance",
  critDamage: "Crit Damage",
  superCritChance: "Super Crit Chance",
  superCritDamage: "Super Crit Damage",
  ultraCritChance: "Ultra Crit Chance",
  ultraCritDamage: "Ultra Crit Damage",
  ultraGoldChance: "Ultra Gold Chance",
  ultraGoldAmount: "Ultra Gold Amount",
  ultraExpChance: "Ultra Exp Chance",
  ultraExpAmount: "Ultra Exp Amount",
  ultraEnergyChance: "Ultra Energy Chance",
  ultraEnergyAmount: "Ultra Energy Amount",
  skillPower: "Skill Power",
  masteryPower: "Mastery Power",
  skillCooldown: "Skill Cooldown",
  skillDuration: "Skill Duration",
  killGold: "Kill Gold",
  killGoldMultiplier: "Kill Gold Multiplier",
  rankExpBonus: "Rank Exp",
  rankExpMultiplier: "Rank Exp Multiplier",
  spellCooldown: "Spell Cooldown",
  superExpChance: "Super Exp Chance",
  superExpAmount: "Super Exp Amount",
  superGoldChance: "Super Gold Chance",
  superGoldAmount: "Super Gold Amount",
  superEnergyChance: "Super Energy Chance",
  superEnergyAmount: "Super Energy Amount",
  activePlayBonus: "Active Play Bonus",
  activePlayDuration: "Active Play Duration",
  wavePerkBonus: "Wave Perk Bonus",
  enemyMoveSpeed: "Enemy Move Speed",
  enemySpawnSpeed: "Enemy Spawn Speed",
  enemyHp: "Enemy HP",
  prestigePower: "Prestige Power",
  prestigePowerMultiplier: "Prestige Power Multiplier",
  battlepassExp: "Battlepass Exp",
  battlepassExpMultiplier: "Battlepass Exp Multiplier",
  energyIncome: "Energy Income",
  bossExp: "Boss Exp",
  bossGold: "Boss Gold",
  bossDamage: "Boss Damage",
  ultraBossDamage: "Ultra Boss Damage",
  goblinHoarderGold: "Goblin Hoarder Gold",
  goblinHoarderCooldown: "Goblin Hoarder Cooldown",
  goblinHoarderSpawns: "Goblin Hoarder Spawns",
  powerMageEnergy: "Power Mage Energy",
  powerMageCooldown: "Power Mage Cooldown",
  powerMageSpawns: "Power Mage Spawns",
  powerMageGoldenChance: "Power Mage Golden Chance",
  trainingDummyExp: "Training Dummy Exp",
  alienTech: "Alien Tech",
  shadowRunes: "Shadow Runes",
  ultimusTokens: "Ultimus Tokens",
  tournamentTrophies: "Tournament Trophies",
  runeRarityChance: "Rune Rarity Chance",
  synergyBonus: "Synergy Effects",
  milestoneBonus: "Milestone Effects",
  mastery2xExpChance: "2x Mastery Exp Chance",
  extraBossChance: "Extra Boss Chance",
  mimicBossChance: "Mimic Boss Chance",
  trainerSpawns: "Trainer Spawns",
  bossRushSkip: "Boss Rush Skip",
  adBonusReward: "Ad Bonus Reward",
});

export const FLAT_HERO_STAT_KEYS = new Set([
  "skillPower",
  "rankExpBonus",
  "skillDuration",
  "superExpAmount",
  "superGoldAmount",
  "superEnergyAmount",
  "ultraGoldAmount",
  "ultraExpAmount",
  "ultraEnergyAmount",
  "energyIncome",
  "battlepassExp",
  "bossExp",
  "bossGold",
  "bossDamage",
  "ultraBossDamage",
  "goblinHoarderGold",
  "powerMageEnergy",
  "trainingDummyExp",
  "alienTech",
  "shadowRunes",
  "tournamentTrophies",
  "ultimusTokens",
  "activePlayDuration",
  "goblinHoarderCooldown",
  "goblinHoarderSpawns",
  "powerMageCooldown",
  "powerMageSpawns",
  "trainerSpawns",
  "bossRushSkip",
]);

export const MULTIPLIER_HERO_STAT_KEYS = new Set([
  "damageMultiplier",
  "killGoldMultiplier",
  "prestigePowerMultiplier",
  "rankExpMultiplier",
  "battlepassExpMultiplier",
]);

const TOP_LEVEL_STAT_KEYS = new Set(["damage", "attackSpeed", "range", "dps"]);
const MAP_PLACEMENT_BONUS_KEY_MAP = Object.freeze({
  damage: "damage",
  attSpeed: "attackSpeed",
  range: "range",
  skillCd: "skillCooldown",
  skillPowerPct: "skillPower",
  killGold: "killGold",
  killExpPct: "rankExpBonus",
  milestoneBonus: "milestoneBonus",
  synergyBonus: "synergyBonus",
  mastery2xExpChance: "mastery2xExpChance",
});

const MAP_PERK_KEY_RULES = Object.freeze([
  ["super_crit_chance", "superCritChance"],
  ["super_crit_damage", "superCritDamage"],
  ["ultra_crit_chance", "ultraCritChance"],
  ["ultra_crit_damage", "ultraCritDamage"],
  ["crit_chance", "critChance"],
  ["crit_damage", "critDamage"],
  ["attack_speed", "attackSpeed"],
  ["skill_cooldown", "skillCooldown"],
  ["spell_cooldown", "spellCooldown"],
  ["skill_power", "skillPower"],
  ["instant_skill_chance", "instantSkillChance"],
  ["instant_spell_chance", "instantSpellChance"],
  ["splash_damage", "splashDamage"],
  ["synergy", "synergyBonus"],
  ["milestone", "milestoneBonus"],
  ["mastery_skill_power", "skillPower"],
  ["2x_mastery_exp_chance", "mastery2xExpChance"],
  ["range", "range"],
  ["damage", "damage"],
  ["kill_gold", "killGold"],
  ["rank_exp", "rankExpBonus"],
  ["super_exp_chance", "superExpChance"],
  ["super_exp_amount", "superExpAmount"],
  ["super_gold_chance", "superGoldChance"],
  ["super_gold_amount", "superGoldAmount"],
  ["super_energy_chance", "superEnergyChance"],
  ["super_energy_amount", "superEnergyAmount"],
  ["active_play_bonus", "activePlayBonus"],
  ["wave_perk", "wavePerkBonus"],
  ["enemy_move_speed", "enemyMoveSpeed"],
  ["enemy_spawn_speed", "enemySpawnSpeed"],
  ["prestige_power", "prestigePower"],
  ["battlepass_exp", "battlepassExp"],
  ["extra_boss_chance", "extraBossChance"],
  ["mimic_boss_chance", "mimicBossChance"],
  ["trainer_spawns", "trainerSpawns"],
  ["boss_rush_skip", "bossRushSkip"],
  ["power_mage_spawns", "powerMageSpawns"],
  ["power_mage_cooldown", "powerMageCooldown"],
  ["power_mage_golden_chance", "powerMageGoldenChance"],
]);

function addBonusTotal(target, key, amount) {
  if (!key || !Number.isFinite(Number(amount))) {
    return target;
  }

  if (MULTIPLIER_HERO_STAT_KEYS.has(key)) {
    target[key] = (target[key] ?? 1) * Number(amount);
    return target;
  }

  target[key] = (target[key] ?? 0) + Number(amount);
  return target;
}

export function mergeBonusTotals(...sources) {
  const totals = {};

  sources.forEach((source) => {
    Object.entries(source ?? {}).forEach(([key, amount]) => {
      addBonusTotal(totals, key, amount);
    });
  });

  return totals;
}

export function normalizeHeroEffectBonusKey(statKey) {
  if (statKey == null) {
    return null;
  }

  return HERO_EFFECT_KEY_MAP[statKey] ?? snakeToCamelStatKey(statKey);
}

export function addNormalizedBonusTotal(target, statKey, amount) {
  return addBonusTotal(target, normalizeHeroEffectBonusKey(statKey), amount);
}

export function normalizeBonusTotals(source) {
  const totals = {};

  Object.entries(source ?? {}).forEach(([key, amount]) => {
    addNormalizedBonusTotal(totals, key, amount);
  });

  return totals;
}

function sumBonusTotals(totals, aliases = []) {
  return aliases.reduce((sum, key) => sum + (totals[key] ?? 0), 0);
}

export function formatStatLabel(statKey) {
  return HERO_STAT_LABELS[statKey] ?? String(statKey ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatHeroStatValue(value, fmt) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? "-");
  }

  return Number.isInteger(numeric)
    ? (typeof fmt === "function" ? fmt(numeric) : numeric.toString())
    : numeric.toFixed(2).replace(/\.00$/, "");
}

export function formatSignedHeroBonus(key, amount, fmt) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) {
    return String(amount ?? "-");
  }

  if (MULTIPLIER_HERO_STAT_KEYS.has(key)) {
    return `x${formatHeroStatValue(numeric, fmt)}`;
  }

  const prefix = numeric > 0 ? "+" : "";
  if (FLAT_HERO_STAT_KEYS.has(key)) {
    return `${prefix}${formatHeroStatValue(numeric, fmt)}`;
  }

  return `${prefix}${formatHeroStatValue(numeric, fmt)}%`;
}

export function getHeroAttributeBonusTotals(levelsByAttributeId, scope) {
  const totals = {};

  HERO_ATTRIBUTE_DEFINITIONS
    .filter((attribute) => attribute.scope === scope)
    .forEach((attribute) => {
      const level = levelsByAttributeId?.[attribute.id] ?? 0;
      if (level <= 0) {
        return;
      }

      addNormalizedBonusTotal(totals, attribute.statKey, getHeroAttributeTotalValue(attribute, level));
    });

  return totals;
}

function createEntry(statKey, amount, system, sourceType, sourceId, sourceLabel, meta = {}) {
  return {
    statKey: normalizeHeroEffectBonusKey(statKey),
    amount: Number(amount) || 0,
    system,
    sourceType,
    sourceId,
    sourceLabel,
    ...meta,
  };
}

function getEntryValueKind(entry, statKey) {
  if (entry?.valueType === "flat" || entry?.valueType === "percent" || entry?.valueType === "multiplier") {
    return entry.valueType;
  }

  if (MULTIPLIER_HERO_STAT_KEYS.has(statKey)) {
    return "multiplier";
  }

  return FLAT_HERO_STAT_KEYS.has(statKey) ? "flat" : "percent";
}

function formatBreakdownSourceLabel(sourceLabel, valueKind) {
  const baseLabel = String(sourceLabel ?? "Other");
  if (valueKind === "multiplier") {
    return `${baseLabel} (x)`;
  }

  return `${baseLabel} (${valueKind === "flat" ? "Flat" : "%"})`;
}

export function collectUpgradeEntries(levelsByTab) {
  const entries = [];

  STATS_LOADOUT_TABS.forEach((tab) => {
    const currentLevels = levelsByTab?.[tab.key] ?? {};

    getTabItems(tab.key).forEach((item) => {
      const rawLevel = Number.parseInt(currentLevels[item.id], 10) || 0;
      const level = Math.max(0, Math.min(rawLevel, getItemMaxLevel(item)));
      if (level <= 0 || item.statAmt == null || !item.statKey) {
        return;
      }

      entries.push(
        createEntry(
          item.statKey,
          item.statAmt * level,
          "upgradesLoadout",
          tab.key,
          item.id,
          `${STATS_LOADOUT_TAB_MAP[tab.key]?.label ?? tab.label}: ${item.name}`,
          {
            level,
            perLevel: item.statAmt,
            groupLabel: tab.label,
          }
        )
      );
    });
  });

  return entries;
}

export function collectHeroAttributeEntries(heroLoadoutState, heroId, scope) {
  const entries = [];
  const levelsByAttributeId = heroLoadoutState?.attributeLevelsByHero?.[heroId] ?? {};

  HERO_ATTRIBUTE_DEFINITIONS
    .filter((attribute) => attribute.scope === scope)
    .forEach((attribute) => {
      const level = Number.parseInt(levelsByAttributeId[attribute.id], 10) || 0;
      if (level <= 0) {
        return;
      }

      entries.push(
        createEntry(
          attribute.statKey,
          getHeroAttributeTotalValue(attribute, level),
          "heroLoadout",
          scope,
          attribute.id,
          attribute.name,
          {
            heroId,
            level,
            groupLabel: scope === "global" ? "Hero Global Attributes" : "Hero Personal Attributes",
          }
        )
      );
    });

  return entries;
}

export function buildStatBreakdown(entries) {
  const totals = {};
  const byStat = {};

  entries.forEach((entry) => {
    if (!entry?.statKey || !Number.isFinite(Number(entry.amount)) || Number(entry.amount) === 0) {
      return;
    }

    const statKey = normalizeHeroEffectBonusKey(entry.statKey);
    const valueKind = getEntryValueKind(entry, statKey);

    if (valueKind === "multiplier") {
      totals[statKey] = (totals[statKey] ?? 1) * Number(entry.amount);
    } else {
      totals[statKey] = (totals[statKey] ?? 0) + Number(entry.amount);
    }

    if (!byStat[statKey]) {
      byStat[statKey] = {
        statKey,
        label: formatStatLabel(statKey),
        total: valueKind === "multiplier" ? 1 : 0,
        groupedEntries: {},
        entries: [],
      };
    }

    if (valueKind === "multiplier") {
      byStat[statKey].total *= Number(entry.amount);
    } else {
      byStat[statKey].total += Number(entry.amount);
    }

    const sourceGroup = String(entry.groupLabel ?? entry.sourceType ?? entry.sourceLabel ?? "Other");
    const aggregateKey = `${String(entry.system ?? "")}|${sourceGroup}|${valueKind}`;
    const statGroup = byStat[statKey];

    if (!statGroup.groupedEntries[aggregateKey]) {
      statGroup.groupedEntries[aggregateKey] = {
        ...entry,
        statKey,
        amount: valueKind === "multiplier" ? 1 : 0,
        sourceId: aggregateKey,
        sourceLabel: formatBreakdownSourceLabel(sourceGroup, valueKind),
        groupLabel: sourceGroup,
        valueType: valueKind,
        mergedEntryCount: 0,
      };
    }

    if (valueKind === "multiplier") {
      statGroup.groupedEntries[aggregateKey].amount *= Number(entry.amount);
    } else {
      statGroup.groupedEntries[aggregateKey].amount += Number(entry.amount);
    }

    statGroup.groupedEntries[aggregateKey].mergedEntryCount += 1;
  });

  const orderedStats = Object.values(byStat).sort((left, right) => left.label.localeCompare(right.label));
  orderedStats.forEach((item) => {
    item.entries = Object.values(item.groupedEntries);
    delete item.groupedEntries;

    item.entries.sort((left, right) => {
      const systemDelta = String(left.system ?? "").localeCompare(String(right.system ?? ""));
      if (systemDelta !== 0) {
        return systemDelta;
      }

      const groupDelta = String(left.groupLabel ?? "").localeCompare(String(right.groupLabel ?? ""));
      if (groupDelta !== 0) {
        return groupDelta;
      }

      return String(left.sourceLabel ?? "").localeCompare(String(right.sourceLabel ?? ""));
    });
  });

  return {
    totals: normalizeBonusTotals(totals),
    byStat,
    orderedStats,
    entries,
  };
}

function normalizeMapPlacementBonusKey(statKey) {
  return MAP_PLACEMENT_BONUS_KEY_MAP[statKey] ?? null;
}

function inferMapPerkBonusKey(perk) {
  const rawId = String(perk?.id ?? "").toLowerCase();
  const rawName = String(perk?.name ?? "").toLowerCase().replace(/[%()\s+-]+/g, "_");
  const searchValue = `${rawId} ${rawName}`;

  for (const [needle, key] of MAP_PERK_KEY_RULES) {
    if (searchValue.includes(needle)) {
      return key;
    }
  }

  return null;
}

export function collectMapGlobalEntries(mapLoadoutState, selectedMapId) {
  const selectedMap = mapsData.maps.find((map) => map.id === selectedMapId) ?? null;
  if (!selectedMap) {
    return [];
  }

  const perkStateById = mapLoadoutState?.perksByMap?.[selectedMap.id] ?? {};
  const entries = [];

  (selectedMap.perks ?? []).forEach((perk) => {
    const perkState = perkStateById[perk.id];
    if (!perkState?.equipped) {
      return;
    }

    const statKey = inferMapPerkBonusKey(perk);
    if (!statKey) {
      return;
    }

    entries.push(
      createEntry(
        statKey,
        getPerkCurrentBonus(perk, perkState.level ?? 0),
        "mapLoadout",
        "selectedMap",
        perk.id,
        `${selectedMap.name}: ${perk.name}`,
        {
          level: perkState.level ?? 0,
          groupLabel: "Map Global Perks",
        }
      )
    );
  });

  if (selectedMap.negativePerk?.statKey && Number.isFinite(Number(selectedMap.negativePerk.statAmt))) {
    const statKey = normalizeMapPlacementBonusKey(selectedMap.negativePerk.statKey);
    if (statKey) {
      entries.push(
        createEntry(
          statKey,
          Number(selectedMap.negativePerk.statAmt),
          "mapLoadout",
          "selectedMapNegative",
          `${selectedMap.id}-negative`,
          `${selectedMap.name}: ${selectedMap.negativePerk.name ?? "Negative Perk"}`,
          {
            groupLabel: "Map Global Perks",
          }
        )
      );
    }
  }

  return entries;
}

export function buildGlobalLoadoutStatModel({ statsLoadoutState, playerLoadoutState, mapLoadoutState, selectedMapId }) {
  const entries = [
    ...collectUpgradeEntries(statsLoadoutState?.levelsByTab),
    ...getPlayerLoadoutPurchasedEntries(playerLoadoutState),
    ...collectMapGlobalEntries(mapLoadoutState, selectedMapId),
  ];

  return buildStatBreakdown(entries);
}

export function buildHeroUpgradeStats(hero, bonusTotals) {
  const baseStats = hero.baseStats ?? {};
  const damageBonus = sumBonusTotals(bonusTotals, HERO_STAT_BONUS_ALIASES.damage);
  const damageMultiplier = Number(bonusTotals.damageMultiplier) || 1;
  const attackSpeedBonus = sumBonusTotals(bonusTotals, HERO_STAT_BONUS_ALIASES.attackSpeed);
  const rangeBonus = sumBonusTotals(bonusTotals, HERO_STAT_BONUS_ALIASES.range);
  const skillCooldownBonus = sumBonusTotals(bonusTotals, HERO_STAT_BONUS_ALIASES.skillCooldown);
  const adjustedSkillCooldown = typeof hero.skill?.cooldown === "number"
    ? Math.max(0, hero.skill.cooldown * (1 - skillCooldownBonus / 100))
    : null;

  const adjustedBaseStats = { ...baseStats };

  if (typeof adjustedBaseStats.damage === "number") {
    adjustedBaseStats.damage = adjustedBaseStats.damage * (1 + damageBonus / 100) * damageMultiplier;
  }

  if (typeof adjustedBaseStats.attackSpeed === "number") {
    adjustedBaseStats.attackSpeed = adjustedBaseStats.attackSpeed * (1 + attackSpeedBonus / 100);
  }

  if (typeof adjustedBaseStats.range === "number") {
    adjustedBaseStats.range = adjustedBaseStats.range * (1 + rangeBonus / 100);
  }

  if (typeof adjustedBaseStats.dps === "number") {
    adjustedBaseStats.dps = adjustedBaseStats.dps * (1 + damageBonus / 100) * damageMultiplier * (1 + attackSpeedBonus / 100);
  }

  const topLevelDisplayStats = Object.entries(adjustedBaseStats).map(([key, value]) => ({
    key,
    label: formatStatLabel(key),
    value: formatHeroStatValue(value),
    baseValue: baseStats[key],
    bonusLabel: (() => {
      if (key === "damage" && (damageBonus || damageMultiplier > 1)) {
        const segments = [];
        if (damageBonus) {
          segments.push(formatSignedHeroBonus(key, damageBonus));
        }
        if (damageMultiplier > 1) {
          segments.push(formatSignedHeroBonus("damageMultiplier", damageMultiplier));
        }
        return `${segments.join(" and ")} from loadouts`;
      }
      if (key === "attackSpeed" && attackSpeedBonus) return `${formatSignedHeroBonus(key, attackSpeedBonus)} from loadouts`;
      if (key === "range" && rangeBonus) return `${formatSignedHeroBonus(key, rangeBonus)} from loadouts`;
      if (key === "dps" && (damageBonus || damageMultiplier > 1 || attackSpeedBonus)) return "Damage and attack speed applied";
      return null;
    })(),
  }));

  const derivedStats = Object.entries(normalizeBonusTotals(bonusTotals))
    .filter(([key, bonus]) => bonus && !TOP_LEVEL_STAT_KEYS.has(key))
    .map(([key, bonus]) => ({
      key,
      label: formatStatLabel(key),
      value: key === "skillCooldown" && adjustedSkillCooldown != null
        ? `${formatHeroStatValue(adjustedSkillCooldown)}s`
        : formatSignedHeroBonus(key, bonus),
      baseValue: key === "skillCooldown" ? hero.skill?.cooldown ?? null : null,
      bonusLabel: key === "skillCooldown" && adjustedSkillCooldown != null
        ? `${formatSignedHeroBonus(key, bonus)} reduction from active bonuses`
        : "Active bonus",
    }));

  return {
    adjustedBaseStats,
    displayStats: [...topLevelDisplayStats, ...derivedStats],
    adjustedSkill: adjustedSkillCooldown != null
      ? {
          ...hero.skill,
          cooldown: adjustedSkillCooldown,
        }
      : hero.skill,
  };
}

export function buildHeroStatModel({ hero, statsLoadoutState, playerLoadoutState, heroLoadoutState, mapLoadoutState, selectedMapId }) {
  const globalModel = buildGlobalLoadoutStatModel({ statsLoadoutState, playerLoadoutState, mapLoadoutState, selectedMapId });
  const currentRank = Number.parseInt(heroLoadoutState?.rankByHero?.[hero.id], 10) || 0;
  const defaultCombatStyleEntries = collectCombatStyleEntries(
    getDefaultPlacementCombatStyleId(heroLoadoutState?.defaultCombatStyleIdByHero, hero.id),
    {
      currentRank,
      heroId: hero.id,
      system: "heroCombatStyle",
      sourceType: "heroCombatStyle",
      sourceId: hero.id,
      sourceLabel: "Default Combat Style",
      personalGroupLabel: "Hero Combat Style Personal",
      globalGroupLabel: "Hero Combat Style Global",
    }
  );
  const personalEntries = [
    ...collectHeroAttributeEntries(heroLoadoutState, hero.id, "personal"),
    ...defaultCombatStyleEntries.filter((entry) => entry.scope === "personal"),
  ];
  const conditionalGlobalEntries = [
    ...collectHeroAttributeEntries(heroLoadoutState, hero.id, "global"),
    ...defaultCombatStyleEntries.filter((entry) => entry.scope === "global"),
  ];

  const heroApplicableEntries = [
    ...globalModel.entries,
    ...personalEntries,
    ...conditionalGlobalEntries,
  ];

  const heroBreakdown = buildStatBreakdown(heroApplicableEntries);
  const heroUpgradeStats = buildHeroUpgradeStats(hero, heroBreakdown.totals);

  return {
    global: globalModel,
    personal: buildStatBreakdown(personalEntries),
    conditionalGlobal: buildStatBreakdown(conditionalGlobalEntries),
    combined: heroBreakdown,
    adjustedHero: {
      ...hero,
      baseStats: heroUpgradeStats.adjustedBaseStats,
      upgradeDisplayStats: heroUpgradeStats.displayStats,
      skill: heroUpgradeStats.adjustedSkill,
    },
  };
}