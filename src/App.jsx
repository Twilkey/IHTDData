import { useState, useMemo, useEffect, createContext, useContext } from "react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

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
  { key: "runes",      data: normalizeSection(runesData) },
  { key: "gems",       data: normalizeSection(gemsData) },
  { key: "powerups",   data: normalizeSection(powerupsData) },
  { key: "tech",       data: normalizeSection(techData) },
  { key: "tournament", data: normalizeSection(tournamentData) },
  { key: "tickets",    data: normalizeSection(ticketsData) },
  { key: "ultimus",    data: normalizeSection(ultimusData) },
  { key: "mastery",    data: normalizeSection(masteryData) },
];

const SECTION_MAP = Object.fromEntries(SECTIONS.map(s => [s.key, s]));

const NAV_GROUPS = [
  {
    label: "Upgrades",
    items: [
      { key: "research" },
      { key: "spells" },
      { key: "runes" },
      { key: "gems" },
      { key: "powerups" },
      { key: "tech" },
      { key: "tournament" },
      { key: "tickets" },
      { key: "ultimus" },
      { key: "mastery" },
    ],
  },
  {
    label: "Hero Data",
    items: [
      { key: "rankExp", label: "Rank Exp", menuIcon: "_killExp.png" },
    ],
  },
];

// ─────────────────────────────────────────────
// COST COMPUTATION
// ─────────────────────────────────────────────
// Suffixes: "", K, M, B, T, then aa–az, ba–bz, ca–cz, da–dz
// Covers up to tier 108 (1e324) — well beyond float max (~1e308)
const BIG_SUFFIXES = (() => {
  const s = ["", "K", "M", "B", "T"];
  for (const c1 of "abcd") {
    for (const c2 of "abcdefghijklmnopqrstuvwxyz") {
      s.push(c1 + c2);
    }
  }
  return s;
})();

// notation: "scientific" | "letters"
function formatBigNum(n, notation = "scientific") {
  if (typeof n === "bigint") n = Number(n);
  if (!isFinite(n)) return "∞";
  if (n === 0) return "0";
  const tier = Math.max(0, Math.floor(Math.log10(Math.max(1, n)) / 3));
  if (tier === 0) return n.toFixed(0);
  // K → T: same for both
  if (tier <= 4) return (n / Math.pow(1000, tier)).toFixed(2) + BIG_SUFFIXES[tier];
  // 1e15+ diverge
  if (notation === "scientific") {
    const exp = Math.floor(Math.log10(n));
    const mantissa = n / Math.pow(10, exp);
    return `${mantissa.toFixed(2)}e${exp}`;
  }
  if (tier >= BIG_SUFFIXES.length) return "∞";
  return (n / Math.pow(1000, tier)).toFixed(2) + BIG_SUFFIXES[tier];
}

// ─────────────────────────────────────────────
// SPELL FORMULA
// Tier 1:  levels 1-15   — energy every level
// Tier 2:  level  16     — tier2Unlock (different currency, one-time)
//          levels 17-20  — energy
// Tier 3:  level  21     — tier3Unlock (different currency, one-time)
//          levels 22-25  — energy
// ─────────────────────────────────────────────
const CURRENCY_LABELS = {
  prestigePower:    "Prestige Power",
  tournamentPoints: "Tournament Points",
  techPoints:       "Tech Points",
  weeklyTickets:    "Weekly Tickets",
  gems:             "Gems",
  tokensBlue:       "Blue Tokens",
  tokensGreen:      "Green Tokens",
  tokensRed:        "Red Tokens",
};

