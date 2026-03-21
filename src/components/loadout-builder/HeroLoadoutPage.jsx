import { Fragment, useEffect, useMemo, useState } from "react";

import {
  getHeroMasteryExpCost,
  getHeroAttributePreview,
  HERO_ATTRIBUTE_DEFINITIONS,
  readHeroLoadoutState,
  writeHeroLoadoutState,
} from "../../lib/heroLoadout";
import {
  COMBAT_STYLE_FALLBACK_ID,
  COMBAT_STYLE_DEFINITIONS,
  getCombatStyle,
  getStoredDefaultCombatStyleId,
  isCombatStyleUnlocked,
  normalizeCombatStyleStatKey,
} from "../../lib/combatStyles";
import { LOADOUT_RECORD_SCOPE_HERO } from "../../lib/loadoutScope";
import {
  buildHeroSearchIndex as buildSharedHeroSearchIndex,
  filterHeroes,
  getHeroSubtypeOptions,
  HeroFiltersPanel,
  useHeroFilters,
} from "./HeroFiltersPanel";
import { ScopedLoadoutPresetsPanel } from "./ScopedLoadoutPresetsPanel";

const RARITY_SORT_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Supreme", "Ascended"];
const ATTRIBUTE_GROUPS = [
  { key: "personal", label: "Personal Attributes", description: "Applies to each copy of the selected hero." },
  { key: "global", label: "Global Attributes", description: "Applies to every placed hero when this hero is on the map." },
];
const HERO_DETAIL_TABS = [
  { id: "information", label: "Information" },
  { id: "rankAttributes", label: "Rank & Attributes" },
  { id: "synergies", label: "Synergies" },
  { id: "combatStyles", label: "Combat Styles" },
];
const SYNERGY_TIER_ORDER = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const FILTER_TABS = [
  { id: "search", label: "Search" },
  { id: "identity", label: "Identity" },
  { id: "effects", label: "Effects" },
  { id: "progression", label: "Progression" },
];
const FILTER_SUBTABS = {
  search: [
    { id: "query", label: "Query" },
    { id: "state", label: "State" },
  ],
  identity: [
    { id: "class", label: "Class" },
    { id: "rarity", label: "Rarity" },
  ],
  effects: [
    { id: "type", label: "Type" },
    { id: "subtype", label: "Subtype" },
  ],
  progression: [
    { id: "milestones", label: "Milestones" },
    { id: "synergies", label: "Synergies" },
  ],
};
const DEFAULT_FILTER_SUBTABS = {
  search: "query",
  identity: "class",
  effects: "type",
  progression: "milestones",
};
const SEARCH_SCOPE_OPTIONS = [
  { id: "name", label: "Name" },
  { id: "skills", label: "Skills" },
  { id: "mastery", label: "Mastery" },
  { id: "milestones", label: "Milestones" },
  { id: "synergies", label: "Synergies" },
];
const FLAT_VALUE_KEYS = new Set([
  "skillDuration",
  "skillPower",
  "skillPower2",
  "rankExp",
  "progressiveRankExp",
  "energyIncome",
  "battlepassExp",
  "bossExp",
  "bossGold",
  "goblinHoarderGold",
  "powerMageEnergy",
  "trainingDummyExp",
]);
const HERO_EFFECT_KEY_MAP = Object.freeze({
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
  ultraCritChance: "ultraCritChance",
  ultraCritDmg: "ultraCritDamage",
  goldSuperAmount: "superGoldAmount",
  superGoldAmt: "superGoldAmount",
  goldSuperChance: "superGoldChance",
  superGoldChance: "superGoldChance",
  expSuperChance: "superExpChance",
  superExpChance: "superExpChance",
  expSuperAmount: "superExpAmount",
  superExpAmt: "superExpAmount",
  energySuperChance: "superEnergyChance",
  superEnergyChance: "superEnergyChance",
  energySuperAmount: "superEnergyAmount",
  superEnergyAmt: "superEnergyAmount",
  activePlayBonus: "activePlayBonus",
  milestoneBonus: "milestoneBonus",
  synergyBonus: "synergyBonus",
  mastery2xExpChance: "mastery2xExpChance",
  enemyMoveSpeed: "enemyMoveSpeed",
  enemySpawnSpeed: "enemySpawnSpeed",
  prestigePower: "prestigePower",
  battlepassExp: "battlepassExp",
  energyIncome: "energyIncome",
  bossExp: "bossExp",
  bossGold: "bossGold",
  bossDamage: "bossDamage",
  ultraBossDamage: "ultraBossDamage",
  goblinHoarderGold: "goblinHoarderGold",
  powerMageEnergy: "powerMageEnergy",
  trainingDummyExp: "trainingDummyExp",
  alienTech: "alienTech",
  shadowRunes: "shadowRunes",
  extraBossChance: "extraBossChance",
  mimicBossChance: "mimicBossChance",
  trainerSpawns: "trainerSpawns",
  bossRushSkip: "bossRushSkip",
  powerMageSpawns: "powerMageSpawns",
  powerMageCooldown: "powerMageCooldown",
  powerMageGoldenChance: "powerMageGoldenChance",
});
const HERO_STAT_LABELS = Object.freeze({
  damage: "Damage",
  attackSpeed: "Attack Speed",
  range: "Range",
  critChance: "Crit Chance",
  critDamage: "Crit Damage",
  superCritChance: "Super Crit Chance",
  superCritDamage: "Super Crit Damage",
  ultraCritChance: "Ultra Crit Chance",
  ultraCritDamage: "Ultra Crit Damage",
  skillPower: "Skill Power",
  skillCooldown: "Skill Cooldown",
  skillDuration: "Skill Duration",
  killGold: "Kill Gold",
  rankExpBonus: "Rank Exp",
  superGoldAmount: "Super Gold Amount",
  superGoldChance: "Super Gold Chance",
  superExpChance: "Super Exp Chance",
  superExpAmount: "Super Exp Amount",
  superEnergyChance: "Super Energy Chance",
  superEnergyAmount: "Super Energy Amount",
  activePlayBonus: "Active Play Bonus",
  milestoneBonus: "Milestone Effects",
  synergyBonus: "Synergy Effects",
  mastery2xExpChance: "2x Mastery Exp Chance",
  enemyMoveSpeed: "Enemy Move Speed",
  enemySpawnSpeed: "Enemy Spawn Speed",
  prestigePower: "Prestige Power",
  battlepassExp: "Battlepass Exp",
  energyIncome: "Energy Income",
  bossExp: "Boss Exp",
  bossGold: "Boss Gold",
  bossDamage: "Boss Damage",
  ultraBossDamage: "Ultra Boss Damage",
  goblinHoarderGold: "Goblin Hoarder Gold",
  powerMageEnergy: "Power Mage Energy",
  trainingDummyExp: "Training Dummy Exp",
  alienTech: "Alien Tech",
  shadowRunes: "Shadow Runes",
  extraBossChance: "Extra Boss Chance",
  mimicBossChance: "Mimic Boss Chance",
  trainerSpawns: "Trainer Spawns",
  bossRushSkip: "Boss Rush Skip",
  powerMageSpawns: "Power Mage Spawns",
  powerMageCooldown: "Power Mage Cooldown",
  powerMageGoldenChance: "Power Mage Golden Chance",
});
const BASE_STAT_LABELS = Object.freeze({
  attackSpeed: "Attack Speed",
  damage: "Damage",
  dps: "DPS",
  range: "Range",
});

