import { useEffect, useMemo, useState } from "react";

import { MapStage, OverlayAnchor } from "../map/MapStage";
import { mapsData } from "../../lib/gameData";
import {
  countEquippedPerks,
  countPlacementBonusCopies,
  getPerkCurrentBonus,
  getPerkTotalCost,
  getPerkUpgradeStepCost,
  getPlacementBonusStepCost,
  getPlacementBonusTotalCost,
  getPlacementBonusValue,
  MAX_BONUS_PLACEMENTS_PER_ID,
  MAX_EQUIPPED_PERKS,
  readMapLoadoutState,
  writeMapLoadoutState,
} from "../../lib/mapLoadout";

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function formatStatValue(value, fmt) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? "-");
  }
  return Number.isInteger(numeric) ? (typeof fmt === "function" ? fmt(numeric) : numeric.toString()) : numeric.toFixed(2).replace(/\.00$/, "");
}

function formatPercentValue(value, fmt) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? "-");
  }

  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${formatStatValue(numeric, fmt)}%`;
}

function formatPlacementBonusLabel(bonus, level, fmt) {
  const total = getPlacementBonusValue(bonus, level);
  return `${bonus.name} ${formatPercentValue(total, fmt)}`;
}

function RightSideTabButton({ active, label, onClick, colors }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? "rgba(245,146,30,0.16)" : colors.header,
        color: active ? colors.accent : colors.text,
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

function ActionButton({ onClick, disabled, children, colors, accent = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: accent ? colors.accent : colors.header,
        color: accent ? "#08111a" : colors.text,
        border: `1px solid ${accent ? colors.accent : colors.border}`,
        borderRadius: 8,
        padding: "8px 10px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function PerkCard({ perk, state, equippedCount, colors, fmt, onUnlock, onToggleEquip, onLevelChange }) {
  const currentBonus = getPerkCurrentBonus(perk, state.level);
  const nextUpgradeCost = state.unlocked && state.level < (perk.maxLevel ?? 0)
    ? getPerkUpgradeStepCost(perk, state.level + 1)
    : null;
  const totalSpent = getPerkTotalCost(perk, state);
  const canEquip = state.equipped || equippedCount < MAX_EQUIPPED_PERKS;

  return (
    <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${state.equipped ? colors.accent : colors.border}`, borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.text }}>{perk.name}</div>
          <div style={{ fontSize: 11, color: colors.muted, marginTop: 3 }}>
            {state.equipped ? "Equipped" : state.unlocked ? "Unlocked" : "Locked"}
            {perk.isDefault ? " · Default" : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: colors.muted }}>Level</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: colors.accent }}>{state.level}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 10, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Current Bonus</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.text }}>{formatPercentValue(currentBonus, fmt)}</div>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 10, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Total Cost</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.gold }}>{formatStatValue(totalSpent, fmt)}</div>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 10, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Next Cost</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.gold }}>{nextUpgradeCost != null ? formatStatValue(nextUpgradeCost, fmt) : "Maxed"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!state.unlocked && !perk.isDefault && (
          <ActionButton onClick={onUnlock} colors={colors} accent>
            Unlock {formatStatValue(perk.unlockCost ?? 0, fmt)}
          </ActionButton>
        )}
        {state.unlocked && (
          <ActionButton onClick={onToggleEquip} disabled={!state.equipped && !canEquip} colors={colors}>
            {state.equipped ? "Unequip" : "Equip"}
          </ActionButton>
        )}
        {state.unlocked && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
            <ActionButton onClick={() => onLevelChange(state.level - 1)} disabled={state.level <= 0} colors={colors}>-</ActionButton>
            <ActionButton onClick={() => onLevelChange(state.level + 1)} disabled={state.level >= (perk.maxLevel ?? 0)} colors={colors}>+</ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}

