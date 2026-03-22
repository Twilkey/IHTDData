import { useEffect, useMemo, useState } from "react";

import { SearchableSelect } from "../SearchableSelect";

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

export const SEARCH_SCOPE_OPTIONS = [
  { id: "name", label: "Name" },
  { id: "skills", label: "Skills" },
  { id: "mastery", label: "Mastery" },
  { id: "milestones", label: "Milestones" },
  { id: "synergies", label: "Synergies" },
];

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function toggleSelection(list, value) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export function formatHeroFilterLabel(value) {
  return String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildHeroSearchIndex(hero) {
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

export function getEnabledSearchScopes(searchScopes) {
  const enabled = Object.entries(searchScopes)
    .filter(([, value]) => value)
    .map(([key]) => key);

  return enabled.length ? enabled : SEARCH_SCOPE_OPTIONS.map((option) => option.id);
}

export function getHeroSubtypeOptions(heroes, typeFilters) {
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
}

export function filterHeroes({
  heroes,
  heroSearchIndex,
  filters,
  sortHeroes,
  placementCounts = {},
  includePlacementFilter = false,
  maxPlacementCount = 0,
}) {
  const normalizedQuery = filters.searchValue.trim().toLowerCase();
  const searchTerms = filters.searchValue
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const enabledSearchScopes = getEnabledSearchScopes(filters.searchScopes);
  const shouldRestrictToExactNameMatches = filters.searchScopes.name
    && Object.entries(filters.searchScopes).every(([scope, isEnabled]) => (scope === "name" ? isEnabled : !isEnabled));
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
    const placementCount = placementCounts[hero.id] ?? 0;
    const matchesPlacement = !includePlacementFilter
      || filters.placementFilter === "all"
      || (filters.placementFilter === "available" && placementCount < maxPlacementCount)
      || (filters.placementFilter === "placed" && placementCount > 0);
    const matchesClass = !filters.classFilters.length || filters.classFilters.includes(hero.class);
    const matchesRarity = !filters.rarityFilters.length || filters.rarityFilters.includes(hero.rarity);
    const matchesType = !filters.typeFilters.length || filters.typeFilters.includes(hero.type);
    const matchesSubtype = !filters.subtypeFilters.length || (hero.typeSubtype ?? []).some((subtype) => filters.subtypeFilters.includes(subtype));
    const matchesMilestones = !filters.milestoneTypeFilters.length || (hero.milestones ?? []).some((milestone) => filters.milestoneTypeFilters.includes(milestone.type));
    const matchesSynergies = !filters.synergyTypeFilters.length || (hero.synergies ?? []).some((synergy) => filters.synergyTypeFilters.includes(synergy.type));

    return matchesSearch && matchesExactName && matchesPlacement && matchesClass && matchesRarity && matchesType && matchesSubtype && matchesMilestones && matchesSynergies;
  });

  return sortHeroes(nextHeroes, filters.sortMode);
}

