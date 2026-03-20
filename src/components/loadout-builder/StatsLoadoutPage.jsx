import { useEffect, useMemo, useState } from "react";

import {
  buildUpgradePreview,
  CURRENCY_LABELS,
  formatStatPerLevel,
  formatStatTotal,
  readStatsLoadoutState,
  STATS_LOADOUT_TAB_MAP,
  STATS_LOADOUT_TABS,
  writeStatsLoadoutState,
} from "../../lib/statsLoadout";
import { LOADOUT_RECORD_SCOPE_STATS } from "../../lib/loadoutScope";
import { ScopedLoadoutPresetsPanel } from "./ScopedLoadoutPresetsPanel";

function CostValue({ amount, colors, fmt, prefix }) {
  if (amount == null) {
    return <span style={{ color: colors.muted }}>Not tracked</span>;
  }

  return (
    <span style={{ color: colors.gold, fontWeight: 800 }}>
      {prefix ? <span style={{ color: colors.muted, fontWeight: 600 }}>{prefix} </span> : null}
      {fmt(amount)}
    </span>
  );
}

function UnlockList({ unlocks, colors, fmt }) {
  if (!unlocks.length) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
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

function MetricRow({ label, value, colors, valueColor }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: valueColor ?? colors.text, fontSize: 14, fontWeight: 700 }}>{value}</div>
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

function getGroupBucket(groupName) {
  return /supreme/i.test(groupName) ? "supreme" : "normal";
}

function getDisplayedGroups(groupBuckets, bucketKey) {
  const groups = groupBuckets[bucketKey] ?? [];
  if (groups.length) {
    return groups;
  }

  return bucketKey === "supreme" ? (groupBuckets.normal ?? []) : (groupBuckets.supreme ?? []);
}

function UpgradeCard({ item, sectionFormula, currentLevel, previewLevels, colors, getIconUrl, fmt, onLevelChange }) {
  const preview = useMemo(
    () => buildUpgradePreview(item, sectionFormula, currentLevel, previewLevels),
    [item, sectionFormula, currentLevel, previewLevels]
  );

  const nextCostLabel = (() => {
    if (!preview.nextCost) {
      return <span style={{ color: colors.muted }}>Maxed</span>;
    }

    if (preview.nextCost.type === "unlock") {
      return (
        <span style={{ color: colors.accent, fontWeight: 700 }}>
          {fmt(preview.nextCost.amount)} {CURRENCY_LABELS[preview.nextCost.currency] ?? preview.nextCost.currency}
        </span>
      );
    }

    return <CostValue amount={preview.nextCost.cost} colors={colors} fmt={fmt} />;
  })();

  const previewCostLabel = (() => {
    if (!preview.canCalculateCost) {
      return <span style={{ color: colors.muted }}>No cost formula</span>;
    }

    if (preview.levelsToBuy === 0) {
      return <span style={{ color: colors.muted }}>No additional levels</span>;
    }

    return <CostValue amount={preview.previewCost} colors={colors} fmt={fmt} prefix="Energy / Cost" />;
  })();

  const previewLevelsLabel = preview.levelsToBuy > 0
    ? `${preview.currentLevel} -> ${preview.projectedLevel}`
    : `${preview.currentLevel}`;

  return (
    <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 14, display: "grid", gap: 12, boxShadow: "0 10px 24px rgba(0,0,0,0.18)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ width: 58, height: 58, borderRadius: 12, background: item.bgColor ?? colors.panel, border: `2px solid ${item.borderColor ?? colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
          {item.icon ? <img src={getIconUrl(item.icon)} alt="" style={{ width: 38, height: 38, objectFit: "contain" }} /> : null}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: colors.text }}>{item.name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: colors.muted }}>Max {fmt(preview.maxLevel)}</span>
            {item.waveReq ? <span style={{ fontSize: 12, color: colors.accent }}>Wave {fmt(item.waveReq)}</span> : null}
          </div>
        </div>
        <label style={{ display: "grid", gap: 4, minWidth: 104 }}>
          <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Current Level</span>
          <input
            type="number"
            min={0}
            max={preview.maxLevel}
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <MetricRow label="Current State" value={formatStatTotal(preview.currentState ?? 0, item.statKey, fmt)} colors={colors} valueColor={colors.positive} />
        <MetricRow label="Per Level" value={formatStatPerLevel(item.statAmt, item.statKey)} colors={colors} valueColor={colors.text} />
        <MetricRow label="Next Cost" value={nextCostLabel} colors={colors} />
        <MetricRow label={`Preview +${previewLevels}`} value={previewLevelsLabel} colors={colors} valueColor={colors.accent} />
        <MetricRow label="Preview Gain" value={formatStatTotal(preview.previewGain ?? 0, item.statKey, fmt)} colors={colors} valueColor={colors.positive} />
        <MetricRow label="Preview Cost" value={previewCostLabel} colors={colors} />
        <MetricRow label="Projected State" value={formatStatTotal(preview.projectedState ?? 0, item.statKey, fmt)} colors={colors} valueColor={colors.positive} />
      </div>

      <div style={{ minHeight: preview.previewUnlocks.length ? "auto" : 0 }}>
        <UnlockList unlocks={preview.previewUnlocks} colors={colors} fmt={fmt} />
      </div>
    </div>
  );
}

