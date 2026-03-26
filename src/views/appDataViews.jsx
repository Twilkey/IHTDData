import { useEffect, useMemo, useState } from "react";

import { SearchableSelect } from "../components/SearchableSelect";
import { heroesData, mapsData } from "../lib/gameData";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return isMobile;
}

const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Supreme"];

const RARITY_COLORS = {
  Common: { bg: "#3a3a3a", border: "#c0bfc0", text: "#d8d8d8" },
  Uncommon: { bg: "#1a3a1a", border: "#4dd44d", text: "#80e880" },
  Rare: { bg: "#1a3535", border: "#33d4d5", text: "#66e0e1" },
  Epic: { bg: "#1a2e50", border: "#5090d8", text: "#80b4f0" },
  Legendary: { bg: "#1a2240", border: "#4a7acc", text: "#80aaee" },
  Mythic: { bg: "#4a2a10", border: "#f09040", text: "#ffbe80" },
  Supreme: { bg: "#7a2020", border: "#ff8080", text: "#ffc4c4" },
};

const TIER_COLORS = {
  I: { bg: "#1a3a1a", border: "#4dd44d", text: "#80e880" },
  II: { bg: "#1a3535", border: "#33d4d5", text: "#66e0e1" },
  III: { bg: "#1a2e50", border: "#5090d8", text: "#80b4f0" },
  IV: { bg: "#3a1a5a", border: "#a060e0", text: "#c090ff" },
  V: { bg: "#4a2a10", border: "#f09040", text: "#ffbe80" },
  VI: { bg: "#5a1a1a", border: "#ff6060", text: "#ffaaaa" },
};

const ASTRAL_COLORS = {
  damage: "#e05555",
  gold: "#ffd040",
  exp: "#4488ee",
  energy: "#2ecc71",
  boss: "#aa2020",
  skills: "#33cccc",
  misc: "#1a8c1a",
};

const HERO_NAMES = (heroesData.heroes ?? [])
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((hero) => ({ id: hero.id, name: hero.name }));

const ALL_TIERS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

const MAP_PERK_UPGRADE_SOURCES = [
  { id: "runes", label: "Runes", statAmt: 2, maxLevel: 15 },
  { id: "mastery", label: "Mastery", statAmt: 5, maxLevel: 5 },
  { id: "ultimus", label: "Ultimus", statAmt: 2, maxLevel: 15 },
];

function getPerkUnit(name) {
  if (name.includes("%")) return "%";
  if (/chance|synergy|speed|cooldown|bonus|effect|group|damage|power|exp|gold|energy|active play/i.test(name)) {
    return "%";
  }
  return "";
}

function SearchBar({ colors, value, onChange, placeholder }) {
  return (
    <div style={{ position: "relative", marginBottom: 20 }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: colors.muted, fontSize: 15, pointerEvents: "none" }}>⌕</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "Search..."}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#0f2640",
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          color: colors.text,
          padding: "9px 12px 9px 34px",
          fontSize: 14,
          fontFamily: "inherit",
          outline: "none",
        }}
      />
      {value && (
        <button onClick={() => onChange("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: colors.muted, fontSize: 16, cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>
      )}
    </div>
  );
}

