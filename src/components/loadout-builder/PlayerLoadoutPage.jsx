import { useEffect, useMemo, useState } from "react";

import {
  getPlayerLoadoutItems,
  getPlayerLoadoutPurchasedEntries,
  PLAYER_LOADOUT_TAB_MAP,
  PLAYER_LOADOUT_TABS,
  readPlayerLoadoutState,
  writePlayerLoadoutState,
} from "../../lib/playerLoadout";
import { buildStatBreakdown, formatSignedHeroBonus } from "../../lib/loadoutStatEngine";
import { LOADOUT_RECORD_SCOPE_PLAYER } from "../../lib/loadoutScope";
import { ScopedLoadoutPresetsPanel } from "./ScopedLoadoutPresetsPanel";

function buildDefaultParentExpansion() {
  return Object.fromEntries(PLAYER_LOADOUT_TABS.map((tab) => [tab.key, true]));
}

function buildDefaultGroupExpansion() {
  return Object.fromEntries(
    PLAYER_LOADOUT_TABS.flatMap((tab) => Object.keys(tab.data.groups ?? {}).map((groupKey) => [`${tab.key}:${groupKey}`, true]))
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

function GroupTabButton({ label, isActive, colors, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        background: isActive ? "rgba(245,146,30,0.16)" : colors.panel,
        color: isActive ? colors.text : colors.muted,
        border: `1px solid ${isActive ? colors.accent : colors.border}`,
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

function InlineTabButton({ tab, isActive, colors, getIconUrl, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tab.key)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: isActive ? `linear-gradient(135deg, ${colors.accent}33 0%, ${colors.header} 100%)` : colors.header,
        border: `1px solid ${isActive ? colors.accent : colors.border}`,
        borderRadius: 999,
        color: isActive ? colors.accent : colors.text,
        cursor: "pointer",
        padding: "9px 12px",
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {tab.menuIcon ? <img src={getIconUrl(tab.menuIcon)} alt="" style={{ width: 18, height: 18, objectFit: "contain" }} /> : null}
      <span>{tab.label}</span>
    </button>
  );
}

function SwitchToggle({ checked, onChange, colors, checkedLabel = "Purchased", uncheckedLabel = "Not Purchased" }) {
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
        minHeight: 36,
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
          }}
        />
      </span>
      <span style={{ fontSize: 12 }}>{label}</span>
    </button>
  );
}

function PurchasedToggle({ isPurchased, colors, onToggle }) {
  return (
    <SwitchToggle checked={isPurchased} onChange={onToggle} colors={colors} checkedLabel="Purchased" uncheckedLabel="Purchased" />
  );
}

function isAutoOwnedPlayerItem({ tabKey, groupEntries, groupKey, item }) {
  const firstGroupKey = groupEntries[0]?.key ?? "";
  const firstItemId = groupEntries[0]?.items?.[0]?.id ?? "";

  if (groupKey !== firstGroupKey || item.id !== firstItemId) {
    return false;
  }

  if (tabKey === "icons") {
    return item.cost === 0;
  }

  if (tabKey === "backgrounds") {
    return item.requirement == null;
  }

  return false;
}

function RewardLine({ item, colors, fmt }) {
  if (!item.rewardUnit || item.reward == null) {
    return <div style={{ fontSize: 13, color: colors.muted }}>Reward -</div>;
  }

  const rewardValue = Number(item.reward) || 0;
  const rewardText = `${rewardValue > 0 ? "+" : ""}${fmt(rewardValue)}${item.reward_type === "percent" ? "%" : ""}`;

  return (
    <div style={{ fontSize: 13, color: colors.muted }}>
      Reward <span style={{ color: item.reward < 0 ? colors.positive : colors.accent, fontWeight: 700 }}>{rewardText}</span> {item.rewardUnit}
    </div>
  );
}

