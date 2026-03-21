import { useState } from "react";

import { PresetsModalShell } from "./PresetsModalShell";

function formatFilterLabel(value) {
  return String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function CompareSettingRow({
  label,
  colors,
  children,
}) {
  return (
    <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
      <div style={{ fontSize: 10, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, colors, label }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "transparent",
        color: colors.text,
        border: `1px solid ${colors.border}`,
        borderRadius: 999,
        padding: "8px 12px",
        cursor: "pointer",
        fontWeight: 700,
      }}
    >
      <span>{label}</span>
      <span style={{ width: 42, height: 24, borderRadius: 999, background: checked ? colors.accent : colors.header, border: `1px solid ${checked ? colors.accent : colors.border}`, position: "relative", transition: "background 0.15s, border-color 0.15s" }}>
        <span style={{ position: "absolute", top: 2, left: checked ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: checked ? "#08111d" : colors.muted, transition: "left 0.15s" }} />
      </span>
    </button>
  );
}

function HeroPickerSlot({ slotId, heroes, colors, getIconUrl, onSelectHero, onCancel }) {
  const [searchValue, setSearchValue] = useState("");

  const filteredHeroes = heroes.filter((hero) => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    if (!normalizedSearch) {
      return true;
    }

    return [hero.name, hero.id, hero.class, hero.rarity, hero.type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });

  return (
    <div key={slotId} style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px dashed ${colors.accent}`, borderRadius: 14, padding: 14, display: "grid", gap: 12, minHeight: 280 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Hero Slot</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: colors.text, marginTop: 4 }}>Pick a Hero</div>
        </div>
        <button type="button" onClick={onCancel} style={{ background: "transparent", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.muted, padding: "8px 10px", fontWeight: 700, cursor: "pointer" }}>
          Cancel
        </button>
      </div>

      <input
        type="text"
        value={searchValue}
        onChange={(event) => setSearchValue(event.target.value)}
        placeholder="Search heroes"
        style={{ width: "100%", background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 10, color: colors.text, fontSize: 14, fontWeight: 700, padding: "10px 12px", fontFamily: "inherit" }}
      />

      <div style={{ display: "grid", gap: 8, maxHeight: 340, overflowY: "auto", paddingRight: 4 }}>
        {filteredHeroes.length ? filteredHeroes.map((hero) => {
          return (
            <button
              key={hero.id}
              type="button"
              onClick={() => onSelectHero(hero.id)}
              style={{
                background: colors.header,
                border: `1px solid ${colors.accent}`,
                borderRadius: 10,
                padding: 10,
                color: colors.text,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                textAlign: "left",
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: colors.panel, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {hero.heroIcon ? <img src={getIconUrl(hero.heroIcon)} alt={hero.name} style={{ width: 30, height: 30, objectFit: "contain" }} /> : null}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{hero.name}</div>
                <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>{hero.class ?? "Unknown class"} · {hero.rarity ?? "Unknown rarity"}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: colors.accent }}>Select</div>
            </button>
          );
        }) : (
          <div style={{ color: colors.muted, fontSize: 13 }}>No heroes match this search.</div>
        )}
      </div>
    </div>
  );
}

function DetailCard({ title, subtitle, colors, headerAccessory = null, children }) {
  return (
    <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: colors.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>{subtitle}</div> : null}
        </div>
        {headerAccessory}
      </div>
      {children}
    </div>
  );
}

function HeroComparisonCard({
  model,
  colors,
  getIconUrl,
  fmt,
  combatStyles,
  onUpdateOverride,
  onRemoveHero,
  onToggleSynergy,
  isExpanded,
}) {
  const hero = model.hero;
  const entryId = model.id;

  return (
    <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.accent}`, borderRadius: 14, padding: 14, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: colors.header, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {hero.heroIcon ? <img src={getIconUrl(hero.heroIcon)} alt={hero.name} style={{ width: 40, height: 40, objectFit: "contain" }} /> : null}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: colors.text }}>{hero.name}</div>
            <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>{hero.class ?? "Unknown class"} · {hero.rarity ?? "Unknown rarity"}</div>
            <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>{formatFilterLabel(hero.type)}{hero.typeSubtype?.length ? ` · ${hero.typeSubtype.map(formatFilterLabel).join(", ")}` : ""}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemoveHero(entryId)}
          style={{ background: "transparent", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.accent, padding: "8px 10px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
        >
          Remove
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <CompareSettingRow label="Rank" colors={colors}>
          <input type="number" min={0} value={model.currentRank} onChange={(event) => onUpdateOverride(entryId, "rank", event.target.value)} style={{ width: "100%", background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 13, fontWeight: 700, padding: "8px 10px", fontFamily: "inherit" }} />
        </CompareSettingRow>
        <CompareSettingRow label="Level" colors={colors}>
          <input type="number" min={0} value={model.currentLevel} onChange={(event) => onUpdateOverride(entryId, "level", event.target.value)} style={{ width: "100%", background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 13, fontWeight: 700, padding: "8px 10px", fontFamily: "inherit" }} />
        </CompareSettingRow>
        <CompareSettingRow label="Mastery" colors={colors}>
          <input type="number" min={0} max={hero.masteryExp?.maxLevel ?? 0} value={model.currentMastery} onChange={(event) => onUpdateOverride(entryId, "mastery", event.target.value)} style={{ width: "100%", background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 13, fontWeight: 700, padding: "8px 10px", fontFamily: "inherit" }} />
        </CompareSettingRow>
        <CompareSettingRow label="Combat Style" colors={colors}>
          <select value={model.combatStyle?.id ?? "balanced"} onChange={(event) => onUpdateOverride(entryId, "combatStyleId", event.target.value)} style={{ width: "100%", background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 13, fontWeight: 700, padding: "8px 10px", fontFamily: "inherit" }}>
            {combatStyles.map((style) => (
              <option key={style.id} value={style.id} disabled={(style.rankReq ?? 0) > model.currentRank}>
                {style.rankReq > 0 ? `${style.name} (Rank ${fmt(style.rankReq)}+)` : style.name}
              </option>
            ))}
          </select>
        </CompareSettingRow>
      </div>

      {!isExpanded ? (
        <DetailCard title="Stats" subtitle="Compact summary" colors={colors}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {model.displayStats.slice(0, 4).map((stat) => (
              <div key={stat.key} style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 10, display: "grid", gap: 4 }}>
                <div style={{ fontSize: 10, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{stat.label}</div>
                <div style={{ fontSize: 14, color: colors.text, fontWeight: 900 }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </DetailCard>
      ) : null}

      {isExpanded ? (
        <div style={{ display: "grid", gap: 12 }}>
          <DetailCard title="Stat Breakdown" subtitle={model.includeLoadoutStats ? "Includes active loadout bonuses" : "Only inline edits and hero progression are applied"} colors={colors}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {model.displayStats.map((stat) => (
                <div key={stat.key} style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 10, display: "grid", gap: 4 }}>
                  <div style={{ fontSize: 10, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{stat.label}</div>
                  <div style={{ fontSize: 15, color: colors.text, fontWeight: 900 }}>{stat.value}</div>
                  {stat.bonusLabel ? <div style={{ fontSize: 11, color: colors.muted }}>{stat.bonusLabel}</div> : null}
                </div>
              ))}
            </div>
          </DetailCard>

          <DetailCard title="Skill" subtitle={model.adjustedSkill?.name ?? hero.skill?.name ?? "No active skill recorded"} colors={colors}>
            <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.6 }}>{model.adjustedSkill?.description ?? hero.skill?.description ?? "No skill description available."}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 10, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Cooldown</div>
                <div style={{ fontSize: 13, color: colors.text, fontWeight: 800, marginTop: 4 }}>{model.skillCooldownLabel}</div>
              </div>
              <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 10, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Power</div>
                <div style={{ fontSize: 13, color: colors.text, fontWeight: 800, marginTop: 4 }}>{model.adjustedSkill?.powerDescription ?? hero.skill?.powerDescription ?? "Not listed"}</div>
              </div>
              <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 10, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Duration</div>
                <div style={{ fontSize: 13, color: colors.text, fontWeight: 800, marginTop: 4 }}>{model.adjustedSkill?.durationDescription ?? hero.skill?.durationDescription ?? "Not listed"}</div>
              </div>
            </div>
          </DetailCard>

          <DetailCard title="Mastery" colors={colors}>
            <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.6 }}>{model.masteryDescription}</div>
          </DetailCard>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <DetailCard title="Milestones" subtitle={`${model.activeMilestones.length} active · ${model.inactiveMilestones.length} inactive`} colors={colors}>
              <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                {[...model.activeMilestones.map((milestone) => ({ ...milestone, isActive: true })), ...model.inactiveMilestones.map((milestone) => ({ ...milestone, isActive: false }))].length ? [...model.activeMilestones.map((milestone) => ({ ...milestone, isActive: true })), ...model.inactiveMilestones.map((milestone) => ({ ...milestone, isActive: false }))].map((milestone, index) => (
                  <div key={`${hero.id}-milestone-${index}`} style={{ background: milestone.isActive ? "rgba(68,136,238,0.16)" : colors.panel, border: `1px solid ${milestone.isActive ? colors.accent : colors.border}`, borderRadius: 10, padding: 10, display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: colors.text }}>{milestone.name ?? `Milestone ${milestone.milestone ?? index + 1}`}</div>
                    <div style={{ fontSize: 11, color: colors.muted }}>{milestone.description ?? milestone.amountLabel ?? "No description available."}</div>
                    {milestone.isActive ? <div style={{ fontSize: 10, color: colors.accent, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Active</div> : null}
                  </div>
                )) : <div style={{ fontSize: 12, color: colors.muted }}>No milestones recorded for this hero.</div>}
              </div>
            </DetailCard>

            <DetailCard
              title="Synergies"
              subtitle={`${model.activeSynergies.length} active · ${model.inactiveSynergies.length} inactive`}
              colors={colors}
              headerAccessory={(
                <div
                  title="Click a synergy to activate or deactivate."
                  aria-label="Synergy toggle info"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `1px solid ${colors.border}`,
                    color: colors.muted,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: "help",
                    flexShrink: 0,
                  }}
                >
                  i
                </div>
              )}
            >
              <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                {[...model.activeSynergies.map((synergy) => ({ ...synergy, isActive: true })), ...model.inactiveSynergies.map((synergy) => ({ ...synergy, isActive: false }))].length ? [...model.activeSynergies.map((synergy) => ({ ...synergy, isActive: true })), ...model.inactiveSynergies.map((synergy) => ({ ...synergy, isActive: false }))].map((synergy, index) => (
                  <button
                    key={`${hero.id}-synergy-${index}`}
                    type="button"
                    onClick={() => synergy.isUnlocked ? onToggleSynergy(entryId, synergy.synergyKey) : undefined}
                    disabled={!synergy.isUnlocked}
                    style={{ background: synergy.isActive ? "rgba(68,136,238,0.16)" : colors.panel, border: `1px solid ${synergy.isActive ? colors.accent : colors.border}`, borderRadius: 10, padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: synergy.isUnlocked ? "pointer" : "not-allowed", opacity: synergy.isUnlocked ? 1 : 0.65 }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: colors.text }}>{synergy.name ?? `Synergy ${index + 1}`}</div>
                    <div style={{ fontSize: 11, color: colors.muted }}>{synergy.description ?? synergy.amountLabel ?? "No description available."}</div>
                    {!synergy.isUnlocked ? <div style={{ fontSize: 10, color: colors.muted, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>{`Locked · Rank ${fmt(synergy.rankRequired ?? 0)}+`}</div> : null}
                  </button>
                )) : <div style={{ fontSize: 12, color: colors.muted }}>No synergies recorded for this hero.</div>}
              </div>
            </DetailCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function HeroComparisonModal({
  colors,
  getIconUrl,
  fmt,
  heroes,
  compareEntries,
  models,
  combatStyles,
  includeLoadoutStats,
  onToggleIncludeLoadoutStats,
  onAddHero,
  onRemoveHero,
  onClose,
  onUpdateOverride,
  onToggleSynergy,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingSlots, setPendingSlots] = useState([]);

  const selectedModels = compareEntries
    .map((entry) => models.find((model) => model.id === entry.id) ?? null)
    .filter(Boolean);

  function handleAddSlot() {
    setPendingSlots((current) => [...current, { id: `slot-${Date.now()}-${current.length}` }]);
  }

  function handleCancelSlot(slotId) {
    setPendingSlots((current) => current.filter((slot) => slot.id !== slotId));
  }

  function handleSelectHero(slotId, heroId) {
    onAddHero(heroId);
    setPendingSlots((current) => current.filter((slot) => slot.id !== slotId));
  }

  return (
    <PresetsModalShell
      colors={colors}
      title="Compare Heroes"
      subtitle="Add hero slots from the header, pick heroes inside each slot, then expand the cards when you want the full stat and ability breakdown."
      onClose={onClose}
      actions={<button type="button" onClick={handleAddSlot} style={{ background: "rgba(68,136,238,0.16)", color: colors.text, border: `1px solid ${colors.accent}`, borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>Add Hero</button>}
      maxWidth={1400}
    >
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={() => setIsExpanded((current) => !current)} style={{ background: isExpanded ? "rgba(68,136,238,0.18)" : colors.header, color: colors.text, border: `1px solid ${isExpanded ? colors.accent : colors.border}`, borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>
              {isExpanded ? "Collapse Breakdown" : "Expand Breakdown"}
            </button>
            <ToggleSwitch checked={includeLoadoutStats} onChange={onToggleIncludeLoadoutStats} colors={colors} label="Include Loadout Stats" />
          </div>
          <div style={{ fontSize: 12, color: colors.muted }}>{selectedModels.length} heroes selected{pendingSlots.length ? ` · ${pendingSlots.length} empty slot${pendingSlots.length === 1 ? "" : "s"}` : ""}</div>
        </div>

        {(selectedModels.length || pendingSlots.length) ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, alignItems: "start" }}>
            {selectedModels.map((model) => (
              <HeroComparisonCard
                key={model.id}
                model={model}
                colors={colors}
                getIconUrl={getIconUrl}
                fmt={fmt}
                combatStyles={combatStyles}
                onUpdateOverride={onUpdateOverride}
                onRemoveHero={onRemoveHero}
                onToggleSynergy={onToggleSynergy}
                isExpanded={isExpanded}
              />
            ))}

            {pendingSlots.map((slot) => (
              <HeroPickerSlot
                key={slot.id}
                slotId={slot.id}
                heroes={heroes}
                colors={colors}
                getIconUrl={getIconUrl}
                onSelectHero={(heroId) => handleSelectHero(slot.id, heroId)}
                onCancel={() => handleCancelSlot(slot.id)}
              />
            ))}
          </div>
        ) : (
          <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16, color: colors.muted, fontSize: 13 }}>
            Add a hero from the header to open a selector slot, then choose the heroes you want to compare.
          </div>
        )}
      </div>
    </PresetsModalShell>
  );
}