export function StatsLoadoutPage({ colors, getIconUrl, fmt, savedLoadouts = [], currentSavedLoadoutId = "", onLoadSave, onDeleteSave, onImportComplete }) {
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
  const activePreviewLevels = previewLevelsByTab[activeTab.key] ?? 1;
  const activeLevels = levelsByTab[activeTab.key] ?? {};
  const hideMaxed = hideMaxedByTab[activeTab.key] ?? false;
  const activeGroups = Object.entries(activeTab.data.groups);
  const activeGroupBuckets = activeGroups.reduce(
    (buckets, entry) => {
      buckets[getGroupBucket(entry[0])].push(entry);
      return buckets;
    },
    { normal: [], supreme: [] }
  );
  const activeGroupName = selectedGroupByTab[activeTab.key] && activeTab.data.groups[selectedGroupByTab[activeTab.key]]
    ? selectedGroupByTab[activeTab.key]
    : activeGroups[0]?.[0] ?? "";
  const activeParentGroup = getGroupBucket(activeGroupName);
  const visibleGroups = getDisplayedGroups(activeGroupBuckets, activeParentGroup);
  const shouldShowParentGroups = activeGroupBuckets.normal.length > 0 && activeGroupBuckets.supreme.length > 0;
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

  function handleParentGroupChange(bucketKey) {
    const nextGroupName = getDisplayedGroups(activeGroupBuckets, bucketKey)[0]?.[0];
    if (!nextGroupName) {
      return;
    }

    handleGroupChange(nextGroupName);
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

  return (
    <div style={{ display: "grid", gap: 20 }}>
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
      />

      <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 18, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.text }}>Upgrades Loadout</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>{activeTab.label}</div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: colors.text, fontSize: 13, fontWeight: 700 }}>
            <input type="checkbox" checked={hideMaxed} onChange={(event) => handleHideMaxedChange(event.target.checked)} />
            Hide Maxed Upgrades
          </label>
          <label style={{ display: "grid", gap: 6, minWidth: 180 }}>
            <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Next Levels</span>
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
                padding: "10px 12px",
                fontFamily: "inherit",
              }}
            />
          </label>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "start" }}>
        <aside style={{ flex: "0 0 260px", width: "100%", maxWidth: 320, display: "grid", gap: 14, position: "sticky", top: 0 }}>
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

        <section style={{ flex: "1 1 760px", minWidth: 0, display: "grid", gap: 16 }}>
          {activeGroups.length > 1 && (
            <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 14, display: "grid", gap: 12 }}>
              {shouldShowParentGroups && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <CategoryTabButton
                    label="Normal"
                    isActive={activeParentGroup === "normal"}
                    colors={colors}
                    onSelect={() => handleParentGroupChange("normal")}
                  />
                  <CategoryTabButton
                    label="Supreme"
                    isActive={activeParentGroup === "supreme"}
                    colors={colors}
                    onSelect={() => handleParentGroupChange("supreme")}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {visibleGroups.map(([groupName]) => (
                  <CategoryTabButton
                    key={groupName}
                    label={groupName}
                    isActive={groupName === activeGroupName}
                    colors={colors}
                    onSelect={() => handleGroupChange(groupName)}
                  />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: 14 }}>
            {activeGroups.length > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: colors.accent, letterSpacing: "0.12em", textTransform: "uppercase" }}>{activeGroupName}</div>
                <div style={{ fontSize: 12, color: colors.muted }}>{activeGroupItems.length} upgrades</div>
              </div>
            )}
            {activeGroups.length <= 1 && activeGroupName && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: colors.accent, letterSpacing: "0.12em", textTransform: "uppercase" }}>{activeGroupName}</div>
                <div style={{ fontSize: 12, color: colors.muted }}>{activeGroupItems.length} upgrades</div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              {activeGroupItems.map((item) => (
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
              ))}
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