// level is 1-indexed (1-25).
// Returns { type:"energy", cost:BigInt }
//      or { type:"unlock", currency:string, amount:number }
function spellCostEntry(level, item) {
  if (level === 16 && item.tier2Unlock)
    return { type: "unlock", currency: item.tier2Unlock.currency, amount: item.tier2Unlock.amount };
  if (level === 21 && item.tier3Unlock)
    return { type: "unlock", currency: item.tier3Unlock.currency, amount: item.tier3Unlock.amount };

  const { baseCost, base15, base20, multCost, noBreakpointMult } = item;

  // Level 1 is the initial unlock — costs exactly baseCost
  if (level === 1) return { type: "energy", cost: BigInt(Math.round(baseCost)) };

  let tierIdx, base;

  if (level <= 15) {
    tierIdx = level - 1;       // 0-14 within tier 1
    base = tierIdx < 10 ? baseCost : baseCost * 2;
  } else if (level >= 17 && level <= 20) {
    tierIdx = level - 17;      // 0-3 within tier 2
    base = base15;
  } else {
    tierIdx = level - 22;      // 0-3 within tier 3
    base = base20;
  }

  const bpMult = noBreakpointMult ? 1 : (tierIdx < 3 ? 1 : tierIdx < 6 ? 2 : 6);
  const cost   = BigInt(Math.round(base))
               * BigInt(Math.round(multCost)) ** BigInt(tierIdx + 1)
               * BigInt(bpMult);
  return { type: "energy", cost };
}

// ─────────────────────────────────────────────
// NOTATION CONTEXT
// ─────────────────────────────────────────────
const NotationContext = createContext("scientific");

function useFmt() {
  const notation = useContext(NotationContext);
  return (n) => formatBigNum(n, notation);
}

