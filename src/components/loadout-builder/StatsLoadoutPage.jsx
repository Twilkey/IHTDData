import { useEffect, useMemo, useState } from "react";

import {
  buildUpgradePreview,
  CURRENCY_LABELS,
  formatStatTotal,
  readStatsLoadoutState,
  STATS_LOADOUT_TAB_MAP,
  STATS_LOADOUT_TABS,
  writeStatsLoadoutState,
} from "../../lib/statsLoadout";
import { LOADOUT_RECORD_SCOPE_STATS } from "../../lib/loadoutScope";
import { useIsNarrowScreen } from "../../lib/useIsNarrowScreen";
import { ScopedLoadoutPresetsPanel } from "./ScopedLoadoutPresetsPanel";

function UnlockList({ unlocks, colors, fmt }) {
  if (!unlocks.length) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {unlocks.map((unlock) => (
        <span
          key={`${unlock.level}-${unlock.currency}`}
          style={{
            background: colors.accent + "22",
            border: `1px solid ${colors.accent}55`,
            borderRadius: 999,
            color: colors.accent,
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 8px",
            whiteSpace: "nowrap",
          }}
        >
          L{unlock.level}: {fmt(unlock.amount)} {CURRENCY_LABELS[unlock.currency] ?? unlock.currency}
        </span>
      ))}
    </div>
  );
}

function TabButton({ tab, isActive, colors, getIconUrl, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tab.key)}
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
      <div style={{ width: 38, height: 38, borderRadius: 10, background: colors.panel, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {tab.menuIcon ? <img src={getIconUrl(tab.menuIcon)} alt="" style={{ width: 24, height: 24, objectFit: "contain" }} /> : null}
      </div>
      <div style={{ minWidth: 0, flex: 1, fontSize: 14, fontWeight: 800, color: isActive ? colors.accent : colors.text }}>{tab.label}</div>
    </button>
  );
}

function CategoryTabButton({ label, isActive, colors, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        background: isActive ? colors.accent : colors.header,
        border: `1px solid ${isActive ? colors.accent : colors.border}`,
        borderRadius: 999,
        color: isActive ? "#000" : colors.text,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 800,
        padding: "8px 12px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function formatCostSummary(preview, fmt) {
  if (preview.levelsToBuy <= 0) {
    return "No additional cost";
  }

  if (preview.nextCost?.type === "unlock") {
    const currencyLabel = CURRENCY_LABELS[preview.nextCost.currency] ?? preview.nextCost.currency;
    const totalCost = preview.previewCost != null ? `${fmt(preview.previewCost)} ${currencyLabel}` : `${fmt(preview.nextCost.amount)} ${currencyLabel}`;
    return `${fmt(preview.nextCost.amount)} ${currencyLabel} x ${fmt(preview.levelsToBuy)} = ${totalCost}`;
  }

  if (preview.nextCost?.cost != null && preview.previewCost != null) {
    return `${fmt(preview.nextCost.cost)} x ${fmt(preview.levelsToBuy)} = ${fmt(preview.previewCost)}`;
  }

  return preview.canCalculateCost ? "No additional cost" : "Cost unavailable";
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

function UpgradeCard({
  item,
  sectionFormula,
  currentLevel,
  previewLevels,
  colors,
  getIconUrl,
  fmt,
  onLevelChange,
}) {
  const preview = useMemo(
    () => buildUpgradePreview(item, sectionFormula, currentLevel, previewLevels),
    [item, sectionFormula, currentLevel, previewLevels]
  );

  const currentStatLabel = formatStatTotal(preview.currentState ?? 0, item.statKey, fmt);
  const previewGainLabel = preview.levelsToBuy > 0
    ? `(${formatStatTotal(preview.previewGain ?? 0, item.statKey, fmt)})`
    : null;
  const costSummaryLabel = formatCostSummary(preview, fmt);

  return (
    <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 12, display: "grid", gridTemplateColumns: "78px minmax(0, 1fr)", gap: 12, alignItems: "start", boxShadow: "0 8px 20px rgba(0,0,0,0.18)" }}>
      <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: "rgba(8,17,29,0.72)", border: `1px solid ${colors.border}`, padding: 7, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {item.icon ? <img src={getIconUrl(item.icon)} alt="" style={{ width: 38, height: 38, objectFit: "contain" }} /> : null}
        </div>
        <div style={{ fontSize: 11, color: colors.muted, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Level</div>
        <input
          type="number"
          min={0}
          max={preview.maxLevel}
          value={currentLevel}
          onChange={(event) => onLevelChange(event.target.value)}
          style={{ width: 64, background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 13, fontWeight: 700, padding: "6px 8px", fontFamily: "inherit", textAlign: "center" }}
        />
      </div>

      <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: colors.text, minWidth: 0 }}>{item.name} <span style={{ color: colors.muted, fontWeight: 700 }}>(Lv. {fmt(currentLevel)})</span></div>
          {item.waveReq ? <div style={{ fontSize: 11, color: colors.accent, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Wave {fmt(item.waveReq)}</div> : null}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: colors.text }}>{currentStatLabel}</span>
          {previewGainLabel ? <span style={{ fontSize: 13, fontWeight: 800, color: colors.positive }}>{previewGainLabel}</span> : null}
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: colors.muted }}>Max {fmt(preview.maxLevel)}</span>
          <span style={{ fontSize: 12, color: colors.muted }}>Cost {costSummaryLabel}</span>
        </div>

        {preview.previewUnlocks.length ? <UnlockList unlocks={preview.previewUnlocks} colors={colors} fmt={fmt} /> : null}
      </div>
    </div>
  );
}

