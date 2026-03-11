import { useState, useMemo } from "react";

// ─────────────────────────────────────────────
// INITIAL DATA  ─ the only thing you ever edit
// In a real setup these come from JSON files
// ─────────────────────────────────────────────
const INITIAL_DATA = {
  research: {
    label: "Research",
    costFn: "geometric",
    groups: {
      Combat: [
        { id: "damage",       name: "Damage I",       baseCost: 5,     baseValue: 0.05, maxLevel: 999999, multiCost: 1.0 },
        { id: "attack_speed", name: "Attack Speed",   baseCost: 10,    baseValue: 0.03, maxLevel: 15,     multiCost: 3.0 },
        { id: "crit_chance",  name: "Crit Chance",    baseCost: 15,    baseValue: 0.01, maxLevel: 25,     multiCost: 4.0 },
        { id: "crit_damage",  name: "Crit Damage",    baseCost: 10,    baseValue: 0.02, maxLevel: 20,     multiCost: 2.5 },
      ],
      Utility: [
        { id: "kill_gold",    name: "Kill Gold",      baseCost: 20,    baseValue: 0.02, maxLevel: 50,     multiCost: 2.0 },
        { id: "skill_power",  name: "Skill Power",    baseCost: 25,    baseValue: 0.05, maxLevel: 30,     multiCost: 1.5 },
      ],
    },
  },
  spells: {
    label: "Spells",
    costFn: "linear",
    groups: {
      "Hero Buffs": [
        { id: "spell_strength",  name: "Strength",   description: "All heroes gain +x% damage for x seconds.",       maxLevel: 15, baseBonus: 25,  unlockCost: 10  },
        { id: "spell_agility",   name: "Agility",    description: "All heroes gain +x% attack speed for x seconds.", maxLevel: 15, baseBonus: 20,  unlockCost: 10  },
        { id: "spell_hawkeyes",  name: "Hawk Eyes",  description: "All heroes gain +x% range for x seconds.",        maxLevel: 15, baseBonus: 10,  unlockCost: 25  },
      ],
      "Global Effects": [
        { id: "spell_gold",      name: "Gold Rush",  description: "Boosts gold income by x% for x seconds.",         maxLevel: 10, baseBonus: 50,  unlockCost: 50  },
        { id: "spell_exp",       name: "Wisdom",     description: "All heroes gain +x% EXP for x seconds.",          maxLevel: 10, baseBonus: 30,  unlockCost: 100 },
      ],
    },
  },
  powerUps: {
    label: "Power Ups",
    costFn: "compound",
    groups: {
      Combat: [
        { id: "pu_damage",       name: "Damage I",    baseCost: 500,   baseValue: 0.05, maxLevel: 999999, multiCost: 1.1  },
        { id: "pu_range",        name: "Range",       baseCost: 5000,  baseValue: 0.01, maxLevel: 10,     multiCost: 5.0  },
        { id: "pu_crit_damage",  name: "Crit Damage", baseCost: 10000, baseValue: 0.05, maxLevel: 10,     multiCost: 3.0  },
      ],
    },
  },
};

// ─────────────────────────────────────────────
// COST COMPUTATION FUNCTIONS
// These replace the spreadsheet custom formulas
// ─────────────────────────────────────────────
function formatBigNum(n) {
  if (n === Infinity || n > 1e18) return "∞";
  const suffixes = ["", "K", "M", "B", "T", "aa", "ab", "ac"];
  const tier = Math.max(0, Math.floor(Math.log10(Math.max(1, n)) / 3));
  if (tier === 0) return n.toFixed(0);
  return (n / Math.pow(1000, tier)).toFixed(2) + suffixes[Math.min(tier, suffixes.length - 1)];
}

function computeTotalCost(baseCost, multiCost, maxLevel, costFn) {
  if (maxLevel > 10000) return Infinity;
  if (costFn === "geometric") {
    if (multiCost === 1) return baseCost * maxLevel;
    return baseCost * (Math.pow(multiCost, maxLevel) - 1) / (multiCost - 1);
  }
  if (costFn === "linear") return baseCost * maxLevel;
  if (costFn === "compound") {
    let total = 0, cost = baseCost;
    for (let i = 0; i < Math.min(maxLevel, 200); i++) { total += cost; cost *= multiCost; }
    return total;
  }
  return baseCost * maxLevel;
}