function computeTotalCost(item, sectionFormula) {
  const formula = item.costFormula ?? sectionFormula;
  const { baseCost, multiCost, maxLevel, stopCostIncreaseAt } = item;

  if (baseCost === undefined || maxLevel === undefined) return null;
  if (formula === "none") return null;

  if (formula === "spell") {
    let total = 0n;
    for (let lvl = 1; lvl <= maxLevel; lvl++) {
      const entry = spellCostEntry(lvl, item);
      if (entry.type === "energy") total += entry.cost;
    }
    return total;
  }

  // Use BigInt arithmetic when all inputs are integers for exact results
  const intInputs = Number.isInteger(baseCost) &&
    (multiCost === undefined || Number.isInteger(multiCost));

  if (intInputs) {
    const bc = BigInt(baseCost);
    const mc = multiCost !== undefined ? BigInt(multiCost) : 1n;
    const n  = BigInt(maxLevel);

    switch (formula) {
      case "flat":
        return bc * n;

      case "power": {
        // cost(i) = baseCost × (i+1)^multiCost  for i = 0..maxLevel-1
        // multCost === 1 → sum(1..n) = n*(n+1)/2  (exact closed form)
        if (!multiCost || multiCost === 1) return bc * n * (n + 1n) / 2n;
        if (maxLevel > 10000) {
          // Integral approximation for very large n — float is sufficient here
          const approx = baseCost * Math.pow(maxLevel, multiCost + 1) / (multiCost + 1);
          return isFinite(approx) ? approx : Infinity;
        }
        let total = 0n;
        for (let i = 1n; i <= n; i++) total += bc * i ** mc;
        return total;
      }

      case "exponential":
      case "exponential_endgame": {
        // cost(i) = baseCost × multiCost^i  for i = 0..maxLevel-1
        if (!multiCost || multiCost === 1) return bc * n;
        // Guard against astronomical BigInt computation (e.g. 2^999999)
        if (mc >= 2n && n > 1000n) {
          const approx = baseCost * (Math.pow(multiCost, maxLevel) - 1) / (multiCost - 1);
          return isFinite(approx) ? approx : Infinity;
        }
        // Geometric series: bc * (mc^n - 1) / (mc - 1)  — exact integer division
        return bc * (mc ** n - 1n) / (mc - 1n);
      }

      case "capped_linear": {
        const cap = stopCostIncreaseAt !== undefined ? BigInt(Math.round(stopCostIncreaseAt)) : n;
        if (n <= cap) return bc * n * (n + 1n) / 2n;
        return bc * (cap * (cap + 1n) / 2n + (n - cap) * cap);
      }

      default:
        return bc * n;
    }
  }

  // Float fallback for fractional multipliers (e.g. exponential_endgame with 1.1×, 1.2×, ...)
  switch (formula) {
    case "flat":
      return baseCost * maxLevel;

    case "power": {
      if (!multiCost || multiCost === 1) return baseCost * maxLevel * (maxLevel + 1) / 2;
      if (maxLevel > 10000) {
        const approx = baseCost * Math.pow(maxLevel, multiCost + 1) / (multiCost + 1);
        return isFinite(approx) ? approx : Infinity;
      }
      let total = 0;
      for (let i = 0; i < maxLevel; i++) total += baseCost * Math.pow(i + 1, multiCost);
      return total;
    }

    case "exponential":
    case "exponential_endgame": {
      if (!multiCost || multiCost === 1) return baseCost * maxLevel;
      const total = baseCost * (Math.pow(multiCost, maxLevel) - 1) / (multiCost - 1);
      return isFinite(total) ? total : Infinity;
    }

    case "capped_linear": {
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

function formatStatTotal(totalAmt, statKey, fmt) {
  const info = STAT_UNITS[statKey];
  const unit = info?.unit ?? "";
  const formatted = fmt(totalAmt);
  if (unit === "%") return `+${formatted}%`;
  if (unit === "x") return `×${formatted}`;
  if (unit) return `+${formatted} ${unit}`;
  return `+${formatted}`;
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
// Returns BigInt when all inputs are integers, Number otherwise.
// All calls for the same item always return the same type.
function costAtLevel(level, item, sectionFormula) {
  const formula   = item.costFormula ?? sectionFormula;
  const { baseCost, multiCost, stopCostIncreaseAt } = item;
  if (!baseCost || formula === "none") return 0n;

  if (formula === "spell") {
    const entry = spellCostEntry(level, item);
    return entry.type === "energy" ? entry.cost : 0n;
  }

  const intInputs = Number.isInteger(baseCost) &&
    (multiCost === undefined || Number.isInteger(multiCost));

  if (intInputs) {
    const bc = BigInt(baseCost);
    const mc = multiCost !== undefined ? BigInt(multiCost) : 1n;
    const lv = BigInt(level);
    switch (formula) {
      case "flat":           return bc;
      case "power":          return bc * lv ** mc;
      case "exponential":
      case "exponential_endgame": return bc * mc ** (lv - 1n);
      case "capped_linear": {
        const cap = stopCostIncreaseAt !== undefined ? BigInt(Math.round(stopCostIncreaseAt)) : lv;
        return bc * (lv < cap ? lv : cap);
      }
      default: return bc;
    }
  }

  // Float fallback
  const i = level - 1;
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
  const fmt      = useFmt();
  const formula  = item.costFormula ?? sectionFormula;
  const isSpell  = formula === "spell";
  const maxLevel = item.maxLevel ?? 100;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Committed values drive all calculations
  const [startLvl, setStartLvl] = useState(1);
  const [endLvl,   setEndLvl]   = useState(Math.min(maxLevel, 100));
  // Draft values are what the user sees while typing
  const [startInput, setStartInput] = useState("1");
  const [endInput,   setEndInput]   = useState(String(Math.min(maxLevel, 100)));

  const start = clamp(startLvl, 1, maxLevel);
  const end   = clamp(endLvl,   start, maxLevel);

  function commitStart() {
    const v = clamp(parseInt(startInput) || 1, 1, maxLevel);
    setStartLvl(v);
    setStartInput(String(v));
    // If start now exceeds end, push end up to match
    if (v > endLvl) {
      setEndLvl(v);
      setEndInput(String(v));
    }
  }
  function commitEnd() {
    const raw = clamp(parseInt(endInput) || 1, 1, maxLevel);
    // End must be >= start
    const v = Math.max(raw, startLvl);
    setEndLvl(v);
    setEndInput(String(v));
  }

  const rows = useMemo(() => {
    const out = [];
    const limit = Math.min(end - start + 1, MAX_TABLE_ROWS);
    if (isSpell) {
      let energyRunning = 0n;
      for (let lvl = start; lvl <= start + limit - 1; lvl++) {
        const entry = spellCostEntry(lvl, item);
        if (entry.type === "energy") {
          energyRunning += entry.cost;
          out.push({ lvl, type: "energy", cost: entry.cost, running: energyRunning });
        } else {
          out.push({ lvl, type: "unlock", currency: entry.currency, amount: entry.amount, running: energyRunning });
        }
      }
    } else {
      const zero = typeof costAtLevel(start, item, sectionFormula) === "bigint" ? 0n : 0;
      let running = zero;
      for (let lvl = start; lvl <= start + limit - 1; lvl++) {
        const cost = costAtLevel(lvl, item, sectionFormula);
        running += cost;
        out.push({ lvl, type: "energy", cost, running });
      }
    }
    return out;
  }, [start, end, item, sectionFormula, isSpell]);

  const totalCost = useMemo(() => {
    if (isSpell) {
      let t = 0n;
      for (let lvl = start; lvl <= end; lvl++) {
        const entry = spellCostEntry(lvl, item);
        if (entry.type === "energy") t += entry.cost;
      }
      return t;
    }
    const zero = typeof costAtLevel(start, item, sectionFormula) === "bigint" ? 0n : 0;
    let t = zero;
    for (let lvl = start; lvl <= end; lvl++) t += costAtLevel(lvl, item, sectionFormula);
    return t;
  }, [start, end, item, sectionFormula, isSpell]);

  // Unlock costs that fall within the selected range (spells only)
  const unlocksInRange = !isSpell ? [] : [16, 21].flatMap(lvl => {
    if (lvl < start || lvl > end) return [];
    const entry = spellCostEntry(lvl, item);
    return entry.type === "unlock" ? [{ lvl, ...entry }] : [];
  });

  const truncated = (end - start + 1) > MAX_TABLE_ROWS;

  // Effective increase: only for % stats
  // Formula: (100 + statAmt×end) / (100 + statAmt×start) - 1
  const effectiveIncrease = (() => {
    if (!item.statAmt || !item.statKey) return null;
    if (STAT_UNITS[item.statKey]?.unit !== "%") return null;
    const bonusBefore = item.statAmt * start;
    const bonusAfter  = item.statAmt * end;
    return (100 + bonusAfter) / (100 + bonusBefore) - 1;
  })();

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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div className="modal-box" style={{ background: colors.bg, border: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>

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
          <input type="number" value={startInput} min={1} max={maxLevel}
            onChange={e => {
              setStartInput(e.target.value);
              if (e.target.value !== "") {
                const v = clamp(parseInt(e.target.value) || 1, 1, maxLevel);
                setStartLvl(v);
                if (v > endLvl) { setEndLvl(v); setEndInput(String(v)); }
              }
            }}
            onBlur={commitStart}
            onKeyDown={e => e.key === "Enter" && commitStart()}
            style={inputStyle} />
          <span style={{ color: colors.muted, fontSize: 13 }}>to</span>
          <input type="number" value={endInput} min={1} max={maxLevel}
            onChange={e => {
              setEndInput(e.target.value);
              if (e.target.value !== "") {
                const v = clamp(Math.max(parseInt(e.target.value) || 1, startLvl), 1, maxLevel);
                setEndLvl(v);
              }
            }}
            onBlur={commitEnd}
            onKeyDown={e => e.key === "Enter" && commitEnd()}
            style={inputStyle} />
          <span style={{ color: colors.muted, fontSize: 12 }}>/ {maxLevel.toLocaleString()}</span>
        </div>

        {/* Summary */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Row 1: levels, cost, effective increase */}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Levels</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{start} → {end} <span style={{ fontSize: 13, color: colors.muted }}>({end - start + 1} lvls)</span></div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{isSpell ? "Total Energy" : "Total Cost"}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: colors.gold }}>{fmt(totalCost)}</div>
            </div>
            {effectiveIncrease !== null && (
              <div>
                <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Effective Increase</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: colors.positive }}>+{(effectiveIncrease * 100).toFixed(2)}%</div>
              </div>
            )}
          </div>
          {/* Row 2: tier unlock costs (spells only, only when in range) */}
          {unlocksInRange.length > 0 && (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {unlocksInRange.map(u => (
                <div key={u.lvl}>
                  <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{u.lvl === 16 ? "Tier 2 Unlock Cost" : "Tier 3 Unlock Cost"}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: colors.accent }}>
                    {fmt(u.amount)} {CURRENCY_LABELS[u.currency] ?? u.currency}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, background: colors.panel }}>
              <tr>
                <th style={thStyle}>Level</th>
                <th style={{ ...thStyle, textAlign: "right" }}>{isSpell ? "Resource / Cost" : "Cost"}</th>
                <th style={{ ...thStyle, textAlign: "right" }}>{isSpell ? "Running Energy" : "Running Total"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                if (r.type === "unlock") return (
                  <tr key={r.lvl} style={{ background: colors.accentDim + "55", borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "7px 16px", color: colors.accent, fontWeight: 700 }}>{r.lvl}</td>
                    <td style={{ padding: "7px 16px", textAlign: "right" }}>
                      <span style={{ color: colors.muted, fontSize: 11, marginRight: 4 }}>{CURRENCY_LABELS[r.currency] ?? r.currency}</span>
                      <span style={{ color: colors.accent, fontFamily: "monospace", fontWeight: 700 }}>{fmt(r.amount)}</span>
                    </td>
                    <td style={{ padding: "7px 16px", color: colors.muted, textAlign: "right" }}>—</td>
                  </tr>
                );
                return (
                  <tr key={r.lvl} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                    <td style={{ padding: "7px 16px", color: colors.accent, fontWeight: 600 }}>{r.lvl}</td>
                    <td style={{ padding: "7px 16px", color: colors.text, fontFamily: "monospace", textAlign: "right" }}>{fmt(r.cost)}</td>
                    <td style={{ padding: "7px 16px", color: colors.gold, fontFamily: "monospace", textAlign: "right", fontWeight: 600 }}>{fmt(r.running)}</td>
                  </tr>
                );
              })}
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
  const fmt       = useFmt();
  const formula   = item.costFormula ?? sectionFormula;
  const isRune    = formula === "none";
  const isSpell   = formula === "spell";
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
      {isSpell ? (
        <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, overflow: "hidden" }}>
          {item.icon
            ? <img src={getIconUrl(item.icon)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            : <span style={{ fontSize: 20, fontWeight: 800, color: "#ffffff99", textTransform: "uppercase", userSelect: "none" }}>{item.name.charAt(0)}</span>
          }
        </div>
      ) : (
        <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: iconBg, border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {item.icon
            ? <img src={getIconUrl(item.icon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
            : <span style={{ fontSize: 20, fontWeight: 800, color: "#ffffff99", textTransform: "uppercase", userSelect: "none" }}>{item.name.charAt(0)}</span>
          }
        </div>
      )}

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

        {/* Row 3: base cost + total cost + max benefit */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {item.baseCost !== undefined && !isRune && (
            <span style={{ fontSize: 13, color: colors.muted }}>{isSpell ? "Unlock" : "Base"} <span style={{ color: colors.gold, fontWeight: 700 }}>{fmt(item.baseCost)}</span></span>
          )}
          {totalCost !== null && (
            <span style={{ fontSize: 13, color: colors.muted }}>Total <span style={{ color: colors.gold, fontWeight: 700 }}>{fmt(totalCost)}</span></span>
          )}
          {item.statAmt !== undefined && item.statKey && item.maxLevel !== undefined && (
            <span style={{ fontSize: 13, color: colors.muted }}>Max Benefit <span style={{ color: colors.positive, fontWeight: 700 }}>{formatStatTotal(item.statAmt * item.maxLevel, item.statKey, fmt)}</span></span>
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
      <div className="card-grid">
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
  const fmt = useFmt();
  const [startInput, setStartInput] = useState("1");
  const [endInput,   setEndInput]   = useState("20");
  const [range, setRange] = useState({ start: 1, end: 20 });

  function applyRange() {
    const s = Math.max(1, parseInt(startInput) || 1);
    const e = Math.max(s, parseInt(endInput)   || s);
    setStartInput(String(s));
    setEndInput(String(e));
    setRange({ start: s, end: e });
  }

  function handleKeyDown(evt) {
    if (evt.key === "Enter") applyRange();
  }

  const rows = useMemo(() => {
    const out = [];
    // rankExpForLevel(i) = total EXP to reach level i from level 1
    // per-step cost = rankExpForLevel(i) - rankExpForLevel(i-1)
    const toBI = (v) => isFinite(v) ? BigInt(Math.round(v)) : null;
    let prevBI = range.start > 1 ? toBI(rankExpForLevel(range.start - 1)) : 0n;
    for (let i = range.start; i <= range.end; i++) {
      const cumBI = toBI(rankExpForLevel(i));
      const required = (cumBI !== null && prevBI !== null) ? cumBI - prevBI : Infinity;
      out.push({ level: i, required, cumulative: cumBI ?? Infinity });
      if (cumBI !== null) prevBI = cumBI;
    }
    return out;
  }, [range]);

  const inputStyle = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "6px 10px", fontSize: 14, fontFamily: "inherit",
    width: 90, textAlign: "center", outline: "none",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ color: colors.muted, fontSize: 13 }}>From level</span>
        <input
          type="number" value={startInput} min={1}
          onChange={e => setStartInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={inputStyle}
        />
        <span style={{ color: colors.muted, fontSize: 13 }}>to</span>
        <input
          type="number" value={endInput} min={1}
          onChange={e => setEndInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={inputStyle}
        />
        <button onClick={applyRange} style={{
          background: colors.accent, color: "#000", border: "none", borderRadius: 6,
          padding: "6px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13,
          fontFamily: "inherit",
        }}>
          Apply
        </button>
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
                <td style={{ padding: "8px 16px", color: colors.text, fontFamily: "monospace" }}>{fmt(r.required)}</td>
                <td style={{ padding: "8px 16px", color: colors.positive, fontFamily: "monospace" }}>{fmt(r.cumulative)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────
function Sidebar({ activeKey, onSelect, isOpen, onClose }) {
  const [open, setOpen] = useState({ Upgrades: true, "Hero Data": true });

  function toggleGroup(label) {
    setOpen(prev => ({ ...prev, [label]: !prev[label] }));
  }

  function handleSelect(key) {
    onSelect(key);
    onClose?.();
  }

  return (
    <div className={`sidebar${isOpen ? " open" : ""}`}
      style={{ background: colors.panel, borderRight: `1px solid ${colors.border}`, minHeight: "100%", paddingTop: 8 }}>
      {NAV_GROUPS.map(group => (
        <div key={group.label} style={{ marginBottom: 4 }}>
          <button onClick={() => toggleGroup(group.label)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", color: colors.muted, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {group.label}
            <span style={{ fontSize: 10, opacity: 0.7 }}>{open[group.label] ? "▲" : "▼"}</span>
          </button>
          {open[group.label] && group.items.map(navItem => {
            const sectionData = SECTION_MAP[navItem.key]?.data;
            const label = navItem.label ?? sectionData?.label ?? navItem.key;
            const menuIcon = navItem.menuIcon ?? sectionData?.menuIcon;
            const isActive = activeKey === navItem.key;
            return (
              <button key={navItem.key} onClick={() => handleSelect(navItem.key)}
                style={{ width: "100%", background: isActive ? `linear-gradient(90deg, ${colors.accent}22 0%, transparent 100%)` : "none", border: "none", borderLeft: isActive ? `3px solid ${colors.accent}` : "3px solid transparent", cursor: "pointer", padding: "9px 16px 9px 20px", textAlign: "left", color: isActive ? colors.accent : colors.text, fontSize: 14, fontWeight: isActive ? 700 : 500, transition: "color 0.15s, background 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span>{label}</span>
                {menuIcon && (
                  <img src={getIconUrl(menuIcon)} alt="" style={{ width: 20, height: 20, objectFit: "contain", opacity: isActive ? 1 : 0.6, flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [activeKey,    setActiveKey]    = useState("research");
  const [modalItem,    setModalItem]    = useState(null);
  const [modalFormula, setModalFormula] = useState(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [notation,     setNotation]     = useState(
    () => localStorage.getItem("notation") ?? "scientific"
  );
  const isMobile = useIsMobile();

  function handleNotation(val) {
    setNotation(val);
    localStorage.setItem("notation", val);
  }

  function openModal(item, formula) {
    setModalItem(item);
    setModalFormula(formula);
  }

  const activeSection = SECTION_MAP[activeKey];

  return (
    <NotationContext.Provider value={notation}>
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", fontFamily: "'Exo 2', 'Rajdhani', 'Segoe UI', sans-serif", color: colors.text, background: colors.bg }}>

      {/* Header */}
      <div style={{ background: colors.panel, borderBottom: `1px solid ${colors.border}`, padding: "0 20px", flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
        {isMobile && (
          <button onClick={() => setDrawerOpen(o => !o)}
            style={{ background: "none", border: "none", color: colors.text, fontSize: 22, cursor: "pointer", padding: "14px 4px", lineHeight: 1 }}>
            ☰
          </button>
        )}
        <div style={{ padding: "14px 0" }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: colors.accent, letterSpacing: "0.06em", textTransform: "uppercase", textShadow: "0 0 12px rgba(245,146,30,0.4)" }}>Idle Hero TD</div>
          <div style={{ fontSize: 11, color: colors.muted, marginTop: 2, letterSpacing: "0.04em" }}>Game Data Reference</div>
        </div>
        {/* Notation toggle */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Notation</span>
          {[
            { val: "scientific", label: "Scientific", example: "1.23e15" },
            { val: "letters",    label: "Letters",    example: "aa, ab…"  },
          ].map(({ val, label, example }) => (
            <button key={val} onClick={() => handleNotation(val)} style={{
              background: notation === val ? colors.accent : colors.header,
              color: notation === val ? "#000" : colors.text,
              border: `1px solid ${notation === val ? colors.accent : colors.border}`,
              borderRadius: 6, padding: "5px 12px", cursor: "pointer",
              fontFamily: "inherit", textAlign: "center", lineHeight: 1.2,
            }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{label}</div>
              <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{example}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div style={{ display: "flex", flex: 1, position: "relative" }}>

        {/* Backdrop for mobile drawer */}
        {isMobile && drawerOpen && (
          <div onClick={() => setDrawerOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 199 }} />
        )}

        <Sidebar
          activeKey={activeKey}
          onSelect={setActiveKey}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />

        {/* Main content */}
        <div style={{ flex: 1, padding: isMobile ? "16px" : "28px", overflowY: "auto", minWidth: 0 }}>
          {activeSection && (
            <SheetView
              sectionData={activeSection.data}
              onOpen={item => openModal(item, activeSection.data.costFormula)}
            />
          )}
          {activeKey === "rankExp" && <RankExpView />}
        </div>

      </div>

      {modalItem && (
        <CostModal
          item={modalItem}
          sectionFormula={modalFormula}
          onClose={() => setModalItem(null)}
        />
      )}
    </div>
    </NotationContext.Provider>
  );
}