function PlacementBonusCard({ bonus, level, placementCount, selected, colors, fmt, onSelect, onLevelChange }) {
  const nextCost = level < (bonus.maxLevel ?? 0) ? getPlacementBonusStepCost(bonus, level + 1) : null;

  return (
    <div style={{ background: selected ? "rgba(245,146,30,0.15)" : colors.header, border: `1px solid ${selected ? colors.accent : colors.border}`, borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.text }}>{bonus.name}</div>
          <div style={{ fontSize: 11, color: colors.muted, marginTop: 3 }}>{placementCount}/{MAX_BONUS_PLACEMENTS_PER_ID} placed</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: colors.muted }}>Level</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: colors.accent }}>{level}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 10, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Current Bonus</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.text }}>{level > 0 ? formatPlacementBonusLabel(bonus, level, fmt) : "Level 1 required"}</div>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 10, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Total Cost</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.gold }}>{formatStatValue(getPlacementBonusTotalCost(bonus, level), fmt)}</div>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 10, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Next Cost</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.gold }}>{nextCost != null ? formatStatValue(nextCost, fmt) : "Maxed"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <ActionButton onClick={onSelect} disabled={level < 1} colors={colors} accent={selected}>
          {selected ? "Selected" : "Select Bonus"}
        </ActionButton>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
          <ActionButton onClick={() => onLevelChange(level - 1)} disabled={level <= 0} colors={colors}>-</ActionButton>
          <ActionButton onClick={() => onLevelChange(level + 1)} disabled={level >= (bonus.maxLevel ?? 0)} colors={colors}>+</ActionButton>
        </div>
      </div>
    </div>
  );
}

