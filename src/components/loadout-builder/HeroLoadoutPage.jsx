import { useEffect, useMemo, useState } from "react";

import {
  getHeroMasteryExpCost,
  getHeroUnlockWave,
  getHeroAttributePreview,
  HERO_ATTRIBUTE_DEFINITIONS,
  readHeroLoadoutState,
  writeHeroLoadoutState,
} from "../../lib/heroLoadout";

const RARITY_SORT_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Supreme", "Ascended"];
const ATTRIBUTE_GROUPS = [
  { key: "personal", label: "Personal Attributes", description: "Applies to each copy of the selected hero." },
  { key: "global", label: "Global Attributes", description: "Applies to every placed hero when this hero is on the map." },
];
const HERO_DETAIL_TABS = [
  { id: "information", label: "Information" },
  { id: "rankAttributes", label: "Rank & Attributes" },
  { id: "synergies", label: "Synergies" },
];
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

function formatAttributeValue(attribute, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? "-");
  }

  if (FLAT_VALUE_KEYS.has(attribute.statKey)) {
    return numeric.toLocaleString();
  }

  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toLocaleString()}%`;
}

function normalizeHeroEffectKey(statKey) {
  return HERO_EFFECT_KEY_MAP[statKey] ?? statKey ?? "";
}

function getHeroEffectLabel(statKey) {
  const normalizedKey = normalizeHeroEffectKey(statKey);
  return HERO_STAT_LABELS[normalizedKey] ?? formatLabel(normalizedKey);
}

function formatHeroEffectAmount(statKey, amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) {
    return String(amount ?? "-");
  }

  const normalizedKey = normalizeHeroEffectKey(statKey);
  const prefix = numeric > 0 ? "+" : "";

  if (FLAT_VALUE_KEYS.has(normalizedKey) || FLAT_VALUE_KEYS.has(statKey)) {
    return `${prefix}${numeric.toLocaleString()}`;
  }

  return `${prefix}${numeric.toLocaleString()}%`;
}

function formatBaseStatValue(statKey, value) {
  if (value == null) {
    return "-";
  }

  if (statKey === "attackSpeed") {
    return `${value}s`;
  }

  return Number.isFinite(Number(value)) ? Number(value).toLocaleString() : String(value);
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
    <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 14, display: "grid", gap: 12, boxShadow: "0 10px 24px rgba(0,0,0,0.18)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: attribute.bgColor ?? colors.panel, border: `2px solid ${attribute.borderColor ?? colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
          {attribute.icon ? <img src={getIconUrl(attribute.icon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} /> : null}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: colors.text }}>{attribute.name}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <span style={{ fontSize: 12, color: colors.muted }}>{formatLabel(attribute.scope)}</span>
            <span style={{ fontSize: 12, color: colors.muted }}>Rank {attribute.rankReq?.toLocaleString() ?? 0}+</span>
            <span style={{ fontSize: 12, color: colors.accent }}>{formatAttributeValue(attribute, attribute.statAmt ?? 0)} / level</span>
          </div>
        </div>
        <label style={{ display: "grid", gap: 4, minWidth: 108 }}>
          <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Current Level</span>
          <input
            type="number"
            min={0}
            max={attribute.maxLevel ?? Number.MAX_SAFE_INTEGER}
            value={currentLevel}
            onChange={(event) => onLevelChange(event.target.value)}
            style={{
              width: "100%",
              background: "#0f2640",
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.text,
              fontSize: 14,
              fontWeight: 700,
              padding: "8px 10px",
              fontFamily: "inherit",
            }}
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Current Bonus</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.positive }}>{formatAttributeValue(attribute, preview.currentValue)}</div>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Projected Level</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.accent }}>{preview.currentLevel} -&gt; {preview.projectedLevel}</div>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Projected Bonus</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.positive }}>{formatAttributeValue(attribute, preview.projectedValue)}</div>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Preview Cost</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.gold }}>{fmt(preview.previewCost)}</div>
        </div>
      </div>
    </div>
  );
}

