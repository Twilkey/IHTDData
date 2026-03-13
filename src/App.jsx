import { useState, useMemo } from "react";

import researchData   from "./data/research.json";
import spellsData     from "./data/spells.json";
import powerupsData   from "./data/powerups.json";
import gemsData       from "./data/gems.json";
import masteryData    from "./data/mastery.json";
import techData       from "./data/tech.json";
import ticketsData    from "./data/tickets.json";
import tournamentData from "./data/tournament.json";
import ultimusData    from "./data/ultimus.json";
import runesData      from "./data/runes.json";
import STAT_UNITS     from "./data/stat_units.json";

// ─────────────────────────────────────────────
// NORMALIZE  — rename multCost → multiCost for
// consistency, and hoist per-item costFormula
// ─────────────────────────────────────────────
function normalizeSection(data) {
  const groups = {};
  for (const [groupName, items] of Object.entries(data.groups)) {
    groups[groupName] = items.map(item => ({
      ...item,
      multiCost: item.multCost ?? item.multiCost,
    }));
  }
  return { ...data, groups };
}

const SECTIONS = [
  { key: "research",   data: normalizeSection(researchData) },
  { key: "spells",     data: normalizeSection(spellsData) },
  { key: "powerups",   data: normalizeSection(powerupsData) },
  { key: "gems",       data: normalizeSection(gemsData) },
  { key: "mastery",    data: normalizeSection(masteryData) },
  { key: "tech",       data: normalizeSection(techData) },
  { key: "tickets",    data: normalizeSection(ticketsData) },
  { key: "tournament", data: normalizeSection(tournamentData) },
  { key: "ultimus",    data: normalizeSection(ultimusData) },
  { key: "runes",      data: normalizeSection(runesData) },
];

// ─────────────────────────────────────────────
// COST COMPUTATION
// ─────────────────────────────────────────────
function formatBigNum(n) {
  if (n === Infinity || n > 1e18) return "∞";
  if (n === 0) return "0";
  const suffixes = ["", "K", "M", "B", "T", "aa", "ab", "ac", "ad", "ae"];
  const tier = Math.max(0, Math.floor(Math.log10(Math.max(1, n)) / 3));
  if (tier === 0) return n.toFixed(0);
  return (n / Math.pow(1000, tier)).toFixed(2) + suffixes[Math.min(tier, suffixes.length - 1)];
}

function computeTotalCost(item, sectionFormula) {
  const formula = item.costFormula ?? sectionFormula;
  const { baseCost, multiCost, maxLevel, stopCostIncreaseAt } = item;

  if (baseCost === undefined || maxLevel === undefined) return null;
  if (formula === "none") return null;

  switch (formula) {
    case "flat":
      // O(1) — always computable
      return baseCost * maxLevel;

    case "power": {
      // cost(i) = baseCost × (i+1)^multiCost  for i = 0..maxLevel-1
      if (!multiCost || multiCost === 1) return baseCost * maxLevel;
      if (maxLevel > 10000) {
        // Integral approximation: sum(i^k, 1..N) ≈ N^(k+1)/(k+1)
        const approx = baseCost * Math.pow(maxLevel, multiCost + 1) / (multiCost + 1);
        return isFinite(approx) ? approx : Infinity;
      }
      let total = 0;
      for (let i = 0; i < maxLevel; i++) total += baseCost * Math.pow(i + 1, multiCost);
      return total;
    }

    case "exponential":
    case "exponential_endgame": {
      // cost(i) = baseCost × multiCost^i  for i = 0..maxLevel-1
      // Geometric series — O(1), overflows to Infinity naturally when astronomical
      if (!multiCost || multiCost === 1) return baseCost * maxLevel;
      const total = baseCost * (Math.pow(multiCost, maxLevel) - 1) / (multiCost - 1);
      return isFinite(total) ? total : Infinity;
    }

    case "capped_linear": {
      // Closed-form O(1): linear ramp up to cap, then flat at cap
      const cap = stopCostIncreaseAt ?? maxLevel;
      if (maxLevel <= cap) return baseCost * maxLevel * (maxLevel + 1) / 2;
      return baseCost * (cap * (cap + 1) / 2 + (maxLevel - cap) * cap);
    }

    default:
      return baseCost * maxLevel;
  }
}

