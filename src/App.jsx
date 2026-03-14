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

import heroesData     from "./data/heroes.json";
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
      { key: "allHeroes",    label: "All Heroes",    menuIcon: "_heroHelm.png" },
      { key: "synergies",    label: "Synergies",  menuIcon: "_synergy.png",      iconFilter: "invert(60%) sepia(100%) saturate(400%) hue-rotate(90deg) brightness(1.2)" },
      { key: "milestones",   label: "Milestones", menuIcon: "_star 3610.png" },
      { key: "rankExp",      label: "Rank Exp",      menuIcon: "_killExp.png" },
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
    tierIdx = level - 1;      // 0-3 within tier 2
    base = base15;
  } else {
    tierIdx = level - 1;      // 0-3 within tier 3
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
  // Use rarity colours if the group name matches a known rarity tier
  const baseRarity = Object.keys(RARITY_COLORS).find(r => title === r || title.startsWith(r + " "));
  const rc = baseRarity ? RARITY_COLORS[baseRarity] : null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        background: rc
          ? `linear-gradient(180deg, ${rc.bg}cc 0%, ${rc.bg}88 100%)`
          : `linear-gradient(180deg, #3a6eb0 0%, ${colors.bannerBg} 100%)`,
        border: `1px solid ${rc ? rc.border : "#4a7ec0"}`,
        borderRadius: 8,
        padding: "8px 20px",
        marginBottom: 14,
        textAlign: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: rc ? rc.text : colors.bannerText, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
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
// ALL HEROES VIEW
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// SEARCH BAR
// ─────────────────────────────────────────────
function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ position: "relative", marginBottom: 20 }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: colors.muted, fontSize: 15, pointerEvents: "none" }}>⌕</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        style={{
          width: "100%", boxSizing: "border-box",
          background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 8,
          color: colors.text, padding: "9px 12px 9px 34px",
          fontSize: 14, fontFamily: "inherit", outline: "none",
        }}
      />
      {value && (
        <button onClick={() => onChange("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: colors.muted, fontSize: 16, cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ALL SYNERGIES VIEW
// ─────────────────────────────────────────────
const HERO_NAMES = (heroesData.heroes ?? [])
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(h => ({ id: h.id, name: h.name }));

const ALL_TIERS = ["I", "II", "III", "IV", "V", "VI"];

function ScopeFilter({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Scope</span>
      {["both", "global", "personal"].map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          background: value === opt ? colors.accent : colors.header,
          color: value === opt ? "#000" : colors.text,
          border: `1px solid ${value === opt ? colors.accent : colors.border}`,
          borderRadius: 6, padding: "5px 14px", cursor: "pointer",
          fontFamily: "inherit", fontWeight: value === opt ? 700 : 500,
          fontSize: 13, textTransform: "capitalize", transition: "all 0.15s",
        }}>{opt}</button>
      ))}
    </div>
  );
}

function TierFilter({ value, onChange }) {
  // value is a Set of selected tiers, empty Set = all
  function toggle(tier) {
    const next = new Set(value);
    next.has(tier) ? next.delete(tier) : next.add(tier);
    onChange(next);
  }
  const allSelected = value.size === 0;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Tier</span>
      <button onClick={() => onChange(new Set())} style={{
        background: allSelected ? colors.accent : colors.header,
        color: allSelected ? "#000" : colors.text,
        border: `1px solid ${allSelected ? colors.accent : colors.border}`,
        borderRadius: 6, padding: "5px 12px", cursor: "pointer",
        fontFamily: "inherit", fontWeight: allSelected ? 700 : 500, fontSize: 13, transition: "all 0.15s",
      }}>All</button>
      {ALL_TIERS.map(tier => {
        const tc = TIER_COLORS[tier] ?? TIER_COLORS.I;
        const active = value.has(tier);
        return (
          <button key={tier} onClick={() => toggle(tier)} style={{
            background: active ? tc.border : tc.bg,
            color: active ? "#000" : tc.text,
            border: `1px solid ${tc.border}`,
            borderRadius: 6, padding: "5px 12px", cursor: "pointer",
            fontFamily: "inherit", fontWeight: 700, fontSize: 13, transition: "all 0.15s",
          }}>{tier}</button>
        );
      })}
    </div>
  );
}