function ScopeFilter({ colors, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Scope</span>
      {["both", "global", "personal"].map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          style={{
            background: value === option ? colors.accent : colors.header,
            color: value === option ? "#000" : colors.text,
            border: `1px solid ${value === option ? colors.accent : colors.border}`,
            borderRadius: 6,
            padding: "5px 14px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: value === option ? 700 : 500,
            fontSize: 13,
            textTransform: "capitalize",
            transition: "all 0.15s",
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function TierFilter({ value, onChange }) {
  function toggle(tier) {
    const next = new Set(value);
    if (next.has(tier)) next.delete(tier);
    else next.add(tier);
    onChange(next);
  }

  const allSelected = value.size === 0;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "#7aaacf", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Tier</span>
      <button
        onClick={() => onChange(new Set())}
        style={{
          background: allSelected ? "#60d6ff" : "#1e4878",
          color: allSelected ? "#000" : "#e0f0ff",
          border: `1px solid ${allSelected ? "#60d6ff" : "#3a6eb0"}`,
          borderRadius: 6,
          padding: "5px 12px",
          cursor: "pointer",
          fontFamily: "inherit",
          fontWeight: allSelected ? 700 : 500,
          fontSize: 13,
          transition: "all 0.15s",
        }}
      >
        All
      </button>
      {ALL_TIERS.map((tier) => {
        const tierColor = TIER_COLORS[tier] ?? TIER_COLORS.I;
        const active = value.has(tier);

        return (
          <button
            key={tier}
            onClick={() => toggle(tier)}
            style={{
              background: active ? tierColor.border : tierColor.bg,
              color: active ? "#000" : tierColor.text,
              border: `1px solid ${tierColor.border}`,
              borderRadius: 6,
              padding: "5px 12px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: 13,
              transition: "all 0.15s",
            }}
          >
            {tier}
          </button>
        );
      })}
    </div>
  );
}

function HeroDropdown({ colors, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Hero</span>
      <SearchableSelect
        value={value}
        onChange={onChange}
        colors={colors}
        options={[{ value: "all", label: "All Heroes" }, ...HERO_NAMES.map((hero) => ({ value: hero.id, label: hero.name }))]}
        searchPlaceholder="Search heroes..."
        size="sm"
        containerStyle={{ minWidth: 180 }}
      />
    </div>
  );
}

function HeroModal({ hero, onClose, colors, Badge, getIconUrl }) {
  const [tab, setTab] = useState("milestones");
  const [mxpStart, setMxpStart] = useState(1);
  const [mxpEnd, setMxpEnd] = useState(10);
  const [mxpStartInput, setMxpStartInput] = useState("1");
  const [mxpEndInput, setMxpEndInput] = useState("10");
  const rarityColor = RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common;

  const tabStyle = (key) => ({
    flex: 1,
    padding: "10px 0",
    background: "none",
    border: "none",
    borderBottom: tab === key ? `2px solid ${colors.accent}` : "2px solid transparent",
    color: tab === key ? colors.accent : colors.muted,
    fontFamily: "inherit",
    fontWeight: tab === key ? 700 : 500,
    fontSize: 13,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "color 0.15s",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div style={{ background: colors.bg, border: `1px solid ${rarityColor.border}`, borderRadius: 12, width: "100%", maxWidth: 680, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: `0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px ${rarityColor.border}22` }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${colors.border}`, display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 10, background: rarityColor.bg, border: `2px solid ${rarityColor.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {hero.heroIcon ? <img src={getIconUrl(hero.heroIcon)} alt={hero.name} style={{ width: 60, height: 60, objectFit: "contain" }} /> : <span style={{ fontSize: 24, fontWeight: 800, color: "#ffffff99" }}>{hero.name.charAt(0)}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: colors.text, letterSpacing: "0.04em" }}>{hero.name}</span>
              <Badge color={rarityColor.border}>{hero.rarity}</Badge>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: hero.baseStats ? 6 : 0 }}>
              <span style={{ fontSize: 12, color: colors.muted, textTransform: "capitalize", fontWeight: 600 }}>{hero.class}</span>
            </div>
            {hero.baseStats && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { label: "Damage", value: hero.baseStats.damage },
                  { label: "DPS", value: hero.baseStats.dps },
                  { label: "Atk Speed", value: hero.baseStats.attackSpeed !== undefined ? `${hero.baseStats.attackSpeed}s` : undefined },
                  { label: "Range", value: hero.baseStats.range },
                ].filter((stat) => stat.value !== undefined).map((stat) => (
                  <div key={stat.label} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "3px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.gold }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: colors.muted, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 4px", flexShrink: 0 }}>✕</button>
        </div>

        {hero.skill && (
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${colors.border}`, background: colors.panel + "88" }}>
            <div style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 700 }}>Skill</div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              {hero.skill.icon && (
                <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, background: "#0f2640", border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <img src={getIconUrl(hero.skill.icon)} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ color: colors.accent, fontWeight: 800, fontSize: 15 }}>{hero.skill.name}</span>
                  <span style={{ fontSize: 12, color: colors.muted, background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "1px 8px" }}>{hero.skill.cooldown}s cooldown</span>
                </div>
                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.5, marginBottom: 6 }}>{hero.skill.description}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {hero.skill.powerDescription && <div style={{ fontSize: 12, color: colors.muted }}><span style={{ color: colors.positive, fontWeight: 600 }}>Power: </span>{hero.skill.powerDescription}</div>}
                  {hero.skill.durationDescription && <div style={{ fontSize: 12, color: colors.muted }}><span style={{ color: colors.gold, fontWeight: 600 }}>Duration: </span>{hero.skill.durationDescription}</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {hero.masteryDescription && (
          <div style={{ padding: "10px 20px", borderBottom: `1px solid ${colors.border}` }}>
            <span style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginRight: 8 }}>Mastery</span>
            <span style={{ fontSize: 13, color: colors.text, lineHeight: 1.5 }}>{hero.masteryDescription}</span>
          </div>
        )}

        <div style={{ display: "flex", borderBottom: `1px solid ${colors.border}`, flexShrink: 0, padding: "0 20px" }}>
          <button style={tabStyle("milestones")} onClick={() => setTab("milestones")}>Milestones <span style={{ fontSize: 11, opacity: 0.7 }}>({hero.milestones?.length ?? 0})</span></button>
          <button style={tabStyle("synergies")} onClick={() => setTab("synergies")}>Synergies <span style={{ fontSize: 11, opacity: 0.7 }}>({hero.synergies?.length ?? 0})</span></button>
          {hero.masteryExp && <button style={tabStyle("masteryExp")} onClick={() => setTab("masteryExp")}>Mastery Exp</button>}
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {tab === "milestones" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, background: colors.panel }}>
                <tr>
                  {["#", "Req Level", "Bonus", "Scope"].map((header) => (
                    <th key={header} style={{ padding: "8px 14px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(hero.milestones ?? []).map((milestone, index) => (
                  <tr key={milestone.milestone} style={{ background: index % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                    <td style={{ padding: "8px 14px", color: colors.accent, fontWeight: 700, fontSize: 14 }}>{milestone.milestone}</td>
                    <td style={{ padding: "8px 14px", color: colors.gold, fontWeight: 600 }}>{milestone.requirement.toLocaleString()}</td>
                    <td style={{ padding: "8px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: 6, background: milestone.bgColor + "44", border: `1px solid ${milestone.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}><img src={getIconUrl(milestone.icon)} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} /></div><span style={{ color: colors.text }}>{milestone.description}</span></div></td>
                    <td style={{ padding: "8px 14px" }}><Badge color={milestone.scope === "global" ? colors.positive : colors.accent}>{milestone.scope}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "synergies" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, background: colors.panel }}>
                <tr>
                  {["Tier", "Rank Req", "Required Heroes", "Bonus", "Scope"].map((header) => (
                    <th key={header} style={{ padding: "8px 14px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(hero.synergies ?? []).map((synergy, index) => {
                  const tierColor = TIER_COLORS[synergy.tier] ?? TIER_COLORS.I;
                  const partners = [synergy.hero1, synergy.hero2, synergy.hero3].filter(Boolean);
                  return (
                    <tr key={synergy.synergyLevel} style={{ background: index % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                      <td style={{ padding: "8px 14px" }}><span style={{ background: tierColor.bg, border: `1px solid ${tierColor.border}`, color: tierColor.text, borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{synergy.tier}</span></td>
                      <td style={{ padding: "8px 14px", color: colors.gold, fontWeight: 600 }}>{synergy.rankRequired > 0 ? synergy.rankRequired : "-"}</td>
                      <td style={{ padding: "8px 14px" }}><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{partners.map((partner) => <span key={partner} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "1px 7px", fontSize: 11, color: colors.text, textTransform: "capitalize" }}>{partner}</span>)}</div></td>
                      <td style={{ padding: "8px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: 6, background: synergy.bgColor + "44", border: `1px solid ${synergy.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}><img src={getIconUrl(synergy.icon)} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} /></div><span style={{ color: colors.text }}>{synergy.description}</span></div></td>
                      <td style={{ padding: "8px 14px" }}><Badge color={synergy.scope === "global" ? colors.positive : colors.accent}>{synergy.scope}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {tab === "masteryExp" && (() => {
            const { baseAmount } = hero.masteryExp;
            const formula = heroesData.masteryExpFormula;
            const breakpoints = formula?.breakpoints ?? [];

            function getMultiplier(level) {
              let multiplier = 1;
              for (const breakpoint of breakpoints) {
                if (level >= breakpoint.atLevel) multiplier *= breakpoint.multIncremental;
              }
              return multiplier;
            }

            function expAt(level) {
              return Math.round(baseAmount * 24 * level * getMultiplier(level));
            }

            const rows = [];
            let running = 0;
            for (let level = 1; level <= 10; level += 1) {
              const exp = expAt(level);
              running += exp;
              rows.push({ level, exp, running, repeat: false });
            }
            rows.push({ level: 11, exp: expAt(11), running: null, repeat: true });

            const totalOneToTen = rows.filter((row) => !row.repeat).reduce((sum, row) => sum + row.exp, 0);
            const clamp = (value) => Math.max(1, Math.min(10, value));
            const start = clamp(mxpStart);
            const end = clamp(Math.max(mxpEnd, mxpStart));
            const rangeTotal = rows.filter((row) => !row.repeat && row.level >= start && row.level <= end).reduce((sum, row) => sum + row.exp, 0);
            const inputStyle = { background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.text, padding: "5px 8px", fontSize: 13, fontFamily: "inherit", width: 60, textAlign: "center", outline: "none" };

            function commitStart() {
              const value = clamp(parseInt(mxpStartInput, 10) || 1);
              setMxpStart(value);
              setMxpStartInput(String(value));
              if (value > mxpEnd) {
                setMxpEnd(value);
                setMxpEndInput(String(value));
              }
            }

            function commitEnd() {
              const value = clamp(Math.max(parseInt(mxpEndInput, 10) || 1, mxpStart));
              setMxpEnd(value);
              setMxpEndInput(String(value));
            }

            return (
              <>
                <div style={{ padding: "12px 20px", borderBottom: `1px solid ${colors.border}`, background: colors.panel + "88" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div><span style={{ fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total (1-10): </span><span style={{ fontSize: 15, fontWeight: 700, color: colors.gold }}>{totalOneToTen.toLocaleString()}</span></div>
                    <div style={{ width: 1, height: 24, background: colors.border }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: colors.muted }}>From</span>
                      <input type="number" value={mxpStartInput} min={1} max={10} style={inputStyle} onChange={(event) => setMxpStartInput(event.target.value)} onBlur={commitStart} onKeyDown={(event) => event.key === "Enter" && commitStart()} />
                      <span style={{ fontSize: 12, color: colors.muted }}>to</span>
                      <input type="number" value={mxpEndInput} min={1} max={10} style={inputStyle} onChange={(event) => setMxpEndInput(event.target.value)} onBlur={commitEnd} onKeyDown={(event) => event.key === "Enter" && commitEnd()} />
                      <span style={{ fontSize: 12, color: colors.muted }}>= </span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: colors.positive }}>{rangeTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead style={{ position: "sticky", top: 0, background: colors.panel }}>
                    <tr>
                      <th style={{ padding: "8px 14px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" }}>Level</th>
                      <th style={{ padding: "8px 14px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "right", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" }}>Exp Required</th>
                      <th style={{ padding: "8px 14px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "right", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" }}>Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.level} style={{ background: row.repeat ? colors.accentDim + "33" : index % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                        <td style={{ padding: "8px 14px", color: row.repeat ? colors.accent : colors.text, fontWeight: 700 }}>{row.repeat ? "Repeat" : row.level}</td>
                        <td style={{ padding: "8px 14px", textAlign: "right", color: colors.gold, fontWeight: 600 }}>{row.exp.toLocaleString()}</td>
                        <td style={{ padding: "8px 14px", textAlign: "right", color: row.repeat ? colors.muted : colors.positive, fontWeight: 600 }}>{row.repeat ? "∞" : row.running.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function HeroCard({ hero, onClick, colors, Badge, getIconUrl }) {
  const rarityColor = RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common;

  return (
    <div
      onClick={onClick}
      style={{ background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.2)", display: "flex", gap: 12, alignItems: "center", cursor: "pointer", transition: "border-color 0.15s" }}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor = rarityColor.border;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = colors.border;
      }}
    >
      <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: rarityColor.bg, border: `2px solid ${rarityColor.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {hero.heroIcon ? <img src={getIconUrl(hero.heroIcon)} alt={hero.name} style={{ width: 48, height: 48, objectFit: "contain" }} /> : <span style={{ fontSize: 20, fontWeight: 800, color: "#ffffff99", textTransform: "uppercase", userSelect: "none" }}>{hero.name.charAt(0)}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
          <span style={{ color: colors.text, fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{hero.name}</span>
          <Badge color={rarityColor.border}>{hero.rarity}</Badge>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: colors.muted, textTransform: "capitalize" }}>{hero.class}</span>
        </div>
        {hero.skill && <div style={{ fontSize: 12, color: colors.muted }}><span style={{ color: colors.accent, fontWeight: 600 }}>{hero.skill.name}</span><span style={{ marginLeft: 6 }}>· {hero.skill.cooldown}s CD</span></div>}
        {hero.baseStats && (
          <div style={{ display: "flex", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
            {hero.baseStats.damage !== undefined && <span style={{ fontSize: 11, color: colors.muted }}>DMG <span style={{ color: colors.gold, fontWeight: 700 }}>{hero.baseStats.damage}</span></span>}
            {hero.baseStats.attackSpeed !== undefined && <span style={{ fontSize: 11, color: colors.muted }}>SPD <span style={{ color: colors.gold, fontWeight: 700 }}>{hero.baseStats.attackSpeed}s</span></span>}
            {hero.baseStats.range !== undefined && <span style={{ fontSize: 11, color: colors.muted }}>RNG <span style={{ color: colors.gold, fontWeight: 700 }}>{hero.baseStats.range}</span></span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function AllHeroesRoute({ colors, Badge, getIconUrl }) {
  const [selectedHero, setSelectedHero] = useState(null);
  const heroes = heroesData.heroes ?? [];

  const grouped = RARITY_ORDER.reduce((accumulator, rarity) => {
    const list = heroes.filter((hero) => hero.rarity === rarity).sort((left, right) => left.order - right.order);
    if (list.length) accumulator[rarity] = list;
    return accumulator;
  }, {});

  heroes.forEach((hero) => {
    if (!RARITY_ORDER.includes(hero.rarity) && !grouped[hero.rarity]) {
      grouped[hero.rarity] = heroes.filter((candidate) => candidate.rarity === hero.rarity).sort((left, right) => left.order - right.order);
    }
  });

  return (
    <div>
      {Object.entries(grouped).map(([rarity, list]) => {
        const rarityColor = RARITY_COLORS[rarity] ?? RARITY_COLORS.Common;
        return (
          <div key={rarity} style={{ marginBottom: 32 }}>
            <div style={{ background: `linear-gradient(180deg, ${rarityColor.bg}cc 0%, ${rarityColor.bg}88 100%)`, border: `1px solid ${rarityColor.border}`, borderRadius: 8, padding: "8px 20px", marginBottom: 14, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: rarityColor.text, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{rarity}</span>
            </div>
            <div className="hero-grid">
              {list.map((hero) => <HeroCard key={hero.id} hero={hero} onClick={() => setSelectedHero(hero)} colors={colors} Badge={Badge} getIconUrl={getIconUrl} />)}
            </div>
          </div>
        );
      })}
      {selectedHero && <HeroModal hero={selectedHero} onClose={() => setSelectedHero(null)} colors={colors} Badge={Badge} getIconUrl={getIconUrl} />}
    </div>
  );
}

export function AllSynergiesRoute({ colors, Badge, getIconUrl }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("both");
  const [tier, setTier] = useState(new Set());
  const [hero, setHero] = useState("all");

  const allSynergies = useMemo(() => {
    const entries = [];
    for (const heroEntry of heroesData.heroes ?? []) {
      for (const synergy of heroEntry.synergies ?? []) {
        entries.push({ hero: heroEntry, synergy });
      }
    }
    return entries;
  }, []);

  const filtered = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    return allSynergies.filter(({ hero: heroEntry, synergy }) => {
      if (scope !== "both" && synergy.scope !== scope) return false;
      if (tier.size > 0 && !tier.has(synergy.tier)) return false;
      if (hero !== "all" && heroEntry.id !== hero) return false;
      if (!loweredQuery) return true;
      return heroEntry.name.toLowerCase().includes(loweredQuery) || synergy.description.toLowerCase().includes(loweredQuery) || synergy.name.toLowerCase().includes(loweredQuery) || synergy.type.toLowerCase().includes(loweredQuery) || [synergy.hero1, synergy.hero2, synergy.hero3].filter(Boolean).some((partner) => partner.toLowerCase().includes(loweredQuery));
    });
  }, [allSynergies, hero, query, scope, tier]);

  const headerStyle = { padding: "8px 12px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" };

  return (
    <div>
      <SearchBar colors={colors} value={query} onChange={setQuery} placeholder="Search by hero, bonus, or required hero..." />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <ScopeFilter colors={colors} value={scope} onChange={setScope} />
        <TierFilter value={tier} onChange={setTier} />
        <HeroDropdown colors={colors} value={hero} onChange={setHero} />
      </div>
      <div style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>
      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ position: "sticky", top: 0, background: colors.panel, zIndex: 1 }}>
            <tr>
              <th style={headerStyle}>Hero</th>
              <th style={headerStyle}>Tier</th>
              <th style={headerStyle}>Rank Req</th>
              <th style={headerStyle}>Required Heroes</th>
              <th style={headerStyle}>Bonus</th>
              <th style={headerStyle}>Scope</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ hero: heroEntry, synergy }, index) => {
              const rarityColor = RARITY_COLORS[heroEntry.rarity] ?? RARITY_COLORS.Common;
              const tierColor = TIER_COLORS[synergy.tier] ?? TIER_COLORS.I;
              const partners = [synergy.hero1, synergy.hero2, synergy.hero3].filter(Boolean);
              return (
                <tr key={`${heroEntry.id}-${synergy.synergyLevel}`} style={{ background: index % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                  <td style={{ padding: "8px 12px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: 5, background: rarityColor.bg, border: `1px solid ${rarityColor.border}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{heroEntry.heroIcon && <img src={getIconUrl(heroEntry.heroIcon)} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />}</div><span style={{ color: colors.text, fontWeight: 600, whiteSpace: "nowrap" }}>{heroEntry.name}</span></div></td>
                  <td style={{ padding: "8px 12px" }}><span style={{ background: tierColor.bg, border: `1px solid ${tierColor.border}`, color: tierColor.text, borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{synergy.tier}</span></td>
                  <td style={{ padding: "8px 12px", color: colors.gold, fontWeight: 600 }}>{synergy.rankRequired > 0 ? synergy.rankRequired : "-"}</td>
                  <td style={{ padding: "8px 12px" }}><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{partners.map((partner) => <span key={partner} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "1px 7px", fontSize: 11, color: colors.text, textTransform: "capitalize" }}>{partner}</span>)}</div></td>
                  <td style={{ padding: "8px 12px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 26, height: 26, borderRadius: 5, background: synergy.bgColor + "44", border: `1px solid ${synergy.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}><img src={getIconUrl(synergy.icon)} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} /></div><span style={{ color: colors.text }}>{synergy.description}</span></div></td>
                  <td style={{ padding: "8px 12px" }}><Badge color={synergy.scope === "global" ? colors.positive : colors.accent}>{synergy.scope}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 32, textAlign: "center", color: colors.muted, fontSize: 14 }}>No synergies match your search.</div>}
      </div>
    </div>
  );
}

export function AllMilestonesRoute({ colors, Badge, getIconUrl }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("both");
  const [minReq, setMinReq] = useState("");
  const [maxReq, setMaxReq] = useState("");

  const allMilestones = useMemo(() => {
    const entries = [];
    for (const hero of heroesData.heroes ?? []) {
      for (const milestone of hero.milestones ?? []) {
        entries.push({ hero, milestone });
      }
    }
    return entries;
  }, []);

  const filtered = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    const min = minReq !== "" ? parseInt(minReq, 10) : null;
    const max = maxReq !== "" ? parseInt(maxReq, 10) : null;

    return allMilestones.filter(({ hero, milestone }) => {
      if (scope !== "both" && milestone.scope !== scope) return false;
      if (min !== null && milestone.requirement < min) return false;
      if (max !== null && milestone.requirement > max) return false;
      if (!loweredQuery) return true;
      return hero.name.toLowerCase().includes(loweredQuery) || milestone.description.toLowerCase().includes(loweredQuery) || milestone.name.toLowerCase().includes(loweredQuery) || milestone.type.toLowerCase().includes(loweredQuery);
    });
  }, [allMilestones, maxReq, minReq, query, scope]);

  const headerStyle = { padding: "8px 12px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" };
  const inputStyle = { background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.text, padding: "5px 10px", fontSize: 13, fontFamily: "inherit", width: 90, textAlign: "center", outline: "none" };

  return (
    <div>
      <SearchBar colors={colors} value={query} onChange={setQuery} placeholder="Search by hero or bonus..." />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <ScopeFilter colors={colors} value={scope} onChange={setScope} />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Req Level</span>
          <input type="number" placeholder="Min" value={minReq} onChange={(event) => setMinReq(event.target.value)} style={inputStyle} />
          <span style={{ color: colors.muted, fontSize: 13 }}>-</span>
          <input type="number" placeholder="Max" value={maxReq} onChange={(event) => setMaxReq(event.target.value)} style={inputStyle} />
          {(minReq || maxReq) && <button onClick={() => { setMinReq(""); setMaxReq(""); }} style={{ background: "none", border: "none", color: colors.muted, fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>}
        </div>
      </div>
      <div style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>
      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ position: "sticky", top: 0, background: colors.panel, zIndex: 1 }}>
            <tr>
              <th style={headerStyle}>Hero</th>
              <th style={headerStyle}>#</th>
              <th style={headerStyle}>Req Level</th>
              <th style={headerStyle}>Bonus</th>
              <th style={headerStyle}>Scope</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ hero, milestone }, index) => {
              const rarityColor = RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common;
              return (
                <tr key={`${hero.id}-${milestone.milestone}`} style={{ background: index % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                  <td style={{ padding: "8px 12px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: 5, background: rarityColor.bg, border: `1px solid ${rarityColor.border}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{hero.heroIcon && <img src={getIconUrl(hero.heroIcon)} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />}</div><span style={{ color: colors.text, fontWeight: 600, whiteSpace: "nowrap" }}>{hero.name}</span></div></td>
                  <td style={{ padding: "8px 12px", color: colors.accent, fontWeight: 700 }}>{milestone.milestone}</td>
                  <td style={{ padding: "8px 12px", color: colors.gold, fontWeight: 600 }}>{milestone.requirement.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 26, height: 26, borderRadius: 5, background: milestone.bgColor + "44", border: `1px solid ${milestone.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}><img src={getIconUrl(milestone.icon)} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} /></div><span style={{ color: colors.text }}>{milestone.description}</span></div></td>
                  <td style={{ padding: "8px 12px" }}><Badge color={milestone.scope === "global" ? colors.positive : colors.accent}>{milestone.scope}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 32, textAlign: "center", color: colors.muted, fontSize: 14 }}>No milestones match your search.</div>}
      </div>
    </div>
  );
}

function MapModal({ map, onClose, mapPerkMult, colors, Badge, getIconUrl }) {
  const hasVariants = map.astralVariants?.length > 0;
  const [tab, setTab] = useState("perks");
  const [variantIdx, setVariantIdx] = useState(0);
  const [groupLevels, setGroupLevels] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("astral_group_levels") ?? "{}");
    } catch {
      return {};
    }
  });

  function setGroupLevel(enumName, value) {
    const next = { ...groupLevels, [enumName]: value };
    setGroupLevels(next);
    localStorage.setItem("astral_group_levels", JSON.stringify(next));
  }

  const totalUnlock = map.perks.reduce((sum, perk) => sum + (perk.unlockCost ?? 0), 0);
  const totalUpgrades = map.perks.reduce((sum, perk) => {
    const breakpoint = 5;
    const upgradeCost = perk.upgradeCost ?? perk.baseCost;
    return sum + upgradeCost * Math.min(perk.maxLevel, breakpoint) + upgradeCost * 2 * Math.max(0, perk.maxLevel - breakpoint);
  }, 0);
  const grandTotal = totalUnlock + totalUpgrades;
  const totalPlacement = (mapsData.placementBonuses ?? []).reduce((sum, bonus) => sum + bonus.baseCost * bonus.breakpoint + bonus.upgradeCostHigh * (bonus.maxLevel - bonus.breakpoint), 0);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(event) => event.stopPropagation()} style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, width: "100%", maxWidth: 560, height: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ borderBottom: `1px solid ${colors.border}`, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, position: "relative", backgroundImage: `url(${getIconUrl(map.icon)})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,25,45,0.82)", pointerEvents: "none" }} />
          <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: colors.text }}>{map.name}</div>
            {map.waveRequirement > 0 ? <div style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>Wave {map.waveRequirement.toLocaleString()} · {map.gemsToUnlock.toLocaleString()} Gems to unlock</div> : <div style={{ fontSize: 12, color: colors.positive, marginTop: 3 }}>Available from start</div>}
            <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
              {[{ label: "Map Perks", value: grandTotal }, { label: "Placement", value: totalPlacement }, { label: "Total", value: grandTotal + totalPlacement, highlight: true }].map(({ label, value, highlight }) => (
                <div key={label}><div style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div><div style={{ fontSize: 13, fontWeight: 700, color: highlight ? colors.accent : colors.gold }}>{value.toLocaleString()}</div></div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: colors.muted, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ display: "flex", borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
          {[{ key: "perks", label: "Map Perks" }, { key: "placement", label: "Placement" }, ...(hasVariants ? [{ key: "variants", label: "Variants" }] : [])].map((tabOption) => (
            <button key={tabOption.key} onClick={() => setTab(tabOption.key)} style={{ flex: 1, background: "none", border: "none", borderBottom: tab === tabOption.key ? `2px solid ${colors.accent}` : "2px solid transparent", color: tab === tabOption.key ? colors.accent : colors.muted, fontFamily: "inherit", fontWeight: 700, fontSize: 13, padding: "10px 0", cursor: "pointer", transition: "color 0.15s" }}>{tabOption.label}</button>
          ))}
        </div>

        <div style={{ overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 0 }}>
          {tab === "perks" && (
            <>
              {map.perks.map((perk) => {
                const unit = getPerkUnit(perk.name);
                const breakpoint = 5;
                const upgradeCost = perk.upgradeCost ?? perk.baseCost;
                const rows = [{ level: "Unlock", cost: perk.unlockCost ?? null, cumulative: perk.unlockCost ?? 0, bonus: perk.baseAmt }];
                let cumulative = perk.unlockCost ?? 0;
                for (let level = 1; level <= perk.maxLevel; level += 1) {
                  const stepCost = level <= breakpoint ? upgradeCost : upgradeCost * 2;
                  cumulative += stepCost;
                  rows.push({ level, cost: stepCost, cumulative, bonus: perk.baseAmt + perk.statAmt * level });
                }
                const headerStyle = { padding: "5px 8px", color: colors.muted, fontWeight: 700, fontSize: 12, borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.05em", textTransform: "uppercase" };

                return (
                  <div key={perk.id} style={{ paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${colors.border}40` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>{perk.name}</span>{perk.isDefault && <Badge color={colors.positive}>Default</Badge>}</div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>{perk.waveReq > 0 && <Badge color={colors.accent}>Wave {(perk.waveReq / 1000).toFixed(0)}K</Badge>}<Badge color={colors.muted}>Max Lv {perk.maxLevel}</Badge></div>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead><tr style={{ background: colors.panel }}><th style={{ ...headerStyle, textAlign: "left" }}>Level</th><th style={{ ...headerStyle, textAlign: "right" }}>Cost</th><th style={{ ...headerStyle, textAlign: "right" }}>Total Cost</th><th style={{ ...headerStyle, textAlign: "right" }}>Bonus{mapPerkMult > 1.0001 ? <span style={{ color: colors.positive, fontWeight: 400 }}> ×{mapPerkMult.toFixed(2)}</span> : ""}</th></tr></thead>
                      <tbody>
                        {rows.map((row, index) => {
                          const boosted = row.bonus * mapPerkMult;
                          const boostedValue = Number.isInteger(Math.round(boosted * 10) / 10) ? String(Math.round(boosted)) : boosted.toFixed(1);
                          return (
                            <tr key={index} style={{ background: index % 2 === 0 ? "transparent" : colors.panel + "50" }}>
                              <td style={{ padding: "4px 8px", color: row.level === "Unlock" ? colors.muted : colors.accent, fontWeight: 600 }}>{row.level}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", color: row.cost ? colors.gold : colors.muted, fontFamily: "monospace" }}>{row.cost ?? "-"}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", color: colors.text, fontFamily: "monospace" }}>{row.cumulative}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", color: colors.positive, fontWeight: 600 }}>{boostedValue}{unit}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {map.negativePerk && (
                <div style={{ paddingTop: 14, marginTop: 4, borderTop: `1px solid #e0555533` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><span style={{ fontWeight: 700, fontSize: 14, color: "#e05555" }}>{map.negativePerk.name}</span><Badge color="#e05555">Penalty</Badge></div>
                  <div style={{ fontSize: 12, color: colors.muted }}>Per level <span style={{ color: "#e05555", fontWeight: 600 }}>{map.negativePerk.statAmt}{getPerkUnit(map.negativePerk.name)}</span></div>
                </div>
              )}
            </>
          )}

          {tab === "variants" && hasVariants && (() => {
            const variant = map.astralVariants[variantIdx];
            const accentColor = ASTRAL_COLORS[variant.enumName] ?? "#b47aff";
            const groupPerk = map.perks.find((perk) => perk.id.includes(variant.enumName));
            const rawGroupLevel = parseInt(groupLevels[variant.enumName], 10) || 0;
            const groupLevel = groupPerk ? Math.min(Math.max(0, rawGroupLevel), groupPerk.maxLevel) : 0;
            const groupMultiplier = groupPerk ? 1 + (groupLevel * groupPerk.statAmt) / 100 : 1;
            const groupBonus = groupPerk ? groupLevel * groupPerk.statAmt : 0;
            return (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {map.astralVariants.map((variantEntry, index) => {
                    const color = ASTRAL_COLORS[variantEntry.enumName] ?? "#b47aff";
                    const active = index === variantIdx;
                    return <button key={variantEntry.enumValue} onClick={() => setVariantIdx(index)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${active ? color : color + "44"}`, background: active ? color + "55" : color + "11", color: active ? "#fff" : color + "99", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", transition: "all 0.15s" }}>{variantEntry.displayName.replace(/ Day$/i, "")}</button>;
                  })}
                </div>
                <div style={{ padding: "12px 14px", background: colors.header, borderRadius: 8, border: `1px solid ${colors.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: accentColor, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{variant.displayName.replace(/ Day$/i, "")}</div>
                  {groupPerk && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${colors.border}40` }}>
                      <span style={{ fontSize: 12, color: colors.muted, flex: 1 }}>{groupPerk.name} Level</span>
                      <input type="number" min={0} max={groupPerk.maxLevel} value={groupLevels[variant.enumName] ?? ""} onChange={(event) => setGroupLevel(variant.enumName, event.target.value)} style={{ width: 52, background: colors.panel, border: `1px solid ${rawGroupLevel > groupPerk.maxLevel ? "#e05555" : colors.border}`, borderRadius: 6, color: colors.text, fontFamily: "inherit", fontSize: 13, padding: "3px 6px", textAlign: "center" }} />
                      <span style={{ fontSize: 12, color: colors.muted }}>/ {groupPerk.maxLevel}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: groupBonus > 0 ? accentColor : colors.muted, minWidth: 52, textAlign: "right" }}>{groupBonus > 0 ? `+${groupBonus}% all` : "no bonus"}</span>
                    </div>
                  )}
                  {variant.effects.map((effect, index) => {
                    const negativeIsGood = new Set(["skillCooldown", "spellCooldown"]);
                    const isDebuff = negativeIsGood.has(effect.statKey) ? effect.amount > 0 : effect.amount < 0;
                    const sign = effect.amount > 0 ? "+" : "";
                    const unit = effect.unit === "pct" ? "%" : "";
                    const rawAmount = isDebuff ? effect.amount : effect.amount * mapPerkMult * groupMultiplier;
                    const displayAmount = Number.isInteger(Math.round(rawAmount * 10) / 10) ? Math.round(rawAmount) : parseFloat(rawAmount.toFixed(1));
                    return <div key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: index < variant.effects.length - 1 ? `1px solid ${colors.border}30` : "none" }}><span style={{ fontSize: 13, color: colors.muted }}>{effect.statLabel}</span><span style={{ fontSize: 13, fontWeight: 700, color: isDebuff ? "#e05555" : colors.positive }}>{sign}{displayAmount}{unit}</span></div>;
                  })}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: colors.muted, fontStyle: "italic" }}>Active variant is set server-side and rotates daily.</div>
              </>
            );
          })()}

          {tab === "placement" && (
            <>
              {(mapsData.placementBonuses ?? []).map((bonus) => {
                const unit = getPerkUnit(bonus.name);
                const rows = [];
                let cumulative = 0;
                for (let level = 1; level <= bonus.maxLevel; level += 1) {
                  const stepCost = level <= bonus.breakpoint ? bonus.baseCost : bonus.upgradeCostHigh;
                  cumulative += stepCost;
                  rows.push({ level, cost: stepCost, cumulative, stat: bonus.statAmt * level });
                }
                const headerStyle = { padding: "4px 8px", color: colors.muted, fontWeight: 700, fontSize: 11, borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.05em", textTransform: "uppercase" };

                return (
                  <div key={bonus.id} style={{ paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${colors.border}40` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{bonus.name}</span><Badge color={colors.muted}>Max Lv {bonus.maxLevel}</Badge></div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead><tr style={{ background: colors.panel }}><th style={{ ...headerStyle, textAlign: "left" }}>Level</th><th style={{ ...headerStyle, textAlign: "right" }}>Cost</th><th style={{ ...headerStyle, textAlign: "right" }}>Total Cost</th><th style={{ ...headerStyle, textAlign: "right" }}>Bonus</th></tr></thead>
                      <tbody>
                        {rows.map((row, index) => <tr key={row.level} style={{ background: index % 2 === 0 ? "transparent" : colors.panel + "50" }}><td style={{ padding: "4px 8px", color: colors.accent, fontWeight: 600 }}>{row.level}</td><td style={{ padding: "4px 8px", textAlign: "right", color: colors.gold, fontFamily: "monospace" }}>{row.cost}</td><td style={{ padding: "4px 8px", textAlign: "right", color: colors.text, fontFamily: "monospace" }}>{row.cumulative}</td><td style={{ padding: "4px 8px", textAlign: "right", color: bonus.statAmt < 0 ? "#e05555" : colors.positive, fontWeight: 600 }}>{bonus.statAmt < 0 ? "" : "+"}{row.stat}{unit}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MapCard({ map, onClick, isMobile, mapPerkMult, colors, Badge, getIconUrl }) {
  const isLocked = map.waveRequirement > 0;
  const iconUrl = getIconUrl(map.icon);
  const hasVariants = map.astralVariants?.length > 0;
  const [variantIdx, setVariantIdx] = useState(0);

  return (
    <div
      onClick={onClick}
      style={{ border: `1px solid ${colors.border}`, borderRadius: 10, overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s", backgroundImage: `url(${iconUrl})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", position: "relative", display: "flex", flexDirection: "column" }}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor = colors.accent;
        event.currentTarget.style.boxShadow = `0 0 14px ${colors.accent}33`;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = colors.border;
        event.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,25,45,0.72)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, padding: "16px", display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: isMobile ? "none" : "0 0 160px" }}>
          <div style={{ fontWeight: 900, fontSize: isMobile ? 18 : 21, color: colors.text, lineHeight: 1.2 }}>{map.name}</div>
          {isLocked ? <><Badge color={colors.accent}>Wave: {map.waveRequirement.toLocaleString()}</Badge><Badge color="#e06aaa">Gems: {map.gemsToUnlock.toLocaleString()}</Badge></> : <Badge color={colors.positive}>Available from start</Badge>}
          {hasVariants && <Badge color="#b47aff">Perks rotate Mon &amp; Thurs</Badge>}
        </div>
        <div style={isMobile ? { height: 1, background: `${colors.border}60` } : { width: 1, background: `${colors.border}60`, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasVariants ? (() => {
            const variant = map.astralVariants[variantIdx];
            return (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }} onClick={(event) => event.stopPropagation()}>
                  {map.astralVariants.map((variantEntry, index) => {
                    const color = ASTRAL_COLORS[variantEntry.enumName] ?? "#b47aff";
                    const active = index === variantIdx;
                    return <button key={variantEntry.enumValue} onClick={() => setVariantIdx(index)} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${active ? color : color + "44"}`, background: active ? color + "55" : color + "11", color: active ? "#fff" : color + "99", fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", lineHeight: 1.4 }}>{variantEntry.displayName.replace(/ Day$/i, "")}</button>;
                  })}
                </div>
                {variant.effects.map((effect, index) => {
                  const isLast = index === variant.effects.length - 1;
                  const sign = effect.amount > 0 ? "+" : "";
                  const unit = effect.unit === "pct" ? "%" : "";
                  const color = isLast ? "#e05555" : colors.positive;
                  const rawAmount = isLast ? effect.amount : effect.amount * mapPerkMult;
                  const displayAmount = Number.isInteger(Math.round(rawAmount * 10) / 10) ? Math.round(rawAmount) : parseFloat(rawAmount.toFixed(1));
                  return <div key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 5 }}><span style={{ fontSize: 15, color }}>{effect.statLabel}</span><span style={{ fontSize: 15, fontWeight: 700, color, flexShrink: 0 }}>{sign}{displayAmount}{unit}</span></div>;
                })}
              </>
            );
          })() : (() => {
            const defaults = map.perks.filter((perk) => perk.isDefault);
            return (
              <>
                <div style={{ fontSize: 13, fontWeight: 800, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Default Perks</div>
                {defaults.length === 0 ? <span style={{ fontSize: 15, color: colors.muted, fontStyle: "italic" }}>None</span> : defaults.map((perk) => {
                  const boosted = perk.baseAmt * mapPerkMult;
                  const boostedValue = Number.isInteger(Math.round(boosted * 10) / 10) ? String(Math.round(boosted)) : boosted.toFixed(1);
                  return <div key={perk.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}><span style={{ fontSize: 15, color: colors.positive }}>{perk.name}</span><span style={{ fontSize: 15, color: colors.positive, fontWeight: 700, flexShrink: 0 }}>{boostedValue}{getPerkUnit(perk.name)}</span></div>;
                })}
                {map.negativePerk && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}><span style={{ fontSize: 15, color: "#e05555" }}>{map.negativePerk.name}</span><span style={{ fontSize: 15, color: "#e05555", fontWeight: 700, flexShrink: 0 }}>{map.negativePerk.statAmt}{getPerkUnit(map.negativePerk.name)}</span></div>}
              </>
            );
          })()}
        </div>
      </div>
      <div style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${colors.border}40`, padding: "6px 16px", textAlign: "center" }}><span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.05em" }}>Click for details</span></div>
    </div>
  );
}

export function AllMapsRoute({ colors, Badge, getIconUrl }) {
  const [selectedMap, setSelectedMap] = useState(null);
  const isMobile = useIsMobile();
  const [mpLevels, setMpLevels] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mapPerkUpgrades"));
      if (saved && typeof saved === "object") return { runes: "", mastery: "", ultimus: "", ...saved };
    } catch {
      return { runes: "", mastery: "", ultimus: "" };
    }
    return { runes: "", mastery: "", ultimus: "" };
  });
  const [wave35k, setWave35k] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mapPerkWave35k")) ?? false;
    } catch {
      return false;
    }
  });

  function setMpLevel(id, value) {
    setMpLevels((previous) => {
      const next = { ...previous, [id]: value };
      localStorage.setItem("mapPerkUpgrades", JSON.stringify(next));
      return next;
    });
  }

  function setAllMax() {
    const next = Object.fromEntries(MAP_PERK_UPGRADE_SOURCES.map((source) => [source.id, String(source.maxLevel)]));
    localStorage.setItem("mapPerkUpgrades", JSON.stringify(next));
    setMpLevels(next);
  }

  function isOverMax(id) {
    const source = MAP_PERK_UPGRADE_SOURCES.find((entry) => entry.id === id);
    const value = parseInt(mpLevels[id], 10);
    return !Number.isNaN(value) && mpLevels[id] !== "" && value > source.maxLevel;
  }

  function toggleWave35k(value) {
    setWave35k(value);
    localStorage.setItem("mapPerkWave35k", JSON.stringify(value));
  }

  const mapPerkMult = MAP_PERK_UPGRADE_SOURCES.reduce((accumulator, source) => {
    const level = Math.min(Math.max(0, parseInt(mpLevels[source.id], 10) || 0), source.maxLevel);
    return accumulator * (1 + (source.statAmt * level) / 100);
  }, 1) * (wave35k ? 1.1 : 1);

  const hasBoost = mapPerkMult > 1.0001;
  const multDisplay = `+${((mapPerkMult - 1) * 100).toFixed(2)}%`;
  const inputStyle = { background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.text, padding: "5px 8px", fontSize: 13, fontFamily: "inherit", width: 68, textAlign: "center", outline: "none" };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>All Maps</div>
        <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Click a map to see full perk details</div>
      </div>

      <div style={{ marginBottom: 20, display: "inline-block", minWidth: isMobile ? "100%" : 320 }}>
        <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>Map Perk Upgrades</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={setAllMax} style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}44`, color: colors.accent, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Max</button>
              <button onClick={() => { const empty = { runes: "", mastery: "", ultimus: "" }; setMpLevels(empty); localStorage.setItem("mapPerkUpgrades", JSON.stringify(empty)); toggleWave35k(false); }} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.muted, borderRadius: 6, padding: "2px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Clear</button>
            </div>
          </div>

          {MAP_PERK_UPGRADE_SOURCES.map((source) => {
            const over = isOverMax(source.id);
            const level = Math.min(Math.max(0, parseInt(mpLevels[source.id], 10) || 0), source.maxLevel);
            const percent = source.statAmt * level;
            return (
              <div key={source.id} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: colors.muted, minWidth: 70 }}>{source.label}</span>
                  <input type="number" min={0} max={source.maxLevel} value={mpLevels[source.id]} onChange={(event) => setMpLevel(source.id, event.target.value)} style={{ ...inputStyle, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                  <span style={{ fontSize: 12, color: colors.muted }}>/ {source.maxLevel}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: percent > 0 ? colors.positive : colors.muted, marginLeft: "auto" }}>+{percent}%</span>
                </div>
                {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 78 }}>Max is {source.maxLevel}</div>}
              </div>
            );
          })}

          <div style={{ marginBottom: 7 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={wave35k} onChange={(event) => toggleWave35k(event.target.checked)} style={{ width: 15, height: 15, cursor: "pointer", accentColor: colors.accent }} />
              <span style={{ fontSize: 13, color: colors.muted }}>Wave 35k+ Challenge on all 7 Maps</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: wave35k ? colors.positive : colors.muted, marginLeft: "auto" }}>+10%</span>
            </label>
          </div>

          <div style={{ borderTop: `1px solid ${colors.border}44`, marginTop: 6, paddingTop: 6 }}>
            <span style={{ fontSize: 13, color: colors.muted }}>Total bonus: </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: hasBoost ? colors.positive : colors.muted }}>{multDisplay}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 20, gridAutoRows: "minmax(200px, auto)" }}>
        {mapsData.maps.map((map) => <MapCard key={map.id} map={map} isMobile={isMobile} mapPerkMult={mapPerkMult} onClick={() => setSelectedMap(map)} colors={colors} Badge={Badge} getIconUrl={getIconUrl} />)}
      </div>

      {selectedMap && <MapModal map={selectedMap} onClose={() => setSelectedMap(null)} mapPerkMult={mapPerkMult} colors={colors} Badge={Badge} getIconUrl={getIconUrl} />}
    </div>
  );
}

/* ─── Masteries ─── */

const MASTERY_BREAKPOINTS = [
  { atLevel: 6, multIncremental: 1.1 },
  { atLevel: 9, multIncremental: 1.1 },
  { atLevel: 11, multIncremental: 1.2 },
];

function computeMasteryExpTable(baseAmount, maxLevel) {
  const rows = [];
  let cumulative = 0;
  for (let level = 1; level <= maxLevel; level++) {
    let mult = 1;
    for (const bp of MASTERY_BREAKPOINTS) {
      if (level >= bp.atLevel) mult *= bp.multIncremental;
    }
    const exp = Math.round(baseAmount * 24 * level * mult);
    cumulative += exp;
    rows.push({ level, exp, cumulative });
  }
  return rows;
}

function classifyMasteryCondition(description) {
  if (!description) return "—";
  const d = description.toLowerCase();
  if (/\bkill(s|ed)?\b/.test(d)) return "Kill";
  if (/\bhit(s)?\b|\btagged\b|\battack(s|ed)?\b|\bstrike\b|\bbleeding\b|\bstunned\b|\bslowed\b|\bconfused\b|\bteleported\b|\bimmolation\b/.test(d)) return "Tag";
  if (/\bgain(s)?\b|\bincreas(e|ed|es)\b|\bboost\b|\bbuff\b/.test(d)) return "Buff";
  return "Passive";
}

function classifyMasteryScope(description) {
  if (!description) return "—";
  const d = description.toLowerCase();
  if (/all heroes within range/.test(d) || /heroes within range/.test(d) || /each enemy (killed |tagged )?within range/.test(d)) return "Aura";
  if (/\bskill('s)?\b|\bthe skill\b|\bthis skill\b/.test(d)) return "Self Skill";
  return "Self";
}

function deriveMasteryTags(hero) {
  const tags = new Set();
  const desc = (hero.masteryDescription ?? "").toLowerCase();
  if (/\bgold\b/.test(desc)) tags.add("gold");
  if (/\benergy\b/.test(desc)) tags.add("energy");
  if (/\bexp\b|\bexperience\b/.test(desc)) tags.add("exp");
  if (/\bdamage\b|\bbleed\b|\bimmolation\b/.test(desc)) tags.add("damage");
  if (/\bcrit\b/.test(desc)) tags.add("crit");
  if (/\battack speed\b|\btriple.shot\b|\bmulti.shot\b/.test(desc)) tags.add("speed");
  if (/\bsplash\b|\bcleave\b/.test(desc)) tags.add("splash");
  if (/\bstun\b/.test(desc)) tags.add("stun");
  if (/\bslow\b/.test(desc)) tags.add("slow");
  if (/\bcooldown\b/.test(desc)) tags.add("cooldown");
  if (/\bconfuse\b/.test(desc)) tags.add("confuse");
  if (/\bteleport\b/.test(desc)) tags.add("teleport");
  if (/\brange\b.*distance/.test(desc)) tags.add("range");
  if (/\bexecut/.test(desc)) tags.add("execute");
  if (/\bchance\b.*\bmaximum\b|\bmaximum\b.*\bchance\b|\blucky\b/.test(desc)) tags.add("luck");
  return [...tags];
}

const MASTERY_TAG_COLORS = {
  gold: "#ffd040",
  energy: "#2ecc71",
  exp: "#4488ee",
  damage: "#e05555",
  crit: "#ff8800",
  speed: "#00cc00",
  splash: "#cc66ff",
  stun: "#00cccc",
  slow: "#00aacc",
  cooldown: "#33cccc",
  confuse: "#dd66aa",
  teleport: "#aa44ff",
  range: "#cccc00",
  execute: "#cc3333",
  luck: "#ff66ff",
};

const CLASS_DISPLAY = { melee: "Melee", mage: "Mage", range: "Range" };

function MasteryModal({ hero, onClose, colors, getIconUrl }) {
  const rows = computeMasteryExpTable(hero.masteryExp.baseAmount, hero.masteryExp.maxLevel);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 0, maxWidth: 520, width: "100%", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${colors.border}`, background: colors.header }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, background: (RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common).bg, border: `1px solid ${(RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common).border}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <img src={getIconUrl(hero.heroIcon)} alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{hero.name} — Mastery</div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{hero.masteryDescription}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: colors.muted, fontSize: 22, cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}>✕</button>
        </div>
        {/* Table */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, background: colors.panel, zIndex: 1 }}>
              <tr>
                <th style={{ padding: "8px 12px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "center", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" }}>Level</th>
                <th style={{ padding: "8px 12px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "right", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" }}>Exp Required</th>
                <th style={{ padding: "8px 12px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "right", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" }}>Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.level} style={{ background: idx % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                  <td style={{ padding: "8px 12px", textAlign: "center", color: colors.accent, fontWeight: 700 }}>{row.level}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: colors.text, fontFamily: "monospace" }}>{row.exp.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: colors.gold, fontFamily: "monospace" }}>{row.cumulative.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${colors.border}` }}>
                <td style={{ padding: "10px 12px", fontWeight: 700, color: colors.text, textAlign: "center" }}>Total</td>
                <td />
                <td style={{ padding: "10px 12px", textAlign: "right", color: colors.gold, fontWeight: 700, fontFamily: "monospace" }}>{rows[rows.length - 1]?.cumulative.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AllMasteriesRoute({ colors, Badge, getIconUrl }) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [selectedHero, setSelectedHero] = useState(null);

  const heroes = heroesData.heroes ?? [];

  const enriched = useMemo(() =>
    heroes.map((hero) => ({
      hero,
      heroClass: CLASS_DISPLAY[hero.class] ?? hero.class,
      condition: classifyMasteryCondition(hero.masteryDescription),
      scope: classifyMasteryScope(hero.masteryDescription),
      tags: deriveMasteryTags(hero),
    })).sort((a, b) => a.hero.order - b.hero.order),
    [heroes],
  );

  const filtered = useMemo(() => {
    const lq = query.trim().toLowerCase();
    return enriched.filter((entry) => {
      if (classFilter !== "all" && entry.hero.class !== classFilter) return false;
      if (!lq) return true;
      return (
        entry.hero.name.toLowerCase().includes(lq) ||
        entry.heroClass.toLowerCase().includes(lq) ||
        entry.condition.toLowerCase().includes(lq) ||
        entry.scope.toLowerCase().includes(lq) ||
        entry.tags.some((t) => t.toLowerCase().includes(lq)) ||
        (entry.hero.masteryDescription ?? "").toLowerCase().includes(lq)
      );
    });
  }, [enriched, query, classFilter]);

  const headerStyle = { padding: "8px 12px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" };
  const CLASS_COLORS = { melee: "#e05555", mage: "#7d7cff", range: "#2ecc71" };

  return (
    <div>
      <SearchBar colors={colors} value={query} onChange={setQuery} placeholder="Search by name, class, condition, scope, or tag..." />
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: colors.muted, fontWeight: 600 }}>Class:</span>
        {["all", "melee", "mage", "range"].map((c) => (
          <button key={c} onClick={() => setClassFilter(c)} style={{ background: classFilter === c ? (c === "all" ? colors.accent + "33" : (CLASS_COLORS[c] ?? colors.accent) + "33") : "transparent", border: `1px solid ${classFilter === c ? (c === "all" ? colors.accent : CLASS_COLORS[c] ?? colors.accent) : colors.border}`, color: classFilter === c ? (c === "all" ? colors.accent : CLASS_COLORS[c] ?? colors.accent) : colors.muted, borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
            {c === "all" ? "All" : CLASS_DISPLAY[c] ?? c}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>{filtered.length} hero{filtered.length !== 1 ? "es" : ""}</div>
      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: isMobile ? 700 : undefined }}>
          <thead style={{ position: "sticky", top: 0, background: colors.panel, zIndex: 1 }}>
            <tr>
              <th style={headerStyle}>Hero</th>
              <th style={headerStyle}>Class</th>
              <th style={headerStyle}>Condition</th>
              <th style={headerStyle}>Scope</th>
              <th style={{ ...headerStyle, minWidth: 200 }}>Description</th>
              <th style={headerStyle}>Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ hero, heroClass, condition, scope, tags }, idx) => {
              const rarityColor = RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common;
              return (
                <tr key={hero.id} onClick={() => setSelectedHero(hero)} style={{ background: idx % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22`, cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = colors.accent + "18")} onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : colors.panel + "60")}>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: rarityColor.bg, border: `1px solid ${rarityColor.border}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {hero.heroIcon && <img src={getIconUrl(hero.heroIcon)} alt="" style={{ width: 30, height: 30, objectFit: "contain" }} />}
                      </div>
                      <span style={{ color: colors.text, fontWeight: 600, whiteSpace: "nowrap" }}>{hero.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}><Badge color={CLASS_COLORS[hero.class] ?? colors.accent}>{heroClass}</Badge></td>
                  <td style={{ padding: "8px 12px", color: colors.text }}>{condition}</td>
                  <td style={{ padding: "8px 12px", color: colors.text }}>{scope}</td>
                  <td style={{ padding: "8px 12px", color: colors.muted, fontSize: 12, lineHeight: 1.4, maxWidth: 320 }}>{hero.masteryExpRequirement}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {tags.map((tag) => (
                        <span key={tag} style={{ background: (MASTERY_TAG_COLORS[tag] ?? colors.accent) + "22", color: MASTERY_TAG_COLORS[tag] ?? colors.accent, border: `1px solid ${(MASTERY_TAG_COLORS[tag] ?? colors.accent)}44`, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 600, textTransform: "capitalize" }}>{tag}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 32, textAlign: "center", color: colors.muted, fontSize: 14 }}>No heroes match your search.</div>}
      </div>
      {selectedHero && <MasteryModal hero={selectedHero} onClose={() => setSelectedHero(null)} colors={colors} getIconUrl={getIconUrl} />}
    </div>
  );
}