function formatLabel(value) {
  return String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function compareHeroes(left, right) {
  const rarityDelta = RARITY_SORT_ORDER.indexOf(left.rarity) - RARITY_SORT_ORDER.indexOf(right.rarity);
  if (rarityDelta !== 0) {
    return rarityDelta;
  }

  return (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
    || String(left.name ?? "").localeCompare(String(right.name ?? ""));
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function toggleSelection(list, value) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function buildHeroSearchIndex(hero) {
  return {
    name: normalizeText([
      hero.name,
      hero.id,
      hero.class,
      hero.rarity,
      hero.type,
      ...(hero.typeSubtype ?? []),
    ].filter(Boolean).join(" ")),
    skills: normalizeText([
      hero.skill?.name,
      hero.skill?.description,
      hero.skill?.powerDescription,
      hero.skill?.durationDescription,
    ].filter(Boolean).join(" ")),
    mastery: normalizeText(hero.masteryDescription),
    milestones: normalizeText((hero.milestones ?? []).flatMap((milestone) => [
      milestone.name,
      milestone.type,
      milestone.scope,
      milestone.description,
    ]).filter(Boolean).join(" ")),
    synergies: normalizeText((hero.synergies ?? []).flatMap((synergy) => [
      synergy.name,
      synergy.type,
      synergy.scope,
      synergy.description,
      synergy.hero1,
      synergy.hero2,
      synergy.hero3,
    ]).filter(Boolean).join(" ")),
  };
}

function getEnabledSearchScopes(searchScopes) {
  const enabled = Object.entries(searchScopes)
    .filter(([, value]) => value)
    .map(([key]) => key);

  return enabled.length ? enabled : SEARCH_SCOPE_OPTIONS.map((option) => option.id);
}

function raritySortValue(rarity) {
  const index = RARITY_SORT_ORDER.indexOf(rarity);
  return index === -1 ? RARITY_SORT_ORDER.length : index;
}

function sortHeroes(heroes, mode) {
  const nextHeroes = [...heroes];

  nextHeroes.sort((left, right) => {
    if (mode === "name") {
      return left.name.localeCompare(right.name);
    }

    if (mode === "class") {
      return `${left.class ?? ""}${left.name}`.localeCompare(`${right.class ?? ""}${right.name}`);
    }

    if (mode === "rarity") {
      return raritySortValue(left.rarity) - raritySortValue(right.rarity) || left.name.localeCompare(right.name);
    }

    if (mode === "type") {
      return `${left.type ?? ""}${left.name}`.localeCompare(`${right.type ?? ""}${right.name}`);
    }

    return compareHeroes(left, right);
  });

  return nextHeroes;
}

function formatAttributeValue(attribute, value, fmt) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? "-");
  }

  if (FLAT_VALUE_KEYS.has(attribute.statKey)) {
    return typeof fmt === "function" ? fmt(numeric) : numeric.toLocaleString();
  }

  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${typeof fmt === "function" ? fmt(numeric) : numeric.toLocaleString()}%`;
}

function normalizeHeroEffectKey(statKey) {
  return HERO_EFFECT_KEY_MAP[statKey] ?? statKey ?? "";
}

function getHeroEffectLabel(statKey) {
  const normalizedKey = normalizeHeroEffectKey(statKey);
  return HERO_STAT_LABELS[normalizedKey] ?? formatLabel(normalizedKey);
}

function formatHeroEffectAmount(statKey, amount, fmt) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) {
    return String(amount ?? "-");
  }

  const normalizedKey = normalizeHeroEffectKey(statKey);
  const prefix = numeric > 0 ? "+" : "";

  if (FLAT_VALUE_KEYS.has(normalizedKey) || FLAT_VALUE_KEYS.has(statKey)) {
    return `${prefix}${typeof fmt === "function" ? fmt(numeric) : numeric.toLocaleString()}`;
  }

  return `${prefix}${typeof fmt === "function" ? fmt(numeric) : numeric.toLocaleString()}%`;
}

function formatBaseStatValue(statKey, value, fmt) {
  if (value == null) {
    return "-";
  }

  if (statKey === "attackSpeed") {
    return `${value}s`;
  }

  return Number.isFinite(Number(value)) ? (typeof fmt === "function" ? fmt(Number(value)) : Number(value).toLocaleString()) : String(value);
}

function formatCombatStyleBonusAmount(entry, fmt) {
  const numeric = Number(entry?.amount ?? 0);
  if (!Number.isFinite(numeric)) {
    return String(entry?.amount ?? "-");
  }

  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${typeof fmt === "function" ? fmt(numeric) : numeric.toLocaleString()}${entry?.valueType === "percent" ? "%" : ""}`;
}

function getCombatStyleBonusTone(entry, colors) {
  const numeric = Number(entry?.amount ?? 0);
  const statKey = entry?.statKey;
  const lowerIsBetter = new Set(["skillCooldown"]);

  return (numeric >= 0) !== lowerIsBetter.has(statKey) ? colors.positive : "#e05555";
}