export function MapPerksLoadoutBuilder({ colors, selectedMap, getIconUrl, fmt }) {
  const [loadoutState, setLoadoutState] = useState(() => readMapLoadoutState(localStorage));
  const [selectedPlacementBonusId, setSelectedPlacementBonusId] = useState(null);
  const [activeRightTab, setActiveRightTab] = useState("perks");

  useEffect(() => {
    writeMapLoadoutState(loadoutState, localStorage);
  }, [loadoutState]);

  useEffect(() => {
    setSelectedPlacementBonusId(null);
  }, [selectedMap?.id]);

  const perkStateById = loadoutState.perksByMap[selectedMap?.id] ?? {};
  const equippedPerkCount = countEquippedPerks(perkStateById);
  const placementBonusLevels = loadoutState.placementBonusLevelsByMap[selectedMap?.id] ?? {};
  const bonusPlacementsBySpot = loadoutState.placementBonusPlacementsByMap[selectedMap?.id] ?? {};
  const placementBonuses = mapsData.placementBonuses ?? [];
  const selectedPlacementBonus = placementBonuses.find((bonus) => bonus.id === selectedPlacementBonusId) ?? null;

  const sortedPerks = useMemo(() => {
    if (!selectedMap) {
      return [];
    }

    return [...(selectedMap.perks ?? [])].sort((left, right) => {
      const leftState = perkStateById[left.id] ?? { unlocked: false, equipped: false, level: 0 };
      const rightState = perkStateById[right.id] ?? { unlocked: false, equipped: false, level: 0 };
      return Number(rightState.equipped) - Number(leftState.equipped)
        || Number(rightState.unlocked) - Number(leftState.unlocked)
        || (left.perkEnum ?? 0) - (right.perkEnum ?? 0);
    });
  }, [selectedMap, perkStateById]);

  const placedBonusEntries = useMemo(() => {
    if (!selectedMap) {
      return [];
    }

    return Object.entries(bonusPlacementsBySpot)
      .filter(([, bonusId]) => bonusId)
      .map(([spotId, bonusId]) => ({
        spot: selectedMap.spots.find((item) => item.id === spotId),
        bonus: placementBonuses.find((item) => item.id === bonusId),
      }))
      .filter((entry) => entry.spot && entry.bonus);
  }, [bonusPlacementsBySpot, placementBonuses, selectedMap]);

  function updateLoadout(updater) {
    setLoadoutState((current) => updater(current));
  }

  function updatePerk(perkId, updater) {
    updateLoadout((current) => ({
      ...current,
      perksByMap: {
        ...current.perksByMap,
        [selectedMap.id]: {
          ...current.perksByMap[selectedMap.id],
          [perkId]: updater(current.perksByMap[selectedMap.id]?.[perkId] ?? { unlocked: false, equipped: false, level: 0 }),
        },
      },
    }));
  }

  function unlockPerk(perk) {
    updatePerk(perk.id, (current) => ({ ...current, unlocked: true }));
  }

  function toggleEquipPerk(perk) {
    updatePerk(perk.id, (current) => {
      if (!current.unlocked) {
        return current;
      }

      if (!current.equipped && equippedPerkCount >= MAX_EQUIPPED_PERKS) {
        return current;
      }

      return { ...current, equipped: !current.equipped };
    });
  }

  function setPerkLevel(perk, nextLevel) {
    updatePerk(perk.id, (current) => ({
      ...current,
      level: clamp(nextLevel, 0, perk.maxLevel ?? 0),
    }));
  }

  function setPlacementBonusLevel(bonus, nextLevel) {
    const clampedLevel = clamp(nextLevel, 0, bonus.maxLevel ?? 0);
    updateLoadout((current) => {
      const nextState = {
        ...current,
        placementBonusLevelsByMap: {
          ...current.placementBonusLevelsByMap,
          [selectedMap.id]: {
            ...current.placementBonusLevelsByMap[selectedMap.id],
            [bonus.id]: clampedLevel,
          },
        },
      };

      if (clampedLevel < 1) {
        nextState.placementBonusPlacementsByMap = {
          ...current.placementBonusPlacementsByMap,
          [selectedMap.id]: Object.fromEntries(
            Object.entries(current.placementBonusPlacementsByMap[selectedMap.id] ?? {}).map(([spotId, placedBonusId]) => [spotId, placedBonusId === bonus.id ? null : placedBonusId])
          ),
        };
        if (selectedPlacementBonusId === bonus.id) {
          setSelectedPlacementBonusId(null);
        }
      }

      return nextState;
    });
  }

  function placeBonusOnSpot(spotId) {
    const placedBonusId = bonusPlacementsBySpot[spotId];

    if (!selectedPlacementBonus) {
      if (placedBonusId) {
        clearPlacementSpot(spotId);
      }
      return;
    }

    const currentLevel = placementBonusLevels[selectedPlacementBonus.id] ?? 0;
    const currentCount = countPlacementBonusCopies(bonusPlacementsBySpot, selectedPlacementBonus.id);
    const replacingSameBonus = placedBonusId === selectedPlacementBonus.id;

    if (currentLevel < 1 || (!replacingSameBonus && currentCount >= MAX_BONUS_PLACEMENTS_PER_ID)) {
      return;
    }

    updateLoadout((current) => ({
      ...current,
      placementBonusPlacementsByMap: {
        ...current.placementBonusPlacementsByMap,
        [selectedMap.id]: {
          ...current.placementBonusPlacementsByMap[selectedMap.id],
          [spotId]: selectedPlacementBonus.id,
        },
      },
    }));
  }

  function clearPlacementSpot(spotId) {
    updateLoadout((current) => ({
      ...current,
      placementBonusPlacementsByMap: {
        ...current.placementBonusPlacementsByMap,
        [selectedMap.id]: {
          ...current.placementBonusPlacementsByMap[selectedMap.id],
          [spotId]: null,
        },
      },
    }));
  }

  if (!selectedMap) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 460px)", gap: 20, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Map Perks Loadout</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>{selectedMap.name}</div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Equipped Perks</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: colors.accent }}>{equippedPerkCount}/{MAX_EQUIPPED_PERKS}</div>
                </div>
                <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Placed Bonuses</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: colors.accent }}>{placedBonusEntries.length}</div>
                </div>
              </div>
            </div>

            {selectedMap.negativePerk && (
              <div style={{ background: "rgba(224,85,85,0.12)", border: "1px solid rgba(224,85,85,0.35)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#e05555", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Negative Perk</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: colors.text, marginTop: 4 }}>{selectedMap.negativePerk.name}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#e05555" }}>{formatPercentValue(selectedMap.negativePerk.statAmt, fmt)}</div>
              </div>
            )}
          </div>

          <div style={{ position: "relative" }}>
            <MapStage map={selectedMap} colors={colors} getIconUrl={getIconUrl} minHeight={420}>
              {({ spotSize }) => (
                <>
                  {selectedMap.spots.map((spot) => {
                    const placedBonusId = bonusPlacementsBySpot[spot.id];
                    const placedBonus = placementBonuses.find((bonus) => bonus.id === placedBonusId) ?? null;
                    const placedLevel = placedBonus ? (placementBonusLevels[placedBonus.id] ?? 0) : 0;

                    return (
                      <OverlayAnchor key={spot.id} x={spot.x} y={spot.y} zIndex={4}>
                        <button
                          type="button"
                          onClick={() => placeBonusOnSpot(spot.id)}
                          style={{
                            width: placedBonus ? Math.max(spotSize * 2.8, 72) : Math.max(spotSize * 1.8, 38),
                            minHeight: placedBonus ? Math.max(spotSize * 1.9, 46) : Math.max(spotSize * 1.8, 38),
                            background: placedBonus ? "rgba(8,17,26,0.86)" : "transparent",
                            border: placedBonus ? `1px solid ${colors.accent}` : "none",
                            borderRadius: placedBonus ? 10 : "50%",
                            color: colors.text,
                            padding: placedBonus ? "6px 8px" : 0,
                            cursor: "pointer",
                            display: "grid",
                            gap: 2,
                            textAlign: "center",
                            boxShadow: placedBonus ? "0 10px 20px rgba(0,0,0,0.28)" : "none",
                          }}
                          aria-label={placedBonus ? `Edit ${placedBonus.name} placement on ${spot.label}` : `Place bonus on ${spot.label}`}
                        >
                          {placedBonus ? (
                            <>
                              <span style={{ fontSize: 11, fontWeight: 800 }}>{placedBonus.name}</span>
                              <span style={{ fontSize: 10, color: colors.accent }}>{formatPlacementBonusLabel(placedBonus, placedLevel, fmt)}</span>
                            </>
                          ) : null}
                        </button>
                      </OverlayAnchor>
                    );
                  })}
                </>
              )}
            </MapStage>
          </div>

          <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Placed Bonuses</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>{placedBonusEntries.length} active placements</div>
            </div>
            {placedBonusEntries.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {placedBonusEntries.map((entry) => (
                  <div key={entry.spot.id} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
                    <div style={{ fontWeight: 800, color: colors.text }}>{entry.bonus.name}</div>
                    <div style={{ fontSize: 11, color: colors.muted }}>{entry.spot.label} · {entry.spot.id}</div>
                    <div style={{ fontSize: 12, color: colors.accent }}>{formatPlacementBonusLabel(entry.bonus, placementBonusLevels[entry.bonus.id] ?? 0, fmt)}</div>
                    <ActionButton onClick={() => clearPlacementSpot(entry.spot.id)} colors={colors}>Remove</ActionButton>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: colors.muted }}>No placement bonuses are assigned to map spots yet.</div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <RightSideTabButton active={activeRightTab === "perks"} label="Map Perks" onClick={() => setActiveRightTab("perks")} colors={colors} />
            <RightSideTabButton active={activeRightTab === "placement"} label="Placement Bonuses" onClick={() => setActiveRightTab("placement")} colors={colors} />
          </div>

          {activeRightTab === "perks" && (
          <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Map Perks</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Unlock, Equip, and Level</div>
            </div>
            <div style={{ display: "grid", gap: 10, maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
              {sortedPerks.map((perk) => (
                <PerkCard
                  key={perk.id}
                  perk={perk}
                  state={perkStateById[perk.id] ?? { unlocked: false, equipped: false, level: 0 }}
                  equippedCount={equippedPerkCount}
                  colors={colors}
                  fmt={fmt}
                  onUnlock={() => unlockPerk(perk)}
                  onToggleEquip={() => toggleEquipPerk(perk)}
                  onLevelChange={(nextLevel) => setPerkLevel(perk, nextLevel)}
                />
              ))}
            </div>
          </div>
          )}

          {activeRightTab === "placement" && (
          <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Placement Bonuses</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Global Bonus Levels</div>
            </div>
            <div style={{ display: "grid", gap: 10, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
              {placementBonuses.map((bonus) => (
                <PlacementBonusCard
                  key={bonus.id}
                  bonus={bonus}
                  level={placementBonusLevels[bonus.id] ?? 0}
                  placementCount={countPlacementBonusCopies(bonusPlacementsBySpot, bonus.id)}
                  selected={selectedPlacementBonusId === bonus.id}
                  colors={colors}
                  fmt={fmt}
                  onSelect={() => setSelectedPlacementBonusId((current) => current === bonus.id ? null : bonus.id)}
                  onLevelChange={(nextLevel) => setPlacementBonusLevel(bonus, nextLevel)}
                />
              ))}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}