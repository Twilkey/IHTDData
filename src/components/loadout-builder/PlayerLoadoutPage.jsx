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

function PurchasedToggle({ isPurchased, colors, onToggle }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, color: colors.text, fontSize: 12, fontWeight: 700 }}>
      <input type="checkbox" checked={isPurchased} onChange={(event) => onToggle(event.target.checked)} />
      Purchased
    </label>
  );
}

function RewardLine({ item, colors, fmt }) {
  if (!item.rewardUnit || item.reward == null) {
    return <div style={{ fontSize: 13, color: colors.muted }}>Reward -</div>;
  }

  return (
    <div style={{ fontSize: 13, color: colors.muted }}>
      Reward <span style={{ color: item.reward < 0 ? colors.positive : colors.accent, fontWeight: 700 }}>{formatSignedHeroBonus("damage", item.reward, fmt).replace("%", "")}</span> {item.rewardUnit}
    </div>
  );
}

function IconCard({ item, isPurchased, colors, getIconUrl, fmt, onToggle }) {
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
          <RewardLine item={item} colors={colors} fmt={fmt} />
        </div>
        <img src={getIconUrl(item.icon)} alt={item.name} style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 6, objectFit: "contain" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: isPurchased ? colors.accent : colors.muted, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {isPurchased ? "Included In Loadout" : "Not Purchased"}
        </div>
        <PurchasedToggle isPurchased={isPurchased} colors={colors} onToggle={onToggle} />
      </div>
    </div>
  );
}

function BackgroundCard({ item, isPurchased, colors, getIconUrl, fmt, onToggle }) {
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: "auto" }}>
          <div style={{ fontSize: 12, color: isPurchased ? colors.accent : colors.muted, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {isPurchased ? "Included In Loadout" : "Not Purchased"}
          </div>
          <PurchasedToggle isPurchased={isPurchased} colors={colors} onToggle={onToggle} />
        </div>
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

export function PlayerLoadoutPage({ colors, getIconUrl, fmt, savedLoadouts = [], currentSavedLoadoutId = "", onLoadSave, onDeleteSave, onImportComplete }) {
  const initialState = useMemo(() => readPlayerLoadoutState(localStorage), []);
  const [selectedTab, setSelectedTab] = useState(initialState.selectedTab);
  const [selectedGroupByTab, setSelectedGroupByTab] = useState(initialState.selectedGroupByTab);
  const [purchasedByTab, setPurchasedByTab] = useState(initialState.purchasedByTab);

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
  const activeItemIds = useMemo(() => new Set(activeItems.map((item) => item.id)), [activeItems]);
  const activeEntries = useMemo(
    () => allEntries.filter((entry) => entry.sourceType === activeTab.key && activeItemIds.has(entry.sourceId)),
    [activeItemIds, activeTab.key, allEntries]
  );
  const purchasedCount = activeItems.filter((item) => Boolean(activePurchased[item.id])).length;
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

  return (
    <div style={{ display: "grid", gap: 20 }}>
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
      />

      <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 18, display: "grid", gap: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: colors.text }}>Player Loadout</div>
        <div style={{ fontSize: 13, color: colors.muted, maxWidth: 780 }}>
          Track which player icons and backgrounds are purchased and apply their rewards as global loadout stats.
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "start" }}>
        <aside style={{ flex: "0 0 260px", width: "100%", maxWidth: 320, display: "grid", gap: 14, position: "sticky", top: 0 }}>
          <div style={{ background: `linear-gradient(180deg, ${colors.panel} 0%, ${colors.header} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 8 }}>
            {PLAYER_LOADOUT_TABS.map((tab) => (
              <TabButton
                key={tab.key}
                tab={tab}
                isActive={tab.key === activeTab.key}
                colors={colors}
                getIconUrl={getIconUrl}
                onSelect={setSelectedTab}
              />
            ))}
          </div>
        </aside>

        <section style={{ flex: "1 1 760px", minWidth: 0, display: "grid", gap: 16 }}>
          <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: colors.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {activeTab.label}
                </div>
                <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>
                  {activeGroup?.label ?? "Group"} group with {fmt(purchasedCount)} purchased and {fmt(activeItems.length)} total items.
                </div>
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
          </div>

          <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: colors.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {activeGroup?.label ?? activeTab.label} Stat Summary
            </div>
            <StatSummaryList entries={activeEntries} colors={colors} fmt={fmt} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {activeItems.map((item) => {
              const isPurchased = Boolean(activePurchased[item.id]);

              if (activeTab.key === "backgrounds") {
                return (
                  <BackgroundCard
                    key={item.id}
                    item={item}
                    isPurchased={isPurchased}
                    colors={colors}
                    getIconUrl={getIconUrl}
                    onToggle={(checked) => handlePurchasedChange(activeTab.key, item.id, checked)}
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