function HeroDropdown({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Hero</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
        color: colors.text, padding: "5px 10px", fontSize: 13, fontFamily: "inherit",
        cursor: "pointer", outline: "none", minWidth: 140,
      }}>
        <option value="all">All Heroes</option>
        {HERO_NAMES.map(h => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>
    </div>
  );
}

function AllSynergiesView() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("both");
  const [tier,  setTier]  = useState(new Set());
  const [hero,  setHero]  = useState("all");

  const allSynergies = useMemo(() => {
    const out = [];
    for (const hero of heroesData.heroes ?? []) {
      for (const s of hero.synergies ?? []) {
        out.push({ hero, synergy: s });
      }
    }
    return out;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSynergies.filter(({ hero: h, synergy }) => {
      if (scope !== "both" && synergy.scope !== scope) return false;
      if (tier.size > 0 && !tier.has(synergy.tier)) return false;
      if (hero  !== "all"  && h.id          !== hero)   return false;
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        synergy.description.toLowerCase().includes(q) ||
        synergy.name.toLowerCase().includes(q) ||
        synergy.type.toLowerCase().includes(q) ||
        [synergy.hero1, synergy.hero2, synergy.hero3].filter(Boolean).some(p => p.toLowerCase().includes(q))
      );
    });
  }, [query, scope, tier, hero, allSynergies]);

  const thStyle = { padding: "8px 12px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" };

  return (
    <div>
      <SearchBar value={query} onChange={setQuery} placeholder="Search by hero, bonus, or required hero…" />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <ScopeFilter value={scope} onChange={setScope} />
        <TierFilter  value={tier}  onChange={setTier} />
        <HeroDropdown value={hero} onChange={setHero} />
      </div>
      <div style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>
      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ position: "sticky", top: 0, background: colors.panel, zIndex: 1 }}>
            <tr>
              <th style={thStyle}>Hero</th>
              <th style={thStyle}>Tier</th>
              <th style={thStyle}>Rank Req</th>
              <th style={thStyle}>Required Heroes</th>
              <th style={thStyle}>Bonus</th>
              <th style={thStyle}>Scope</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ hero, synergy }, i) => {
              const rc = RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common;
              const tc = TIER_COLORS[synergy.tier] ?? TIER_COLORS.I;
              const partners = [synergy.hero1, synergy.hero2, synergy.hero3].filter(Boolean);
              return (
                <tr key={`${hero.id}-${synergy.synergyLevel}`} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 5, background: rc.bg, border: `1px solid ${rc.border}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {hero.heroIcon && <img src={getIconUrl(hero.heroIcon)} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />}
                      </div>
                      <span style={{ color: colors.text, fontWeight: 600, whiteSpace: "nowrap" }}>{hero.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text, borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{synergy.tier}</span>
                  </td>
                  <td style={{ padding: "8px 12px", color: colors.gold, fontWeight: 600 }}>{synergy.rankRequired > 0 ? synergy.rankRequired : "—"}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {partners.map(p => (
                        <span key={p} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "1px 7px", fontSize: 11, color: colors.text, textTransform: "capitalize" }}>{p}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 5, background: synergy.bgColor + "44", border: `1px solid ${synergy.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        <img src={getIconUrl(synergy.icon)} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
                      </div>
                      <span style={{ color: colors.text }}>{synergy.description}</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <Badge color={synergy.scope === "global" ? colors.positive : colors.accent}>{synergy.scope}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: colors.muted, fontSize: 14 }}>No synergies match your search.</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ALL MILESTONES VIEW
// ─────────────────────────────────────────────
function AllMilestonesView() {
  const [query,    setQuery]    = useState("");
  const [scope,    setScope]    = useState("both");
  const [minReq,   setMinReq]   = useState("");
  const [maxReq,   setMaxReq]   = useState("");

  const allMilestones = useMemo(() => {
    const out = [];
    for (const hero of heroesData.heroes ?? []) {
      for (const m of hero.milestones ?? []) {
        out.push({ hero, milestone: m });
      }
    }
    return out;
  }, []);

  const filtered = useMemo(() => {
    const q   = query.trim().toLowerCase();
    const min = minReq !== "" ? parseInt(minReq) : null;
    const max = maxReq !== "" ? parseInt(maxReq) : null;
    return allMilestones.filter(({ hero, milestone }) => {
      if (scope !== "both" && milestone.scope !== scope) return false;
      if (min !== null && milestone.requirement < min) return false;
      if (max !== null && milestone.requirement > max) return false;
      if (!q) return true;
      return (
        hero.name.toLowerCase().includes(q) ||
        milestone.description.toLowerCase().includes(q) ||
        milestone.name.toLowerCase().includes(q) ||
        milestone.type.toLowerCase().includes(q)
      );
    });
  }, [query, scope, minReq, maxReq, allMilestones]);

  const thStyle = { padding: "8px 12px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" };

  const reqInputStyle = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "5px 10px", fontSize: 13, fontFamily: "inherit",
    width: 90, textAlign: "center", outline: "none",
  };

  return (
    <div>
      <SearchBar value={query} onChange={setQuery} placeholder="Search by hero or bonus…" />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <ScopeFilter value={scope} onChange={setScope} />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Req Level</span>
          <input type="number" placeholder="Min" value={minReq} onChange={e => setMinReq(e.target.value)} style={reqInputStyle} />
          <span style={{ color: colors.muted, fontSize: 13 }}>–</span>
          <input type="number" placeholder="Max" value={maxReq} onChange={e => setMaxReq(e.target.value)} style={reqInputStyle} />
          {(minReq || maxReq) && (
            <button onClick={() => { setMinReq(""); setMaxReq(""); }} style={{ background: "none", border: "none", color: colors.muted, fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>
      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ position: "sticky", top: 0, background: colors.panel, zIndex: 1 }}>
            <tr>
              <th style={thStyle}>Hero</th>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Req Level</th>
              <th style={thStyle}>Bonus</th>
              <th style={thStyle}>Scope</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ hero, milestone }, i) => {
              const rc = RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common;
              return (
                <tr key={`${hero.id}-${milestone.milestone}`} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 5, background: rc.bg, border: `1px solid ${rc.border}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {hero.heroIcon && <img src={getIconUrl(hero.heroIcon)} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />}
                      </div>
                      <span style={{ color: colors.text, fontWeight: 600, whiteSpace: "nowrap" }}>{hero.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px", color: colors.accent, fontWeight: 700 }}>{milestone.milestone}</td>
                  <td style={{ padding: "8px 12px", color: colors.gold, fontWeight: 600 }}>{milestone.requirement.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 5, background: milestone.bgColor + "44", border: `1px solid ${milestone.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        <img src={getIconUrl(milestone.icon)} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
                      </div>
                      <span style={{ color: colors.text }}>{milestone.description}</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <Badge color={milestone.scope === "global" ? colors.positive : colors.accent}>{milestone.scope}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: colors.muted, fontSize: 14 }}>No milestones match your search.</div>
        )}
      </div>
    </div>
  );
}