// ─────────────────────────────────────────────
// RANK EXP FORMULA  (replaces 6000-row sheet)
// ─────────────────────────────────────────────
function rankExpForLevel(lvl) {
  let v = 1000 * Math.pow(lvl - 1, 3);
  if (lvl > 2)    v *= (1 + lvl          * 0.05);
  if (lvl > 100)  v *= (1 + (lvl - 100)  * 0.02);
  if (lvl > 250)  v *= (1 + (lvl - 250)  * 0.01);
  if (lvl > 400)  v *= (1 + (lvl - 400)  * 0.01);
  if (lvl > 500)  v *= (1 + (lvl - 500)  * 0.01);
  if (lvl > 1000) v *= (1 + (lvl - 1000) * 0.01);
  if (lvl > 1500) v *= (1 + (lvl - 1500) * 0.02);
  if (lvl > 2000) v *= (1 + (lvl - 2000) * 0.03);
  if (lvl > 2500) v *= (1 + (lvl - 2500) * 0.05);
  if (lvl > 3000) v *= (1 + (lvl - 3000) * 0.07);
  if (lvl > 3500) v *= (1 + (lvl - 3500) * 0.10);
  if (lvl > 4250) v *= (1 + (lvl - 4250) * 0.13);
  if (lvl > 4500) v *= (1 + (lvl - 4500) * 0.15);
  if (lvl > 4750) v *= (1 + (lvl - 4750) * 0.20);
  if (lvl > 5000) v *= (1 + (lvl - 5000) * 0.25);
  if (lvl > 5250) v *= (1 + (lvl - 5250) * 0.30);
  if (lvl > 5500) v *= (1 + (lvl - 5500) * 0.40);
  if (lvl > 6000) v *= (1 + (lvl - 6000) * 0.50);
  return Math.round(v);
}

// ─────────────────────────────────────────────
// STAT DISPLAY HELPERS
// ─────────────────────────────────────────────
function getStatLabel(statKey) {
  return STAT_UNITS[statKey]?.label ?? statKey;
}

function formatStat(statAmt, statKey) {
  const info = STAT_UNITS[statKey];
  if (!info) return `+${statAmt}`;
  const { unit } = info;
  if (unit === "%") return `+${statAmt}%`;
  if (unit === "x") return `×${statAmt}`;
  return `+${statAmt} ${unit}`;
}


// ─────────────────────────────────────────────
// COLORS  — based on in-game UI palette
// ─────────────────────────────────────────────
const colors = {
  bg:        "#1a3a5c",   // medium navy — matches game's blue background
  panel:     "#152e4a",   // slightly darker navy for header / tab bar
  border:    "#2a5a8a",   // visible but soft blue border
  accent:    "#f5921e",   // game orange (active tab / highlights)
  accentDim: "#7a440e",   // dim orange for group labels
  text:      "#e0f0ff",   // bright light-blue white body text
  muted:     "#7aaacf",   // lighter steel-blue for labels
  positive:  "#2ecc71",   // green for cumulative / positive values
  header:    "#1e4878",   // card background — lighter blue
  bannerBg:  "#2a5c96",   // section-group banner background
  bannerText:"#ffffff",   // section-group banner text
  gold:      "#ffd040",   // gold / currency colour
};

// ─────────────────────────────────────────────
// COST AT A SINGLE LEVEL  (1-indexed)
// ─────────────────────────────────────────────
function costAtLevel(level, item, sectionFormula) {
  const formula   = item.costFormula ?? sectionFormula;
  const { baseCost, multiCost, stopCostIncreaseAt } = item;
  if (!baseCost || formula === "none") return 0;
  const i = level - 1; // convert to 0-indexed
  switch (formula) {
    case "flat":           return baseCost;
    case "power":          return baseCost * Math.pow(level, multiCost ?? 1);
    case "exponential":
    case "exponential_endgame": return baseCost * Math.pow(multiCost ?? 1, i);
    case "capped_linear":  return baseCost * Math.min(level, stopCostIncreaseAt ?? level);
    default:               return baseCost;
  }
}