export function useHeroFilters({ includePlacementFilter = false } = {}) {
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
  const [placementFilter, setPlacementFilter] = useState("all");
  const [sortMode, setSortMode] = useState("order");
  const [classFilters, setClassFilters] = useState([]);
  const [rarityFilters, setRarityFilters] = useState([]);
  const [typeFilters, setTypeFilters] = useState([]);
  const [subtypeFilters, setSubtypeFilters] = useState([]);
  const [milestoneTypeFilters, setMilestoneTypeFilters] = useState([]);
  const [synergyTypeFilters, setSynergyTypeFilters] = useState([]);

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

  function resetFilters() {
    setSearchValue("");
    setSearchScopes({
      name: true,
      skills: true,
      mastery: true,
      milestones: true,
      synergies: true,
    });
    if (includePlacementFilter) {
      setPlacementFilter("all");
    }
    setSortMode("order");
    setClassFilters([]);
    setRarityFilters([]);
    setTypeFilters([]);
    setSubtypeFilters([]);
    setMilestoneTypeFilters([]);
    setSynergyTypeFilters([]);
  }

  return {
    isFiltersExpanded,
    setIsFiltersExpanded,
    activeFilterTab,
    setActiveFilterTab,
    activeFilterSubtabs,
    setActiveFilterSubtabs,
    searchValue,
    setSearchValue,
    searchScopes,
    setSearchScopes,
    placementFilter,
    setPlacementFilter,
    sortMode,
    setSortMode,
    classFilters,
    setClassFilters,
    rarityFilters,
    setRarityFilters,
    typeFilters,
    setTypeFilters,
    subtypeFilters,
    setSubtypeFilters,
    milestoneTypeFilters,
    setMilestoneTypeFilters,
    synergyTypeFilters,
    setSynergyTypeFilters,
    resetFilters,
  };
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

export function FilterSubTabButton({ active, label, onClick, colors }) {
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
              label={formatHeroFilterLabel(option)}
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

export function HeroFiltersPanel({
  colors,
  filters,
  resultsCount,
  totalCount,
  classOptions,
  rarityOptions,
  typeOptions,
  subtypeOptions,
  milestoneTypeOptions,
  synergyTypeOptions,
  includePlacementFilter = false,
  helperText,
}) {
  const effectSubtabs = useMemo(
    () => filters.typeFilters.some((type) => type === "buff" || type === "debuff")
      ? FILTER_SUBTABS.effects
      : FILTER_SUBTABS.effects.filter((subtab) => subtab.id !== "subtype"),
    [filters.typeFilters]
  );
  const visibleSubtabs = filters.activeFilterTab === "effects" ? effectSubtabs : FILTER_SUBTABS[filters.activeFilterTab];
  const activeSubtab = filters.activeFilterSubtabs[filters.activeFilterTab] ?? DEFAULT_FILTER_SUBTABS[filters.activeFilterTab];

  if (!filters.isFiltersExpanded) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: 14, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {FILTER_TABS.map((tab) => (
          <FilterTabButton key={tab.id} active={filters.activeFilterTab === tab.id} label={tab.label} onClick={() => filters.setActiveFilterTab(tab.id)} colors={colors} />
        ))}
        {typeof resultsCount === "number" && typeof totalCount === "number" ? (
          <div style={{ marginLeft: "auto", color: colors.muted, fontSize: 12 }}>
            {resultsCount} of {totalCount} heroes
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {visibleSubtabs.map((subtab) => (
          <FilterSubTabButton
            key={subtab.id}
            active={activeSubtab === subtab.id}
            label={subtab.label}
            onClick={() => filters.setActiveFilterSubtabs((current) => ({ ...current, [filters.activeFilterTab]: subtab.id }))}
            colors={colors}
          />
        ))}
      </div>

      {filters.activeFilterTab === "search" && activeSubtab === "query" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ color: colors.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Search Heroes</label>
          <input value={filters.searchValue} onChange={(event) => filters.setSearchValue(event.target.value)} placeholder="Search names, skills, mastery, milestones, synergies" style={{ background: "#0f2640", border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 10, padding: "10px 12px", font: "inherit" }} />
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: colors.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Search In</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {SEARCH_SCOPE_OPTIONS.map((option) => (
                <label key={option.id} style={{ display: "flex", alignItems: "center", gap: 6, color: colors.text, fontSize: 12 }}>
                  <input type="checkbox" checked={filters.searchScopes[option.id]} onChange={() => filters.setSearchScopes((current) => ({ ...current, [option.id]: !current[option.id] }))} />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {filters.activeFilterTab === "search" && activeSubtab === "state" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {includePlacementFilter ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: colors.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Availability</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { value: "all", label: "All Heroes" },
                  { value: "available", label: "Available" },
                  { value: "placed", label: "Placed" },
                ].map((option) => (
                  <FilterChip key={option.value} active={filters.placementFilter === option.value} label={option.label} onClick={() => filters.setPlacementFilter(option.value)} colors={colors} />
                ))}
              </div>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ color: colors.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Sort</label>
            <SearchableSelect
              value={filters.sortMode}
              onChange={filters.setSortMode}
              colors={colors}
              options={[
                { value: "order", label: "Default Order" },
                { value: "name", label: "Name" },
                { value: "class", label: "Class" },
                { value: "rarity", label: "Rarity" },
                { value: "type", label: "Hero Type" },
              ]}
              searchPlaceholder="Search sort modes..."
            />
          </div>
        </div>
      ) : null}

      {filters.activeFilterTab === "identity" && activeSubtab === "class" ? (
        <FilterChipGroup title="Class" options={classOptions} selected={filters.classFilters} onToggle={(value) => filters.setClassFilters((current) => toggleSelection(current, value))} colors={colors} />
      ) : null}

      {filters.activeFilterTab === "identity" && activeSubtab === "rarity" ? (
        <FilterChipGroup title="Rarity" options={rarityOptions} selected={filters.rarityFilters} onToggle={(value) => filters.setRarityFilters((current) => toggleSelection(current, value))} colors={colors} />
      ) : null}

      {filters.activeFilterTab === "effects" && activeSubtab === "type" ? (
        <FilterChipGroup title="Hero Type" options={typeOptions} selected={filters.typeFilters} onToggle={(value) => filters.setTypeFilters((current) => toggleSelection(current, value))} colors={colors} />
      ) : null}

      {filters.activeFilterTab === "effects" && activeSubtab === "subtype" ? (
        <FilterChipGroup title="Buff / Debuff Subtype" options={subtypeOptions} selected={filters.subtypeFilters} onToggle={(value) => filters.setSubtypeFilters((current) => toggleSelection(current, value))} colors={colors} emptyLabel="Choose buff or debuff in the Type sub tab to unlock subtype filters." />
      ) : null}

      {filters.activeFilterTab === "progression" && activeSubtab === "milestones" ? (
        <FilterChipGroup title="Milestone Bonus Type" options={milestoneTypeOptions} selected={filters.milestoneTypeFilters} onToggle={(value) => filters.setMilestoneTypeFilters((current) => toggleSelection(current, value))} colors={colors} />
      ) : null}

      {filters.activeFilterTab === "progression" && activeSubtab === "synergies" ? (
        <FilterChipGroup title="Synergy Bonus Type" options={synergyTypeOptions} selected={filters.synergyTypeFilters} onToggle={(value) => filters.setSynergyTypeFilters((current) => toggleSelection(current, value))} colors={colors} />
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ color: colors.muted, fontSize: 12 }}>
          {helperText}
        </div>
        <button type="button" onClick={filters.resetFilters} style={{ background: colors.header, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>Reset Filters</button>
      </div>
    </div>
  );
}