import { useState, useMemo, useEffect, useLayoutEffect, useRef, createContext, useContext } from "react";

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
import mapsData       from "./data/maps.json";
import researchData   from "./data/research.json";
import spellsData     from "./data/spells.json";
import powerupsData   from "./data/powerups.json";
import gemsData       from "./data/gems.json";
import masteryData    from "./data/mastery.json";
import techData       from "./data/tech.json";
import ticketsData    from "./data/tickets.json";
import tournamentData from "./data/tournament.json";
import ultimusData    from "./data/ultimus.json";
import runesData           from "./data/runes.json";
import heroAttributesData       from "./data/hero_attributes.json";
import tournamentBracketsData   from "./data/tournament_brackets.json";
import combatStylesData         from "./data/combat_styles.json";
import enemyHpData              from "./data/enemy_hp.json";
import STAT_UNITS          from "./data/stat_units.json";
import techTreeDisplayData  from "./data/tech_tree_display.json";

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
      { key: "synergies",    label: "Synergies",     menuIcon: "_synergy.png", iconFilter: "invert(60%) sepia(100%) saturate(400%) hue-rotate(90deg) brightness(1.2)" },
      { key: "milestones",   label: "Milestones",    menuIcon: "_star 3610.png" },
      { key: "rankExp",      label: "Rank Exp",      menuIcon: "_killExp.png" },
      { key: "attributes",    label: "Attributes",     menuIcon: "_attributePoints_0.png" },
      { key: "combatStyles",  label: "Combat Styles",  menuIcon: "icon_scale.png" },
    ],
  },
  {
    label: "Tournament",
    items: [
      { key: "brackets", label: "Brackets", menuIcon: "Icon_Trophy_0.png" },
    ],
  },
  {
    label: "Maps",
    items: [
      { key: "allMaps",   label: "All Maps",   menuIcon: "Icon_Map_0.png" },
      { key: "mapPerks",  label: "Map Perks",  menuIcon: "_starEmpty_0.png" },
    ],
  },
  {
    label: "Calculators",
    items: [
      { key: "rankRequired", label: "Rank Required",    menuIcon: "_attributePoints_0.png" },
      { key: "enemyHp",      label: "Enemy HP",         menuIcon: "_bosses.png" },
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

  if (formula === "hero_attr") {
    const bp1 = Math.round(maxLevel * 0.5);
    const bp2 = Math.round(maxLevel * 0.8);
    // Closed-form: sum(L=a..b) floor(bc * L * mult) ≈ mult * bc * (b-a+1)*(a+b)/2
    // Error ≤ number of terms — negligible for display at any scale
    const sumRange = (a, b) => b >= a ? (b - a + 1) * (a + b) / 2 : 0;
    return Math.round(
      baseCost       * sumRange(1,     bp1 - 1) +
      1.25  * baseCost * sumRange(bp1,   bp2 - 1) +
      1.875 * baseCost * sumRange(bp2,   maxLevel)
    );
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

      // rank_linear: cost(level) = baseCost × level → total = baseCost × n×(n+1)/2
      case "rank_linear":
        return bc * n * (n + 1n) / 2n;

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

    case "rank_linear":
      return baseCost * maxLevel * (maxLevel + 1) / 2;

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

const ASTRAL_COLORS = {
  damage:  "#e05555",
  gold:    "#ffd040",
  exp:     "#4488ee",
  energy:  "#2ecc71",
  boss:    "#aa2020",
  skills:  "#33cccc",
  misc:    "#1a8c1a",
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

  if (formula === "hero_attr") {
    const ml  = item.maxLevel ?? 999999;
    const bp1 = Math.round(ml * 0.5);
    const bp2 = Math.round(ml * 0.8);
    const mult = level >= bp2 ? 1.875 : level >= bp1 ? 1.25 : 1.0;
    return Math.floor(baseCost * level * mult);
  }

  const intInputs = Number.isInteger(baseCost) &&
    (multiCost === undefined || Number.isInteger(multiCost));

  if (intInputs) {
    const bc = BigInt(baseCost);
    const mc = multiCost !== undefined ? BigInt(multiCost) : 1n;
    const lv = BigInt(level);
    switch (formula) {
      case "flat":           return bc;
      case "rank_linear":    return bc * lv;
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
    case "rank_linear":    return baseCost * level;
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
            {item.waveReq > 0 && (
              <div style={{ display: "inline-block", marginTop: 5, background: "#1a2a3a", border: "1px solid #ffaa44", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#ffaa44" }}>
                Unlocks: Wave {item.waveReq.toLocaleString()}
              </div>
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

function getPerkUnit(name) {
  if (name.includes("%")) return "%";
  if (/chance|synergy|speed|cooldown|bonus|effect|group|damage|power|exp|gold|energy|active play/i.test(name)) return "%";
  return "";
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
  const [endInput,   setEndInput]   = useState("5000");
  const [range, setRange] = useState({ start: 1, end: 5000 });

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

  const { rows, totalExp, totalPoints } = useMemo(() => {
    const out = [];
    const toBI = (v) => isFinite(v) ? BigInt(Math.round(v)) : null;
    let prevBI = range.start > 1 ? toBI(rankExpForLevel(range.start - 1)) : 0n;
    let cumulativePoints = range.start > 1
      ? Array.from({ length: range.start - 1 }, (_, i) => i + 2).reduce((s, l) => s + l, 0)
      : 0;
    const pointsBefore = cumulativePoints;
    for (let i = range.start; i <= range.end; i++) {
      const cumBI = toBI(rankExpForLevel(i));
      const required = (cumBI !== null && prevBI !== null) ? cumBI - prevBI : Infinity;
      const pointsGained = i === 1 ? 0 : i;
      cumulativePoints += pointsGained;
      out.push({ level: i, required, cumulative: cumBI ?? Infinity, pointsGained, cumulativePoints });
      if (cumBI !== null) prevBI = cumBI;
    }
    let totalExp = 0n;
    let hasInf = false;
    for (const r of out) {
      if (r.required === Infinity) { hasInf = true; break; }
      totalExp += r.required;
    }
    const totalPoints = out.length > 0 ? out[out.length - 1].cumulativePoints - pointsBefore : 0;
    return { rows: out, totalExp: hasInf ? null : totalExp, totalPoints };
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
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 16px" }}>
          <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total EXP (Levels {range.start}–{range.end})</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.positive, fontFamily: "monospace" }}>{totalExp !== null ? fmt(totalExp) : "—"}</div>
        </div>
        <div style={{ flex: 1, minWidth: 180, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 16px" }}>
          <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Attribute Points (Levels {range.start}–{range.end})</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.gold, fontFamily: "monospace" }}>{totalPoints.toLocaleString()}</div>
        </div>
      </div>
      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: colors.panel }}>
              {["Level", "EXP Required", "Cumulative EXP", "Points Gained", "Cumulative Points"].map(h => (
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
                <td style={{ padding: "8px 16px", color: r.pointsGained === 0 ? colors.muted : colors.gold, fontWeight: r.pointsGained > 0 ? 600 : 400 }}>{r.pointsGained === 0 ? "—" : `+${r.pointsGained}`}</td>
                <td style={{ padding: "8px 16px", color: colors.gold, fontFamily: "monospace" }}>{r.cumulativePoints.toLocaleString()}</td>
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
  const [mxpStart, setMxpStart] = useState(1);
  const [mxpEnd,   setMxpEnd]   = useState(10);
  const [mxpStartInput, setMxpStartInput] = useState("1");
  const [mxpEndInput,   setMxpEndInput]   = useState("10");
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
          {hero.masteryExp && (
            <button style={tabStyle("masteryExp")} onClick={() => setTab("masteryExp")}>Mastery Exp</button>
          )}
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

          {tab === "masteryExp" && (() => {
            const { baseAmount } = hero.masteryExp;
            const formula = heroesData.masteryExpFormula;
            const bps = formula?.breakpoints ?? [];

            function getMult(L) {
              let m = 1.0;
              for (const bp of bps) if (L >= bp.atLevel) m *= bp.multIncremental;
              return m;
            }
            function expAt(L) { return Math.round(baseAmount * 24 * L * getMult(L)); }

            const rows = [];
            let running = 0;
            for (let L = 1; L <= 10; L++) {
              const exp = expAt(L);
              running += exp;
              rows.push({ L, exp, running, repeat: false });
            }
            const repeatExp = expAt(11);
            rows.push({ L: 11, exp: repeatExp, running: null, repeat: true });

            const thS = { padding: "8px 14px", color: colors.muted, fontWeight: 700, fontSize: 11, textAlign: "left", borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.06em", textTransform: "uppercase" };
            const total1to10 = rows.filter(r => !r.repeat).reduce((s, r) => s + r.exp, 0);
            const clamp = (v) => Math.max(1, Math.min(10, v));
            const s = clamp(mxpStart), e = clamp(Math.max(mxpEnd, mxpStart));
            const rangeTotal = rows.filter(r => !r.repeat && r.L >= s && r.L <= e).reduce((acc, r) => acc + r.exp, 0);
            const inputS = { background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.text, padding: "5px 8px", fontSize: 13, fontFamily: "inherit", width: 60, textAlign: "center", outline: "none" };
            function commitMxpStart() { const v = clamp(parseInt(mxpStartInput) || 1); setMxpStart(v); setMxpStartInput(String(v)); if (v > mxpEnd) { setMxpEnd(v); setMxpEndInput(String(v)); } }
            function commitMxpEnd()   { const v = clamp(Math.max(parseInt(mxpEndInput) || 1, mxpStart)); setMxpEnd(v); setMxpEndInput(String(v)); }
            return (<>
              <div style={{ padding: "12px 20px", borderBottom: `1px solid ${colors.border}`, background: colors.panel + "88" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total (1–10): </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: colors.gold }}>{total1to10.toLocaleString()}</span>
                  </div>
                  <div style={{ width: 1, height: 24, background: colors.border }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: colors.muted }}>From</span>
                    <input type="number" value={mxpStartInput} min={1} max={10} style={inputS}
                      onChange={e => setMxpStartInput(e.target.value)}
                      onBlur={commitMxpStart}
                      onKeyDown={e => e.key === "Enter" && commitMxpStart()} />
                    <span style={{ fontSize: 12, color: colors.muted }}>to</span>
                    <input type="number" value={mxpEndInput} min={1} max={10} style={inputS}
                      onChange={e => setMxpEndInput(e.target.value)}
                      onBlur={commitMxpEnd}
                      onKeyDown={e => e.key === "Enter" && commitMxpEnd()} />
                    <span style={{ fontSize: 12, color: colors.muted }}>= </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: colors.positive }}>{rangeTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ position: "sticky", top: 0, background: colors.panel }}>
                  <tr>
                    <th style={thS}>Level</th>
                    <th style={{ ...thS, textAlign: "right" }}>Exp Required</th>
                    <th style={{ ...thS, textAlign: "right" }}>Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.L} style={{ background: r.repeat ? colors.accentDim + "33" : i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                      <td style={{ padding: "8px 14px", color: r.repeat ? colors.accent : colors.text, fontWeight: 700 }}>
                        {r.repeat ? "Repeat" : r.L}
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: colors.gold, fontWeight: 600 }}>{r.exp.toLocaleString()}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: r.repeat ? colors.muted : colors.positive, fontWeight: 600 }}>
                        {r.repeat ? "∞" : r.running.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>);
          })()}

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
// ATTRIBUTES VIEW
// ─────────────────────────────────────────────
function AttributesView() {
  const fmt = useFmt();
  const isMobile = useIsMobile();
  const [modalAttr, setModalAttr] = useState(null);

  const groups = [
    { key: "personal", label: "Attributes (Personal)", desc: "Applies to the individual hero only." },
    { key: "global",   label: "Attributes (Global)",   desc: "Affects all heroes globally." },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("_attributePoints_0.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Attributes</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Attribute point upgrades per hero</div>
        </div>
      </div>

      {groups.map(group => (
        <div key={group.key} style={{ marginBottom: 36 }}>
          {/* Group header */}
          <div style={{
            background: `linear-gradient(180deg, #3a6eb0 0%, ${colors.bannerBg} 100%)`,
            border: `1px solid #4a7ec0`,
            borderRadius: 8, padding: "8px 20px", marginBottom: 14,
            textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: colors.bannerText, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{group.label}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>{group.desc}</div>
          </div>

          {/* Attribute cards — 2 col desktop, 1 col mobile */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 8 }}>
            {(heroAttributesData[group.key] ?? []).map(attr => {
              const statLine   = attr.statAmt !== undefined && attr.statKey ? formatStat(attr.statAmt, attr.statKey) : null;
              const maxLvl     = attr.maxLevel;
              const totalCost  = maxLvl != null ? fmt(computeTotalCost(attr, "hero_attr")) : null;
              const maxBenefit = maxLvl != null && attr.statAmt !== undefined && attr.statKey
                ? formatStatTotal(attr.statAmt * maxLvl, attr.statKey, fmt) : null;
              const iconBg     = attr.bgColor     ?? "#1a4a8a";
              const iconBorder = attr.borderColor ?? colors.border;

              return (
                <div key={attr.id} onClick={() => setModalAttr(attr)}
                  style={{
                    background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8, padding: 12,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    display: "flex", gap: 12, alignItems: "center",
                    cursor: "pointer", transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}
                >
                  {/* Icon box */}
                  <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: iconBg, border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {attr.icon
                      ? <img src={getIconUrl(attr.icon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
                      : <span style={{ fontSize: 20, fontWeight: 800, color: "#ffffff99", textTransform: "uppercase", userSelect: "none" }}>{attr.name.charAt(0)}</span>
                    }
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Row 1: name + rank badge */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 3 }}>
                      <span style={{ color: colors.text, fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{attr.name}</span>
                      {attr.rankReq > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                          background: "#0f2640", border: `1px solid #2a5a8a`,
                          color: "#7aaacf", whiteSpace: "nowrap", flexShrink: 0,
                        }}>Rank {attr.rankReq.toLocaleString()}+</span>
                      )}
                    </div>

                    {/* Row 2: stat per level */}
                    {statLine && (
                      <div style={{ color: colors.positive, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{statLine} per level</div>
                    )}

                    {/* Row 3: cost info */}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, color: colors.muted }}>Base <span style={{ color: colors.gold, fontWeight: 700 }}>{attr.baseCost.toLocaleString()} × lvl</span></span>
                      {totalCost != null && (
                        <span style={{ fontSize: 13, color: colors.muted }}>Total <span style={{ color: colors.gold, fontWeight: 700 }}>{totalCost}</span></span>
                      )}
                      {maxBenefit && (
                        <span style={{ fontSize: 13, color: colors.muted }}>Max <span style={{ color: colors.positive, fontWeight: 700 }}>{maxBenefit}</span></span>
                      )}
                      {maxLvl == null && (
                        <span style={{ fontSize: 13, color: colors.muted }}>Levels <span style={{ color: colors.accent, fontWeight: 700 }}>∞</span></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {modalAttr && (
        <CostModal item={modalAttr} sectionFormula="hero_attr" onClose={() => setModalAttr(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAPS VIEW
// ─────────────────────────────────────────────
function perkMaxCost(perk) {
  const bp = 5;
  const uc = perk.upgradeCost ?? perk.baseCost;
  const low  = uc * Math.min(perk.maxLevel, bp);
  const high = uc * 2 * Math.max(0, perk.maxLevel - bp);
  return (perk.unlockCost ?? 0) + low + high;
}

function MapModal({ map, onClose }) {
  const hasVariants = map.astralVariants?.length > 0;
  const [tab, setTab] = useState("perks");
  const [variantIdx, setVariantIdx] = useState(0);
  const totalUnlock      = map.perks.reduce((sum, p) => sum + (p.unlockCost ?? 0), 0);
  const totalUpgrades    = map.perks.reduce((sum, p) => {
    const bp = 5, uc = p.upgradeCost ?? p.baseCost;
    return sum + uc * Math.min(p.maxLevel, bp) + uc * 2 * Math.max(0, p.maxLevel - bp);
  }, 0);
  const grandTotal       = totalUnlock + totalUpgrades;
  const totalPlacement   = (mapsData.placementBonuses ?? []).reduce((sum, b) =>
    sum + b.baseCost * b.breakpoint + b.upgradeCostHigh * (b.maxLevel - b.breakpoint), 0);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, width: "100%", maxWidth: 560, height: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Modal header */}
        <div style={{ borderBottom: `1px solid ${colors.border}`, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, position: "relative", backgroundImage: `url(${getIconUrl(map.icon)})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,25,45,0.82)", pointerEvents: "none" }} />
          <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: colors.text }}>{map.name}</div>
            {map.waveRequirement > 0
              ? <div style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>Wave {map.waveRequirement.toLocaleString()} · {map.gemsToUnlock.toLocaleString()} Gems to unlock</div>
              : <div style={{ fontSize: 12, color: colors.positive, marginTop: 3 }}>Available from start</div>
            }
            <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
              {[
                { label: "Map Perks",  value: grandTotal },
                { label: "Placement",  value: totalPlacement },
                { label: "Total",      value: grandTotal + totalPlacement, highlight: true },
              ].map(({ label, value, highlight }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: highlight ? colors.accent : colors.gold }}>{value.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: colors.muted, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
          {[{ key: "perks", label: "Map Perks" }, { key: "placement", label: "Placement" }, ...(hasVariants ? [{ key: "variants", label: "Variants" }] : [])].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, background: "none", border: "none", borderBottom: tab === t.key ? `2px solid ${colors.accent}` : "2px solid transparent",
              color: tab === t.key ? colors.accent : colors.muted, fontFamily: "inherit", fontWeight: 700,
              fontSize: 13, padding: "10px 0", cursor: "pointer", transition: "color 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 0 }}>
          {tab === "perks" && <>
            {/* Perk list */}
            {map.perks.map(perk => {
              const unit = getPerkUnit(perk.name);
              const bp = 5;
              const uc = perk.upgradeCost ?? perk.baseCost;
              const rows = [];
              rows.push({ level: "Unlock", cost: perk.unlockCost ?? null, cumulative: perk.unlockCost ?? 0, bonus: perk.baseAmt });
              let cum = perk.unlockCost ?? 0;
              for (let lvl = 1; lvl <= perk.maxLevel; lvl++) {
                const stepCost = lvl <= bp ? uc : uc * 2;
                cum += stepCost;
                rows.push({ level: lvl, cost: stepCost, cumulative: cum, bonus: perk.baseAmt + perk.statAmt * lvl });
              }
              const thStyle = { padding: "5px 8px", color: colors.muted, fontWeight: 700, fontSize: 12, borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.05em", textTransform: "uppercase" };
              return (
                <div key={perk.id} style={{ paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${colors.border}40` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>{perk.name}</span>
                      {perk.isDefault && <Badge color={colors.positive}>Default</Badge>}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {perk.waveReq > 0 && <Badge color={colors.accent}>Wave {(perk.waveReq / 1000).toFixed(0)}K</Badge>}
                      <Badge color={colors.muted}>Max Lv {perk.maxLevel}</Badge>
                    </div>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: colors.panel }}>
                        <th style={{ ...thStyle, textAlign: "left"  }}>Level</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Total Cost</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Bonus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "50" }}>
                          <td style={{ padding: "4px 8px", color: r.level === "Unlock" ? colors.muted : colors.accent, fontWeight: 600 }}>{r.level}</td>
                          <td style={{ padding: "4px 8px", textAlign: "right", color: r.cost ? colors.gold : colors.muted, fontFamily: "monospace" }}>{r.cost ?? "—"}</td>
                          <td style={{ padding: "4px 8px", textAlign: "right", color: colors.text, fontFamily: "monospace" }}>{r.cumulative}</td>
                          <td style={{ padding: "4px 8px", textAlign: "right", color: colors.positive, fontWeight: 600 }}>{r.bonus}{unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {map.negativePerk && (() => {
              const np = map.negativePerk;
              const unit = getPerkUnit(np.name);
              return (
                <div style={{ paddingTop: 14, marginTop: 4, borderTop: `1px solid #e0555533` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#e05555" }}>{np.name}</span>
                    <Badge color="#e05555">Penalty</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: colors.muted }}>
                    Per level <span style={{ color: "#e05555", fontWeight: 600 }}>{np.statAmt}{unit}</span>
                  </div>
                </div>
              );
            })()}
          </>}

          {tab === "variants" && hasVariants && (() => {
            const variant = map.astralVariants[variantIdx];
            return (
              <>
                {/* Variant pill switcher */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {map.astralVariants.map((v, i) => {
                    const c = ASTRAL_COLORS[v.enumName] ?? "#b47aff";
                    const active = i === variantIdx;
                    return (
                      <button key={v.enumValue} onClick={() => setVariantIdx(i)} style={{
                        padding: "5px 12px", borderRadius: 20,
                        border: `1px solid ${active ? c : c + "44"}`,
                        background: active ? c + "55" : c + "11",
                        color: active ? "#fff" : c + "99",
                        fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", transition: "all 0.15s",
                      }}>{v.displayName.replace(/ Day$/i, "")}</button>
                    );
                  })}
                </div>
                {/* Selected variant effects */}
                <div style={{ padding: "12px 14px", background: colors.header, borderRadius: 8, border: `1px solid ${colors.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: ASTRAL_COLORS[variant.enumName] ?? "#b47aff", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{variant.displayName.replace(/ Day$/i, "")}</div>
                  {variant.effects.map((ef, i) => {
                    const negativIsGood = new Set(["skillCooldown", "spellCooldown"]);
                    const isDebuff = negativIsGood.has(ef.statKey) ? ef.amount > 0 : ef.amount < 0;
                    const sign = ef.amount > 0 ? "+" : "";
                    const unitStr = ef.unit === "pct" ? "%" : "";
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < variant.effects.length - 1 ? `1px solid ${colors.border}30` : "none" }}>
                        <span style={{ fontSize: 13, color: colors.muted }}>{ef.statLabel}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isDebuff ? "#e05555" : colors.positive }}>{sign}{ef.amount}{unitStr}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: colors.muted, fontStyle: "italic" }}>Active variant is set server-side and rotates daily.</div>
              </>
            );
          })()}

          {tab === "placement" && (() => {
            const bonuses = mapsData.placementBonuses ?? [];
            const thStyle = { padding: "4px 8px", color: colors.muted, fontWeight: 700, fontSize: 11, borderBottom: `1px solid ${colors.border}`, letterSpacing: "0.05em", textTransform: "uppercase" };
            return (
              <>
                {bonuses.map(b => {
                  const unit = getPerkUnit(b.name);
                  const rows = [];
                  let cum = 0;
                  for (let lvl = 1; lvl <= b.maxLevel; lvl++) {
                    const stepCost = lvl <= b.breakpoint ? b.baseCost : b.upgradeCostHigh;
                    cum += stepCost;
                    rows.push({ level: lvl, cost: stepCost, cumulative: cum, bonus: b.statAmt * lvl });
                  }
                  return (
                    <div key={b.id} style={{ paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${colors.border}40` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{b.name}</span>
                        <Badge color={colors.muted}>Max Lv {b.maxLevel}</Badge>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: colors.panel }}>
                            <th style={{ ...thStyle, textAlign: "left"  }}>Level</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Total Cost</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Bonus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={r.level} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "50" }}>
                              <td style={{ padding: "4px 8px", color: colors.accent, fontWeight: 600 }}>{r.level}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", color: colors.gold, fontFamily: "monospace" }}>{r.cost}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", color: colors.text, fontFamily: "monospace" }}>{r.cumulative}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", color: b.statAmt < 0 ? "#e05555" : colors.positive, fontWeight: 600 }}>{b.statAmt < 0 ? "" : "+"}{r.bonus}{unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function MapCard({ map, onClick, isMobile }) {
  const isLocked = map.waveRequirement > 0;
  const iconUrl = getIconUrl(map.icon);
  const hasVariants = map.astralVariants?.length > 0;
  const [variantIdx, setVariantIdx] = useState(0);

  const negativeIsGood = new Set(["skillCooldown", "spellCooldown"]);

  return (
    <div onClick={onClick} style={{
      border: `1px solid ${colors.border}`, borderRadius: 10, overflow: "hidden", cursor: "pointer",
      transition: "border-color 0.15s, box-shadow 0.15s",
      backgroundImage: `url(${iconUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      position: "relative",
      display: "flex", flexDirection: "column",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.boxShadow = `0 0 14px ${colors.accent}33`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Dark overlay so text stays readable */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,25,45,0.72)", pointerEvents: "none" }} />

      {/* Content sits above overlay — stacked on mobile, side-by-side on desktop */}
      <div style={{ position: "relative", zIndex: 1, padding: "16px", display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, flex: 1 }}>

        {/* Header block: name + unlock requirements */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: isMobile ? "none" : "0 0 160px" }}>
          <div style={{ fontWeight: 900, fontSize: isMobile ? 18 : 21, color: colors.text, lineHeight: 1.2 }}>{map.name}</div>
          {isLocked
            ? <>
                <Badge color={colors.accent}>Wave: {map.waveRequirement.toLocaleString()}</Badge>
                <Badge color="#e06aaa">Gems: {map.gemsToUnlock.toLocaleString()}</Badge>
              </>
            : <Badge color={colors.positive}>Available from start</Badge>
          }
          {hasVariants && <Badge color="#b47aff">Perks rotate Mon &amp; Thurs</Badge>}
        </div>

        {/* Divider — horizontal on mobile, vertical on desktop */}
        <div style={isMobile
          ? { height: 1, background: `${colors.border}60` }
          : { width: 1, background: `${colors.border}60`, flexShrink: 0 }
        } />

        {/* Perks / variants */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasVariants ? (() => {
            const variant = map.astralVariants[variantIdx];
            return (
              <>
                {/* Pill switcher */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }} onClick={e => e.stopPropagation()}>
                  {map.astralVariants.map((v, i) => {
                    const c = ASTRAL_COLORS[v.enumName] ?? "#b47aff";
                    const active = i === variantIdx;
                    return (
                      <button key={v.enumValue} onClick={() => setVariantIdx(i)} style={{
                        padding: "4px 10px", borderRadius: 20,
                        border: `1px solid ${active ? c : c + "44"}`,
                        background: active ? c + "55" : c + "11",
                        color: active ? "#fff" : c + "99",
                        fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", lineHeight: 1.4,
                      }}>{v.displayName.replace(/ Day$/i, "")}</button>
                    );
                  })}
                </div>
                {/* Effects */}
                {variant.effects.map((ef, i) => {
                  const isLast = i === variant.effects.length - 1;
                  const sign = ef.amount > 0 ? "+" : "";
                  const unitStr = ef.unit === "pct" ? "%" : "";
                  const col = isLast ? "#e05555" : colors.positive;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 15, color: col }}>{ef.statLabel}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: col, flexShrink: 0 }}>{sign}{ef.amount}{unitStr}</span>
                    </div>
                  );
                })}
              </>
            );
          })() : (() => {
            const defaults = map.perks.filter(p => p.isDefault);
            return (
              <>
                <div style={{ fontSize: 13, fontWeight: 800, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Default Perks</div>
                {defaults.length === 0
                  ? <span style={{ fontSize: 15, color: colors.muted, fontStyle: "italic" }}>None</span>
                  : defaults.map(perk => {
                      const unit = getPerkUnit(perk.name);
                      return (
                        <div key={perk.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 15, color: colors.positive }}>{perk.name}</span>
                          <span style={{ fontSize: 15, color: colors.positive, fontWeight: 700, flexShrink: 0 }}>{perk.baseAmt}{unit}</span>
                        </div>
                      );
                    })
                }
                {map.negativePerk && (() => {
                  const unit = getPerkUnit(map.negativePerk.name);
                  return (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 15, color: "#e05555" }}>{map.negativePerk.name}</span>
                      <span style={{ fontSize: 15, color: "#e05555", fontWeight: 700, flexShrink: 0 }}>{map.negativePerk.statAmt}{unit}</span>
                    </div>
                  );
                })()}
              </>
            );
          })()}
        </div>

      </div>
      <div style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${colors.border}40`, padding: "6px 16px", textAlign: "center" }}>
        <span style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.05em" }}>Click for details</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMBAT STYLES VIEW
// ─────────────────────────────────────────────
function CombatStylesView() {
  const isMobile = useIsMobile();
  const styles = combatStylesData.styles ?? [];

  function statLabel(key) {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }

  const cols = isMobile ? 2 : 4;

  return (
    <div style={{ padding: "16px 12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
        {styles.map(style => (
          <div key={style.id} style={{
            background: colors.panel,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>{style.name}</div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                background: "#0f2640", border: "1px solid #2a5a8a", color: "#7aaacf", whiteSpace: "nowrap",
              }}>
                {style.rankReq > 0 ? `Rank ${style.rankReq.toLocaleString()}+` : "Available"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {style.bonuses.length === 0 ? (
                <span style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>No modifiers</span>
              ) : style.bonuses.map((b, i) => (
                <div key={i} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontWeight: 700, color: (() => { const neg = ["skillCooldown"].includes(b.stat); return (b.amount >= 0) !== neg ? colors.positive : "#e05555"; })() }}>
                    {b.amount >= 0 ? "+" : ""}{b.amount}{b.isPercent ? "%" : ""}
                  </span>
                  <span style={{ color: colors.text, flex: 1 }}>{statLabel(b.stat)}</span>
                  {b.isGlobal && (
                    <span style={{ fontSize: 10, color: colors.muted, background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "1px 5px", marginLeft: "auto" }}>Global</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AllMapsView() {
  const [selectedMap, setSelectedMap] = useState(null);
  const isMobile = useIsMobile();
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>All Maps</div>
        <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Click a map to see full perk details</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 20, gridAutoRows: "minmax(200px, auto)" }}>
        {mapsData.maps.map(map => <MapCard key={map.id} map={map} isMobile={isMobile} onClick={() => setSelectedMap(map)} />)}
      </div>
      {selectedMap && <MapModal map={selectedMap} onClose={() => setSelectedMap(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// RANK REQUIRED CALCULATOR
// ─────────────────────────────────────────────
function attrPointsForLevels(attr, targetLevel) {
  if (!targetLevel || targetLevel <= 0) return 0;
  const ml  = attr.maxLevel ?? 999999;
  const bp1 = Math.round(ml * 0.5);
  const bp2 = Math.round(ml * 0.8);
  const sumRange = (a, b) => b >= a ? (b - a + 1) * (a + b) / 2 : 0;
  const e1 = Math.min(bp1 - 1, targetLevel);
  const e2 = Math.min(bp2 - 1, targetLevel);
  return Math.round(
    attr.baseCost       * sumRange(1,    e1) +
    1.25  * attr.baseCost * sumRange(bp1,  e2) +
    1.875 * attr.baseCost * sumRange(bp2,  targetLevel)
  );
}

function rankForPoints(points) {
  if (points <= 0) return 1;
  return Math.ceil((-1 + Math.sqrt(1 + 8 * (points + 1))) / 2);
}

function RankRequiredView() {
  const fmt = useFmt();
  const isMobile = useIsMobile();
  const allAttrs = [
    ...heroAttributesData.personal,
    ...heroAttributesData.global,
  ];

  const RR_STORAGE_KEY = "rankRequiredLevels";

  const [levels, setLevels] = useState(() => {
    const defaults = Object.fromEntries(allAttrs.map(a => [a.id, ""]));
    try {
      const saved = JSON.parse(localStorage.getItem(RR_STORAGE_KEY));
      if (saved && typeof saved === "object") return { ...defaults, ...saved };
    } catch {}
    return defaults;
  });

  function setLevel(id, val) {
    setLevels(prev => {
      const next = { ...prev, [id]: val };
      localStorage.setItem(RR_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const totalPoints = useMemo(() => {
    return allAttrs.reduce((sum, attr) => {
      const target = Math.min(parseInt(levels[attr.id]) || 0, attr.maxLevel ?? 999999);
      return sum + attrPointsForLevels(attr, target);
    }, 0);
  }, [levels]);

  const minRank    = rankForPoints(totalPoints);
  const rankExp    = rankExpForLevel(minRank);
  const hasInputs  = totalPoints > 0;

  const groups = [
    { key: "personal", label: "Personal Attributes" },
    { key: "global",   label: "Global Attributes" },
  ];

  function isInvalid(val, maxLvl) {
    const n = parseInt(val);
    if (val === "" || isNaN(n)) return false;
    return n < 0 || n > maxLvl;
  }

  function handleBlur(id, val, maxLvl) {
    const n = parseInt(val);
    if (val === "" || isNaN(n)) return;
    const clamped = Math.max(0, Math.min(n, maxLvl));
    setLevel(id, String(clamped));
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("_attributePoints_0.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Rank Required</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Enter your desired attribute levels to find the minimum rank needed.</div>
        </div>
      </div>

      {/* Result bar */}
      <div style={{ marginBottom: 24, background: colors.panel, border: `1px solid ${hasInputs ? colors.accent : colors.border}`, borderRadius: 10, padding: "16px 20px", display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Points Needed</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.gold }}>{totalPoints.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Minimum Rank</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: hasInputs ? colors.accent : colors.muted }}>{hasInputs ? minRank.toLocaleString() : "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>EXP to Reach Rank</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: hasInputs ? colors.positive : colors.muted }}>{hasInputs ? fmt(rankExp) : "—"}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => setLevels(prev => {
            const next = { ...prev };
            allAttrs.forEach(a => { if ((a.maxLevel ?? 999999) < 999999) next[a.id] = String(a.maxLevel); });
            return next;
          })} style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}66`, borderRadius: 6, color: colors.accent, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
            Max All
          </button>
          {hasInputs && (
            <button onClick={() => { const empty = Object.fromEntries(allAttrs.map(a => [a.id, ""])); setLevels(empty); localStorage.removeItem(RR_STORAGE_KEY); }}
              style={{ background: "none", border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.muted, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Attribute groups */}
      {groups.map(group => (
        <div key={group.key} style={{ marginBottom: 28 }}>
          <div style={{
            background: `linear-gradient(180deg, #3a6eb0 0%, ${colors.bannerBg} 100%)`,
            border: `1px solid #4a7ec0`, borderRadius: 8, padding: "8px 20px", marginBottom: 14,
            textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: colors.bannerText, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{group.label}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 8 }}>
            {(heroAttributesData[group.key] ?? []).map(attr => {
              const iconBg     = attr.bgColor     ?? "#1a4a8a";
              const iconBorder = attr.borderColor ?? colors.border;
              const maxLvl     = attr.maxLevel ?? 999999;
              const val        = levels[attr.id] ?? "";
              const invalid    = isInvalid(val, maxLvl);
              const target     = invalid ? 0 : Math.min(parseInt(val) || 0, maxLvl);
              const cost       = attrPointsForLevels(attr, target);
              const hasVal     = target > 0;

              return (
                <div key={attr.id} style={{
                  background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`,
                  border: `1px solid ${hasVal ? colors.accent + "88" : colors.border}`,
                  borderRadius: 8, padding: 12,
                  display: "flex", gap: 12, alignItems: "center",
                }}>
                  <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, background: iconBg, border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {attr.icon
                      ? <img src={getIconUrl(attr.icon)} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
                      : <span style={{ fontSize: 16, fontWeight: 800, color: "#ffffff99" }}>{attr.name.charAt(0)}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 4 }}>{attr.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <input
                        type="number" min={0} max={maxLvl}
                        placeholder={maxLvl >= 999999 ? "Level" : `Max: ${maxLvl}`}
                        value={val}
                        onChange={e => setLevel(attr.id, e.target.value)}
                        onBlur={e => handleBlur(attr.id, e.target.value, maxLvl)}
                        style={{
                          background: "#0f2640",
                          border: `1px solid ${invalid ? "#e05555" : hasVal ? colors.accent : colors.border}`,
                          borderRadius: 6, color: invalid ? "#e05555" : colors.text,
                          padding: "7px 10px", fontSize: 14, fontFamily: "inherit",
                          width: 110, textAlign: "center", outline: "none",
                        }}
                      />
                      {invalid && (
                        <span style={{ fontSize: 11, color: "#e05555" }}>Max {maxLvl}</span>
                      )}
                      {maxLvl < 999999 && (
                        <button onClick={() => setLevel(attr.id, String(maxLvl))} style={{ background: colors.accent + "22", border: `1px solid ${colors.accent}66`, borderRadius: 5, color: colors.accent, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>Max</button>
                      )}
                      {hasVal && !invalid && (
                        <span style={{ fontSize: 12, color: colors.gold }}>{cost.toLocaleString()} pts</span>
                      )}
                    </div>
                  </div>
                  {attr.rankReq > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#0f2640", border: `1px solid #2a5a8a`, color: "#7aaacf", whiteSpace: "nowrap", flexShrink: 0 }}>
                      Rank {attr.rankReq.toLocaleString()}+
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// HOME VIEW
// ─────────────────────────────────────────────
const HOME_SECTIONS = [
  {
    group: "Upgrades",
    color: "#4a9eff",
    items: [
      { key: "research",   label: "Research",   icon: "_energy.png",          desc: "Prestige power upgrades" },
      { key: "spells",     label: "Spells",     icon: "_energy.png",          desc: "Spell levels and energy costs" },
      { key: "runes",      label: "Runes",      icon: "_rune_2.png",          desc: "Rune bonuses" },
      { key: "gems",       label: "Gems",       icon: "_gem_2.png",           desc: "Gem upgrades" },
      { key: "powerups",   label: "Power Ups",  icon: "_prestigePower.png",   desc: "Power up levels" },
      { key: "tech",       label: "Tech",       icon: "_techPts_2.png",       desc: "Tech tree upgrades" },
      { key: "tournament", label: "Tournament", icon: "_tournPts.png",        desc: "Tournament upgrades" },
      { key: "tickets",    label: "Tickets",    icon: "_ticket.png",          desc: "Weekly ticket upgrades" },
      { key: "ultimus",    label: "Ultimus",    icon: "token_red.png",        desc: "Ultimus upgrades" },
      { key: "mastery",    label: "Mastery",    icon: "_mastery_2.png",       desc: "Mastery levels" },
    ],
  },
  {
    group: "Hero Data",
    color: "#b47aff",
    items: [
      { key: "allHeroes",    label: "All Heroes",    icon: "_heroHelm.png",           desc: "Stats, skills and synergies" },
      { key: "synergies",    label: "Synergies",     icon: "_synergy.png",            desc: "Browse all synergy bonuses" },
      { key: "milestones",   label: "Milestones",    icon: "_star 3610.png",          desc: "Hero milestone rewards" },
      { key: "rankExp",      label: "Rank Exp",      icon: "_killExp.png",            desc: "Experience per rank level" },
      { key: "attributes",   label: "Attributes",    icon: "_attributePoints_0.png",  desc: "Personal and global attribute costs" },
      { key: "combatStyles", label: "Combat Styles", icon: "icon_scale.png",          desc: "Combat style bonuses and rank requirements" },
    ],
  },
  {
    group: "Tournament",
    color: colors.gold,
    items: [
      { key: "brackets", label: "Brackets", icon: "Icon_Trophy_0.png", desc: "Trophy rewards by tier and placement" },
    ],
  },
  {
    group: "Maps",
    color: colors.positive,
    items: [
      { key: "allMaps",  label: "All Maps",  icon: "Icon_Map_0.png",    desc: "Map perks and unlock requirements" },
      { key: "mapPerks", label: "Map Perks", icon: "_starEmpty_0.png",  desc: "Perk points earned per wave milestone" },
    ],
  },
  {
    group: "Calculators",
    color: colors.accent,
    items: [
      { key: "rankRequired", label: "Rank Required", icon: "_attributePoints_0.png", desc: "Min rank needed for your attribute levels" },
      { key: "enemyHp",      label: "Enemy HP",      icon: "_bosses.png",            desc: "Enemy HP by wave with player reductions" },
    ],
  },
];

const STORE_LINKS = [
  { label: "Android", url: "https://play.google.com/store/apps/details?id=com.SwellGamesLLC.IdleHeroTD", color: "#78c257", icon: "icon_android.png", desc: "Get it on Google Play" },
  { label: "iOS",     url: "https://apps.apple.com/us/app/id6479284270",                                  color: "#aaaaaa", icon: "icon_ios.png",     desc: "Download on the App Store" },
  { label: "Steam",   url: "https://store.steampowered.com/app/2897580",                                  color: "#1b9de2", icon: "icon_steam.png",    desc: "Available on Steam" },
  { label: "Discord", url: "https://discord.com/invite/vs3uJUsxVx",                                       color: "#5865f2", icon: "discord-mark-blue.png", desc: "Join the community" },
];

// ─────────────────────────────────────────────
// ENEMY HP CALCULATOR
// ─────────────────────────────────────────────
function EnemyHpView() {
  const fmt = useFmt();
  const isMobile = useIsMobile();

  const { enemy_hp_scaling, enemy_hp } = enemyHpData.playerStats;
  const wave_skip = enemyHpData.wave_skip_chance;

  const STORAGE_KEY = "enemyHpInputs";
  const savedInputs = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  }, []);

  const [waveInput,        setWaveInput]        = useState(savedInputs.wave        ?? "100");
  const [masteryInput,     setMasteryInput]     = useState(savedInputs.mastery     ?? "0");
  const [ultimusInput,     setUltimusInput]     = useState(savedInputs.ultimus     ?? "0");
  const [researchInput,    setResearchInput]    = useState(savedInputs.research    ?? "0");
  const [techInput,        setTechInput]        = useState(savedInputs.tech        ?? "0");
  const [runesInput,       setRunesInput]       = useState(savedInputs.runes       ?? "0");
  const [tournSkipInput,   setTournSkipInput]   = useState(savedInputs.tournSkip   ?? "0");
  const [runesSkipInput,   setRunesSkipInput]   = useState(savedInputs.runesSkip   ?? "0");
  const [params, setParams] = useState(() => {
    const w = Math.max(1, parseInt(savedInputs.wave) || 100);
    return { wave: w, mastery: parseInt(savedInputs.mastery) || 0, ultimus: parseInt(savedInputs.ultimus) || 0,
             research: parseInt(savedInputs.research) || 0, tech: parseInt(savedInputs.tech) || 0,
             runes: parseInt(savedInputs.runes) || 0, tournSkip: parseInt(savedInputs.tournSkip) || 0,
             runesSkip: parseInt(savedInputs.runesSkip) || 0 };
  });

  function clamp(val, max) { return Math.min(Math.max(parseInt(val) || 0, 0), max); }

  function apply() {
    const wave      = Math.max(1, parseInt(waveInput) || 1);
    const mastery   = clamp(masteryInput,   enemy_hp_scaling.sources[0].maxLevel);
    const ultimus   = clamp(ultimusInput,   enemy_hp_scaling.sources[1].maxLevel);
    const research  = clamp(researchInput,  enemy_hp.sources[0].maxLevel);
    const tech      = clamp(techInput,      enemy_hp.sources[1].maxLevel);
    const runes     = clamp(runesInput,     enemy_hp.sources[2].maxLevel);
    const tournSkip = clamp(tournSkipInput, wave_skip.sources[0].maxLevel);
    const runesSkip = clamp(runesSkipInput, wave_skip.sources[1].maxLevel);
    const next = { wave, mastery, ultimus, research, tech, runes, tournSkip, runesSkip };
    setWaveInput(String(wave));
    setMasteryInput(String(mastery));   setUltimusInput(String(ultimus));
    setResearchInput(String(research)); setTechInput(String(tech)); setRunesInput(String(runes));
    setTournSkipInput(String(tournSkip)); setRunesSkipInput(String(runesSkip));
    setParams(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ wave: String(wave), mastery: String(mastery), ultimus: String(ultimus),
      research: String(research), tech: String(tech), runes: String(runes), tournSkip: String(tournSkip), runesSkip: String(runesSkip) }));
  }

  function clear() {
    setWaveInput("100"); setMasteryInput("0"); setUltimusInput("0");
    setResearchInput("0"); setTechInput("0"); setRunesInput("0");
    setTournSkipInput("0"); setRunesSkipInput("0");
    setParams({ wave: 100, mastery: 0, ultimus: 0, research: 0, tech: 0, runes: 0, tournSkip: 0, runesSkip: 0 });
    localStorage.removeItem(STORAGE_KEY);
  }

  function handleKeyDown(e) { if (e.key === "Enter") apply(); }

  const result = useMemo(() => {
    const { startHp, moduloRates, waveRangeScales, enemyMultipliers } = enemyHpData;

    function getWaveRangeScale(w) {
      for (const entry of waveRangeScales) {
        if (entry.maxWave === null || w <= entry.maxWave) return entry.scale;
      }
      return 0.3;
    }
    function getBaseRate(w) {
      if (w % 10 === 0) return moduloRates.mod10;
      if (w % 5  === 0) return moduloRates.mod5;
      return moduloRates.default;
    }
    function simulate(targetWave, num12) {
      let hp = startHp;
      for (let w = 2; w <= targetWave; w++) {
        hp = Math.round((hp + 4) * (getBaseRate(w) * getWaveRangeScale(w) * num12 + 1));
      }
      return hp;
    }
    function mobsForWave(w) {
      const d = w % 10;
      return { mobCount: d === 0 ? 19 : 9 + d, hasBoss: d === 0 };
    }

    const num12    = (1 - params.mastery * 0.005) * (1 - params.ultimus * 0.005);
    const ehpMult  = (1 - params.research * enemy_hp.sources[0].amtPerLevel) *
                     (1 - params.tech     * enemy_hp.sources[1].amtPerLevel) *
                     (1 - params.runes    * enemy_hp.sources[2].amtPerLevel);

    const scalingPct  = (1 - num12)   * 100;
    const ehpPct      = (1 - ehpMult) * 100;
    const skipChance  = params.tournSkip * wave_skip.sources[0].amtPerLevel +
                        params.runesSkip * wave_skip.sources[1].amtPerLevel;
    const effectiveWave = Math.max(1, Math.floor(params.wave * (1 - skipChance / 100)));

    const hp     = simulate(params.wave,  num12);
    const hpSkip = simulate(effectiveWave, num12);

    const toBI = (v) => isFinite(v) && v >= 0 ? BigInt(Math.round(v)) : 0n;

    function buildTypes(rawHp, wave) {
      const { mobCount, hasBoss } = mobsForWave(wave);
      return [
        { key: "normal", label: "Normal", mult: 1.0,                    count: mobCount },
        { key: "boss",   label: "Boss",   mult: enemyMultipliers.boss,  count: hasBoss ? 1 : 0 },
      ].map(t => {
        const perHp = toBI(rawHp * t.mult * ehpMult);
        return { ...t, hp: perHp, totalHp: perHp * BigInt(t.count) };
      });
    }

    const { mobCount, hasBoss } = mobsForWave(params.wave);
    const { mobCount: mobCountSkip, hasBoss: hasBossSkip } = mobsForWave(effectiveWave);

    return {
      baseHp: toBI(hp),
      types:     buildTypes(hp,     params.wave),
      typesSkip: buildTypes(hpSkip, effectiveWave),
      scalingPct, ehpPct, skipChance, effectiveWave,
      mobCount, hasBoss, mobCountSkip, hasBossSkip,
    };
  }, [params]);

  const smallInput = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "5px 8px", fontSize: 13, fontFamily: "inherit",
    width: 68, textAlign: "center", outline: "none",
  };
  const typeColors = { normal: "#a3e8b0", boss: "#f87171" };

  const reductionCards = [
    {
      key: "ehp", label: "Enemy HP", badge: "Post-Sim", badgeColor: colors.accent,
      footer: { label: "Total reduction:", value: `−${result.ehpPct.toFixed(2)}%`, color: result.ehpPct > 0 ? colors.positive : colors.muted },
      sources: [
        { label: "Research", icon: "_energy.png",    val: researchInput,  set: setResearchInput,  max: enemy_hp.sources[0].maxLevel, amtPer: enemy_hp.sources[0].amtPerLevel },
        { label: "Tech",     icon: "_techPts_2.png", val: techInput,      set: setTechInput,      max: enemy_hp.sources[1].maxLevel, amtPer: enemy_hp.sources[1].amtPerLevel },
        { label: "Runes",    icon: "_rune_2.png",    val: runesInput,     set: setRunesInput,     max: enemy_hp.sources[2].maxLevel, amtPer: enemy_hp.sources[2].amtPerLevel },
      ],
    },
    {
      key: "scaling", label: "Enemy Scaling", badge: "Per Wave", badgeColor: "#60a5fa",
      footer: { label: "Total reduction:", value: `−${result.scalingPct.toFixed(2)}%`, color: result.scalingPct > 0 ? colors.positive : colors.muted },
      sources: [
        { label: "Mastery", icon: "_mastery_2.png", val: masteryInput, set: setMasteryInput, max: enemy_hp_scaling.sources[0].maxLevel, amtPer: enemy_hp_scaling.sources[0].amtPerLevel },
        { label: "Ultimus", icon: "token_red.png",  val: ultimusInput, set: setUltimusInput, max: enemy_hp_scaling.sources[1].maxLevel, amtPer: enemy_hp_scaling.sources[1].amtPerLevel },
      ],
    },
    {
      key: "skip", label: "Enemy Skip Chance", badge: "Exploration", badgeColor: colors.gold,
      footer: { label: "Skip chance:", value: `${result.skipChance.toFixed(2)}%`, color: result.skipChance > 0 ? colors.gold : colors.muted },
      sources: [
        { label: "Tournament", icon: "_tournPts.png", val: tournSkipInput, set: setTournSkipInput, max: wave_skip.sources[0].maxLevel, amtPer: wave_skip.sources[0].amtPerLevel, isChance: true },
        { label: "Runes",      icon: "_rune_2.png",   val: runesSkipInput, set: setRunesSkipInput, max: wave_skip.sources[1].maxLevel, amtPer: wave_skip.sources[1].amtPerLevel, isChance: true },
      ],
    },
  ];

  return (
    <div>
      {/* Wave input */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Wave</span>
          <input type="number" min={1} value={waveInput} onChange={e => setWaveInput(e.target.value)} onKeyDown={handleKeyDown}
            style={{ ...smallInput, width: 110, fontSize: 14, padding: "7px 10px" }} />
        </div>
      </div>

      {/* Reduction + skip cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {reductionCards.map(card => (
          <div key={card.key} style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{card.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: card.badgeColor + "22", border: `1px solid ${card.badgeColor}55`, color: card.badgeColor }}>{card.badge}</span>
            </div>
            {card.sources.map(src => {
              const over = (parseInt(src.val) || 0) > src.max;
              return (
                <div key={src.label} style={{ marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {src.icon && <img src={getIconUrl(src.icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />}
                    <span style={{ fontSize: 12, color: colors.muted, minWidth: 80 }}>{src.label}</span>
                    <input type="number" min={0} max={src.max} value={src.val} onChange={e => src.set(e.target.value)} onKeyDown={handleKeyDown}
                      style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                    <span style={{ fontSize: 11, color: colors.muted }}>/ {src.max}</span>
                    <span style={{ fontSize: 11, color: src.isChance ? colors.gold : colors.positive, marginLeft: "auto" }}>
                      {src.isChance ? "" : "−"}{((parseInt(src.val) || 0) * src.amtPer * 100).toFixed(1)}%
                    </span>
                  </div>
                  {over && <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {src.max}</div>}
                </div>
              );
            })}
            <div style={{ borderTop: `1px solid ${colors.border}44`, marginTop: 6, paddingTop: 6 }}>
              <span style={{ fontSize: 13, color: colors.muted }}>{card.footer.label} </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: card.footer.color }}>{card.footer.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Apply + Clear */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button onClick={apply} style={{
          background: colors.accent, color: "#000", border: "none", borderRadius: 6,
          padding: "8px 24px", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit",
        }}>Apply</button>
        <button onClick={clear} style={{
          background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 6,
          padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
        }}>Clear</button>
      </div>

      {/* Info strip */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Base HP",    value: fmt(result.baseHp),                                                              color: colors.text },
          { label: "Mob Spawns", value: `${result.mobCount} normal${result.hasBoss ? " + 1 boss" : ""}`,                 color: colors.gold },
          ...(result.skipChance > 0 ? [{ label: "Est. Wave (with skip)", value: String(result.effectiveWave), color: colors.accent }] : []),
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "7px 14px" }}>
            <span style={{ fontSize: 11, color: colors.muted }}>{label} </span>
            <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Enemy type cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
        {result.types.map((type, i) => {
          const isBoss   = type.key === "boss";
          const spawns   = isBoss ? result.hasBoss : true;
          const typeSkip = result.typesSkip[i];
          const spawnsSkip = isBoss ? result.hasBossSkip : true;
          return (
            <div key={type.key} style={{
              background: colors.panel, border: `1px solid ${spawns ? colors.border : colors.border + "55"}`,
              borderRadius: 10, padding: "16px", textAlign: "center",
              display: "flex", flexDirection: "column", gap: 6, opacity: spawns ? 1 : 0.45,
            }}>
              <div style={{ fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{type.label}</div>
              <div style={{ fontSize: 11, color: colors.muted }}>
                ×{type.mult} multiplier · {isBoss ? (spawns ? "1 boss" : "×0 waves only") : `${type.count} mobs`}
              </div>

              {/* Original wave */}
              <div style={{ borderTop: `1px solid ${colors.border}33`, paddingTop: 8 }}>
                <div style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Wave {params.wave} — Per mob</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: typeColors[type.key], fontFamily: "monospace", lineHeight: 1 }}>{fmt(type.hp)}</div>
                {spawns && <>
                  <div style={{ fontSize: 11, color: colors.muted, marginTop: 6, marginBottom: 2 }}>Total this wave</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: typeColors[type.key], fontFamily: "monospace", lineHeight: 1 }}>{fmt(type.totalHp)}</div>
                </>}
              </div>

              {/* Skip-adjusted wave */}
              {result.skipChance > 0 && (
                <div style={{ borderTop: `1px solid ${colors.gold}44`, paddingTop: 8, background: colors.gold + "08", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: colors.gold, marginBottom: 4 }}>Est. Wave {result.effectiveWave} — Per mob</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: typeColors[type.key], fontFamily: "monospace", lineHeight: 1, opacity: 0.85 }}>{fmt(typeSkip.hp)}</div>
                  {spawnsSkip && <>
                    <div style={{ fontSize: 11, color: colors.muted, marginTop: 6, marginBottom: 2 }}>Total this wave</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: typeColors[type.key], fontFamily: "monospace", lineHeight: 1, opacity: 0.85 }}>{fmt(typeSkip.totalHp)}</div>
                  </>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HomeView({ onNavigate }) {
  const isMobile = useIsMobile();
  return (
    <div>

      {/* Hero banner */}
      <div style={{ textAlign: "center", marginBottom: 36, padding: "32px 20px", background: `linear-gradient(180deg, ${colors.panel} 0%, transparent 100%)`, borderRadius: 12, border: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 900, color: colors.accent, letterSpacing: "0.06em", textTransform: "uppercase", textShadow: "0 0 24px rgba(245,146,30,0.5)", marginBottom: 8 }}>
          Idle Hero TD
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 4 }}>Game Data Reference</div>
        <div style={{ fontSize: 13, color: colors.muted, marginBottom: 20 }}>by Asingh · Game Version 15.04</div>
        <p style={{ fontSize: 14, color: colors.muted, lineHeight: 1.7, maxWidth: 560, margin: "0 auto 12px" }}>
          A comprehensive reference tool for Idle Hero TD — covering upgrade costs, hero stats, synergies, milestones, mastery exp, map perks, and tournament brackets. Use the sidebar to navigate between sections.
        </p>
        <p style={{ fontSize: 13, color: colors.muted, lineHeight: 1.6, maxWidth: 560, margin: "0 auto 24px", padding: "10px 16px", background: colors.header, borderRadius: 8, border: `1px solid ${colors.border}` }}>
          Found an error or something looks off? Please message <span style={{ color: colors.accent, fontWeight: 700 }}>Asingh</span> or any of the mods on the Discord server.
        </p>
        {/* Store + Discord links */}
        <div style={{ fontSize: 13, color: colors.muted, marginBottom: 14 }}>Find the game and join the community:</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {STORE_LINKS.map(link => (
            <a key={link.label} href={link.url} target="_blank" rel="noreferrer" style={{
              padding: "10px 18px", borderRadius: 10,
              background: link.color + "22", border: `1px solid ${link.color}66`,
              color: link.color, fontWeight: 700, fontSize: 13,
              textDecoration: "none", display: "flex", alignItems: "center", gap: 8,
              transition: "background 0.15s",
            }}>
              {link.icon && <img src={getIconUrl(link.icon)} alt="" style={{ width: 20, height: 20, objectFit: "contain", flexShrink: 0 }} />}
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 800 }}>{link.label}</div>
                <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 400 }}>{link.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Section quick-links */}
      {HOME_SECTIONS.map(section => (
        <div key={section.group} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: section.color, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10, paddingLeft: 4 }}>
            {section.group}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 10 }}>
            {section.items.map(item => (
              <button key={item.key} onClick={() => onNavigate(item.key)} style={{
                background: colors.header, border: `1px solid ${colors.border}`,
                borderRadius: 8, padding: "12px 14px", textAlign: "left",
                cursor: "pointer", fontFamily: "inherit",
                transition: "border-color 0.15s, background 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = section.color; e.currentTarget.style.background = section.color + "11"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.background = colors.header; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {item.icon && (
                    <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, background: "#0f2640", border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      <img src={getIconUrl(item.icon)} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.4 }}>{item.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// TOURNAMENT BRACKETS VIEW
// ─────────────────────────────────────────────
function BracketsView() {
  const [waveInput, setWaveInput] = useState("");
  const wave = parseInt(waveInput) || null;

  const activeBracket = wave != null
    ? tournamentBracketsData.brackets.find(b => wave >= b.minWave && (b.maxWave == null || wave <= b.maxWave))
    : null;

  const thS = {
    padding: "9px 12px", color: colors.muted, fontWeight: 700, fontSize: 11,
    textAlign: "right", borderBottom: `1px solid ${colors.border}`,
    letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("Icon_Trophy_0.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Tournament Brackets</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Base trophy rewards by tier and placement.</div>
        </div>
      </div>

      {/* Wave finder */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "12px 16px" }}>
        <span style={{ fontSize: 13, color: colors.muted }}>Your wave:</span>
        <input
          type="number" placeholder="e.g. 5000"
          value={waveInput}
          onChange={e => setWaveInput(e.target.value)}
          style={{ background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.text, padding: "6px 10px", fontSize: 14, fontFamily: "inherit", width: 130, outline: "none" }}
        />
        {activeBracket && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: colors.positive, fontWeight: 700 }}>
              Tier {activeBracket.tier} — {activeBracket.minWave.toLocaleString()}–{activeBracket.maxWave != null ? activeBracket.maxWave.toLocaleString() : "∞"}
            </span>
            <span style={{ fontSize: 13, color: colors.muted }}>
              Rank 1: <span style={{ color: colors.gold, fontWeight: 700 }}>{activeBracket.trophiesPerRank[0].toLocaleString()}</span>
            </span>
            <span style={{ fontSize: 13, color: colors.muted }}>
              Rank 10: <span style={{ color: colors.gold, fontWeight: 700 }}>{activeBracket.trophiesPerRank[9].toLocaleString()}</span>
            </span>
            <span style={{ fontSize: 13, color: colors.muted }}>
              Gems: <span style={{ color: "#e06aaa", fontWeight: 700 }}>{activeBracket.gems.toLocaleString()}</span>
            </span>
          </div>
        )}
        {wave != null && !activeBracket && (
          <span style={{ fontSize: 13, color: colors.muted, fontStyle: "italic" }}>No bracket found for wave {wave.toLocaleString()}</span>
        )}
      </div>

      {/* Table */}
      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 8, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
          <thead style={{ background: colors.panel }}>
            <tr>
              <th style={{ ...thS, textAlign: "left" }}>Tier</th>
              <th style={{ ...thS, textAlign: "left" }}>Wave Range</th>
              {[1,2,3,4,5,6,7,8,9,10].map(r => (
                <th key={r} style={{ ...thS, color: r === 1 ? colors.gold : thS.color }}>#{r}</th>
              ))}
              <th style={{ ...thS, color: "#e06aaa" }}>Gems</th>
            </tr>
          </thead>
          <tbody>
            {tournamentBracketsData.brackets.map((b, i) => {
              const isActive = activeBracket?.tier === b.tier;
              return (
                <tr key={b.tier} style={{
                  background: isActive ? colors.positive + "22" : i % 2 === 0 ? "transparent" : colors.panel + "60",
                  borderBottom: `1px solid ${colors.border}${isActive ? "" : "22"}`,
                  outline: isActive ? `1px solid ${colors.positive}` : "none",
                }}>
                  <td style={{ padding: "8px 12px", fontWeight: 700, color: isActive ? colors.positive : colors.accent, whiteSpace: "nowrap" }}>
                    {isActive ? `▶ Tier ${b.tier}` : `Tier ${b.tier}`}
                  </td>
                  <td style={{ padding: "8px 12px", color: colors.muted, whiteSpace: "nowrap" }}>
                    {b.minWave.toLocaleString()}–{b.maxWave != null ? b.maxWave.toLocaleString() : "∞"}
                  </td>
                  {b.trophiesPerRank.map((t, ri) => (
                    <td key={ri} style={{ padding: "8px 12px", textAlign: "right", color: ri === 0 ? colors.gold : colors.text, fontWeight: ri === 0 ? 700 : 400 }}>
                      {t.toLocaleString()}
                    </td>
                  ))}
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "#e06aaa", fontWeight: 600 }}>{b.gems.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAP PERKS VIEW
// ─────────────────────────────────────────────
const MAP_PERK_START = 25000;
const MAP_PERK_INTERVAL = 1000;

function MapPerksView() {
  const isMobile = useIsMobile();
  const [startWave, setStartWave] = useState(MAP_PERK_START);
  const [endWave,   setEndWave]   = useState(75000);
  const [startInput, setStartInput] = useState(String(MAP_PERK_START));
  const [endInput,   setEndInput]   = useState("75000");

  const clampWave = (v) => Math.max(MAP_PERK_START, Math.round(v / MAP_PERK_INTERVAL) * MAP_PERK_INTERVAL);

  function commitStart() {
    const v = clampWave(parseInt(startInput) || MAP_PERK_START);
    setStartWave(v);
    setStartInput(v.toLocaleString().replace(/,/g, ""));
    if (v > endWave) { setEndWave(v); setEndInput(String(v)); }
  }
  function commitEnd() {
    const raw = clampWave(parseInt(endInput) || MAP_PERK_START);
    const v = Math.max(raw, startWave);
    setEndWave(v);
    setEndInput(String(v));
  }

  const rows = useMemo(() => {
    const out = [];
    for (let w = startWave; w <= endWave; w += MAP_PERK_INTERVAL) {
      const n = (w - MAP_PERK_START) / MAP_PERK_INTERVAL;
      const granted    = n;
      const cumulative = n * (n + 1) / 2;
      out.push({ wave: w, granted, cumulative });
    }
    return out;
  }, [startWave, endWave]);

  const inputStyle = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "6px 10px", fontSize: 14, fontFamily: "inherit",
    width: 110, textAlign: "center", outline: "none",
  };
  const thStyle = {
    padding: "8px 16px", color: colors.muted, fontWeight: 700, fontSize: 12,
    textAlign: "left", borderBottom: `1px solid ${colors.border}`,
    letterSpacing: "0.06em", textTransform: "uppercase",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("_starEmpty_0.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Map Perks</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Perk points earned per wave milestone (every 1,000 waves from {MAP_PERK_START.toLocaleString()})</div>
        </div>
      </div>

      {/* Wave range filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "12px 16px" }}>
        <span style={{ color: colors.muted, fontSize: 13 }}>From wave</span>
        <input type="number" value={startInput} min={MAP_PERK_START} step={MAP_PERK_INTERVAL}
          onChange={e => setStartInput(e.target.value)}
          onBlur={commitStart}
          onKeyDown={e => e.key === "Enter" && commitStart()}
          style={inputStyle} />
        <span style={{ color: colors.muted, fontSize: 13 }}>to</span>
        <input type="number" value={endInput} min={MAP_PERK_START} step={MAP_PERK_INTERVAL}
          onChange={e => setEndInput(e.target.value)}
          onBlur={commitEnd}
          onKeyDown={e => e.key === "Enter" && commitEnd()}
          style={inputStyle} />
        <span style={{ fontSize: 13, color: colors.muted }}>
          — <span style={{ color: colors.accent, fontWeight: 700 }}>{rows[rows.length - 1]?.cumulative.toLocaleString() ?? 0}</span> total perks at wave {endWave.toLocaleString()}
        </span>
      </div>

      {/* Table */}
      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: colors.panel }}>
            <tr>
              <th style={thStyle}>Wave</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Perks Granted</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Cumulative Perks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.wave} style={{ background: i % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                <td style={{ padding: "7px 16px", color: colors.accent, fontWeight: 600 }}>{r.wave.toLocaleString()}</td>
                <td style={{ padding: "7px 16px", textAlign: "right", color: r.granted === 0 ? colors.muted : colors.text, fontWeight: r.granted > 0 ? 600 : 400 }}>
                  {r.granted === 0 ? "—" : `+${r.granted}`}
                </td>
                <td style={{ padding: "7px 16px", textAlign: "right", color: colors.gold, fontWeight: 600 }}>
                  {r.cumulative.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TECH TREE VIEW
// ─────────────────────────────────────────────
function TechTreeGroupAbs({ items, layout, onOpen, containerWidth }) {
  const fmt  = useFmt();
  const cols = layout.cols;

  // Fixed vertical rhythm; horizontal fills the container
  const NODE_H  = 112;
  const ROW_GAP = 52;
  const COL_GAP = 24;
  const rowHeight = NODE_H + ROW_GAP;

  const colWidth = Math.floor(containerWidth / cols);
  const NODE_W   = colWidth - COL_GAP;

  const posById = layout.nodes;
  const maxRow  = Math.max(...Object.values(posById).map(n => n.row));
  const svgW    = containerWidth;
  const svgH    = maxRow * rowHeight - ROW_GAP;

  const cx   = col => (col - 1) * colWidth + colWidth / 2;
  const topY = row => (row - 1) * rowHeight;
  const botY = row => (row - 1) * rowHeight + NODE_H;

  function makeLine(fromId, toId, key) {
    const pp = posById[fromId];
    const cp = posById[toId];
    if (!pp || !cp) return null;
    const x1 = cx(pp.col), y1 = botY(pp.row);
    const x2 = cx(cp.col), y2 = topY(cp.row);
    const midY = (y1 + y2) / 2;
    return (
      <polyline
        key={key}
        points={`${x1},${y1} ${x1},${midY} ${x2},${midY} ${x2},${y2}`}
        fill="none" stroke="#3a6a9a" strokeWidth={2} strokeLinejoin="round"
      />
    );
  }

  const parentLines = items
    .filter(item => item.parent && posById[item.parent] && posById[item.id])
    .map(item => makeLine(item.parent, item.id, `${item.parent}-${item.id}`));

  const extraLines = (layout.extraLines ?? [])
    .map(el => makeLine(el.from, el.to, `extra-${el.from}-${el.to}`));

  return (
    <div style={{ position: "relative", width: svgW, height: svgH }}>
      <svg width={svgW} height={svgH}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
        {parentLines}
        {extraLines}
      </svg>

      {items.map(item => {
        const pos = posById[item.id];
        if (!pos) return null;
        const left       = (pos.col - 1) * colWidth + COL_GAP / 2;
        const top        = (pos.row  - 1) * rowHeight;
        const iconBg     = item.bgColor     ?? "#1a4a8a";
        const iconBorder = item.borderColor ?? colors.border;
        const unlimited  = item.maxLevel >= 999999;
        const maxLvlTxt  = item.maxLevel.toLocaleString();
        const statLine   = item.statAmt !== undefined && item.statKey
          ? formatStat(item.statAmt, item.statKey) : null;
        const maxBonus   = !unlimited && item.statAmt !== undefined && item.statKey
          ? formatStatTotal(item.statAmt * item.maxLevel, item.statKey, fmt) : null;

        return (
          <div key={item.id} onClick={() => onOpen(item)}
            style={{
              position: "absolute", left, top,
              width: NODE_W, minHeight: NODE_H,
              background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`,
              border: `1px solid ${colors.border}`,
              borderRadius: 10, padding: "10px 12px",
              display: "flex", gap: 10, alignItems: "flex-start",
              cursor: "pointer", transition: "border-color 0.15s", boxSizing: "border-box",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}>

            {/* Icon */}
            <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: iconBg, border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: 2 }}>
              {item.icon && <img src={getIconUrl(item.icon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />}
            </div>

            {/* Text */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, lineHeight: 1.3, marginBottom: 3, wordBreak: "break-word" }}>{item.name}</div>
              {statLine && (
                <div style={{ fontSize: 12, color: colors.positive, lineHeight: 1.2, marginBottom: 2 }}>
                  {statLine} / lvl{maxBonus && <span style={{ color: colors.gold, marginLeft: 6 }}>({maxBonus} max)</span>}
                </div>
              )}
              <div style={{ fontSize: 12, color: colors.muted, marginBottom: item.waveReq > 0 ? 4 : 0 }}>
                Max lvl: {maxLvlTxt}
              </div>
              {item.waveReq > 0 && (
                <div style={{ display: "inline-block", background: "#1a2a3a", border: "1px solid #ffaa44", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700, color: "#ffaa44" }}>
                  Unlocks: Wave {item.waveReq.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TechTreeViewAbs({ onOpen }) {
  const [activeTab, setActiveTab] = useState("Tech");
  const isMobile = useIsMobile();
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mobile: use the standard card list
  if (isMobile) {
    return (
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["Tech", "Supreme Tech"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? colors.accent : colors.panel,
                color: activeTab === tab ? "#000" : colors.text,
                border: `1px solid ${activeTab === tab ? colors.accent : colors.border}`,
                borderRadius: 6, padding: "7px 16px", cursor: "pointer",
                fontFamily: "inherit", fontWeight: 700, fontSize: 14,
              }}>
              {tab}
            </button>
          ))}
        </div>
        <SheetView
          sectionData={{ ...SECTION_MAP["tech"].data, groups: { [activeTab]: techData.groups[activeTab] } }}
          onOpen={onOpen}
        />
      </div>
    );
  }

  const layout = techTreeDisplayData[activeTab];
  const items  = techData.groups[activeTab];

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["Tech", "Supreme Tech"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? colors.accent : colors.panel,
              color: activeTab === tab ? "#000" : colors.text,
              border: `1px solid ${activeTab === tab ? colors.accent : colors.border}`,
              borderRadius: 6, padding: "8px 26px", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 700, fontSize: 14,
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tree — fills full content width, measured via ref */}
      <div ref={containerRef} style={{ width: "100%" }}>
        {containerWidth > 0 && (
          <TechTreeGroupAbs
            key={activeTab}
            items={items}
            layout={layout}
            onOpen={onOpen}
            containerWidth={containerWidth}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TECH TREE — FLEX VERSION
// ─────────────────────────────────────────────
function TechNodeCard({ item, onOpen, nodeRef, compact }) {
  const fmt        = useFmt();
  const iconBg     = item.bgColor     ?? "#1a4a8a";
  const iconBorder = item.borderColor ?? colors.border;
  const unlimited  = item.maxLevel >= 999999;
  const maxLvlTxt  = item.maxLevel.toLocaleString();
  const statLine   = item.statAmt !== undefined && item.statKey
    ? formatStat(item.statAmt, item.statKey) : null;
  const maxBonus   = !unlimited && item.statAmt !== undefined && item.statKey
    ? formatStatTotal(item.statAmt * item.maxLevel, item.statKey, fmt) : null;

  if (compact) {
    return (
      <div ref={nodeRef} onClick={() => onOpen(item)}
        style={{
          background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`,
          border: `1px solid ${colors.border}`,
          borderRadius: 10, padding: "8px 6px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          cursor: "pointer", transition: "border-color 0.15s", textAlign: "center",
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent}
        onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}>
        <div style={{ width: 36, height: 36, borderRadius: 6, background: iconBg, border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {item.icon && <img src={getIconUrl(item.icon)} alt="" style={{ width: 24, height: 24, objectFit: "contain" }} />}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: colors.text, lineHeight: 1.3, wordBreak: "break-word" }}>{item.name}</div>
      </div>
    );
  }

  return (
    <div ref={nodeRef} onClick={() => onOpen(item)}
      style={{
        background: `linear-gradient(180deg, #2a5c96 0%, ${colors.header} 100%)`,
        border: `1px solid ${colors.border}`,
        borderRadius: 10, padding: "10px 12px",
        display: "flex", gap: 10, alignItems: "flex-start",
        cursor: "pointer", transition: "border-color 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent}
      onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}>

      <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 8, background: iconBg, border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: 2 }}>
        {item.icon && <img src={getIconUrl(item.icon)} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, lineHeight: 1.3, marginBottom: 3, wordBreak: "break-word" }}>{item.name}</div>
        {statLine && (
          <div style={{ fontSize: 12, color: colors.positive, lineHeight: 1.2, marginBottom: 2 }}>
            {statLine} / lvl{maxBonus && <span style={{ color: colors.gold, marginLeft: 6 }}>({maxBonus} max)</span>}
          </div>
        )}
        <div style={{ fontSize: 12, color: colors.muted, marginBottom: item.waveReq > 0 ? 4 : 0 }}>
          Max lvl: {maxLvlTxt}
        </div>
        {item.waveReq > 0 && (
          <div style={{ display: "inline-block", background: "#1a2a3a", border: "1px solid #ffaa44", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700, color: "#ffaa44" }}>
            Unlocks: Wave {item.waveReq.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

function TechTreeGroup({ items, layout, onOpen }) {
  const cols    = layout.cols;
  const posById = layout.nodes;
  const ROW_GAP = 52;

  // Build rows: array of (cols) slots per row, null = empty, "spanned" = consumed by colSpan
  const maxRow = Math.max(...Object.values(posById).map(n => n.row));
  const rows   = Array.from({ length: maxRow }, (_, ri) => {
    const row = Array(cols).fill(null);
    for (const item of items) {
      const pos = posById[item.id];
      if (pos && pos.row === ri + 1) {
        const span = pos.colSpan ?? 1;
        row[pos.col - 1] = { item, colSpan: span };
        for (let s = 1; s < span; s++) row[pos.col - 1 + s] = "spanned";
      }
    }
    return row;
  });

  // Refs to each rendered node card, keyed by item id
  const nodeRefs     = useRef({});
  const containerRef = useRef(null);
  const [pts, setPts]                   = useState({});
  const [containerWidth, setContainerWidth] = useState(9999);

  // Remeasure lines on resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const compact = containerWidth / cols < 160;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const next = {};
    for (const [id, el] of Object.entries(nodeRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next[id] = { cx: r.left - cr.left + r.width / 2, top: r.top - cr.top, bottom: r.bottom - cr.top };
    }
    // Only update state if positions actually changed — prevents infinite loop
    setPts(prev => {
      const ids = Object.keys(next);
      if (ids.length !== Object.keys(prev).length) return next;
      for (const id of ids) {
        const p = prev[id];
        const n = next[id];
        if (!p || p.cx !== n.cx || p.top !== n.top || p.bottom !== n.bottom) return next;
      }
      return prev;
    });
  });

  function makeLine(fromId, toId, key) {
    const p = pts[fromId], c = pts[toId];
    if (!p || !c) return null;
    const midY = (p.bottom + c.top) / 2;
    return (
      <polyline key={key}
        points={`${p.cx},${p.bottom} ${p.cx},${midY} ${c.cx},${midY} ${c.cx},${c.top}`}
        fill="none" stroke="#3a6a9a" strokeWidth={2} strokeLinejoin="round" />
    );
  }

  const svgHeight = Object.values(pts).reduce((m, p) => Math.max(m, p.bottom), 0);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* SVG lines — rendered behind the rows */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: svgHeight, pointerEvents: "none", zIndex: 0 }}>
        {items.filter(i => i.parent).map(i => makeLine(i.parent, i.id, `${i.parent}-${i.id}`))}
        {(layout.extraLines ?? []).map(el => makeLine(el.from, el.to, `extra-${el.from}-${el.to}`))}
      </svg>

      {/* Rows */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: "flex", marginBottom: ri < rows.length - 1 ? ROW_GAP : 0 }}>
            {row.map((slot, ci) => {
              if (slot === "spanned") return null;
              const colSpan = slot?.colSpan ?? 1;
              return (
                <div key={ci} style={{ flex: colSpan, minWidth: 0, padding: "0 8px", display: "flex", justifyContent: "center" }}>
                  {slot?.item && (
                    <div style={{ width: colSpan > 1 ? `${100 / colSpan}%` : "100%" }}>
                      <TechNodeCard
                        item={slot.item}
                        onOpen={onOpen}
                        nodeRef={el => nodeRefs.current[slot.item.id] = el}
                        compact={compact}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function TechTreeView({ onOpen }) {
  const [activeTab, setActiveTab] = useState("Tech");
  const isMobile = useIsMobile();

  const TAB_COLORS = {
    "Tech":         { bg: "#3a6eb0", border: "#4a7ec0", activeBg: colors.accent, activeText: "#000" },
    "Supreme Tech": { bg: "#8b0000", border: "#cc2222", activeBg: "#cc2222",     activeText: "#fff" },
  };

  const sectionTitle = (() => {
    const tc = TAB_COLORS[activeTab];
    return (
      <div style={{ background: `linear-gradient(180deg, ${tc.bg}dd 0%, ${tc.bg}99 100%)`, border: `1px solid ${tc.border}`, borderRadius: 8, padding: "8px 20px", marginBottom: 16, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
          {activeTab}
        </span>
      </div>
    );
  })();

  const tabBar = (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {["Tech", "Supreme Tech"].map(tab => {
        const tc = TAB_COLORS[tab];
        const isActive = activeTab === tab;
        return (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              background: isActive ? tc.activeBg : colors.panel,
              color: isActive ? tc.activeText : colors.text,
              border: `1px solid ${isActive ? tc.border : colors.border}`,
              borderRadius: 6, padding: "8px 26px", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 700, fontSize: 14,
            }}>
            {tab}
          </button>
        );
      })}
    </div>
  );

  if (isMobile) {
    return (
      <div>
        {tabBar}
        {sectionTitle}
        <SheetView
          sectionData={{ ...SECTION_MAP["tech"].data, groups: { [activeTab]: techData.groups[activeTab] } }}
          onOpen={onOpen}
        />
      </div>
    );
  }

  return (
    <div>
      {tabBar}
      {sectionTitle}
      <TechTreeGroup
        key={activeTab}
        items={techData.groups[activeTab]}
        layout={techTreeDisplayData[activeTab]}
        onOpen={onOpen}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────
function Sidebar({ activeKey, onSelect, isOpen, onClose }) {
  const [open, setOpen] = useState(() => {
    const initial = {};
    for (const group of NAV_GROUPS) {
      initial[group.label] = group.items.some(item => item.key === activeKey);
    }
    return initial;
  });

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
      {/* Standalone Home button */}
      {(() => {
        const isActive = activeKey === "home";
        return (
          <button onClick={() => handleSelect("home")}
            style={{ width: "100%", background: isActive ? `linear-gradient(90deg, ${colors.accent}22 0%, transparent 100%)` : "none", border: "none", borderLeft: isActive ? `3px solid ${colors.accent}` : "3px solid transparent", cursor: "pointer", padding: "9px 16px 9px 20px", textAlign: "left", color: isActive ? colors.accent : colors.text, fontSize: 14, fontWeight: isActive ? 700 : 500, transition: "color 0.15s, background 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
            <span>Home</span>
            <img src={getIconUrl("tower2.png")} alt="" style={{ width: 20, height: 20, objectFit: "contain", opacity: isActive ? 1 : 0.6, flexShrink: 0 }} />
          </button>
        );
      })()}
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
    () => localStorage.getItem("activeKey") ?? "home"
  );
  const [modalItem,    setModalItem]    = useState(null);
  const [modalFormula, setModalFormula] = useState(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);
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
        <div style={{ padding: "14px 0", cursor: "pointer" }} onClick={() => { setActiveKey("home"); localStorage.setItem("activeKey", "home"); }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: colors.accent, letterSpacing: "0.06em", textTransform: "uppercase", textShadow: "0 0 12px rgba(245,146,30,0.4)" }}>Idle Hero TD</div>
          <div style={{ fontSize: 11, color: colors.muted, marginTop: 1, letterSpacing: "0.04em" }}>Game Data Reference</div>
          <div style={{ fontSize: 10, color: colors.muted, opacity: 0.7, marginTop: 1 }}>by Asingh · v15.04</div>
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
          {activeSection && activeKey !== "tech" && (
            <SheetView
              sectionData={activeSection.data}
              onOpen={item => openModal(item, activeSection.data.costFormula)}
            />
          )}
          {activeKey === "tech" && (
            <TechTreeView onOpen={item => openModal(item, SECTION_MAP["tech"].data.costFormula)} />
          )}
          {activeKey === "allHeroes"  && <AllHeroesView />}
          {activeKey === "synergies"  && <AllSynergiesView />}
          {activeKey === "milestones" && <AllMilestonesView />}
          {activeKey === "rankExp"    && <RankExpView />}
          {activeKey === "attributes"   && <AttributesView />}
          {activeKey === "combatStyles" && <CombatStylesView />}
          {activeKey === "rankRequired" && <RankRequiredView />}
          {activeKey === "enemyHp"      && <EnemyHpView />}
          {activeKey === "home"       && <HomeView onNavigate={key => { setActiveKey(key); localStorage.setItem("activeKey", key); }} />}
          {activeKey === "brackets"   && <BracketsView />}
          {activeKey === "allMaps"    && <AllMapsView />}
          {activeKey === "mapPerks"   && <MapPerksView />}
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