// ─────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────
function Badge({ children, color }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 600,
      letterSpacing: "0.04em", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function StatRow({ label, value, sub, valueColor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `1px solid ${colors.border}`, padding: "6px 0", gap: 8 }}>
      <span style={{ color: colors.muted, fontSize: 13 }}>{label}</span>
      <span style={{ color: valueColor ?? colors.gold, fontFamily: "'Exo 2', monospace", fontSize: 14, textAlign: "right", fontWeight: 700 }}>
        {value}{sub && <span style={{ color: colors.muted, fontSize: 11 }}> {sub}</span>}
      </span>
    </div>
  );
}

const MAX_TABLE_ROWS = 500;

function CostModal({ item, sectionFormula, onClose }) {
  const maxLevel = item.maxLevel ?? 100;
  const [startLvl, setStartLvl] = useState(1);
  const [endLvl,   setEndLvl]   = useState(Math.min(maxLevel, 20));

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const start = clamp(startLvl, 1, maxLevel);
  const end   = clamp(endLvl,   start, maxLevel);

  const rows = useMemo(() => {
    const out = []; let running = 0;
    const limit = Math.min(end - start + 1, MAX_TABLE_ROWS);
    for (let lvl = start; lvl <= start + limit - 1; lvl++) {
      const cost = costAtLevel(lvl, item, sectionFormula);
      running += cost;
      out.push({ lvl, cost, running });
    }
    return out;
  }, [start, end, item, sectionFormula]);

  const totalCost = useMemo(() => {
    let t = 0;
    for (let lvl = start; lvl <= end; lvl++) t += costAtLevel(lvl, item, sectionFormula);
    return t;
  }, [start, end, item, sectionFormula]);

  const truncated = (end - start + 1) > MAX_TABLE_ROWS;

  const inputStyle = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "6px 10px", fontSize: 14, fontFamily: "inherit",
    width: 90, textAlign: "center", outline: "none",
  };
  const thStyle = {
    padding: "8px 16px", color: colors.muted, fontWeight: 700, fontSize: 12,
    textAlign: "left", borderBottom: `1px solid ${colors.border}`,
    letterSpacing: "0.06em", textTransform: "uppercase",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}
      onClick={onClose}>
      <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 12, width: "100%", maxWidth: 600, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
        onClick={e => e.stopPropagation()}>

        {/* Modal header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: colors.text }}>{item.name}</div>
            {item.statAmt && item.statKey && (
              <div style={{ fontSize: 13, color: colors.positive, marginTop: 2 }}>{formatStat(item.statAmt, item.statKey)} per level</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: colors.muted, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>✕</button>
        </div>

        {/* Level range inputs */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: colors.muted, fontSize: 13 }}>From level</span>
          <input type="number" value={startLvl} min={1} max={maxLevel}
            onChange={e => setStartLvl(clamp(parseInt(e.target.value) || 1, 1, maxLevel))}
            style={inputStyle} />
          <span style={{ color: colors.muted, fontSize: 13 }}>to</span>
          <input type="number" value={endLvl} min={1} max={maxLevel}
            onChange={e => setEndLvl(clamp(parseInt(e.target.value) || 1, 1, maxLevel))}
            style={inputStyle} />
          <span style={{ color: colors.muted, fontSize: 12 }}>/ {maxLevel === 999999 ? "∞" : maxLevel.toLocaleString()}</span>
        </div>

        {/* Summary */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${colors.border}`, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Levels</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{start} → {end} <span style={{ fontSize: 13, color: colors.muted }}>({end - start + 1} lvls)</span></div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Cost</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.gold }}>{formatBigNum(totalCost)}</div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, background: colors.panel }}>
              <tr>
                <th style={thStyle}>Level</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Running Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.lvl} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                  <td style={{ padding: "7px 16px", color: colors.accent, fontWeight: 600 }}>{r.lvl}</td>
                  <td style={{ padding: "7px 16px", color: colors.text, fontFamily: "monospace", textAlign: "right" }}>{formatBigNum(r.cost)}</td>
                  <td style={{ padding: "7px 16px", color: colors.gold, fontFamily: "monospace", textAlign: "right", fontWeight: 600 }}>{formatBigNum(r.running)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {truncated && (
            <div style={{ padding: "10px 16px", fontSize: 12, color: colors.muted, textAlign: "center", borderTop: `1px solid ${colors.border}` }}>
              Showing first {MAX_TABLE_ROWS} rows — total cost above reflects the full range.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function getIconUrl(filename) {
  return new URL(`./images/Icons/${filename}`, import.meta.url).href;
}

function ItemCard({ item, sectionFormula, canCalculateCost, onOpen }) {
  const formula   = item.costFormula ?? sectionFormula;
  const isRune    = formula === "none";
  const totalCost = computeTotalCost(item, sectionFormula);
  const statLine  = item.statAmt !== undefined && item.statKey
    ? formatStat(item.statAmt, item.statKey)
    : null;
  const levelLabel = item.maxLevel === undefined ? null : `Max Lvl: ${item.maxLevel.toLocaleString()}`;

  const iconBg     = item.bgColor     ?? "#1a4a8a";
  const iconBorder = item.borderColor ?? colors.border;

  const clickable = canCalculateCost !== false;

  return (
    <div onClick={clickable ? onOpen : undefined} style={{ background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.2)", display: "flex", gap: 12, alignItems: "center", cursor: clickable ? "pointer" : "default", transition: "border-color 0.15s" }}
      onMouseEnter={e => { if (clickable) e.currentTarget.style.borderColor = colors.accent; }}
      onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}>

      {/* Icon box */}
      <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: iconBg, border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {item.icon
          ? <img src={getIconUrl(item.icon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
          : <span style={{ fontSize: 20, fontWeight: 800, color: "#ffffff99", textTransform: "uppercase", userSelect: "none" }}>{item.name.charAt(0)}</span>
        }
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Row 1: name + level */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 3 }}>
          <span style={{ color: colors.text, fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{item.name}</span>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {levelLabel && <Badge color={colors.accent}>{levelLabel}</Badge>}
          </div>
        </div>

        {/* Row 2: stat per level */}
        {statLine && (
          <div style={{ color: colors.positive, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{statLine} per level</div>
        )}

        {/* Row 3: base cost + total cost */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {item.baseCost !== undefined && !isRune && (
            <span style={{ fontSize: 13, color: colors.muted }}>Base <span style={{ color: colors.gold, fontWeight: 700 }}>{formatBigNum(item.baseCost)}</span></span>
          )}
          {totalCost !== null && (
            <span style={{ fontSize: 13, color: colors.muted }}>Total <span style={{ color: colors.gold, fontWeight: 700 }}>{formatBigNum(totalCost)}</span></span>
          )}
          {item.waveReq !== undefined && item.waveReq > 0 && (
            <span style={{ fontSize: 13, color: colors.muted }}>Unlocks <span style={{ color: colors.accent, fontWeight: 700 }}>Wave {item.waveReq.toLocaleString()}</span></span>
          )}
        </div>

      </div>
    </div>
  );
}

function GroupCard({ title, items, sectionFormula, canCalculateCost, onOpen }) {
  return (
    <div style={{ marginBottom: 32 }}>
      {/* Banner-style group header matching the in-game section headers */}
      <div style={{
        background: `linear-gradient(180deg, #3a6eb0 0%, ${colors.bannerBg} 100%)`,
        border: `1px solid #4a7ec0`,
        borderRadius: 8,
        padding: "8px 20px",
        marginBottom: 14,
        textAlign: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: colors.bannerText, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
          {title}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        {items.map(item => (
          <ItemCard key={item.id} item={item} sectionFormula={sectionFormula} canCalculateCost={canCalculateCost} onOpen={() => onOpen(item)} />
        ))}
      </div>
    </div>
  );
}

