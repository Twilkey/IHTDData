import { useEffect, useMemo, useState } from "react";

import {
  activateSpellInLoadout,
  countActiveSpells,
  deactivateSpellInLoadout,
  MAP_SPELL_DEFINITIONS,
  MAP_SPELL_GROUPS,
  MAP_SPELL_MODE_OPTIONS,
  MAX_ACTIVE_SPELLS,
  readMapLoadoutState,
  updateSpellLevelInLoadout,
  updateSpellModeInLoadout,
  writeMapLoadoutState,
} from "../../lib/mapLoadout";

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function formatLevel(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function SectionCard({ children, colors }) {
  return (
    <div
      style={{
        background: colors.panel,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function SpellIcon({ spell, colors, getIconUrl, size = 44 }) {
  const iconSrc = spell?.icon ? getIconUrl(spell.icon) : null;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${colors.border}`,
        background: spell?.bgColor ?? colors.header,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        padding: 4,
      }}
    >
      {iconSrc ? (
        <img src={iconSrc} alt={spell.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <span style={{ fontWeight: 800, color: colors.text }}>{spell?.name?.slice(0, 2).toUpperCase() ?? "?"}</span>
      )}
    </div>
  );
}

function ModeButton({ active, label, onClick, colors }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? "rgba(245,146,30,0.18)" : colors.header,
        color: active ? colors.accent : colors.text,
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

export function MapSpellLoadoutBuilder({ colors, selectedMap, getIconUrl }) {
  const [loadoutState, setLoadoutState] = useState(() => readMapLoadoutState(localStorage));

  useEffect(() => {
    writeMapLoadoutState(loadoutState, localStorage);
  }, [loadoutState]);

  const spellLoadout = selectedMap
    ? (loadoutState.spellLoadoutsByMap[selectedMap.id] ?? { activeSpellIds: [], spellStatesById: {} })
    : { activeSpellIds: [], spellStatesById: {} };

  const activeSpells = useMemo(
    () => spellLoadout.activeSpellIds.map((spellId) => MAP_SPELL_DEFINITIONS.find((spell) => spell.id === spellId)).filter(Boolean),
    [spellLoadout.activeSpellIds]
  );

  const activeSpellCount = countActiveSpells(spellLoadout);

  function updateCurrentMapSpellLoadout(updater) {
    if (!selectedMap) {
      return;
    }

    setLoadoutState((current) => ({
      ...current,
      spellLoadoutsByMap: {
        ...current.spellLoadoutsByMap,
        [selectedMap.id]: updater(current.spellLoadoutsByMap[selectedMap.id]),
      },
    }));
  }

  function activateSpell(spellId) {
    updateCurrentMapSpellLoadout((current) => activateSpellInLoadout(current, spellId));
  }

  function deactivateSpell(spellId) {
    updateCurrentMapSpellLoadout((current) => deactivateSpellInLoadout(current, spellId));
  }

  function setSpellLevel(spell, nextLevel) {
    updateCurrentMapSpellLoadout((current) => updateSpellLevelInLoadout(
      current,
      spell.id,
      clamp(nextLevel, 0, spell.maxLevel ?? 0)
    ));
  }

  function setSpellMode(spellId, nextMode) {
    updateCurrentMapSpellLoadout((current) => updateSpellModeInLoadout(current, spellId, nextMode));
  }

  if (!selectedMap) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <SectionCard colors={colors}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Spell Loadout</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>{selectedMap.name}</div>
            <div style={{ fontSize: 13, color: colors.muted, lineHeight: 1.55 }}>
              Active spells are saved per map. Map presets also include perks, placements, and this spell setup together.
            </div>
          </div>
          <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "12px 14px", minWidth: 150 }}>
            <div style={{ fontSize: 10, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Active Spells</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: activeSpellCount >= MAX_ACTIVE_SPELLS ? colors.accent : colors.text }}>
              {activeSpellCount}/{MAX_ACTIVE_SPELLS}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard colors={colors}>
        <div>
          <div style={{ fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Active List</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Equipped Spells</div>
        </div>
        {activeSpells.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {activeSpells.map((spell) => {
              const spellState = spellLoadout.spellStatesById?.[spell.id] ?? { level: 0, mode: "manual" };
              return (
                <div
                  key={spell.id}
                  style={{
                    background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 14,
                    padding: 12,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <SpellIcon spell={spell} colors={colors} getIconUrl={getIconUrl} />
                    <div style={{ minWidth: 180, flex: 1, display: "grid", gap: 4 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>{spell.name}</div>
                      <div style={{ fontSize: 12, color: colors.muted }}>{spell.statKey}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deactivateSpell(spell.id)}
                      style={{
                        background: "transparent",
                        color: "#ffb3a8",
                        border: "1px solid rgba(255, 122, 103, 0.45)",
                        borderRadius: 10,
                        padding: "8px 12px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 160px) minmax(0, 1fr)", gap: 12, alignItems: "start" }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 10, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Level</span>
                      <input
                        type="number"
                        min={0}
                        max={spell.maxLevel ?? 0}
                        value={formatLevel(spellState.level)}
                        onChange={(event) => setSpellLevel(spell, Number.parseInt(event.target.value, 10) || 0)}
                        style={{
                          background: "#0f2640",
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 10,
                          padding: "10px 12px",
                          fontFamily: "inherit",
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      />
                    </label>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 10, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Trigger Mode</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {MAP_SPELL_MODE_OPTIONS.map((option) => (
                          <ModeButton
                            key={`${spell.id}-${option.id}`}
                            active={spellState.mode === option.id}
                            label={option.label}
                            onClick={() => setSpellMode(spell.id, option.id)}
                            colors={colors}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: colors.muted, fontSize: 13, lineHeight: 1.6 }}>
            No active spells yet. Add up to five spells from the grouped lists below.
          </div>
        )}
      </SectionCard>

      <SectionCard colors={colors}>
        <div>
          <div style={{ fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Inactive Spells</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>Grouped Spell Pool</div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {MAP_SPELL_GROUPS.map((group) => {
            const inactiveSpells = group.spells.filter((spell) => !spellLoadout.activeSpellIds.includes(spell.id));
            if (!inactiveSpells.length) {
              return null;
            }

            return (
              <div key={group.id} style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: colors.text }}>{group.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                  {inactiveSpells.map((spell) => {
                    const spellState = spellLoadout.spellStatesById?.[spell.id] ?? { level: 0, mode: "manual" };
                    const canActivate = activeSpellCount < MAX_ACTIVE_SPELLS;

                    return (
                      <div
                        key={spell.id}
                        style={{
                          background: colors.header,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 12,
                          padding: 12,
                          display: "grid",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <SpellIcon spell={spell} colors={colors} getIconUrl={getIconUrl} size={38} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: colors.text }}>{spell.name}</div>
                            <div style={{ fontSize: 11, color: colors.muted }}>Level {formatLevel(spellState.level)} / {spell.maxLevel ?? 0}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => activateSpell(spell.id)}
                          disabled={!canActivate}
                          style={{
                            background: canActivate ? colors.accent : colors.panel,
                            color: canActivate ? "#08111d" : colors.muted,
                            border: `1px solid ${canActivate ? colors.accent : colors.border}`,
                            borderRadius: 10,
                            padding: "9px 12px",
                            fontWeight: 800,
                            cursor: canActivate ? "pointer" : "not-allowed",
                          }}
                        >
                          {canActivate ? "Add to Active" : "Active Limit Reached"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}