function IconCard({ item, isPurchased, colors, getIconUrl, fmt, onToggle, showToggle = true }) {
  return (
    <div style={{ background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`, border: `1px solid ${isPurchased ? colors.accent : colors.border}`, borderRadius: 10, padding: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.2)", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {item.rewardIcon ? (
          <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: item.rewardBgColor, border: `2px solid ${item.rewardBorderColor}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <img src={getIconUrl(item.rewardIcon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
          </div>
        ) : (
          <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: colors.panel, border: `2px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: colors.muted, fontSize: 18 }}>-</span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: colors.text, fontWeight: 700, fontSize: 15, lineHeight: 1.2, marginBottom: 4 }}>{item.name}</div>
          <div style={{ fontSize: 13, color: colors.muted, marginBottom: 2 }}>
            Cost <span style={{ color: item.cost === 0 ? colors.positive : colors.gold, fontWeight: 700 }}>{item.cost === 0 ? "Free" : fmt(item.cost)}</span>
          </div>
        </div>
        <img src={getIconUrl(item.icon)} alt={item.name} style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 6, objectFit: "contain" }} />
      </div>
      {showToggle ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <PurchasedToggle isPurchased={isPurchased} colors={colors} onToggle={onToggle} />
        </div>
      ) : null}
    </div>
  );
}

function BackgroundCard({ item, isPurchased, colors, getIconUrl, fmt, onToggle, showToggle = true }) {
  return (
    <div style={{ position: "relative", backgroundImage: item.background ? `url(${getIconUrl(item.background)})` : "none", backgroundSize: "cover", backgroundPosition: "center", border: `1px solid ${isPurchased ? colors.accent : colors.border}`, borderRadius: 10, padding: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.2)", overflow: "hidden", minHeight: 132 }}>
      {item.background && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.58)" }} />}
      <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 12, height: "100%" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {item.icon ? (
            <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: item.bgColor, border: `2px solid ${item.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <img src={getIconUrl(item.icon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
            </div>
          ) : (
            <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: colors.panel, border: `2px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: colors.muted, fontSize: 18 }}>-</span>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: colors.text, fontWeight: 700, fontSize: 15, lineHeight: 1.2, marginBottom: 4 }}>{item.name}</div>
            <div style={{ fontSize: 13, color: colors.muted, marginBottom: 2 }}>
              Req <span style={{ color: colors.gold, fontWeight: 700 }}>{item.requirement != null ? (typeof item.requirement === "string" ? item.requirement : fmt(item.requirement)) : "-"}</span>
            </div>
            <RewardLine item={item} colors={colors} fmt={fmt} />
          </div>
        </div>
        {showToggle ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: "auto" }}>
            <PurchasedToggle isPurchased={isPurchased} colors={colors} onToggle={onToggle} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatSummaryList({ entries, colors, fmt }) {
  const breakdown = useMemo(() => buildStatBreakdown(entries), [entries]);

  if (!breakdown.orderedStats.length) {
    return <div style={{ color: colors.muted, fontSize: 13 }}>No purchased cosmetic rewards are contributing stats yet.</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
      {breakdown.orderedStats.map((item) => (
        <div key={item.statKey} style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 13, color: colors.text, fontWeight: 800 }}>{item.label}</div>
            <div style={{ fontSize: 13, color: colors.accent, fontWeight: 900 }}>{formatSignedHeroBonus(item.statKey, item.total, fmt)}</div>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {item.entries.map((entry) => (
              <div key={`${entry.sourceType}-${entry.sourceId}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                <span style={{ color: colors.muted }}>{entry.sourceLabel}</span>
                <span style={{ color: colors.text, fontWeight: 700 }}>{formatSignedHeroBonus(item.statKey, entry.amount, fmt)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CollapseButton({ label, meta, isExpanded, colors, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        background: colors.header,
        color: colors.text,
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
      }}
    >
      <div style={{ minWidth: 0, display: "grid", gap: 3 }}>
        <div style={{ fontSize: 13, fontWeight: 900 }}>{label}</div>
        {meta ? <div style={{ fontSize: 11, color: colors.muted }}>{meta}</div> : null}
      </div>
      <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 900, color: colors.accent }}>{isExpanded ? "Hide" : "Show"}</div>
    </button>
  );
}

function PlayerStatSummaryTree({ sections, expandedParents, expandedGroups, colors, fmt, onToggleParent, onToggleGroup }) {
  const visibleSections = sections.filter((section) => section.entries.length > 0);
  const hasAnyStats = visibleSections.length > 0;

  if (!hasAnyStats) {
    return <div style={{ color: colors.muted, fontSize: 13 }}>No purchased cosmetic rewards are contributing stats yet.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {visibleSections.map((section) => {
        const isParentExpanded = expandedParents[section.key] ?? true;

        return (
          <div key={section.key} style={{ display: "grid", gap: 10, background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 12 }}>
            <CollapseButton
              label={section.label}
              meta={null}
              isExpanded={isParentExpanded}
              colors={colors}
              onToggle={() => onToggleParent(section.key)}
            />

            {isParentExpanded ? (
              <>
                <div style={{ display: "grid", gap: 10 }}>
                  {section.groups.filter((group) => group.entries.length > 0).map((group) => {
                    const groupExpansionKey = `${section.key}:${group.key}`;
                    const isGroupExpanded = expandedGroups[groupExpansionKey] ?? true;

                    return (
                      <div key={groupExpansionKey} style={{ display: "grid", gap: 8, padding: 10, borderRadius: 12, background: colors.panel, border: `1px solid ${colors.border}` }}>
                        <CollapseButton
                          label={group.label}
                          meta={null}
                          isExpanded={isGroupExpanded}
                          colors={colors}
                          onToggle={() => onToggleGroup(groupExpansionKey)}
                        />
                        {isGroupExpanded ? <StatSummaryList entries={group.entries} colors={colors} fmt={fmt} /> : null}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function PlayerLoadoutPage({ colors, getIconUrl, fmt, savedLoadouts = [], currentSavedLoadoutId = "", onLoadSave, onDeleteSave, onImportComplete, saveButton }) {
  const initialState = useMemo(() => readPlayerLoadoutState(localStorage), []);
  const [selectedTab, setSelectedTab] = useState(initialState.selectedTab);
  const [selectedGroupByTab, setSelectedGroupByTab] = useState(initialState.selectedGroupByTab);
  const [purchasedByTab, setPurchasedByTab] = useState(initialState.purchasedByTab);
  const [expandedSummaryParents, setExpandedSummaryParents] = useState(() => buildDefaultParentExpansion());
  const [expandedSummaryGroups, setExpandedSummaryGroups] = useState(() => buildDefaultGroupExpansion());
  const [summaryViewMode, setSummaryViewMode] = useState("split");

  useEffect(() => {
    writePlayerLoadoutState({ selectedTab, selectedGroupByTab, purchasedByTab }, localStorage);
  }, [purchasedByTab, selectedGroupByTab, selectedTab]);

  const activeTab = PLAYER_LOADOUT_TAB_MAP[selectedTab] ?? PLAYER_LOADOUT_TABS[0];
  const groupEntries = Object.entries(activeTab.data.groups ?? {}).map(([groupKey, items]) => ({
    key: groupKey,
    label: groupKey,
    items,
  }));
  const activeGroup = groupEntries.find((group) => group.key === selectedGroupByTab[activeTab.key]) ?? groupEntries[0] ?? null;
  const activeItems = activeGroup?.items ?? getPlayerLoadoutItems(activeTab.key);
  const activePurchased = purchasedByTab[activeTab.key] ?? {};
  const allEntries = useMemo(
    () => getPlayerLoadoutPurchasedEntries({ selectedTab, purchasedByTab }),
    [selectedTab, purchasedByTab]
  );
  const allSummarySections = useMemo(() => {
    return PLAYER_LOADOUT_TABS.map((tab) => {
      const groupDefinitions = Object.entries(tab.data.groups ?? {}).map(([groupKey, items]) => {
        const itemIds = new Set(items.map((item) => item.id));
        const entries = allEntries.filter((entry) => entry.sourceType === tab.key && itemIds.has(entry.sourceId));

        return {
          key: groupKey,
          label: groupKey,
          entries,
        };
      });

      return {
        key: tab.key,
        label: tab.label,
        entries: allEntries.filter((entry) => entry.sourceType === tab.key),
        groups: groupDefinitions,
      };
    });
  }, [allEntries]);
  const playerPresets = useMemo(
    () => savedLoadouts.filter((save) => save.scopeId === LOADOUT_RECORD_SCOPE_PLAYER),
    [savedLoadouts]
  );

  useEffect(() => {
    if (!activeGroup && groupEntries[0]) {
      setSelectedGroupByTab((current) => ({
        ...current,
        [activeTab.key]: groupEntries[0].key,
      }));
    }
  }, [activeGroup, activeTab.key, groupEntries]);

  function handlePurchasedChange(tabKey, itemId, isPurchased) {
    setPurchasedByTab((current) => {
      const nextTab = { ...(current[tabKey] ?? {}) };
      if (isPurchased) {
        nextTab[itemId] = true;
      } else {
        delete nextTab[itemId];
      }

      return {
        ...current,
        [tabKey]: nextTab,
      };
    });
  }

  function handleGroupChange(groupKey) {
    setSelectedGroupByTab((current) => ({
      ...current,
      [activeTab.key]: groupKey,
    }));
  }

  function handleToggleSummaryParent(tabKey) {
    setExpandedSummaryParents((current) => ({
      ...current,
      [tabKey]: !(current[tabKey] ?? true),
    }));
  }

  function handleToggleSummaryGroup(groupKey) {
    setExpandedSummaryGroups((current) => ({
      ...current,
      [groupKey]: !(current[groupKey] ?? true),
    }));
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 18, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.text }}>Player Loadout</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <ScopedLoadoutPresetsPanel
            colors={colors}
            title="Player Loadout Presets"
            description="Save and manage player-loadout-only presets here. These records only affect the Player Loadout page."
            scopeId={LOADOUT_RECORD_SCOPE_PLAYER}
            presets={playerPresets}
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
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "start" }}>
        <aside style={{ flex: "0 0 260px", width: "100%", maxWidth: 320, display: "grid", gap: 14, position: "sticky", top: 0 }}>
          <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: colors.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                All Player Stats
              </div>
              <button
                type="button"
                onClick={() => setSummaryViewMode((current) => (current === "split" ? "combined" : "split"))}
                style={{
                  background: colors.header,
                  border: `1px solid ${colors.accent}`,
                  borderRadius: 999,
                  color: colors.text,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 800,
                  padding: "8px 12px",
                  whiteSpace: "nowrap",
                }}
              >
                {summaryViewMode === "split" ? "Combine" : "Split"}
              </button>
            </div>
            {summaryViewMode === "combined" ? (
              <StatSummaryList entries={allEntries} colors={colors} fmt={fmt} />
            ) : (
              <PlayerStatSummaryTree
                sections={allSummarySections}
                expandedParents={expandedSummaryParents}
                expandedGroups={expandedSummaryGroups}
                colors={colors}
                fmt={fmt}
                onToggleParent={handleToggleSummaryParent}
                onToggleGroup={handleToggleSummaryGroup}
              />
            )}
          </div>
        </aside>

        <section style={{ flex: "1 1 760px", minWidth: 0, display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {PLAYER_LOADOUT_TABS.map((tab) => (
                <InlineTabButton
                  key={tab.key}
                  tab={tab}
                  isActive={tab.key === activeTab.key}
                  colors={colors}
                  getIconUrl={getIconUrl}
                  onSelect={setSelectedTab}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {groupEntries.map((group) => (
                <GroupTabButton
                  key={group.key}
                  label={group.label}
                  isActive={group.key === activeGroup?.key}
                  colors={colors}
                  onSelect={() => handleGroupChange(group.key)}
                />
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {activeItems.map((item) => {
              const isAutoOwned = isAutoOwnedPlayerItem({ tabKey: activeTab.key, groupEntries, groupKey: activeGroup?.key, item });
              const isPurchased = isAutoOwned || Boolean(activePurchased[item.id]);

              if (activeTab.key === "backgrounds") {
                return (
                  <BackgroundCard
                    key={item.id}
                    item={item}
                    isPurchased={isPurchased}
                    colors={colors}
                    getIconUrl={getIconUrl}
                    onToggle={(checked) => handlePurchasedChange(activeTab.key, item.id, checked)}
                    showToggle={!isAutoOwned}
                    fmt={fmt}
                  />
                );
              }

              return (
                <IconCard
                  key={item.id}
                  item={item}
                  isPurchased={isPurchased}
                  colors={colors}
                  getIconUrl={getIconUrl}
                  fmt={fmt}
                  showToggle={!isAutoOwned}
                  onToggle={(checked) => handlePurchasedChange(activeTab.key, item.id, checked)}
                />
              );
            })}
          </div>

        </section>
      </div>
    </div>
  );
}