// ─────────────────────────────────────────────
// RANK EXP FORMULA  (replaces 6000-row sheet)
// ─────────────────────────────────────────────
function rankExpForLevel(lvl) {
  let v = 1000 * Math.pow(lvl - 1, 3);
  if (lvl > 2)   v *= (1 + lvl * 0.05);
  if (lvl > 100) v *= (1 + (lvl - 100) * 0.02);
  if (lvl > 250) v *= (1 + (lvl - 250) * 0.01);
  if (lvl > 400) v *= (1 + (lvl - 400) * 0.01);
  if (lvl > 500) v *= (1 + (lvl - 500) * 0.01);
  if (lvl > 1000) v *= (1 + (lvl - 1000) * 0.01);
  if (lvl > 1500) v *= (1 + (lvl - 1500) * 0.02);
  if (lvl > 2000) v *= (1 + (lvl - 2000) * 0.03);
  return Math.round(v);
}

// ─────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────
const TABS = ["Research", "Spells", "Power Ups", "Rank Exp", "⚙ Edit Config"];
const TAB_KEYS = ["research", "spells", "powerUps", "rankExp", "edit"];

const colors = {
  bg: "#0d0f14",
  panel: "#13161e",
  border: "#1e2330",
  accent: "#e8a82a",
  accentDim: "#6b4e10",
  text: "#c8cdd8",
  muted: "#4a5268",
  positive: "#4caf86",
  header: "#1a1d28",
};

function Badge({ children, color }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 600,
      letterSpacing: "0.04em", whiteSpace: "nowrap"
    }}>{children}</span>
  );
}

function StatRow({ label, value, sub }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `1px solid ${colors.border}`, padding: "6px 0", gap: 8 }}>
      <span style={{ color: colors.muted, fontSize: 12 }}>{label}</span>
      <span style={{ color: colors.text, fontFamily: "monospace", fontSize: 13, textAlign: "right" }}>
        {value} {sub && <span style={{ color: colors.muted, fontSize: 11 }}>{sub}</span>}
      </span>
    </div>
  );
}