const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Supreme"];

const RARITY_COLORS = {
  Common:    { bg: "#3a3a3a", border: "#c0bfc0", text: "#d8d8d8" },
  Uncommon:  { bg: "#1a3a1a", border: "#4dd44d", text: "#80e880" },
  Rare:      { bg: "#1a3535", border: "#33d4d5", text: "#66e0e1" },
  Epic:      { bg: "#1a2e50", border: "#5090d8", text: "#80b4f0" },
  Legendary: { bg: "#1a2240", border: "#4a7acc", text: "#80aaee" },
  Mythic:    { bg: "#4a2a10", border: "#f09040", text: "#ffbe80" },
  Supreme:   { bg: "#7a2020", border: "#ff8080", text: "#ffc4c4" },
};

const TIER_COLORS = {
  I:   { bg: "#1a3a1a", border: "#4dd44d", text: "#80e880" },
  II:  { bg: "#1a3535", border: "#33d4d5", text: "#66e0e1" },
  III: { bg: "#1a2e50", border: "#5090d8", text: "#80b4f0" },
  IV:  { bg: "#3a1a5a", border: "#a060e0", text: "#c090ff" },
  V:   { bg: "#4a2a10", border: "#f09040", text: "#ffbe80" },
  VI:  { bg: "#5a1a1a", border: "#ff6060", text: "#ffaaaa" },
};