export function StatsLoadoutPage({ colors, getIconUrl, fmt, savedLoadouts = [], currentSavedLoadoutId = "", onLoadSave, onDeleteSave, onImportComplete, saveButton }) {
  const isNarrowScreen = useIsNarrowScreen(980);
  const initialState = useMemo(() => readStatsLoadoutState(localStorage), []);
  const [selectedTab, setSelectedTab] = useState(initialState.selectedTab);
  const [previewLevelsByTab, setPreviewLevelsByTab] = useState(initialState.previewLevelsByTab);
  const [levelsByTab, setLevelsByTab] = useState(initialState.levelsByTab);
  const [hideMaxedByTab, setHideMaxedByTab] = useState(initialState.hideMaxedByTab);
  const [selectedGroupByTab, setSelectedGroupByTab] = useState(() => Object.fromEntries(
    STATS_LOADOUT_TABS.map((tab) => [tab.key, Object.keys(tab.data.groups)[0] ?? ""])
  ));

  useEffect(() => {
    writeStatsLoadoutState({ selectedTab, previewLevelsByTab, levelsByTab, hideMaxedByTab }, localStorage);
  }, [selectedTab, previewLevelsByTab, levelsByTab, hideMaxedByTab]);

  const activeTab = STATS_LOADOUT_TAB_MAP[selectedTab] ?? STATS_LOADOUT_TABS[0];
  const activeLevels = levelsByTab[activeTab.key] ?? {};
  const hideMaxed = hideMaxedByTab[activeTab.key] ?? false;
  const activeGroups = Object.entries(activeTab.data.groups);
  const activeGroupName = selectedGroupByTab[activeTab.key] && activeTab.data.groups[selectedGroupByTab[activeTab.key]]
    ? selectedGroupByTab[activeTab.key]
    : activeGroups[0]?.[0] ?? "";
  const activeGroupItems = (activeTab.data.groups[activeGroupName] ?? []).filter((item) => !hideMaxed || (activeLevels[item.id] ?? 0) < (item.maxLevel ?? 999999));
  const statsPresets = useMemo(
    () => savedLoadouts.filter((save) => save.scopeId === LOADOUT_RECORD_SCOPE_STATS),
    [savedLoadouts]
  );

  useEffect(() => {
    if (!activeGroupName && activeGroups[0]?.[0]) {
      setSelectedGroupByTab((current) => ({
        ...current,
        [activeTab.key]: activeGroups[0][0],
      }));
    }
  }, [activeGroupName, activeGroups, activeTab.key]);

  function handleTabChange(tabKey) {
    setSelectedTab(tabKey);
  }

  function handleGroupChange(groupName) {
    setSelectedGroupByTab((current) => ({
      ...current,
      [activeTab.key]: groupName,
    }));
  }

  function handlePreviewChange(rawValue) {
    setPreviewLevelsByTab((current) => ({
      ...current,
      [activeTab.key]: Math.max(1, Number.parseInt(rawValue, 10) || 1),
    }));
  }

  function handleLevelChange(item, rawValue) {
    const parsed = rawValue === "" ? 0 : Number.parseInt(rawValue, 10);
    const nextLevel = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, item.maxLevel ?? 999999)) : 0;

    setLevelsByTab((current) => {
      const nextTabLevels = { ...(current[activeTab.key] ?? {}) };
      if (nextLevel <= 0) {
        delete nextTabLevels[item.id];
      } else {
        nextTabLevels[item.id] = nextLevel;
      }

      return {
        ...current,
        [activeTab.key]: nextTabLevels,
      };
    });
  }

  function handleHideMaxedChange(isChecked) {
    setHideMaxedByTab((current) => ({
      ...current,
      [activeTab.key]: isChecked,
    }));
  }

  const activePreviewLevels = previewLevelsByTab[activeTab.key] ?? 1;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 18, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.text }}>Upgrades Loadout</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>{activeTab.label}</div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", width: isNarrowScreen ? "100%" : "auto" }}>
          <ScopedLoadoutPresetsPanel
            colors={colors}
            title="Upgrades Loadout Presets"
            description="Save and manage upgrades-loadout-only presets here. These records only affect the Upgrades Loadout page."
            scopeId={LOADOUT_RECORD_SCOPE_STATS}
            presets={statsPresets}
            currentSavedLoadoutId={currentSavedLoadoutId}
            onLoadSave={onLoadSave}
            onDeleteSave={onDeleteSave}
            onImportComplete={onImportComplete}
            compact
          />
          <label style={{ display: "grid", gap: 6, minWidth: isNarrowScreen ? 0 : 104, flex: isNarrowScreen ? "1 1 100%" : "0 0 auto" }}>
            <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Buy Levels</span>
            <input
              type="number"
              min={1}
              value={activePreviewLevels}
              onChange={(event) => handlePreviewChange(event.target.value)}
              style={{
                background: "#0f2640",
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                color: colors.text,
                fontSize: 14,
                fontWeight: 700,
                padding: "10px 10px",
                fontFamily: "inherit",
              }}
            />
          </label>
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
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "start" }}>
        <aside style={{ flex: isNarrowScreen ? "1 1 100%" : "0 0 260px", width: "100%", maxWidth: isNarrowScreen ? "none" : 320, display: "grid", gap: 14, position: isNarrowScreen ? "static" : "sticky", top: isNarrowScreen ? "auto" : 0 }}>
          <div style={{ background: `linear-gradient(180deg, ${colors.panel} 0%, ${colors.header} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 8 }}>
            {STATS_LOADOUT_TABS.map((tab) => (
              <TabButton
                key={tab.key}
                tab={tab}
                isActive={tab.key === activeTab.key}
                colors={colors}
                getIconUrl={getIconUrl}
                onSelect={handleTabChange}
              />
            ))}
          </div>
        </aside>

        <section style={{ flex: "1 1 760px", minWidth: 0, display: "grid", gap: 16, width: "100%" }}>
          <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {activeGroups.map(([groupName]) => (
                <CategoryTabButton
                  key={groupName}
                  label={groupName}
                  isActive={groupName === activeGroupName}
                  colors={colors}
                  onSelect={() => handleGroupChange(groupName)}
                />
              ))}
            </div>
            <SwitchToggle
              checked={hideMaxed}
              onChange={handleHideMaxedChange}
              colors={colors}
              checkedLabel="Hide Maxed"
              uncheckedLabel="Show Maxed"
            />
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {activeGroupName ? (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: colors.accent, letterSpacing: "0.12em", textTransform: "uppercase" }}>{activeGroupName}</div>
                <div style={{ fontSize: 12, color: colors.muted }}>{activeGroupItems.length} upgrades</div>
              </div>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: isNarrowScreen ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {activeGroupItems.map((item) => {
                return (
                  <UpgradeCard
                    key={item.id}
                    item={item}
                    sectionFormula={activeTab.data.costFormula}
                    currentLevel={activeLevels[item.id] ?? 0}
                    previewLevels={activePreviewLevels}
                    colors={colors}
                    getIconUrl={getIconUrl}
                    fmt={fmt}
                    onLevelChange={(value) => handleLevelChange(item, value)}
                  />
                );
              })}
            </div>
            {!activeGroupItems.length && (
              <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 16, color: colors.muted, fontSize: 13 }}>
                No upgrades are visible in this category with the current hide-maxed setting.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}