function FilterTabButton({ active, label, onClick, colors }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? "rgba(245,146,30,0.18)" : colors.header,
        color: active ? colors.text : colors.muted,
        border: `1px solid ${active ? colors.accent : colors.border}`,
        borderRadius: 999,
        padding: "8px 12px",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function FilterSubTabButton({ active, label, onClick, colors }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? "rgba(68,136,238,0.18)" : "transparent",
        color: active ? colors.text : colors.muted,
        border: `1px solid ${active ? colors.accent : colors.border}`,
        borderRadius: 999,
        padding: "6px 10px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function FilterChip({ active, label, onClick, colors }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? "rgba(68,136,238,0.18)" : colors.header,
        color: active ? colors.text : colors.muted,
        border: `1px solid ${active ? colors.accent : colors.border}`,
        borderRadius: 999,
        padding: "8px 12px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function FilterChipGroup({ title, options, selected, onToggle, colors, emptyLabel = "No options available." }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ color: colors.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</div>
      {options.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {options.map((option) => (
            <FilterChip
              key={option}
              active={selected.includes(option)}
              label={formatLabel(option)}
              onClick={() => onToggle(option)}
              colors={colors}
            />
          ))}
        </div>
      ) : (
        <div style={{ color: colors.muted, fontSize: 12 }}>{emptyLabel}</div>
      )}
    </div>
  );
}

function AttributeCard({ attribute, currentLevel, previewLevels, colors, fmt, getIconUrl, onLevelChange }) {
  const preview = useMemo(
    () => getHeroAttributePreview(attribute, currentLevel, previewLevels),
    [attribute, currentLevel, previewLevels]
  );

  return (
    <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 12, display: "grid", gridTemplateColumns: "78px minmax(0, 1fr)", gap: 12, alignItems: "start", boxShadow: "0 8px 20px rgba(0,0,0,0.18)" }}>
      <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: attribute.bgColor ?? "rgba(8,17,29,0.72)", border: `2px solid ${attribute.borderColor ?? colors.border}`, padding: 7, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {attribute.icon ? <img src={getIconUrl(attribute.icon)} alt="" style={{ width: 38, height: 38, objectFit: "contain" }} /> : null}
        </div>
        <div style={{ fontSize: 11, color: colors.muted, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Level</div>
        <input
          type="number"
          min={0}
          max={attribute.maxLevel ?? Number.MAX_SAFE_INTEGER}
          value={currentLevel}
          onChange={(event) => onLevelChange(event.target.value)}
          style={{ width: 64, background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 13, fontWeight: 700, padding: "6px 8px", fontFamily: "inherit", textAlign: "center" }}
        />
      </div>

      <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: colors.text, minWidth: 0 }}>
            {attribute.name} <span style={{ color: colors.muted, fontWeight: 700 }}>(Lv. {fmt(currentLevel)})</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: colors.muted }}>{formatLabel(attribute.scope)}</span>
            <span style={{ fontSize: 12, color: colors.muted }}>Rank {fmt(attribute.rankReq ?? 0)}+</span>
            <span style={{ fontSize: 12, color: colors.accent, fontWeight: 800 }}>{formatAttributeValue(attribute, attribute.statAmt ?? 0, fmt)} / level</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: colors.text }}>{formatAttributeValue(attribute, preview.currentValue, fmt)}</span>
          {preview.projectedLevel > preview.currentLevel ? <span style={{ fontSize: 13, fontWeight: 800, color: colors.positive }}>{formatAttributeValue(attribute, preview.projectedValue - preview.currentValue, fmt)}</span> : null}
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: colors.muted }}>Max {fmt(attribute.maxLevel ?? 0)}</span>
          <span style={{ fontSize: 12, color: colors.muted }}>Cost {fmt(preview.previewCost)}</span>
        </div>
      </div>
    </div>
  );
}

function SwitchToggle({ checked, onChange, colors, checkedLabel, uncheckedLabel }) {
  const label = checked ? checkedLabel : uncheckedLabel;

  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        background: colors.header,
        border: `1px solid ${checked ? colors.accent : colors.border}`,
        borderRadius: 999,
        color: colors.text,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 40,
        padding: "6px 12px 6px 8px",
        fontFamily: "inherit",
        fontWeight: 800,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 38,
          height: 22,
          borderRadius: 999,
          background: checked ? colors.accent : "#0f2640",
          border: `1px solid ${checked ? colors.accent : colors.border}`,
          position: "relative",
          transition: "background 120ms ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: checked ? "#08111d" : colors.text,
            transition: "left 120ms ease",
          }}
        />
      </span>
      <span style={{ fontSize: 13 }}>{label}</span>
    </button>
  );
}

function HeaderFieldCard({ label, value, colors, helper, valueColor, min = 0, max, onChange, disabled = false }) {
  return (
    <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>{label}</div>
      {onChange ? (
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          style={{ width: "100%", minWidth: 0, background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 10, color: colors.text, fontSize: 16, fontWeight: 800, padding: "10px 12px", fontFamily: "inherit" }}
        />
      ) : (
        <div style={{ fontSize: 16, fontWeight: 900, color: valueColor ?? colors.text }}>{value}</div>
      )}
      {helper ? <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>{helper}</div> : null}
    </div>
  );
}

function getSynergyTierSortValue(tier) {
  const index = SYNERGY_TIER_ORDER.indexOf(String(tier ?? "").toUpperCase());
  return index === -1 ? SYNERGY_TIER_ORDER.length : index;
}

function buildSynergyTeamIds(ownerHeroId, synergy) {
  return [...new Set([ownerHeroId, synergy.hero1, synergy.hero2, synergy.hero3].filter(Boolean))];
}

function buildSynergyTeamKey({ ownerHeroId, synergy }) {
  const tier = String(synergy.tier ?? "?").toUpperCase();
  const rankRequired = synergy.rankRequired ?? 0;
  const teamIds = buildSynergyTeamIds(ownerHeroId, synergy).sort();

  return `${tier}::${rankRequired}::${teamIds.join("|")}`;
}