export function HeroLoadoutPage({ colors, getIconUrl, fmt, heroes }) {
  const initialState = useMemo(() => readHeroLoadoutState(localStorage), []);
  const [selectedHeroId, setSelectedHeroId] = useState(initialState.selectedHeroId);
  const [previewLevelsByHero, setPreviewLevelsByHero] = useState(initialState.previewLevelsByHero);
  const [hideMaxedByHero, setHideMaxedByHero] = useState(initialState.hideMaxedByHero);
  const [rankByHero, setRankByHero] = useState(initialState.rankByHero);
  const [levelByHero, setLevelByHero] = useState(initialState.levelByHero);
  const [masteryLevelByHero, setMasteryLevelByHero] = useState(initialState.masteryLevelByHero);
  const [attributeLevelsByHero, setAttributeLevelsByHero] = useState(initialState.attributeLevelsByHero);
  const [activeHeroTab, setActiveHeroTab] = useState("information");
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState("search");
  const [activeFilterSubtabs, setActiveFilterSubtabs] = useState(DEFAULT_FILTER_SUBTABS);
  const [searchValue, setSearchValue] = useState("");
  const [searchScopes, setSearchScopes] = useState({
    name: true,
    skills: true,
    mastery: true,
    milestones: true,
    synergies: true,
  });
  const [sortMode, setSortMode] = useState("order");
  const [classFilters, setClassFilters] = useState([]);
  const [rarityFilters, setRarityFilters] = useState([]);
  const [typeFilters, setTypeFilters] = useState([]);
  const [subtypeFilters, setSubtypeFilters] = useState([]);
  const [milestoneTypeFilters, setMilestoneTypeFilters] = useState([]);
  const [synergyTypeFilters, setSynergyTypeFilters] = useState([]);

  useEffect(() => {
    writeHeroLoadoutState({
      selectedHeroId,
      previewLevelsByHero,
      hideMaxedByHero,
      rankByHero,
      levelByHero,
      masteryLevelByHero,
      attributeLevelsByHero,
    }, localStorage);
  }, [attributeLevelsByHero, hideMaxedByHero, levelByHero, masteryLevelByHero, previewLevelsByHero, rankByHero, selectedHeroId]);

  const heroesById = useMemo(() => Object.fromEntries(heroes.map((hero) => [hero.id, hero])), [heroes]);
  const heroSearchIndex = useMemo(
    () => Object.fromEntries(heroes.map((hero) => [hero.id, buildHeroSearchIndex(hero)])),
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
  const subtypeOptions = useMemo(() => {
    const relevantTypes = typeFilters.filter((type) => type === "buff" || type === "debuff");
    if (!relevantTypes.length) {
      return [];
    }

    return [...new Set(
      heroes
        .filter((hero) => relevantTypes.includes(hero.type))
        .flatMap((hero) => hero.typeSubtype ?? [])
        .filter(Boolean)
    )];
  }, [heroes, typeFilters]);

  const sortedHeroes = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();
    const searchTerms = searchValue
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const enabledSearchScopes = getEnabledSearchScopes(searchScopes);
    const shouldRestrictToExactNameMatches = searchScopes.name && Object.entries(searchScopes).every(([scope, isEnabled]) => (scope === "name" ? isEnabled : !isEnabled));
    const exactNameMatches = shouldRestrictToExactNameMatches && normalizedQuery
      ? new Set(
        heroes
          .filter((hero) => {
            const normalizedName = normalizeText(hero.name);
            const normalizedId = normalizeText(hero.id);
            return normalizedName === normalizedQuery || normalizedId === normalizedQuery;
          })
          .map((hero) => hero.id)
      )
      : null;

    const nextHeroes = heroes.filter((hero) => {
      const matchesSearch = !searchTerms.length || searchTerms.every((term) => enabledSearchScopes.some((scope) => heroSearchIndex[hero.id]?.[scope]?.includes(term)));
      const matchesExactName = !exactNameMatches?.size || exactNameMatches.has(hero.id);
      const matchesClass = !classFilters.length || classFilters.includes(hero.class);
      const matchesRarity = !rarityFilters.length || rarityFilters.includes(hero.rarity);
      const matchesType = !typeFilters.length || typeFilters.includes(hero.type);
      const matchesSubtype = !subtypeFilters.length || (hero.typeSubtype ?? []).some((subtype) => subtypeFilters.includes(subtype));
      const matchesMilestones = !milestoneTypeFilters.length || (hero.milestones ?? []).some((milestone) => milestoneTypeFilters.includes(milestone.type));
      const matchesSynergies = !synergyTypeFilters.length || (hero.synergies ?? []).some((synergy) => synergyTypeFilters.includes(synergy.type));

      return matchesSearch && matchesExactName && matchesClass && matchesRarity && matchesType && matchesSubtype && matchesMilestones && matchesSynergies;
    });

    return sortHeroes(nextHeroes, sortMode);
  }, [classFilters, heroSearchIndex, heroes, milestoneTypeFilters, rarityFilters, searchScopes, searchValue, sortMode, subtypeFilters, synergyTypeFilters, typeFilters]);

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

  useEffect(() => {
    const hasSubtypeType = typeFilters.some((type) => type === "buff" || type === "debuff");
    if (!hasSubtypeType && subtypeFilters.length) {
      setSubtypeFilters([]);
    }
  }, [subtypeFilters, typeFilters]);

  useEffect(() => {
    const supportsSubtype = typeFilters.some((type) => type === "buff" || type === "debuff");
    if (!supportsSubtype && activeFilterSubtabs.effects === "subtype") {
      setActiveFilterSubtabs((current) => ({ ...current, effects: "type" }));
    }
  }, [activeFilterSubtabs.effects, typeFilters]);

  const selectedHero = sortedHeroes.find((hero) => hero.id === selectedHeroId) ?? sortedHeroes[0] ?? null;
  const activePreviewLevels = selectedHero ? (previewLevelsByHero[selectedHero.id] ?? 1) : 1;
  const hideMaxed = selectedHero ? (hideMaxedByHero[selectedHero.id] ?? false) : false;
  const selectedHeroRank = selectedHero ? (rankByHero[selectedHero.id] ?? 0) : 0;
  const selectedHeroLevel = selectedHero ? (levelByHero[selectedHero.id] ?? 0) : 0;
  const selectedHeroMasteryLevel = selectedHero ? (masteryLevelByHero[selectedHero.id] ?? 0) : 0;
  const selectedHeroUnlockWave = selectedHero ? getHeroUnlockWave(selectedHero) : null;
  const activeAttributeLevels = selectedHero ? (attributeLevelsByHero[selectedHero.id] ?? {}) : {};
  const effectSubtabs = typeFilters.some((type) => type === "buff" || type === "debuff")
    ? FILTER_SUBTABS.effects
    : FILTER_SUBTABS.effects.filter((subtab) => subtab.id !== "subtype");
  const visibleSubtabs = activeFilterTab === "effects" ? effectSubtabs : FILTER_SUBTABS[activeFilterTab];
  const activeSubtab = activeFilterSubtabs[activeFilterTab] ?? DEFAULT_FILTER_SUBTABS[activeFilterTab];
  const visibleGroups = useMemo(() => ATTRIBUTE_GROUPS.map((group) => ({
    ...group,
    attributes: HERO_ATTRIBUTE_DEFINITIONS
      .filter((attribute) => attribute.groupKey === group.key)
      .filter((attribute) => !hideMaxed || (activeAttributeLevels[attribute.id] ?? 0) < (attribute.maxLevel ?? Number.MAX_SAFE_INTEGER)),
  })), [activeAttributeLevels, hideMaxed]);

  const milestoneProgress = useMemo(() => {
    const milestones = selectedHero?.milestones ?? [];
    return {
      completed: milestones.filter((milestone) => selectedHeroLevel >= (milestone.requirement ?? 0)).length,
      next: milestones.find((milestone) => selectedHeroLevel < (milestone.requirement ?? 0)) ?? null,
    };
  }, [selectedHero, selectedHeroLevel]);

  const nextMasteryLevel = selectedHero
    ? Math.min((selectedHero.masteryExp?.maxLevel ?? 0), selectedHeroMasteryLevel + 1)
    : 0;
  const nextMasteryCost = selectedHero && selectedHero.masteryExp && selectedHeroMasteryLevel < (selectedHero.masteryExp.maxLevel ?? 0)
    ? getHeroMasteryExpCost(selectedHero, selectedHeroMasteryLevel + 1)
    : 0;

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

  function resetFilters() {
    setSearchValue("");
    setSearchScopes({
      name: true,
      skills: true,
      mastery: true,
      milestones: true,
      synergies: true,
    });
    setSortMode("order");
    setClassFilters([]);
    setRarityFilters([]);
    setTypeFilters([]);
    setSubtypeFilters([]);
    setMilestoneTypeFilters([]);
    setSynergyTypeFilters([]);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 18, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.text }}>Hero Loadout</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Configure hero-wide rank, level, mastery, and attribute levels shared by every copy of the same hero.</div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={() => setIsFiltersExpanded((current) => !current)} style={{ background: isFiltersExpanded ? "rgba(68,136,238,0.16)" : colors.header, color: colors.text, border: `1px solid ${isFiltersExpanded ? colors.accent : colors.border}`, borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer", minHeight: 44 }}>
            Filters
          </button>
          <div style={{ fontSize: 12, color: colors.muted }}>{sortedHeroes.length} of {heroes.length} heroes</div>
        </div>
      </div>

      {isFiltersExpanded && (
        <div style={{ display: "grid", gap: 14, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {FILTER_TABS.map((tab) => (
              <FilterTabButton key={tab.id} active={activeFilterTab === tab.id} label={tab.label} onClick={() => setActiveFilterTab(tab.id)} colors={colors} />
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {visibleSubtabs.map((subtab) => (
              <FilterSubTabButton
                key={subtab.id}
                active={activeSubtab === subtab.id}
                label={subtab.label}
                onClick={() => setActiveFilterSubtabs((current) => ({ ...current, [activeFilterTab]: subtab.id }))}
                colors={colors}
              />
            ))}
          </div>

          {activeFilterTab === "search" && activeSubtab === "query" && (
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ color: colors.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Search Heroes</label>
              <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Search names, skills, mastery, milestones, synergies" style={{ background: "#0f2640", border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 10, padding: "10px 12px", font: "inherit" }} />
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ color: colors.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Search In</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {SEARCH_SCOPE_OPTIONS.map((option) => (
                    <label key={option.id} style={{ display: "flex", alignItems: "center", gap: 6, color: colors.text, fontSize: 12 }}>
                      <input type="checkbox" checked={searchScopes[option.id]} onChange={() => setSearchScopes((current) => ({ ...current, [option.id]: !current[option.id] }))} />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeFilterTab === "search" && activeSubtab === "state" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ color: colors.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Sort</label>
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} style={{ background: "#0f2640", border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 10, padding: "10px 12px", font: "inherit" }}>
                  <option value="order">Default Order</option>
                  <option value="name">Name</option>
                  <option value="class">Class</option>
                  <option value="rarity">Rarity</option>
                  <option value="type">Hero Type</option>
                </select>
              </div>
            </div>
          )}

          {activeFilterTab === "identity" && activeSubtab === "class" && (
            <FilterChipGroup title="Class" options={classOptions} selected={classFilters} onToggle={(value) => setClassFilters((current) => toggleSelection(current, value))} colors={colors} />
          )}

          {activeFilterTab === "identity" && activeSubtab === "rarity" && (
            <FilterChipGroup title="Rarity" options={rarityOptions} selected={rarityFilters} onToggle={(value) => setRarityFilters((current) => toggleSelection(current, value))} colors={colors} />
          )}

          {activeFilterTab === "effects" && activeSubtab === "type" && (
            <FilterChipGroup title="Hero Type" options={typeOptions} selected={typeFilters} onToggle={(value) => setTypeFilters((current) => toggleSelection(current, value))} colors={colors} />
          )}

          {activeFilterTab === "effects" && activeSubtab === "subtype" && (
            <FilterChipGroup title="Buff / Debuff Subtype" options={subtypeOptions} selected={subtypeFilters} onToggle={(value) => setSubtypeFilters((current) => toggleSelection(current, value))} colors={colors} emptyLabel="Choose buff or debuff in the Type sub tab to unlock subtype filters." />
          )}

          {activeFilterTab === "progression" && activeSubtab === "milestones" && (
            <FilterChipGroup title="Milestone Bonus Type" options={milestoneTypeOptions} selected={milestoneTypeFilters} onToggle={(value) => setMilestoneTypeFilters((current) => toggleSelection(current, value))} colors={colors} />
          )}

          {activeFilterTab === "progression" && activeSubtab === "synergies" && (
            <FilterChipGroup title="Synergy Bonus Type" options={synergyTypeOptions} selected={synergyTypeFilters} onToggle={(value) => setSynergyTypeFilters((current) => toggleSelection(current, value))} colors={colors} />
          )}

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ color: colors.muted, fontSize: 12 }}>
              Filters update the hero list in the sidebar and which hero is available to inspect.
            </div>
            <button type="button" onClick={resetFilters} style={{ background: colors.header, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>Reset Filters</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "start" }}>
        <aside style={{ flex: "0 0 280px", width: "100%", maxWidth: 340, display: "grid", gap: 14, position: "sticky", top: 0 }}>
          <div style={{ background: `linear-gradient(180deg, ${colors.panel} 0%, ${colors.header} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 12, maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
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
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: colors.panel, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                          {hero.heroIcon ? <img src={getIconUrl(hero.heroIcon)} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} /> : null}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: isActive ? colors.accent : colors.text }}>{hero.name}</div>
                          <div style={{ fontSize: 11, color: colors.muted }}>{formatLabel(hero.class)} · Order {hero.order ?? "-"}</div>
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
                    <div style={{ fontSize: 13, color: colors.muted, marginTop: 8 }}>Rank, map-resetting level, mastery, and attributes on this page apply to every placed copy of {selectedHero.name}.</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800, color: colors.accent }}>Rank {selectedHeroRank.toLocaleString()}</div>
                    <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800, color: colors.gold }}>Level {selectedHeroLevel.toLocaleString()}</div>
                    <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800, color: colors.text }}>Mastery {selectedHeroMasteryLevel}/{selectedHero.masteryExp?.maxLevel ?? 0}</div>
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
              </div>

              {activeHeroTab === "information" && (
                <div style={{ display: "grid", gap: 16 }}>
                  <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Overview</div>
                      <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Core identity, unlock timing, and current progression for the selected hero.</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 240px) minmax(0, 1fr)", gap: 16, alignItems: "stretch" }}>
                      <div style={{ minHeight: 220, borderRadius: 16, background: `linear-gradient(180deg, ${colors.header} 0%, rgba(15,38,64,0.95) 100%)`, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                        {selectedHero.heroIcon ? <img src={getIconUrl(selectedHero.heroIcon)} alt={selectedHero.name} style={{ width: "100%", maxWidth: 160, maxHeight: 160, objectFit: "contain" }} /> : null}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                        {[
                          { label: "Hero", value: selectedHero.name },
                          { label: "Rarity", value: selectedHero.rarity },
                          { label: "Type", value: formatLabel(selectedHero.type) },
                          { label: "Wave Unlocked", value: selectedHeroUnlockWave != null ? selectedHeroUnlockWave.toLocaleString() : "Not provided" },
                          { label: "Current Rank", value: selectedHeroRank.toLocaleString() },
                          { label: "Current Level", value: selectedHeroLevel.toLocaleString() },
                          { label: "Class", value: formatLabel(selectedHero.class) },
                        ].map((item) => (
                          <div key={item.label} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>{item.label}</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Active Skill</div>
                      <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Base skill text plus the parts affected by skill power and skill duration.</div>
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
                              <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 999, padding: "4px 10px", fontSize: 12, color: colors.muted }}>{selectedHero.skill.cooldown ?? 0}s cooldown</div>
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
                      <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Track the current mastery level and the exp cost required for the next level.</div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                      <label style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                        <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Current Mastery Level</span>
                        <input
                          type="number"
                          min={0}
                          max={selectedHero.masteryExp?.maxLevel ?? 0}
                          value={selectedHeroMasteryLevel}
                          onChange={(event) => handleMasteryLevelChange(event.target.value)}
                          style={{ background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 10, color: colors.text, fontSize: 14, fontWeight: 700, padding: "10px 12px", fontFamily: "inherit" }}
                          disabled={!selectedHero.masteryExp}
                        />
                      </label>
                      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Next Mastery Level</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: colors.text }}>
                          {selectedHero.masteryExp ? (selectedHeroMasteryLevel >= (selectedHero.masteryExp.maxLevel ?? 0) ? "Maxed" : nextMasteryLevel) : "Unavailable"}
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
                      <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Base stat values defined for the hero.</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                      {Object.entries(selectedHero.baseStats ?? {}).map(([statKey, value]) => (
                        <div key={statKey} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>{BASE_STAT_LABELS[statKey] ?? formatLabel(statKey)}</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: colors.gold }}>{formatBaseStatValue(statKey, value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Milestones</div>
                      <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>All milestone thresholds for this hero, including bonus type and scope.</div>
                    </div>
                    {(selectedHero.milestones ?? []).length ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                        {(selectedHero.milestones ?? []).map((milestone) => {
                          const isActive = selectedHeroLevel >= (milestone.requirement ?? 0);
                          return (
                            <div key={milestone.milestone} style={{ background: isActive ? "rgba(46,204,113,0.12)" : colors.header, border: `1px solid ${isActive ? colors.positive : colors.border}`, borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                                <div>
                                  <div style={{ fontSize: 12, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Milestone {milestone.milestone}</div>
                                  <div style={{ fontSize: 16, fontWeight: 900, color: colors.text, marginTop: 4 }}>{milestone.name}</div>
                                </div>
                                <div style={{ background: isActive ? "rgba(46,204,113,0.18)" : colors.panel, border: `1px solid ${isActive ? colors.positive : colors.border}`, borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 800, color: isActive ? colors.positive : colors.muted }}>{isActive ? "Active" : "Locked"}</div>
                              </div>
                              <div style={{ display: "grid", gap: 6 }}>
                                <div style={{ fontSize: 12, color: colors.text }}><span style={{ color: colors.muted }}>Required Level:</span> {milestone.requirement?.toLocaleString() ?? 0}</div>
                                <div style={{ fontSize: 12, color: colors.text }}><span style={{ color: colors.muted }}>Stat:</span> {getHeroEffectLabel(milestone.type)}</div>
                                <div style={{ fontSize: 12, color: colors.text }}><span style={{ color: colors.muted }}>Amount:</span> {formatHeroEffectAmount(milestone.type, milestone.amount)}</div>
                                <div style={{ fontSize: 12, color: colors.text }}><span style={{ color: colors.muted }}>Scope:</span> {formatLabel(milestone.scope)}</div>
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
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Rank</div>
                      <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Rank drives synergies. Level resets each map and drives milestone unlocks.</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                      <label style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                        <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Current Rank</span>
                        <input
                          type="number"
                          min={0}
                          value={selectedHeroRank}
                          onChange={(event) => handleRankChange(event.target.value)}
                          style={{ background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 10, color: colors.text, fontSize: 14, fontWeight: 700, padding: "10px 12px", fontFamily: "inherit" }}
                        />
                      </label>
                      <label style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                        <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Current Level</span>
                        <input
                          type="number"
                          min={0}
                          value={selectedHeroLevel}
                          onChange={(event) => handleHeroLevelChange(event.target.value)}
                          style={{ background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 10, color: colors.text, fontSize: 14, fontWeight: 700, padding: "10px 12px", fontFamily: "inherit" }}
                        />
                      </label>
                      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Milestones Reached</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>{milestoneProgress.completed} / {selectedHero.milestones?.length ?? 0}</div>
                      </div>
                      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Next Milestone</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: colors.accent }}>{milestoneProgress.next ? `Level ${milestoneProgress.next.requirement.toLocaleString()}` : "Completed"}</div>
                        <div style={{ fontSize: 12, color: colors.muted }}>{milestoneProgress.next ? getHeroEffectLabel(milestoneProgress.next.type) : "All milestones unlocked"}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Attributes</div>
                        <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Preview future costs and set the shared attribute levels for this hero.</div>
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, color: colors.text, fontSize: 13, fontWeight: 700 }}>
                          <input type="checkbox" checked={hideMaxed} onChange={(event) => handleHideMaxedChange(event.target.checked)} />
                          Hide Maxed Attributes
                        </label>
                        <label style={{ display: "grid", gap: 6, minWidth: 180 }}>
                          <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Preview Additional Levels</span>
                          <input
                            type="number"
                            min={1}
                            value={activePreviewLevels}
                            onChange={(event) => handlePreviewChange(event.target.value)}
                            style={{ background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 10, color: colors.text, fontSize: 14, fontWeight: 700, padding: "10px 12px", fontFamily: "inherit" }}
                          />
                        </label>
                      </div>
                    </div>

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
                          <div style={{ display: "grid", gap: 14 }}>
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
              )}

              {activeHeroTab === "synergies" && (
                <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Synergies</div>
                    <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Each path shows its tier, the rank requirement for every team member, and the stat bonus it grants.</div>
                  </div>

                  {(selectedHero.synergies ?? []).length ? (
                    <div style={{ display: "grid", gap: 14 }}>
                      {(selectedHero.synergies ?? []).map((synergy) => {
                        const teamHeroIds = [selectedHero.id, synergy.hero1, synergy.hero2, synergy.hero3].filter(Boolean);
                        const uniqueTeamHeroIds = [...new Set(teamHeroIds)];
                        const isActive = uniqueTeamHeroIds.every((heroId) => (rankByHero[heroId] ?? 0) >= (synergy.rankRequired ?? 0));

                        return (
                          <div key={synergy.synergyLevel} style={{ background: isActive ? "rgba(46,204,113,0.10)" : colors.header, border: `1px solid ${isActive ? colors.positive : colors.border}`, borderRadius: 14, padding: 14, display: "grid", gap: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                              <div>
                                <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Tier {synergy.tier} · Path {synergy.synergyLevel}</div>
                                <div style={{ fontSize: 18, fontWeight: 900, color: colors.text, marginTop: 4 }}>{synergy.name}</div>
                                <div style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>Required rank for all heroes: {synergy.rankRequired?.toLocaleString() ?? 0}</div>
                              </div>
                              <div style={{ background: isActive ? "rgba(46,204,113,0.18)" : colors.panel, border: `1px solid ${isActive ? colors.positive : colors.border}`, borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 800, color: isActive ? colors.positive : colors.muted }}>{isActive ? "Active" : "Inactive"}</div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                              {uniqueTeamHeroIds.map((heroId) => {
                                const teamHero = heroesById[heroId];
                                const currentRank = rankByHero[heroId] ?? 0;
                                const meetsRank = currentRank >= (synergy.rankRequired ?? 0);
                                return (
                                  <div key={heroId} style={{ background: colors.panel, border: `1px solid ${meetsRank ? colors.positive : colors.border}`, borderRadius: 12, padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 10, background: colors.header, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                                      {teamHero?.heroIcon ? <img src={getIconUrl(teamHero.heroIcon)} alt={teamHero.name} style={{ width: 30, height: 30, objectFit: "contain" }} /> : null}
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ fontSize: 13, fontWeight: 800, color: colors.text }}>{teamHero?.name ?? formatLabel(heroId)}</div>
                                      <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>Current Rank {currentRank.toLocaleString()}</div>
                                      <div style={{ fontSize: 11, color: meetsRank ? colors.positive : colors.accent, marginTop: 2 }}>{meetsRank ? "Requirement met" : `Needs ${Math.max((synergy.rankRequired ?? 0) - currentRank, 0).toLocaleString()} more rank`}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                              <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 6 }}>
                                <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Stat Increase</div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: colors.text }}>{getHeroEffectLabel(synergy.type)}</div>
                                <div style={{ fontSize: 12, color: colors.accent, fontWeight: 800 }}>{formatHeroEffectAmount(synergy.type, synergy.amount)}</div>
                              </div>
                              <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 6 }}>
                                <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>Scope</div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: colors.text }}>{formatLabel(synergy.scope)}</div>
                                <div style={{ fontSize: 12, color: colors.muted }}>{synergy.description}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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