function SheetView({ sectionData, onOpen }) {
  const { costFormula, canCalculateCost, groups } = sectionData;
  return (
    <div>
      {Object.entries(groups).map(([groupName, items]) => (
        <GroupCard key={groupName} title={groupName} items={items} sectionFormula={costFormula} canCalculateCost={canCalculateCost} onOpen={onOpen} />
      ))}
    </div>
  );
}

function RankExpView() {
  const [maxLvl, setMaxLvl] = useState(20);
  const rows = useMemo(() => {
    const out = []; let total = 0;
    for (let i = 1; i <= maxLvl; i++) {
      const req = rankExpForLevel(i);
      total += req;
      out.push({ level: i, required: req, cumulative: total });
    }
    return out;
  }, [maxLvl]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <span style={{ color: colors.muted, fontSize: 13 }}>Show up to level:</span>
        {[20, 100, 500, 1000, 5000].map(n => (
          <button key={n} onClick={() => setMaxLvl(n)}
            style={{ background: maxLvl === n ? colors.accent : colors.header, color: maxLvl === n ? "#000" : colors.text, border: `1px solid ${maxLvl === n ? colors.accent : colors.border}`, borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: maxLvl === n ? 700 : 400, fontSize: 12 }}>
            {n}
          </button>
        ))}
      </div>
      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: colors.panel }}>
              {["Level", "EXP Required", "Cumulative EXP"].map(h => (
                <th key={h} style={{ padding: "10px 16px", color: colors.muted, fontWeight: 600, textAlign: "left", borderBottom: `1px solid ${colors.border}`, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.level} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                <td style={{ padding: "8px 16px", color: colors.accent, fontWeight: 600 }}>{r.level}</td>
                <td style={{ padding: "8px 16px", color: colors.text, fontFamily: "monospace" }}>{formatBigNum(r.required)}</td>
                <td style={{ padding: "8px 16px", color: colors.positive, fontFamily: "monospace" }}>{formatBigNum(r.cumulative)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [activeTab,    setActiveTab]    = useState(0);
  const [modalItem,    setModalItem]    = useState(null);
  const [modalFormula, setModalFormula] = useState(null);

  function openModal(item, formula) {
    setModalItem(item);
    setModalFormula(formula);
  }

  // All tabs: one per section + Rank Exp at the end
  const tabs = [...SECTIONS.map(s => s.data.label), "Rank Exp"];

  return (
    <div style={{ background: colors.bg, minHeight: "100vh", fontFamily: "'Exo 2', 'Rajdhani', 'Segoe UI', sans-serif", color: colors.text }}>
      {/* Header */}
      <div style={{ background: colors.panel, borderBottom: `1px solid ${colors.border}`, padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ padding: "14px 0" }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: colors.accent, letterSpacing: "0.06em", textTransform: "uppercase", textShadow: "0 0 12px rgba(245,146,30,0.4)" }}>Idle Hero TD</div>
            <div style={{ fontSize: 11, color: colors.muted, marginTop: 2, letterSpacing: "0.04em" }}>Game Data Reference</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: colors.panel, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "0 24px", gap: 2, overflowX: "none" }}>
          {tabs.map((label, i) => (
            <button key={label} onClick={() => setActiveTab(i)}
              style={{
                background: activeTab === i ? `linear-gradient(180deg, #3a6eb0 0%, #2a5080 100%)` : "none",
                border: "none",
                borderBottom: activeTab === i ? `2px solid ${colors.accent}` : "2px solid transparent",
                borderRadius: activeTab === i ? "6px 6px 0 0" : 0,
                color: activeTab === i ? colors.accent : colors.muted,
                padding: "11px 16px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: activeTab === i ? 700 : 400,
                marginBottom: -1,
                transition: "color 0.15s, background 0.15s",
                whiteSpace: "nowrap",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        {SECTIONS.map((section, i) =>
          activeTab === i
            ? <SheetView key={section.key} sectionData={section.data} onOpen={item => openModal(item, section.data.costFormula)} />
            : null
        )}
        {activeTab === SECTIONS.length && <RankExpView />}
      </div>

      {modalItem && (
        <CostModal
          item={modalItem}
          sectionFormula={modalFormula}
          onClose={() => setModalItem(null)}
        />
      )}
    </div>
  );
}
