import { useEffect, useMemo, useState } from "react";

import { collectCombatStyleEntries, COMBAT_STYLE_DEFINITIONS } from "../../lib/combatStyles";
import { heroList, mapsData } from "../../lib/gameData";
import { buildHeroStatModel, buildStatBreakdown, formatHeroStatValue, formatSignedHeroBonus } from "../../lib/loadoutStatEngine";
import { LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY } from "../../lib/loadoutBuilderSave";
import { LOADOUT_RUNTIME_CHANGED_EVENT, schedulePersistLoadoutRuntime } from "../../lib/loadoutRuntimeStore";
import { readMapLoadoutState } from "../../lib/mapLoadout";
import { readPlayerLoadoutState } from "../../lib/playerLoadout";
import { createStatSimulatorDraftState, importSimulatorScenarioFromLoadout, pushSimulatorFocusHeroToLoadout, pushSimulatorMapToLoadout, readStatSimulatorState, STAT_SIMULATOR_MANUAL_STAT_FIELDS, STAT_SIMULATOR_SKILL_EFFECT_FIELDS, sumSupportExtraSynergy, sumSupportSkillEffects, updateSimulatorSupportRow, writeStatSimulatorState } from "../../lib/statSimulator";
import { readStatsLoadoutState } from "../../lib/statsLoadout";
import { readHeroLoadoutState } from "../../lib/heroLoadout";

const LOADOUT_SOURCE_FIELDS = Object.freeze([
  { key: "statsLoadout", label: "Use current upgrades loadout", description: "Applies purchased upgrade bonuses from the Upgrades Loadout page." },
  { key: "playerLoadout", label: "Use current player loadout", description: "Applies purchased icons, backgrounds, and premiums." },
  { key: "mapLoadout", label: "Use current map loadout", description: "Applies currently selected map perk bonuses from the Map Loadout page." },
  { key: "heroAttributes", label: "Use current hero attributes", description: "Imports the selected hero's saved attribute levels from Hero Loadout." },
]);