function HeroModal({ hero, onClose }) {
  const [tab, setTab] = useState("milestones");
  const rc = RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common;

  const tabStyle = (key) => ({
    flex: 1, padding: "10px 0", background: "none", border: "none",
    borderBottom: tab === key ? `2px solid ${colors.accent}` : `2px solid transparent`,
    color: tab === key ? colors.accent : colors.muted,
    fontFamily: "inherit", fontWeight: tab === key ? 700 : 500,
    fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase",
    cursor: "pointer", transition: "color 0.15s",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div style={{
        background: colors.bg, border: `1px solid ${rc.border}`,
        borderRadius: 12, width: "100%", maxWidth: 680,
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        boxShadow: `0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px ${rc.border}22`,
      }}>

        {/* ── Hero Header ── */}
        <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${colors.border}`, display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{
            width: 64, height: 64, flexShrink: 0, borderRadius: 10,
            background: rc.bg, border: `2px solid ${rc.border}`,
            display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          }}>
            {hero.heroIcon
              ? <img src={getIconUrl(hero.heroIcon)} alt={hero.name} style={{ width: 60, height: 60, objectFit: "contain" }} />
              : <span style={{ fontSize: 24, fontWeight: 800, color: "#ffffff99" }}>{hero.name.charAt(0)}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: colors.text, letterSpacing: "0.04em" }}>{hero.name}</span>
              <Badge color={rc.border}>{hero.rarity}</Badge>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: hero.baseStats ? 6 : 0 }}>
              <span style={{ fontSize: 12, color: colors.muted, textTransform: "capitalize", fontWeight: 600 }}>{hero.class}</span>
            </div>
            {hero.baseStats && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { label: "Damage",    value: hero.baseStats.damage },
                  { label: "DPS",       value: hero.baseStats.dps },
                  { label: "Atk Speed", value: hero.baseStats.attackSpeed !== undefined ? `${hero.baseStats.attackSpeed}s` : undefined },
                  { label: "Range",     value: hero.baseStats.range },
                ].filter(s => s.value !== undefined).map(s => (
                  <div key={s.label} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "3px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.gold }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: colors.muted, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 4px", flexShrink: 0 }}>✕</button>
        </div>

        {/* ── Skill Block ── */}
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
                  <span style={{ fontSize: 12, color: colors.muted, background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "1px 8px" }}>
                    {hero.skill.cooldown}s cooldown
                  </span>
                </div>
                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.5, marginBottom: 6 }}>{hero.skill.description}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {hero.skill.powerDescription && (
                    <div style={{ fontSize: 12, color: colors.muted }}>
                      <span style={{ color: colors.positive, fontWeight: 600 }}>Power: </span>{hero.skill.powerDescription}
                    </div>
                  )}
                  {hero.skill.durationDescription && (
                    <div style={{ fontSize: 12, color: colors.muted }}>
                      <span style={{ color: colors.gold, fontWeight: 600 }}>Duration: </span>{hero.skill.durationDescription}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Mastery Block ── */}
        {hero.masteryDescription && (
          <div style={{ padding: "10px 20px", borderBottom: `1px solid ${colors.border}` }}>
            <span style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginRight: 8 }}>Mastery</span>
            <span style={{ fontSize: 13, color: colors.text, lineHeight: 1.5 }}>{hero.masteryDescription}</span>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: `1px solid ${colors.border}`, flexShrink: 0, padding: "0 20px" }}>
          <button style={tabStyle("milestones")} onClick={() => setTab("milestones")}>
            Milestones <span style={{ fontSize: 11, opacity: 0.7 }}>({hero.milestones?.length ?? 0})</span>
          </button>
          <button style={tabStyle("synergies")} onClick={() => setTab("synergies")}>
            Synergies <span style={{ fontSize: 11, opacity: 0.7 }}>({hero.synergies?.length ?? 0})</span>
          </button>
        </div>

        {/* ── Tab Content ── */}
        <div style={{ overflowY: "auto", flex: 1 }}>

          {tab === "milestones" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, background: colors.panel }}>
                <tr>
                  {["#", "Req Level", "Bonus", "Scope"].map(h => (
                    <th key={h} style={{ padding: "8px 14px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(hero.milestones ?? []).map((m, i) => (
                  <tr key={m.milestone} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                    <td style={{ padding: "8px 14px", color: colors.accent, fontWeight: 700, fontSize: 14 }}>{m.milestone}</td>
                    <td style={{ padding: "8px 14px", color: colors.gold, fontWeight: 600 }}>{m.requirement.toLocaleString()}</td>
                    <td style={{ padding: "8px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: m.bgColor + "44", border: `1px solid ${m.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                          <img src={getIconUrl(m.icon)} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
                        </div>
                        <span style={{ color: colors.text }}>{m.description}</span>
                      </div>
                    </td>
                    <td style={{ padding: "8px 14px" }}>
                      <Badge color={m.scope === "global" ? colors.positive : colors.accent}>{m.scope}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "synergies" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, background: colors.panel }}>
                <tr>
                  {["Tier", "Rank Req", "Required Heroes", "Bonus", "Scope"].map(h => (
                    <th key={h} style={{ padding: "8px 14px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(hero.synergies ?? []).map((s, i) => {
                  const tc = TIER_COLORS[s.tier] ?? TIER_COLORS.I;
                  const partners = [s.hero1, s.hero2, s.hero3].filter(Boolean);
                  return (
                    <tr key={s.synergyLevel} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                      <td style={{ padding: "8px 14px" }}>
                        <span style={{ background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text, borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{s.tier}</span>
                      </td>
                      <td style={{ padding: "8px 14px", color: colors.gold, fontWeight: 600 }}>{s.rankRequired > 0 ? s.rankRequired : "—"}</td>
                      <td style={{ padding: "8px 14px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {partners.map(p => (
                            <span key={p} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "1px 7px", fontSize: 11, color: colors.text, textTransform: "capitalize" }}>{p}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "8px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: s.bgColor + "44", border: `1px solid ${s.borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                            <img src={getIconUrl(s.icon)} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
                          </div>
                          <span style={{ color: colors.text }}>{s.description}</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 14px" }}>
                        <Badge color={s.scope === "global" ? colors.positive : colors.accent}>{s.scope}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

        </div>
      </div>
    </div>
  );
}

function HeroCard({ hero, onClick }) {
  const rc = RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.Common;
  return (
    <div onClick={onClick} style={{
      background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: 12,
      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      display: "flex",
      gap: 12,
      alignItems: "center",
      cursor: "pointer",
      transition: "border-color 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = rc.border}
      onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}
    >
      {/* Hero icon */}
      <div style={{
        width: 52, height: 52, flexShrink: 0, borderRadius: 8,
        background: rc.bg, border: `2px solid ${rc.border}`,
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}>
        {hero.heroIcon
          ? <img src={getIconUrl(hero.heroIcon)} alt={hero.name} style={{ width: 48, height: 48, objectFit: "contain" }} />
          : <span style={{ fontSize: 20, fontWeight: 800, color: "#ffffff99", textTransform: "uppercase", userSelect: "none" }}>{hero.name.charAt(0)}</span>
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
          <span style={{ color: colors.text, fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{hero.name}</span>
          <Badge color={rc.border}>{hero.rarity}</Badge>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: colors.muted, textTransform: "capitalize" }}>{hero.class}</span>
        </div>
        {hero.skill && (
          <div style={{ fontSize: 12, color: colors.muted }}>
            <span style={{ color: colors.accent, fontWeight: 600 }}>{hero.skill.name}</span>
            <span style={{ marginLeft: 6 }}>· {hero.skill.cooldown}s CD</span>
          </div>
        )}
        {hero.baseStats && (
          <div style={{ display: "flex", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
            {hero.baseStats.damage   !== undefined && <span style={{ fontSize: 11, color: colors.muted }}>DMG <span style={{ color: colors.gold, fontWeight: 700 }}>{hero.baseStats.damage}</span></span>}
            {hero.baseStats.attackSpeed !== undefined && <span style={{ fontSize: 11, color: colors.muted }}>SPD <span style={{ color: colors.gold, fontWeight: 700 }}>{hero.baseStats.attackSpeed}s</span></span>}
            {hero.baseStats.range    !== undefined && <span style={{ fontSize: 11, color: colors.muted }}>RNG <span style={{ color: colors.gold, fontWeight: 700 }}>{hero.baseStats.range}</span></span>}
          </div>
        )}
      </div>
    </div>
  );
}

function AllHeroesView() {
  const [selectedHero, setSelectedHero] = useState(null);
  const heroes = heroesData.heroes ?? [];

  // Group by rarity, preserving RARITY_ORDER
  const grouped = RARITY_ORDER.reduce((acc, r) => {
    const list = heroes.filter(h => h.rarity === r).sort((a, b) => a.order - b.order);
    if (list.length) acc[r] = list;
    return acc;
  }, {});

  // Any rarities not in RARITY_ORDER go at the end
  heroes.forEach(h => {
    if (!RARITY_ORDER.includes(h.rarity) && !grouped[h.rarity]) {
      grouped[h.rarity] = heroes.filter(x => x.rarity === h.rarity).sort((a, b) => a.order - b.order);
    }
  });

  return (
    <div>
      {Object.entries(grouped).map(([rarity, list]) => {
        const rc = RARITY_COLORS[rarity] ?? RARITY_COLORS.Common;
        return (
          <div key={rarity} style={{ marginBottom: 32 }}>
            <div style={{
              background: `linear-gradient(180deg, ${rc.bg}cc 0%, ${rc.bg}88 100%)`,
              border: `1px solid ${rc.border}`,
              borderRadius: 8,
              padding: "8px 20px",
              marginBottom: 14,
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: rc.text, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
                {rarity}
              </span>
            </div>
            <div className="hero-grid">
              {list.map(hero => <HeroCard key={hero.id} hero={hero} onClick={() => setSelectedHero(hero)} />)}
            </div>
          </div>
        );
      })}
      {selectedHero && <HeroModal hero={selectedHero} onClose={() => setSelectedHero(null)} />}
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
                  <img src={getIconUrl(menuIcon)} alt="" style={{ width: 20, height: 20, objectFit: "contain", opacity: isActive ? 1 : 0.6, flexShrink: 0, filter: navItem.iconFilter ?? "none" }} />
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
  const [activeKey,    setActiveKey]    = useState(
    () => localStorage.getItem("activeKey") ?? "research"
  );
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
          onSelect={key => { setActiveKey(key); localStorage.setItem("activeKey", key); }}
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
          {activeKey === "allHeroes"  && <AllHeroesView />}
          {activeKey === "synergies"  && <AllSynergiesView />}
          {activeKey === "milestones" && <AllMilestonesView />}
          {activeKey === "rankExp"    && <RankExpView />}
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