function SectionCard({ title, items, costFn }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: colors.accentDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {items.map(item => {
          const maxVal = item.baseValue !== undefined ? item.baseValue * item.maxLevel : null;
          const totalCost = item.baseCost !== undefined
            ? computeTotalCost(item.baseCost, item.multiCost, item.maxLevel, costFn)
            : null;
          return (
            <div key={item.id} style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ color: colors.text, fontWeight: 600, fontSize: 13 }}>{item.name}</span>
                <Badge color={colors.accent}>{item.maxLevel === 999999 ? "∞ levels" : `${item.maxLevel} lvl`}</Badge>
              </div>
              {item.description && <div style={{ color: colors.muted, fontSize: 11, marginBottom: 8, fontStyle: "italic" }}>{item.description}</div>}
              {item.baseCost !== undefined && <StatRow label="Base Cost" value={formatBigNum(item.baseCost)} />}
              {item.baseValue !== undefined && <StatRow label="Base Value" value={`+${(item.baseValue * 100).toFixed(1)}%`} />}
              {maxVal !== null && item.maxLevel < 999999 && <StatRow label="Max Bonus" value={`+${(maxVal * 100).toFixed(1)}%`} />}
              {item.multiCost !== undefined && item.multiCost !== 1 && <StatRow label="Cost Multi" value={`×${item.multiCost}`} />}
              {totalCost !== null && <StatRow label="Total Cost" value={formatBigNum(totalCost)} sub={totalCost === Infinity ? "(unbounded)" : ""} />}
              {item.unlockCost !== undefined && <StatRow label="Unlock Cost" value={formatBigNum(item.unlockCost)} />}
              {item.baseBonus !== undefined && <StatRow label="Base Bonus" value={`+${item.baseBonus}%`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SheetView({ sheetKey, sheetData }) {
  return (
    <div>
      {Object.entries(sheetData.groups).map(([groupName, items]) => (
        <SectionCard key={groupName} title={groupName} items={items} costFn={sheetData.costFn} />
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
        {[10, 20, 50, 100, 500].map(n => (
          <button key={n} onClick={() => setMaxLvl(n)}
            style={{ background: maxLvl === n ? colors.accent : colors.header, color: maxLvl === n ? "#000" : colors.text, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: maxLvl === n ? 700 : 400, fontSize: 12 }}>
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
      <div style={{ marginTop: 12, padding: "10px 14px", background: colors.accentDim + "33", border: `1px solid ${colors.accentDim}`, borderRadius: 6, fontSize: 12, color: colors.muted }}>
        💡 This table is <strong style={{ color: colors.text }}>generated on demand</strong> from a single formula function. In your spreadsheet this was 6,000 rows of copied formulas.
      </div>
    </div>
  );
}

function EditConfig({ data, onSave }) {
  const [draft, setDraft] = useState(JSON.stringify(data, null, 2));
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    try {
      const parsed = JSON.parse(draft);
      onSave(parsed);
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ color: colors.muted, fontSize: 12, flex: 1 }}>Edit JSON config directly. In production, these files live in your GitHub repo. Changes are committed and the site auto-deploys.</span>
        <button onClick={handleSave} style={{ background: saved ? colors.positive : colors.accent, color: "#000", border: "none", borderRadius: 6, padding: "8px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "background 0.2s" }}>
          {saved ? "✓ Applied" : "Apply Changes"}
        </button>
      </div>
      {error && <div style={{ background: "#ff4a4a22", border: "1px solid #ff4a4a44", color: "#ff8888", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 12 }}>JSON Error: {error}</div>}
      <textarea value={draft} onChange={e => setDraft(e.target.value)}
        style={{ width: "100%", height: 480, background: colors.header, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, resize: "vertical", boxSizing: "border-box", outline: "none" }}
      />
      <div style={{ marginTop: 12, padding: "10px 14px", background: "#1a2830", border: `1px solid #1e3540`, borderRadius: 6, fontSize: 12, color: colors.muted }}>
        💡 <strong style={{ color: colors.text }}>Real workflow:</strong> Each section would be a separate <code style={{ color: colors.positive }}>research.json</code>, <code style={{ color: colors.positive }}>spells.json</code> etc. You edit via a form UI or directly in GitHub. No more formula chains — just the config values that actually matter.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState(INITIAL_DATA);

  const sheetTabMap = { 0: "research", 1: "spells", 2: "powerUps" };

  return (
    <div style={{ background: colors.bg, minHeight: "100vh", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: colors.text }}>
      {/* Header */}
      <div style={{ background: colors.panel, borderBottom: `1px solid ${colors.border}`, padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ padding: "14px 0" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.accent, letterSpacing: "0.02em" }}>IdleHeroTD</div>
            <div style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>Game Data Admin</div>
          </div>
          <div style={{ flex: 1 }} />
          <Badge color={colors.positive}>JSON-driven</Badge>
          <Badge color={colors.accent}>No spreadsheet formulas</Badge>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: colors.panel, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "0 24px", gap: 2 }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setActiveTab(i)}
              style={{ background: "none", border: "none", borderBottom: activeTab === i ? `2px solid ${colors.accent}` : "2px solid transparent", color: activeTab === i ? colors.accent : colors.muted, padding: "12px 16px", cursor: "pointer", fontSize: 13, fontWeight: activeTab === i ? 600 : 400, marginBottom: -1, transition: "color 0.15s" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        {activeTab === 0 && <SheetView sheetKey="research" sheetData={data.research} />}
        {activeTab === 1 && <SheetView sheetKey="spells" sheetData={data.spells} />}
        {activeTab === 2 && <SheetView sheetKey="powerUps" sheetData={data.powerUps} />}
        {activeTab === 3 && <RankExpView />}
        {activeTab === 4 && <EditConfig data={data} onSave={setData} />}
      </div>
    </div>
  );
}