function parseNumberInput(value, fallback = 0) {
  if (value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampChance(value) {
  return Math.max(0, value);
}

function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? "-");
  }

  if (Math.abs(numeric) >= 1000) {
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  return numeric.toFixed(2).replace(/\.00$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function Panel({ title, subtitle, colors, children, action }) {
  return (
    <section style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: colors.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 12, color: colors.muted }}>{subtitle}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ActionButton({ label, onClick, colors, tone = "default" }) {
  const palette = tone === "accent"
    ? { background: colors.accent, color: "#09131f", border: `${colors.accent}66` }
    : tone === "positive"
      ? { background: colors.positive, color: "#09131f", border: `${colors.positive}66` }
      : { background: colors.panel, color: colors.text, border: colors.border };

  return (
    <button
      onClick={onClick}
      style={{ borderRadius: 10, border: `1px solid ${palette.border}`, background: palette.background, color: palette.color, padding: "10px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
    >
      {label}
    </button>
  );
}

function TextField({ label, value, onChange, colors, type = "text", step = "any", min = undefined, max = undefined }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>{label}</span>
      <input
        type={type}
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        style={{ background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 10, color: colors.text, fontSize: 14, fontWeight: 700, padding: "10px 12px", fontFamily: "inherit" }}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, colors, options }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 10, color: colors.text, fontSize: 14, fontWeight: 700, padding: "10px 12px", fontFamily: "inherit" }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ToggleCard({ item, checked, onChange, colors }) {
  return (
    <label style={{ display: "grid", gap: 8, border: `1px solid ${checked ? colors.accent : colors.border}`, background: checked ? `${colors.accent}14` : colors.panel, borderRadius: 12, padding: 12, cursor: "pointer" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: colors.text, fontWeight: 800 }}>{item.label}</span>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      </div>
      <span style={{ fontSize: 12, color: colors.muted }}>{item.description}</span>
    </label>
  );
}

function BreakdownGrid({ title, breakdown, colors, emptyMessage }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12, color: colors.muted, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</div>
      {breakdown.orderedStats.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {breakdown.orderedStats.map((item) => (
            <div key={item.statKey} style={{ border: `1px solid ${colors.border}`, background: colors.panel, borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 13, color: colors.text, fontWeight: 800 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: colors.accent, fontWeight: 900 }}>{formatSignedHeroBonus(item.statKey, item.total, formatNumber)}</div>
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                {item.entries.map((entry) => (
                  <div key={`${entry.sourceId}-${entry.system}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                    <span style={{ color: colors.muted }}>{entry.sourceLabel}</span>
                    <span style={{ color: colors.text, fontWeight: 700 }}>{formatSignedHeroBonus(item.statKey, entry.amount, formatNumber)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: colors.muted, fontSize: 13 }}>{emptyMessage}</div>
      )}
    </div>
  );
}

function HeroStatSummary({ heroModel, colors }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>Stat</th>
            <th style={{ textAlign: "right", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>Value</th>
            <th style={{ textAlign: "left", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>Source</th>
          </tr>
        </thead>
        <tbody>
          {heroModel.adjustedHero.upgradeDisplayStats.map((item, index) => (
            <tr key={item.key} style={{ background: index % 2 === 0 ? "transparent" : `${colors.panel}66` }}>
              <td style={{ padding: "8px 10px", color: colors.text, fontWeight: 700 }}>{item.label}</td>
              <td style={{ padding: "8px 10px", color: colors.accent, textAlign: "right", fontWeight: 800 }}>{item.value}</td>
              <td style={{ padding: "8px 10px", color: colors.muted }}>{item.bonusLabel ?? "Base"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildManualSandboxStats(manualStats, heroTotals, skillTotals) {
  const damageBonus = (heroTotals.damage ?? 0) + (skillTotals.damage ?? 0);
  const attackSpeedBonus = (heroTotals.attackSpeed ?? 0) + (skillTotals.attackSpeed ?? 0);
  const critChanceBonus = (heroTotals.critChance ?? 0) + (skillTotals.critChance ?? 0);
  const critDamageBonus = (heroTotals.critDamage ?? 0) + (skillTotals.critDamage ?? 0);
  const superChanceBonus = (heroTotals.superCritChance ?? 0) + (skillTotals.superCritChance ?? 0);
  const superDamageBonus = (heroTotals.superCritDamage ?? 0) + (skillTotals.superCritDamage ?? 0);
  const ultraChanceBonus = (heroTotals.ultraCritChance ?? 0) + (skillTotals.ultraCritChance ?? 0);
  const ultraDamageBonus = (heroTotals.ultraCritDamage ?? 0) + (skillTotals.ultraCritDamage ?? 0);
  const killGoldBonus = heroTotals.killGold ?? 0;
  const bossGoldBonus = heroTotals.bossGold ?? 0;

  return {
    damage: manualStats.damage * (1 + damageBonus / 100),
    attackSpeed: manualStats.attackSpeed * (1 + attackSpeedBonus / 100),
    critChance: clampChance(manualStats.critChance + critChanceBonus),
    critDamage: manualStats.critDamage * (1 + critDamageBonus / 100),
    superCritChance: clampChance(manualStats.superCritChance + superChanceBonus),
    superCritDamage: manualStats.superCritDamage * (1 + superDamageBonus / 100),
    ultraCritChance: clampChance(manualStats.ultraCritChance + ultraChanceBonus),
    ultraCritDamage: manualStats.ultraCritDamage * (1 + ultraDamageBonus / 100),
    killGold: manualStats.killGold * (1 + killGoldBonus / 100),
    bossGold: manualStats.bossGold * (1 + bossGoldBonus / 100),
  };
}

export function StatSimulatorPage({ colors, getIconUrl }) {
  const [simulatorState, setSimulatorState] = useState(() => readStatSimulatorState(localStorage));
  const [loadoutRevision, setLoadoutRevision] = useState(0);
  const [bridgeMessage, setBridgeMessage] = useState(null);

  useEffect(() => {
    writeStatSimulatorState(simulatorState, localStorage);
  }, [simulatorState]);

  useEffect(() => {
    function handleRuntimeChanged() {
      setLoadoutRevision((current) => current + 1);
    }

    window.addEventListener(LOADOUT_RUNTIME_CHANGED_EVENT, handleRuntimeChanged);
    return () => window.removeEventListener(LOADOUT_RUNTIME_CHANGED_EVENT, handleRuntimeChanged);
  }, []);

  useEffect(() => {
    if (!bridgeMessage) {
      return undefined;
    }

    const timerId = window.setTimeout(() => setBridgeMessage(null), 2600);
    return () => window.clearTimeout(timerId);
  }, [bridgeMessage]);

  const loadoutStates = useMemo(() => ({
    statsLoadout: readStatsLoadoutState(localStorage),
    playerLoadout: readPlayerLoadoutState(localStorage),
    mapLoadout: readMapLoadoutState(localStorage),
    heroLoadout: readHeroLoadoutState(localStorage),
  }), [loadoutRevision]);

  const selectedHero = useMemo(
    () => heroList.find((hero) => hero.id === simulatorState.focusHeroId) ?? heroList[0] ?? null,
    [simulatorState.focusHeroId]
  );

  const syntheticHeroLoadoutState = useMemo(() => {
    const heroId = simulatorState.focusHeroId;
    const importedAttributeLevelsByHero = simulatorState.loadoutSources.heroAttributes
      ? loadoutStates.heroLoadout.attributeLevelsByHero
      : {};

    return {
      selectedHeroId: heroId,
      rankByHero: {
        ...loadoutStates.heroLoadout.rankByHero,
        [heroId]: simulatorState.focusHeroRank,
      },
      levelByHero: {
        ...loadoutStates.heroLoadout.levelByHero,
        [heroId]: simulatorState.focusHeroLevel,
      },
      masteryLevelByHero: {
        ...loadoutStates.heroLoadout.masteryLevelByHero,
        [heroId]: simulatorState.focusHeroMasteryLevel,
      },
      defaultCombatStyleIdByHero: {
        ...loadoutStates.heroLoadout.defaultCombatStyleIdByHero,
        [heroId]: simulatorState.focusCombatStyleId,
      },
      attributeLevelsByHero: importedAttributeLevelsByHero,
      previewLevelsByHero: loadoutStates.heroLoadout.previewLevelsByHero,
      hideMaxedByHero: loadoutStates.heroLoadout.hideMaxedByHero,
    };
  }, [loadoutStates.heroLoadout, simulatorState.focusCombatStyleId, simulatorState.focusHeroId, simulatorState.focusHeroLevel, simulatorState.focusHeroMasteryLevel, simulatorState.focusHeroRank, simulatorState.loadoutSources.heroAttributes]);

  const heroModel = useMemo(() => {
    if (!selectedHero) {
      return null;
    }

    return buildHeroStatModel({
      hero: selectedHero,
      statsLoadoutState: simulatorState.loadoutSources.statsLoadout ? loadoutStates.statsLoadout : { levelsByTab: {} },
      playerLoadoutState: simulatorState.loadoutSources.playerLoadout ? loadoutStates.playerLoadout : { purchasedByTab: {} },
      heroLoadoutState: syntheticHeroLoadoutState,
      mapLoadoutState: simulatorState.loadoutSources.mapLoadout ? loadoutStates.mapLoadout : { perksByMap: {}, placementBonusLevelsByMap: {}, placementBonusPlacementsByMap: {}, spellLoadoutsByMap: {} },
      selectedMapId: simulatorState.selectedMapId,
    });
  }, [loadoutStates.mapLoadout, loadoutStates.playerLoadout, loadoutStates.statsLoadout, selectedHero, simulatorState.loadoutSources.mapLoadout, simulatorState.loadoutSources.playerLoadout, simulatorState.loadoutSources.statsLoadout, simulatorState.selectedMapId, syntheticHeroLoadoutState]);

  const supportCombatStyleBreakdown = useMemo(() => {
    const entries = simulatorState.supportRows.flatMap((row) => {
      if (!row.enabled || !row.heroId) {
        return [];
      }

      const hero = heroList.find((item) => item.id === row.heroId);
      return collectCombatStyleEntries(row.combatStyleId, {
        currentRank: 999,
        heroId: row.heroId,
        system: "simulatorSupportCombatStyle",
        sourceType: "simulatorSupportCombatStyle",
        sourceId: row.id,
        sourceLabel: `${hero?.name ?? "Hero"}: ${COMBAT_STYLE_DEFINITIONS.find((style) => style.id === row.combatStyleId)?.name ?? "Style"}`,
        personalGroupLabel: "Support Combat Style Personal",
        globalGroupLabel: "Support Combat Style Global",
      });
    });

    return buildStatBreakdown(entries);
  }, [simulatorState.supportRows]);

  const supportSkillTotals = useMemo(
    () => sumSupportSkillEffects(simulatorState.supportRows),
    [simulatorState.supportRows]
  );

  const totalExtraSynergy = useMemo(
    () => sumSupportExtraSynergy(simulatorState.supportRows),
    [simulatorState.supportRows]
  );

  const manualSandboxStats = useMemo(
    () => buildManualSandboxStats(simulatorState.manualStats, heroModel?.combined?.totals ?? {}, supportSkillTotals),
    [heroModel?.combined?.totals, simulatorState.manualStats, supportSkillTotals]
  );

  function updateSimulatorState(updater) {
    setSimulatorState((current) => updater(current));
  }

  function handleScenarioImport() {
    setSimulatorState((current) => importSimulatorScenarioFromLoadout(current, localStorage));
    setBridgeMessage("Imported selected hero and map from loadout.");
  }

  function handlePushHero() {
    pushSimulatorFocusHeroToLoadout(simulatorState, localStorage);
    setBridgeMessage("Pushed focus hero rank, level, mastery, and combat style to Hero Loadout.");
  }

  function handlePushMap() {
    pushSimulatorMapToLoadout(simulatorState, localStorage);
    schedulePersistLoadoutRuntime(localStorage);
    setBridgeMessage("Pushed selected map into the loadout runtime.");
  }

  function handleReset() {
    setSimulatorState(createStatSimulatorDraftState());
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <Panel
        title="Stat Simulator"
        subtitle="Standalone sandbox based on the spreadsheet simulator layout, with optional pull and push bridges to the existing loadout system."
        colors={colors}
        action={(
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ActionButton label="Import Hero + Map From Loadout" onClick={handleScenarioImport} colors={colors} tone="accent" />
            <ActionButton label="Push Hero To Hero Loadout" onClick={handlePushHero} colors={colors} />
            <ActionButton label="Push Map To Loadout" onClick={handlePushMap} colors={colors} />
            <ActionButton label="Reset Sandbox" onClick={handleReset} colors={colors} />
          </div>
        )}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: colors.panel, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={getIconUrl("_attributePoints_0.png")} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
          </div>
          <div style={{ display: "grid", gap: 3 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: colors.text }}>Spreadsheet Sandbox</div>
            <div style={{ fontSize: 13, color: colors.muted }}>Scenario inputs stay local to the simulator unless you explicitly push selected fields back into loadout storage.</div>
          </div>
        </div>
        {bridgeMessage ? <div style={{ color: colors.positive, fontSize: 13, fontWeight: 700 }}>{bridgeMessage}</div> : null}
      </Panel>

      <Panel title="Scenario Setup" subtitle="High-level sheet inputs and scenario context." colors={colors}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <TextField label="Highest Hero Tier" value={simulatorState.highestHeroTier} onChange={(value) => updateSimulatorState((current) => ({ ...current, highestHeroTier: value }))} colors={colors} />
          <TextField label="Milestone" type="number" min={0} value={simulatorState.milestone} onChange={(value) => updateSimulatorState((current) => ({ ...current, milestone: parseNumberInput(value, 0) }))} colors={colors} />
          <TextField label="Synergy Tier" value={simulatorState.synergyTier} onChange={(value) => updateSimulatorState((current) => ({ ...current, synergyTier: value }))} colors={colors} />
          <SelectField label="Map" value={simulatorState.selectedMapId} onChange={(value) => updateSimulatorState((current) => ({ ...current, selectedMapId: value }))} colors={colors} options={mapsData.maps.map((map) => ({ value: map.id, label: map.name }))} />
          <TextField label="Research Synergy Effects" type="number" min={0} value={simulatorState.researchSynergyEffectsLevel} onChange={(value) => updateSimulatorState((current) => ({ ...current, researchSynergyEffectsLevel: parseNumberInput(value, 0) }))} colors={colors} />
          <TextField label="Tech Synergy Effects" type="number" min={0} value={simulatorState.techSynergyEffectsLevel} onChange={(value) => updateSimulatorState((current) => ({ ...current, techSynergyEffectsLevel: parseNumberInput(value, 0) }))} colors={colors} />
          <TextField label="Runes Map Perks %" type="number" value={simulatorState.runesMapPerksPercent} onChange={(value) => updateSimulatorState((current) => ({ ...current, runesMapPerksPercent: parseNumberInput(value, 0) }))} colors={colors} />
          <TextField label="Ultimus Map Perks %" type="number" value={simulatorState.ultimusMapPerksPercent} onChange={(value) => updateSimulatorState((current) => ({ ...current, ultimusMapPerksPercent: parseNumberInput(value, 0) }))} colors={colors} />
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "center", color: colors.text, fontSize: 13, fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={simulatorState.synergyEvent}
            onChange={(event) => updateSimulatorState((current) => ({ ...current, synergyEvent: event.target.checked }))}
          />
          Synergies event enabled
        </label>
      </Panel>

      <Panel title="Loadout Bridges" subtitle="Explicitly choose which live loadout sources the simulator should read." colors={colors}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {LOADOUT_SOURCE_FIELDS.map((field) => (
            <ToggleCard
              key={field.key}
              item={field}
              checked={simulatorState.loadoutSources[field.key]}
              onChange={(checked) => updateSimulatorState((current) => ({
                ...current,
                loadoutSources: {
                  ...current.loadoutSources,
                  [field.key]: checked,
                },
              }))}
              colors={colors}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Focus Hero" subtitle="The hero whose stats are recalculated through the shared app stat engine." colors={colors}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <SelectField label="Hero" value={simulatorState.focusHeroId} onChange={(value) => updateSimulatorState((current) => ({ ...current, focusHeroId: value }))} colors={colors} options={heroList.map((hero) => ({ value: hero.id, label: hero.name }))} />
          <TextField label="Rank" type="number" min={0} value={simulatorState.focusHeroRank} onChange={(value) => updateSimulatorState((current) => ({ ...current, focusHeroRank: parseNumberInput(value, 0) }))} colors={colors} />
          <TextField label="Level" type="number" min={0} value={simulatorState.focusHeroLevel} onChange={(value) => updateSimulatorState((current) => ({ ...current, focusHeroLevel: parseNumberInput(value, 0) }))} colors={colors} />
          <TextField label="Mastery Level" type="number" min={0} value={simulatorState.focusHeroMasteryLevel} onChange={(value) => updateSimulatorState((current) => ({ ...current, focusHeroMasteryLevel: parseNumberInput(value, 0) }))} colors={colors} />
          <SelectField label="Combat Style" value={simulatorState.focusCombatStyleId} onChange={(value) => updateSimulatorState((current) => ({ ...current, focusCombatStyleId: value }))} colors={colors} options={COMBAT_STYLE_DEFINITIONS.map((style) => ({ value: style.id, label: `${style.name} (Rank ${style.rankReq ?? 0})` }))} />
        </div>
        {heroModel ? <HeroStatSummary heroModel={heroModel} colors={colors} /> : null}
      </Panel>

      <Panel title="Support Roster" subtitle="Sheet-style support rows with manual skill-effect inputs for the sandbox side of the simulator." colors={colors}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1120 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>Use</th>
                <th style={{ textAlign: "left", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>Hero</th>
                <th style={{ textAlign: "left", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>Combat Style</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>Extra Synergy</th>
                {STAT_SIMULATOR_SKILL_EFFECT_FIELDS.map((field) => (
                  <th key={field.key} style={{ textAlign: "right", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>{field.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {simulatorState.supportRows.map((row, index) => (
                <tr key={row.id} style={{ background: index % 2 === 0 ? "transparent" : `${colors.panel}66` }}>
                  <td style={{ padding: "8px 10px" }}>
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(event) => updateSimulatorState((current) => updateSimulatorSupportRow(current, row.id, (existing) => ({ ...existing, enabled: event.target.checked })))}
                    />
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <select
                      value={row.heroId}
                      onChange={(event) => updateSimulatorState((current) => updateSimulatorSupportRow(current, row.id, (existing) => ({ ...existing, heroId: event.target.value })))}
                      style={{ width: "100%", background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, padding: "8px 10px", fontFamily: "inherit" }}
                    >
                      <option value="">None</option>
                      {heroList.map((hero) => <option key={hero.id} value={hero.id}>{hero.name}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <select
                      value={row.combatStyleId}
                      onChange={(event) => updateSimulatorState((current) => updateSimulatorSupportRow(current, row.id, (existing) => ({ ...existing, combatStyleId: event.target.value })))}
                      style={{ width: "100%", background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, padding: "8px 10px", fontFamily: "inherit" }}
                    >
                      {COMBAT_STYLE_DEFINITIONS.map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <input
                      type="number"
                      value={row.extraSynergy}
                      onChange={(event) => updateSimulatorState((current) => updateSimulatorSupportRow(current, row.id, (existing) => ({ ...existing, extraSynergy: parseNumberInput(event.target.value, 0) })))}
                      style={{ width: 90, background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, padding: "8px 10px", fontFamily: "inherit", textAlign: "right" }}
                    />
                  </td>
                  {STAT_SIMULATOR_SKILL_EFFECT_FIELDS.map((field) => (
                    <td key={field.key} style={{ padding: "8px 10px" }}>
                      <input
                        type="number"
                        value={row.skillEffects[field.key]}
                        onChange={(event) => updateSimulatorState((current) => updateSimulatorSupportRow(current, row.id, (existing) => ({
                          ...existing,
                          skillEffects: {
                            ...existing.skillEffects,
                            [field.key]: parseNumberInput(event.target.value, 0),
                          },
                        })))}
                        style={{ width: 90, background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, padding: "8px 10px", fontFamily: "inherit", textAlign: "right" }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div style={{ border: `1px solid ${colors.border}`, background: colors.panel, borderRadius: 12, padding: 12, display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>Enabled Support Heroes</div>
            <div style={{ fontSize: 24, color: colors.text, fontWeight: 900 }}>{simulatorState.supportRows.filter((row) => row.enabled && row.heroId).length}</div>
          </div>
          <div style={{ border: `1px solid ${colors.border}`, background: colors.panel, borderRadius: 12, padding: 12, display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>Total Extra Synergy</div>
            <div style={{ fontSize: 24, color: colors.text, fontWeight: 900 }}>{formatNumber(totalExtraSynergy)}</div>
          </div>
          <div style={{ border: `1px solid ${colors.border}`, background: colors.panel, borderRadius: 12, padding: 12, display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>Selected Map</div>
            <div style={{ fontSize: 18, color: colors.text, fontWeight: 900 }}>{mapsData.maps.find((map) => map.id === simulatorState.selectedMapId)?.name ?? "None"}</div>
          </div>
        </div>
      </Panel>

      <Panel title="Breakdowns" subtitle="Split between real app loadout math and manual spreadsheet-style support effects." colors={colors}>
        <BreakdownGrid title="Focus Hero Combined Bonus Breakdown" breakdown={heroModel?.combined ?? { orderedStats: [] }} colors={colors} emptyMessage="No active bonuses are being applied to the focus hero." />
        <BreakdownGrid title="Support Combat Style Breakdown" breakdown={supportCombatStyleBreakdown} colors={colors} emptyMessage="No support combat styles are active yet." />
      </Panel>

      <Panel title="Manual DPS Sandbox" subtitle="Editable base values plus support skill effect totals for spreadsheet-style experimentation." colors={colors}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {STAT_SIMULATOR_MANUAL_STAT_FIELDS.map((field) => (
            <TextField
              key={field.key}
              label={field.label}
              type="number"
              value={simulatorState.manualStats[field.key]}
              onChange={(value) => updateSimulatorState((current) => ({
                ...current,
                manualStats: {
                  ...current.manualStats,
                  [field.key]: parseNumberInput(value, 0),
                },
              }))}
              colors={colors}
            />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {STAT_SIMULATOR_SKILL_EFFECT_FIELDS.map((field) => (
            <div key={field.key} style={{ border: `1px solid ${colors.border}`, background: colors.panel, borderRadius: 12, padding: 12, display: "grid", gap: 4 }}>
              <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>{field.label} Total</div>
              <div style={{ fontSize: 22, color: colors.accent, fontWeight: 900 }}>{formatNumber(supportSkillTotals[field.key])}%</div>
            </div>
          ))}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>Stat</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>Base</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>Final</th>
              </tr>
            </thead>
            <tbody>
              {STAT_SIMULATOR_MANUAL_STAT_FIELDS.map((field, index) => (
                <tr key={field.key} style={{ background: index % 2 === 0 ? "transparent" : `${colors.panel}66` }}>
                  <td style={{ padding: "8px 10px", color: colors.text, fontWeight: 700 }}>{field.label}</td>
                  <td style={{ padding: "8px 10px", color: colors.muted, textAlign: "right" }}>{formatNumber(simulatorState.manualStats[field.key])}</td>
                  <td style={{ padding: "8px 10px", color: colors.accent, textAlign: "right", fontWeight: 800 }}>{formatNumber(manualSandboxStats[field.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Runtime Notes" subtitle="Simulator-only state is stored separately from app saves." colors={colors}>
        <div style={{ display: "grid", gap: 8, color: colors.muted, fontSize: 13, lineHeight: 1.6 }}>
          <div>Selected map sync uses {LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY} only when you click the push button.</div>
          <div>Focus hero push writes rank, level, mastery level, selected hero, and default combat style into Hero Loadout.</div>
          <div>Upgrades, player bonuses, map perks, and hero attributes are opt-in sources through the bridge toggles above.</div>
        </div>
      </Panel>
    </div>
  );
}