function SynergyHeroBadge({ hero, rank, isFocused, colors, getIconUrl, fmt }) {
  return (
    <div style={{ position: "relative", width: 86, paddingBottom: 18, display: "flex", justifyContent: "center" }}>
      <div style={{ position: "relative", width: 72, height: 72, borderRadius: 16, background: isFocused ? "rgba(230, 190, 86, 0.28)" : colors.header, border: `1px solid ${isFocused ? "rgba(230, 190, 86, 0.75)" : colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: isFocused ? "0 0 0 2px rgba(230, 190, 86, 0.22)" : "none" }}>
        {hero?.heroIcon ? <img src={getIconUrl(hero.heroIcon)} alt={hero.name} style={{ width: 56, height: 56, objectFit: "contain" }} /> : null}
        <div style={{ position: "absolute", top: 6, left: 6, minWidth: 24, height: 24, padding: "0 6px", borderRadius: 999, background: "rgba(8,17,29,0.92)", border: `1px solid ${isFocused ? "rgba(230, 190, 86, 0.75)" : colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: colors.text }}>
          {fmt(rank)}
        </div>
      </div>
      <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", minWidth: "max-content", maxWidth: 120, borderRadius: 999, padding: "4px 10px", background: isFocused ? "rgba(230, 190, 86, 0.88)" : "rgba(8,17,29,0.94)", border: `1px solid ${isFocused ? "rgba(230, 190, 86, 0.9)" : colors.border}`, fontSize: 11, fontWeight: 800, color: isFocused ? "#2b2107" : colors.text, whiteSpace: "normal", lineHeight: 1.2, textAlign: "center" }}>
        {hero?.name ?? "Unknown"}
      </div>
    </div>
  );
}

function SynergyHeroDescription({ hero, heroSynergy, rank, isFocused, colors, getIconUrl, fmt }) {
  const scopeColor = heroSynergy?.scope === "personal" ? "#f5921e" : heroSynergy?.scope ? colors.positive : colors.muted;

  return (
    <div className="hero-synergy-lane">
      <SynergyHeroBadge hero={hero} rank={rank} isFocused={isFocused} colors={colors} getIconUrl={getIconUrl} fmt={fmt} />
      <img src={getIconUrl("_arrowDown.png")} alt="down arrow" style={{ width: 20, height: 20, objectFit: "contain", opacity: 0.85 }} />
      <div style={{ width: "100%", background: isFocused ? "rgba(230, 190, 86, 0.16)" : colors.header, border: `1px solid ${isFocused ? "rgba(230, 190, 86, 0.45)" : colors.border}`, borderRadius: 12, padding: 12, display: "grid", gap: 8, alignContent: "start", textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: colors.text, lineHeight: 1.6 }}>
          {heroSynergy?.description ?? "No synergy description available."}
        </div>
        {heroSynergy?.scope ? (
          <div style={{ fontSize: 12, fontWeight: 900, color: scopeColor, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {formatLabel(heroSynergy.scope)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SynergyTeamCard({ synergyTeam, selectedHeroId, heroesById, rankByHero, colors, getIconUrl, fmt }) {
  const teamHeroIds = synergyTeam.teamHeroIds;
  const isActive = teamHeroIds.every((heroId) => (rankByHero[heroId] ?? 0) >= (synergyTeam.rankRequired ?? 0));
  const teamSize = teamHeroIds.length;
  const gridColumns = teamHeroIds.flatMap((_, index) => (
    index < teamHeroIds.length - 1
      ? ["minmax(0, 1fr)", "20px"]
      : ["minmax(0, 1fr)"]
  )).join(" ");
  const flexGrow = Math.max(1, teamSize);
  const flexBasis = Math.max(320, 180 + (teamSize * 120));

  return (
    <div style={{ flex: `${flexGrow} 1 ${flexBasis}px`, minWidth: 320, maxWidth: "100%", background: isActive ? "rgba(46,204,113,0.10)" : colors.header, border: `1px solid ${isActive ? colors.positive : colors.border}`, borderRadius: 16, padding: 14 }}>
      <div className="hero-synergy-team" style={{ "--hero-synergy-columns": gridColumns }}>
        {teamHeroIds.map((heroId, index) => {
          const teamHero = heroesById[heroId] ?? null;
          const currentRank = rankByHero[heroId] ?? 0;
          const isFocused = heroId === selectedHeroId;
          const heroSynergy = synergyTeam.heroEntries.find((entry) => entry.heroId === heroId)?.synergy ?? null;

          return (
            <Fragment key={`${synergyTeam.key}-${heroId}`}>
              <SynergyHeroDescription hero={teamHero} heroSynergy={heroSynergy} rank={currentRank} isFocused={isFocused} colors={colors} getIconUrl={getIconUrl} fmt={fmt} />
              {index < teamHeroIds.length - 1 ? (
                <div className="hero-synergy-plus">
                  <img src={getIconUrl("_plus.png")} alt="+" style={{ width: 18, height: 18, objectFit: "contain", opacity: 0.9, flexShrink: 0 }} />
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function HeroLoadoutPage({ colors, getIconUrl, fmt, heroes, savedLoadouts = [], currentSavedLoadoutId = "", onLoadSave, onDeleteSave, onImportComplete, saveButton }) {
  const initialState = useMemo(() => readHeroLoadoutState(localStorage), []);
  const [selectedHeroId, setSelectedHeroId] = useState(initialState.selectedHeroId);
  const [previewLevelsByHero, setPreviewLevelsByHero] = useState(initialState.previewLevelsByHero);
  const [hideMaxedByHero, setHideMaxedByHero] = useState(initialState.hideMaxedByHero);
  const [rankByHero, setRankByHero] = useState(initialState.rankByHero);
  const [levelByHero, setLevelByHero] = useState(initialState.levelByHero);
  const [masteryLevelByHero, setMasteryLevelByHero] = useState(initialState.masteryLevelByHero);
  const [defaultCombatStyleIdByHero, setDefaultCombatStyleIdByHero] = useState(initialState.defaultCombatStyleIdByHero);
  const [attributeLevelsByHero, setAttributeLevelsByHero] = useState(initialState.attributeLevelsByHero);
  const [activeHeroTab, setActiveHeroTab] = useState("information");
  const heroPresets = useMemo(
    () => savedLoadouts.filter((save) => save.scopeId === LOADOUT_RECORD_SCOPE_HERO),
    [savedLoadouts]
  );
  const heroFilters = useHeroFilters();

  useEffect(() => {
    writeHeroLoadoutState({
      selectedHeroId,
      previewLevelsByHero,
      hideMaxedByHero,
      rankByHero,
      levelByHero,
      masteryLevelByHero,
      defaultCombatStyleIdByHero,
      attributeLevelsByHero,
    }, localStorage);
  }, [attributeLevelsByHero, defaultCombatStyleIdByHero, hideMaxedByHero, levelByHero, masteryLevelByHero, previewLevelsByHero, rankByHero, selectedHeroId]);

  const heroesById = useMemo(() => Object.fromEntries(heroes.map((hero) => [hero.id, hero])), [heroes]);
  const heroSearchIndex = useMemo(
    () => Object.fromEntries(heroes.map((hero) => [hero.id, buildSharedHeroSearchIndex(hero)])),
    [heroes]
  );
  const classOptions = useMemo(() => [...new Set(heroes.map((hero) => hero.class).filter(Boolean))], [heroes]);
  const rarityOptions = useMemo(() => [...new Set(heroes.map((hero) => hero.rarity).filter(Boolean))], [heroes]);
  const typeOptions = useMemo(() => [...new Set(heroes.map((hero) => hero.type).filter(Boolean))], [heroes]);
  const milestoneTypeOptions = useMemo(
    () => [...new Set(heroes.flatMap((hero) => (hero.milestones ?? []).map((milestone) => milestone.type)).filter(Boolean))],
    [heroes]
  );
  const synergyTypeOptions = useMemo(
    () => [...new Set(heroes.flatMap((hero) => (hero.synergies ?? []).map((synergy) => synergy.type)).filter(Boolean))],
    [heroes]
  );
  const subtypeOptions = useMemo(() => getHeroSubtypeOptions(heroes, heroFilters.typeFilters), [heroes, heroFilters.typeFilters]);

  const sortedHeroes = useMemo(() => {
    return filterHeroes({
      heroes,
      heroSearchIndex,
      filters: heroFilters,
      sortHeroes,
    });
  }, [
    heroFilters.classFilters,
    heroFilters.milestoneTypeFilters,
    heroFilters.rarityFilters,
    heroFilters.searchScopes,
    heroFilters.searchValue,
    heroFilters.sortMode,
    heroFilters.subtypeFilters,
    heroFilters.synergyTypeFilters,
    heroFilters.typeFilters,
    heroSearchIndex,
    heroes,
  ]);

  const groupedHeroes = useMemo(() => {
    const rarityGroups = RARITY_SORT_ORDER
      .map((rarity) => ({
        rarity,
        heroes: sortedHeroes.filter((hero) => hero.rarity === rarity),
      }))
      .filter((group) => group.heroes.length);

    const extraRarities = [...new Set(sortedHeroes.map((hero) => hero.rarity).filter((rarity) => !RARITY_SORT_ORDER.includes(rarity)))];
    return [
      ...rarityGroups,
      ...extraRarities.map((rarity) => ({
        rarity,
        heroes: sortedHeroes.filter((hero) => hero.rarity === rarity),
      })),
    ];
  }, [sortedHeroes]);

  useEffect(() => {
    if (sortedHeroes.length && !sortedHeroes.some((hero) => hero.id === selectedHeroId)) {
      setSelectedHeroId(sortedHeroes[0].id);
    }
  }, [selectedHeroId, sortedHeroes]);

  const selectedHero = sortedHeroes.find((hero) => hero.id === selectedHeroId) ?? sortedHeroes[0] ?? null;
  const activePreviewLevels = selectedHero ? (previewLevelsByHero[selectedHero.id] ?? 1) : 1;
  const hideMaxed = selectedHero ? (hideMaxedByHero[selectedHero.id] ?? false) : false;
  const selectedHeroRank = selectedHero ? (rankByHero[selectedHero.id] ?? 0) : 0;
  const selectedHeroLevel = selectedHero ? (levelByHero[selectedHero.id] ?? 0) : 0;
  const selectedHeroMasteryLevel = selectedHero ? (masteryLevelByHero[selectedHero.id] ?? 0) : 0;
  const selectedHeroDefaultCombatStyleId = selectedHero
    ? getStoredDefaultCombatStyleId(defaultCombatStyleIdByHero, selectedHero.id)
    : "";
  const activeAttributeLevels = selectedHero ? (attributeLevelsByHero[selectedHero.id] ?? {}) : {};
  const visibleGroups = useMemo(() => ATTRIBUTE_GROUPS.map((group) => ({
    ...group,
    attributes: HERO_ATTRIBUTE_DEFINITIONS
      .filter((attribute) => attribute.groupKey === group.key)
      .filter((attribute) => !hideMaxed || (activeAttributeLevels[attribute.id] ?? 0) < (attribute.maxLevel ?? Number.MAX_SAFE_INTEGER)),
  })), [activeAttributeLevels, hideMaxed]);
  const synergiesByTier = useMemo(() => {
    const groups = new Map();

    (selectedHero?.synergies ?? []).forEach((synergy) => {
      const tierKey = String(synergy.tier ?? "?").toUpperCase();
      const teamKey = buildSynergyTeamKey({ ownerHeroId: selectedHero.id, synergy });
      const teamHeroIds = buildSynergyTeamIds(selectedHero.id, synergy);
      const current = groups.get(tierKey) ?? { tier: tierKey, rankRequired: synergy.rankRequired ?? 0, synergies: [] };

      if (!current.synergies.some((entry) => entry.key === teamKey)) {
        current.synergies.push({
          key: teamKey,
          rankRequired: synergy.rankRequired ?? 0,
          teamHeroIds,
          heroEntries: teamHeroIds.map((heroId) => {
            const matchedHeroSynergy = (heroesById[heroId]?.synergies ?? []).find((candidate) => (
              buildSynergyTeamKey({ ownerHeroId: heroId, synergy: candidate }) === teamKey
            ));

            return {
              heroId,
              synergy: matchedHeroSynergy ?? (heroId === selectedHero.id ? synergy : null),
            };
          }),
        });
      }

      groups.set(tierKey, current);
    });

    return Array.from(groups.values()).sort((left, right) => getSynergyTierSortValue(left.tier) - getSynergyTierSortValue(right.tier));
  }, [heroesById, selectedHero]);

  const nextMasteryLevel = selectedHero
    ? Math.min((selectedHero.masteryExp?.maxLevel ?? 0), selectedHeroMasteryLevel + 1)
    : 0;
  const nextMasteryCost = selectedHero && selectedHero.masteryExp && selectedHeroMasteryLevel < (selectedHero.masteryExp.maxLevel ?? 0)
    ? getHeroMasteryExpCost(selectedHero, selectedHeroMasteryLevel + 1)
    : 0;
  const selectedHeroCombatStyleEntries = selectedHero
    ? COMBAT_STYLE_DEFINITIONS.map((style) => ({
        style,
        isUnlocked: isCombatStyleUnlocked(style, selectedHeroRank),
        entries: (style.bonuses ?? [])
          .map((bonus, index) => {
            const statKey = normalizeCombatStyleStatKey(bonus?.stat);
            const amount = Number(bonus?.amount);
            if (!statKey || !Number.isFinite(amount) || amount === 0) {
              return null;
            }

            return {
              statKey,
              amount,
              valueType: bonus?.isPercent ? "percent" : "flat",
              scope: bonus?.isGlobal ? "global" : "personal",
              sourceId: `${style.id}:${index}`,
            };
          })
          .filter(Boolean),
      }))
    : [];

  function handleHeroSelect(heroId) {
    setSelectedHeroId(heroId);
  }

  function handlePreviewChange(rawValue) {
    if (!selectedHero) {
      return;
    }

    const nextValue = Math.max(1, Number.parseInt(rawValue, 10) || 1);
    setPreviewLevelsByHero((current) => ({
      ...current,
      [selectedHero.id]: nextValue,
    }));
  }

  function handleHideMaxedChange(isChecked) {
    if (!selectedHero) {
      return;
    }

    setHideMaxedByHero((current) => ({
      ...current,
      [selectedHero.id]: isChecked,
    }));
  }

  function handleRankChange(rawValue) {
    if (!selectedHero) {
      return;
    }

    const parsed = rawValue === "" ? 0 : Number.parseInt(rawValue, 10);
    const nextRank = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setRankByHero((current) => ({
      ...current,
      [selectedHero.id]: nextRank,
    }));
  }

  function handleHeroLevelChange(rawValue) {
    if (!selectedHero) {
      return;
    }

    const parsed = rawValue === "" ? 0 : Number.parseInt(rawValue, 10);
    const nextLevel = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setLevelByHero((current) => ({
      ...current,
      [selectedHero.id]: nextLevel,
    }));
  }

  function handleMasteryLevelChange(rawValue) {
    if (!selectedHero) {
      return;
    }

    const maxLevel = selectedHero.masteryExp?.maxLevel ?? 0;
    const parsed = rawValue === "" ? 0 : Number.parseInt(rawValue, 10);
    const nextLevel = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, maxLevel)) : 0;
    setMasteryLevelByHero((current) => ({
      ...current,
      [selectedHero.id]: nextLevel,
    }));
  }

  function handleAttributeLevelChange(attribute, rawValue) {
    if (!selectedHero) {
      return;
    }

    const parsed = rawValue === "" ? 0 : Number.parseInt(rawValue, 10);
    const nextLevel = Number.isFinite(parsed)
      ? Math.max(0, Math.min(parsed, attribute.maxLevel ?? Number.MAX_SAFE_INTEGER))
      : 0;

    setAttributeLevelsByHero((current) => {
      const nextHeroLevels = { ...(current[selectedHero.id] ?? {}) };
      if (nextLevel <= 0) {
        delete nextHeroLevels[attribute.id];
      } else {
        nextHeroLevels[attribute.id] = nextLevel;
      }

      return {
        ...current,
        [selectedHero.id]: nextHeroLevels,
      };
    });
  }

  function handleDefaultCombatStyleChange(styleId, isChecked) {
    if (!selectedHero) {
      return;
    }

    setDefaultCombatStyleIdByHero((current) => ({
      ...current,
      [selectedHero.id]: isChecked ? styleId : COMBAT_STYLE_FALLBACK_ID,
    }));
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 18, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.text }}>Hero Loadout</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <ScopedLoadoutPresetsPanel
            colors={colors}
            title="Hero Loadout Presets"
            description="Save and manage hero-loadout-only presets here. These records only affect the Hero Loadout page."
            scopeId={LOADOUT_RECORD_SCOPE_HERO}
            presets={heroPresets}
            currentSavedLoadoutId={currentSavedLoadoutId}
            onLoadSave={onLoadSave}
            onDeleteSave={onDeleteSave}
            onImportComplete={onImportComplete}
            compact
          />
          {saveButton ? (
            <button
              type="button"
              onClick={saveButton.onClick}
              style={{
                background: saveButton.passive ? colors.header : colors.accent,
                color: saveButton.passive ? colors.muted : "#08111d",
                border: `1px solid ${saveButton.passive ? colors.border : colors.accent}`,
                borderRadius: 10,
                padding: "10px 14px",
                fontWeight: 800,
                cursor: saveButton.busy ? "wait" : saveButton.passive ? "default" : "pointer",
                minHeight: 44,
              }}
            >
              {saveButton.label}
            </button>
          ) : null}
          <button type="button" onClick={() => heroFilters.setIsFiltersExpanded((current) => !current)} style={{ background: heroFilters.isFiltersExpanded ? "rgba(68,136,238,0.16)" : colors.header, color: colors.text, border: `1px solid ${heroFilters.isFiltersExpanded ? colors.accent : colors.border}`, borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer", minHeight: 44 }}>
            Filters
          </button>
        </div>
      </div>

      <HeroFiltersPanel
        colors={colors}
        filters={heroFilters}
        resultsCount={sortedHeroes.length}
        totalCount={heroes.length}
        classOptions={classOptions}
        rarityOptions={rarityOptions}
        typeOptions={typeOptions}
        subtypeOptions={subtypeOptions}
        milestoneTypeOptions={milestoneTypeOptions}
        synergyTypeOptions={synergyTypeOptions}
        helperText="Filters update the hero list in the sidebar and which hero is available to inspect."
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <aside style={{ flex: "0 0 300px", width: "100%", maxWidth: 340, display: "grid", gap: 14, alignSelf: "flex-start" }}>
          <div style={{ background: `linear-gradient(180deg, ${colors.panel} 0%, ${colors.header} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 12, maxHeight: "calc(200vh - 240px)", overflowY: "auto", position: "sticky", top: 16 }}>
            {groupedHeroes.map((group) => (
              <div key={group.rarity} style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>{group.rarity}</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {group.heroes.map((hero) => {
                    const isActive = selectedHero?.id === hero.id;
                    return (
                      <button
                        key={hero.id}
                        type="button"
                        onClick={() => handleHeroSelect(hero.id)}
                        style={{
                          width: "100%",
                          background: isActive ? `linear-gradient(135deg, ${colors.accent}33 0%, ${colors.header} 100%)` : colors.header,
                          border: `1px solid ${isActive ? colors.accent : colors.border}`,
                          borderRadius: 12,
                          color: colors.text,
                          cursor: "pointer",
                          display: "grid",
                          gridTemplateColumns: "72px minmax(0, 1fr)",
                          gap: 12,
                          padding: 12,
                          textAlign: "left",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ position: "relative", width: 72, height: 72, borderRadius: 12, background: isActive ? "rgba(245,146,30,0.12)" : colors.panel, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible", flexShrink: 0, marginBottom: 10 }}>
                          {hero.heroIcon ? <img src={getIconUrl(hero.heroIcon)} alt="" style={{ width: 56, height: 56, objectFit: "contain" }} /> : null}
                          <div style={{ position: "absolute", left: "50%", bottom: -10, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: "rgba(8,17,29,0.92)", border: `1px solid ${colors.border}`, boxShadow: "0 6px 16px rgba(0,0,0,0.24)", zIndex: 1 }}>
                            <img src={getIconUrl("_mastery_2.png")} alt="" style={{ width: 12, height: 12, objectFit: "contain", flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 800, color: colors.text }}>{fmt(masteryLevelByHero[hero.id] ?? 0)}</span>
                          </div>
                        </div>
                        <div style={{ minWidth: 0, display: "grid", gap: 6, alignContent: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: isActive ? colors.accent : colors.text, lineHeight: 1.25 }}>{hero.name}</div>
                          <div style={{ fontSize: 11, color: colors.muted, lineHeight: 1.4 }}>{formatLabel(hero.class)} · Lv. {fmt(levelByHero[hero.id] ?? 0)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {!groupedHeroes.length && (
              <div style={{ color: colors.muted, fontSize: 13, lineHeight: 1.6 }}>
                No heroes match the current search and filter combination.
              </div>
            )}
          </div>
        </aside>

        <section style={{ flex: "1 1 760px", minWidth: 0, display: "grid", gap: 16 }}>
          {selectedHero ? (
            <>
              <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 16 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ width: 72, height: 72, borderRadius: 14, background: colors.panel, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    {selectedHero.heroIcon ? <img src={getIconUrl(selectedHero.heroIcon)} alt={selectedHero.name} style={{ width: 54, height: 54, objectFit: "contain" }} /> : null}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: colors.text }}>{selectedHero.name}</div>
                    <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>{formatLabel(selectedHero.class)} · {selectedHero.rarity} · {formatLabel(selectedHero.type)}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))", gap: 12 }}>
                  <HeaderFieldCard
                    label="Current Rank"
                    value={selectedHeroRank}
                    onChange={handleRankChange}
                    colors={colors}
                    helper="Synergy requirements use rank."
                  />
                  <HeaderFieldCard
                    label="Current Level"
                    value={selectedHeroLevel}
                    onChange={handleHeroLevelChange}
                    colors={colors}
                    helper="Milestone unlocks use level."
                  />
                  <HeaderFieldCard
                    label="Current Mastery Level"
                    value={selectedHeroMasteryLevel}
                    onChange={handleMasteryLevelChange}
                    min={0}
                    max={selectedHero.masteryExp?.maxLevel ?? 0}
                    disabled={!selectedHero.masteryExp}
                    colors={colors}
                    helper={selectedHero.masteryExp ? `Max ${fmt(selectedHero.masteryLevel?.maxLevel ?? selectedHero.masteryExp?.maxLevel ?? 0)}` : "Mastery is unavailable for this hero."}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {HERO_DETAIL_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveHeroTab(tab.id)}
                    style={{
                      background: activeHeroTab === tab.id ? "rgba(245,146,30,0.16)" : colors.panel,
                      color: activeHeroTab === tab.id ? colors.text : colors.muted,
                      border: `1px solid ${activeHeroTab === tab.id ? colors.accent : colors.border}`,
                      borderRadius: 999,
                      padding: "10px 14px",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeHeroTab === "information" && (
                <div style={{ display: "grid", gap: 16 }}>
                  <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Active Skill</div>
                    </div>

                    {selectedHero.skill ? (
                      <div style={{ display: "grid", gap: 14 }}>
                        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                          <div style={{ width: 64, height: 64, borderRadius: 12, background: colors.header, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                            {selectedHero.skill.icon ? <img src={getIconUrl(selectedHero.skill.icon)} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} /> : null}
                          </div>
                          <div style={{ minWidth: 0, flex: 1, display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>{selectedHero.skill.name}</div>
                              <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 999, padding: "4px 10px", fontSize: 12, color: colors.muted }}>{fmt(selectedHero.skill.cooldown ?? 0)}s cooldown</div>
                            </div>
                            <div style={{ fontSize: 14, color: colors.text, lineHeight: 1.6 }}>{selectedHero.skill.description}</div>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                          <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                            <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Skill Effect</div>
                            <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6 }}>{selectedHero.skill.description || "No skill description available."}</div>
                          </div>
                          <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                            <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Power Description</div>
                            <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6 }}>{selectedHero.skill.powerDescription || "No skill power scaling description provided."}</div>
                          </div>
                          <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                            <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Duration Description</div>
                            <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6 }}>{selectedHero.skill.durationDescription || "No skill duration scaling description provided."}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, fontSize: 13, color: colors.muted }}>No active skill data is available for this hero.</div>
                    )}
                  </div>

                  <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Skill Mastery</div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Current Mastery Level</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: colors.text }}>
                          {selectedHero.masteryExp ? `${fmt(selectedHeroMasteryLevel)} / ${fmt(selectedHero.masteryExp.maxLevel ?? 0)}` : "Unavailable"}
                        </div>
                      </div>
                      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Next Mastery Level</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: colors.text }}>
                          {selectedHero.masteryExp ? (selectedHeroMasteryLevel >= (selectedHero.masteryExp.maxLevel ?? 0) ? "Maxed" : fmt(nextMasteryLevel)) : "Unavailable"}
                        </div>
                      </div>
                      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Next Level Cost</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: colors.accent }}>
                          {selectedHero.masteryExp ? (selectedHeroMasteryLevel >= (selectedHero.masteryExp.maxLevel ?? 0) ? "Maxed" : `${fmt(nextMasteryCost)} exp`) : "Unavailable"}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Mastery Effect</div>
                      <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6 }}>{selectedHero.masteryDescription || "No mastery description is available for this hero."}</div>
                    </div>
                  </div>

                  <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Stats</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                      {Object.entries(selectedHero.baseStats ?? {}).map(([statKey, value]) => (
                        <div key={statKey} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>{BASE_STAT_LABELS[statKey] ?? formatLabel(statKey)}</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: colors.gold }}>{formatBaseStatValue(statKey, value, fmt)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Milestones</div>
                    </div>
                    {(selectedHero.milestones ?? []).length ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                        {(selectedHero.milestones ?? []).map((milestone) => {
                          const isActive = selectedHeroLevel >= (milestone.requirement ?? 0);
                          const scopeColor = milestone.scope === "personal" ? colors.accent : colors.positive;
                          return (
                            <div key={milestone.milestone} style={{ background: isActive ? "rgba(46,204,113,0.12)" : colors.header, border: `1px solid ${isActive ? colors.positive : colors.border}`, borderRadius: 14, padding: 14, display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", gap: 14, alignItems: "center", opacity: isActive ? 1 : 0.58, minWidth: 0 }}>
                              <div style={{ width: 72, height: 72, borderRadius: 16, background: milestone.bgColor ?? colors.panel, border: `1px solid ${milestone.borderColor ?? colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                                {milestone.icon ? <img src={getIconUrl(milestone.icon)} alt="" style={{ width: 42, height: 42, objectFit: "contain" }} /> : null}
                              </div>
                              <div style={{ display: "grid", gap: 6 }}>
                                <div style={{ fontSize: 15, fontWeight: 900, color: colors.text }}>Level {fmt(milestone.requirement ?? 0)}</div>
                                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6 }}>{milestone.description ?? `${milestone.name} ${formatHeroEffectAmount(milestone.type, milestone.amount, fmt)}`}</div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: scopeColor }}>{formatLabel(milestone.scope)} effect</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, fontSize: 13, color: colors.muted }}>No milestone data is available for this hero.</div>
                    )}
                  </div>
                </div>
              )}

              {activeHeroTab === "rankAttributes" && (
                <div style={{ display: "grid", gap: 16 }}>
                  <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Attributes</div>
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <label style={{ display: "grid", gap: 6, minWidth: 180 }}>
                          <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Additional Levels</span>
                          <input
                            type="number"
                            min={1}
                            value={activePreviewLevels}
                            onChange={(event) => handlePreviewChange(event.target.value)}
                            style={{ background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 10, color: colors.text, fontSize: 14, fontWeight: 700, padding: "10px 12px", fontFamily: "inherit" }}
                          />
                        </label>
                        <SwitchToggle
                          checked={hideMaxed}
                          onChange={handleHideMaxedChange}
                          colors={colors}
                          checkedLabel="Hide Maxed"
                          uncheckedLabel="Hide Maxed"
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 16 }}>
                    {visibleGroups.map((group) => (
                      <div key={group.key} style={{ display: "grid", gap: 14 }}>
                        <div style={{ background: `linear-gradient(180deg, ${colors.panel} 0%, ${colors.header} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: colors.text }}>{group.label}</div>
                            <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{group.description}</div>
                          </div>
                          <div style={{ fontSize: 12, color: colors.muted }}>{group.attributes.length} attributes</div>
                        </div>
                        {group.attributes.length ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
                            {group.attributes.map((attribute) => (
                              <AttributeCard
                                key={attribute.id}
                                attribute={attribute}
                                currentLevel={activeAttributeLevels[attribute.id] ?? 0}
                                previewLevels={activePreviewLevels}
                                colors={colors}
                                fmt={fmt}
                                getIconUrl={getIconUrl}
                                onLevelChange={(rawValue) => handleAttributeLevelChange(attribute, rawValue)}
                              />
                            ))}
                          </div>
                        ) : (
                          <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16, fontSize: 13, color: colors.muted }}>
                            Every attribute in this section is currently maxed.
                          </div>
                        )}
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              )}

              {activeHeroTab === "combatStyles" && (
                <div style={{ display: "grid", gap: 16 }}>
                  <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Combat Styles</div>
                        <div style={{ fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 1.6 }}>
                          Choose one default combat style for {selectedHero.name}. Newly placed copies will start with that style selected. If no default is set, placements fall back to Balanced.
                        </div>
                      </div>
                      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "10px 12px", minWidth: 220 }}>
                        <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Current Default</div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: colors.text, marginTop: 6 }}>
                          {getCombatStyle(selectedHeroDefaultCombatStyleId)?.name ?? "Balanced"}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                      {selectedHeroCombatStyleEntries.map(({ style, isUnlocked, entries }) => {
                        const isDefault = selectedHeroDefaultCombatStyleId === style.id;

                        return (
                          <div key={style.id} style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${isUnlocked ? colors.positive : isDefault ? colors.accent : colors.border}`, borderRadius: 14, padding: 14, display: "grid", gap: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
                              <div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: colors.text }}>{style.name}</div>
                                <div style={{ fontSize: 12, color: isUnlocked ? colors.positive : colors.muted, marginTop: 4 }}>
                                  {style.rankReq > 0 ? `Requires Rank ${fmt(style.rankReq)}+` : "Available at any rank"}
                                </div>
                              </div>
                              <SwitchToggle
                                checked={isDefault}
                                onChange={(nextChecked) => handleDefaultCombatStyleChange(style.id, nextChecked)}
                                colors={colors}
                                checkedLabel="Default Style"
                                uncheckedLabel="Set Default"
                              />
                            </div>

                            {isDefault && !isUnlocked ? (
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 999, color: colors.muted, fontSize: 11, fontWeight: 800, padding: "4px 10px" }}>
                                  No bonuses until the rank requirement is met
                                </span>
                              </div>
                            ) : null}

                            {entries.length ? (
                              <div style={{ display: "grid", gap: 8 }}>
                                {entries.map((entry, index) => (
                                  <div key={`${style.id}-${entry.statKey}-${index}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: getCombatStyleBonusTone(entry, colors), minWidth: 68 }}>
                                      {formatCombatStyleBonusAmount(entry, fmt)}
                                    </span>
                                    <span style={{ fontSize: 12, color: colors.text, flex: 1 }}>{getHeroEffectLabel(entry.statKey)}</span>
                                    <span style={{ fontSize: 10, color: colors.muted, background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 999, padding: "2px 8px" }}>
                                      {entry.scope === "global" ? "Global" : "Personal"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeHeroTab === "synergies" && (
                <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Synergies</div>
                  </div>

                  {(selectedHero.synergies ?? []).length ? (
                    <div style={{ display: "grid", gap: 14 }}>
                      {synergiesByTier.map((tierGroup) => (
                        <div key={`tier-${tierGroup.tier}`} style={{ display: "grid", gap: 12 }}>
                          <div style={{ background: `linear-gradient(180deg, ${colors.panel} 0%, ${colors.header} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: colors.text }}>Tier {tierGroup.tier}</div>
                            <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.6 }}>
                              The following heroes must be Rank {fmt(tierGroup.rankRequired ?? 0)}+ to activate these synergies.
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 12, width: "100%", flexWrap: "wrap", alignItems: "stretch" }}>
                            {tierGroup.synergies.map((synergyTeam) => (
                              <SynergyTeamCard
                                key={synergyTeam.key}
                                synergyTeam={synergyTeam}
                                selectedHeroId={selectedHero.id}
                                heroesById={heroesById}
                                rankByHero={rankByHero}
                                colors={colors}
                                getIconUrl={getIconUrl}
                                fmt={fmt}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, fontSize: 13, color: colors.muted }}>No synergy paths are available for this hero.</div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 18, color: colors.muted, fontSize: 13 }}>
              No hero data is available.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}