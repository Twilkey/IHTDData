import { useMemo, useState, useTransition } from "react";

function getHomeSections(colors, isAdmin) {
  const sections = [
    {
      group: "Upgrades",
      color: "#4a9eff",
      items: [
        { key: "research", label: "Research", icon: "_energy.png", desc: "Prestige power upgrades" },
        { key: "spells", label: "Spells", icon: "_energy.png", desc: "Spell levels and energy costs" },
        { key: "runes", label: "Runes", icon: "_rune_2.png", desc: "Rune bonuses" },
        { key: "gems", label: "Gems", icon: "_gem_2.png", desc: "Gem upgrades" },
        { key: "powerups", label: "Power Ups", icon: "_prestigePower.png", desc: "Power up levels" },
        { key: "tech", label: "Tech", icon: "_techPts_2.png", desc: "Tech tree upgrades" },
        { key: "tournament", label: "Tournament", icon: "_tournPts.png", desc: "Tournament upgrades" },
        { key: "tickets", label: "Tickets", icon: "_ticket.png", desc: "Weekly ticket upgrades" },
        { key: "ultimus", label: "Ultimus", icon: "token_red.png", desc: "Ultimus upgrades" },
        { key: "mastery", label: "Mastery", icon: "_mastery_2.png", desc: "Mastery levels" },
      ],
    },
    {
      group: "Hero Data",
      color: "#b47aff",
      items: [
        { key: "allHeroes", label: "All Heroes", icon: "_heroHelm.png", desc: "Stats, skills and synergies" },
        { key: "synergies", label: "Synergies", icon: "_synergy.png", desc: "Browse all synergy bonuses" },
        { key: "milestones", label: "Milestones", icon: "_star 3610.png", desc: "Hero milestone rewards" },
        { key: "rankExp", label: "Rank Exp", icon: "_killExp.png", desc: "Experience per rank level" },
        { key: "attributes", label: "Attributes", icon: "_attributePoints_0.png", desc: "Personal and global attribute costs" },
        { key: "combatStyles", label: "Combat Styles", icon: "icon_scale.png", desc: "Combat style bonuses and rank requirements" },
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
        { key: "allMaps", label: "All Maps", icon: "Icon_Map_0.png", desc: "Map perks and unlock requirements" },
        { key: "mapPerks", label: "Map Perks", icon: "_starEmpty_0.png", desc: "Perk points earned per wave milestone" },
      ],
    },
    {
      group: "Loadout",
      color: "#68d391",
      items: [
        { key: "statsHub", label: "Stats Hub", icon: "_attributePoints_0.png", desc: "Review global and hero-specific loadout stat breakdowns" },
        { key: "loadoutBuilderPlacement", label: "Map Loadouts", icon: "tower2.png", desc: "Plan hero placements on authored map nodes" },
        { key: "heroLoadout", label: "Hero Loadout", icon: "_heroHelm.png", desc: "Build and save focused hero equipment and stat plans" },
        { key: "statsLoadout", label: "Upgrades Loadout", icon: "_heroes.png", desc: "Track purchased upgrade levels and preview stat gains by tab" },
        { key: "playerLoadout", label: "Player Loadout", icon: "_background.png", desc: "Track purchased player icons and backgrounds as global stats" },
      ],
    },
    {
      group: "Simulator",
      color: "#ff9f5a",
      items: [
        { key: "statSimulator", label: "Stat Simulator", icon: "_attributePoints_0.png", desc: "Standalone stat sandbox with explicit loadout import and export bridges" },
        { key: "resourceOptimizer", label: "Resource Optimizer", icon: "_coin.png", desc: "Greedy budget optimizer with optional Upgrades Loadout sync" },
      ],
    },
    {
      group: "Misc",
      color: "#f5c842",
      items: [
        { key: "battpassExp", label: "Battlepass Exp", icon: "_battlepass.png", desc: "EXP required per battlepass level" },
        { key: "wavePerks", label: "Wave Perks", icon: "flagSword.png", desc: "Review wave perk values and effect multipliers" },
        { key: "challenges", label: "Challenges", icon: "_starBlue.png", desc: "Challenge requirements and permanent rewards" },
        { key: "playerIcons", label: "Player Icons", icon: "icon_inforound.png", desc: "Unlock costs and rewards for player icons" },
        { key: "playerBackgrounds", label: "Player Backgrounds", icon: "_prestigeBg.png", desc: "Background unlock requirements and rewards" },
      ],
    },
    {
      group: "Calculators",
      color: colors.accent,
      items: [
        { key: "rankRequired", label: "Rank Required", icon: "_attributePoints_0.png", desc: "Min rank needed for your attribute levels" },
        { key: "enemyHp", label: "Enemy HP", icon: "_bosses.png", desc: "Enemy HP by wave with player reductions" },
      ],
    },
    {
      group: "Admin",
      color: "#ff8c42",
      items: [
        { key: "coordFinder", label: "Coord Finder", icon: "_edit.png", desc: "Create and edit normalized map spot coordinates" },
      ],
    },
  ];

  return isAdmin ? sections : sections.filter((section) => section.group !== "Admin");
}

const STORE_LINKS = [
  { label: "Android", url: "https://play.google.com/store/apps/details?id=com.SwellGamesLLC.IdleHeroTD", color: "#78c257", icon: "icon_android.png", desc: "Get it on Google Play" },
  { label: "iOS", url: "https://apps.apple.com/us/app/id6479284270", color: "#aaaaaa", icon: "icon_ios.png", desc: "Download on the App Store" },
  { label: "Steam", url: "https://store.steampowered.com/app/2897580", color: "#1b9de2", icon: "icon_steam.png", desc: "Available on Steam" },
  { label: "Discord", url: "https://discord.com/invite/vs3uJUsxVx", color: "#5865f2", icon: "discord-mark-blue.png", desc: "Join the community" },
];

export function HomeView({ colors, getIconUrl, onNavigate, isMobile, isAdmin }) {
  const homeSections = getHomeSections(colors, isAdmin);

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 36, padding: "32px 20px", background: `linear-gradient(180deg, ${colors.panel} 0%, transparent 100%)`, borderRadius: 12, border: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 900, color: colors.accent, letterSpacing: "0.06em", textTransform: "uppercase", textShadow: "0 0 24px rgba(245,146,30,0.5)", marginBottom: 8 }}>
          Idle Hero TD
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 4 }}>Game Data Reference</div>
        <div style={{ fontSize: 13, color: colors.muted, marginBottom: 20 }}>by Asingh · Game Version 15.04</div>
        <p style={{ fontSize: 14, color: colors.muted, lineHeight: 1.7, maxWidth: 560, margin: "0 auto 12px" }}>
          A comprehensive reference tool for Idle Hero TD - covering upgrade costs, hero stats, synergies, milestones, mastery exp, map perks, tournament brackets, and battlepass exp. Use the sidebar to navigate between sections.
        </p>
        <p style={{ fontSize: 13, color: colors.muted, lineHeight: 1.6, maxWidth: 560, margin: "0 auto 24px", padding: "10px 16px", background: colors.header, borderRadius: 8, border: `1px solid ${colors.border}` }}>
          Found an error or something looks off? Please message <span style={{ color: colors.accent, fontWeight: 700 }}>Asingh</span> or any of the mods on the Discord server.
        </p>
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

      {homeSections.map(section => (
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

export function BracketsView({ colors, getIconUrl, tournamentBracketsData }) {
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
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("Icon_Trophy_0.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Tournament Brackets</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Base trophy rewards by tier and placement.</div>
        </div>
      </div>

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
              Tier {activeBracket.tier} - {activeBracket.minWave.toLocaleString()}-{activeBracket.maxWave != null ? activeBracket.maxWave.toLocaleString() : "∞"}
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

      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 8, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
          <thead style={{ background: colors.panel }}>
            <tr>
              <th style={{ ...thS, textAlign: "left" }}>Tier</th>
              <th style={{ ...thS, textAlign: "left" }}>Wave Range</th>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => (
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
                    {b.minWave.toLocaleString()}-{b.maxWave != null ? b.maxWave.toLocaleString() : "∞"}
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

function battpassExpForLevel(lvl) {
  const roundHalfUp = (value) => Math.floor(value + 0.5);
  let base = 50 * lvl * lvl;

  if (lvl > 35) base = roundHalfUp(base * (1 + (lvl - 35) * 0.05));
  if (lvl > 50) base = roundHalfUp(base * (1 + (lvl - 50) * 0.05));
  if (lvl > 75) base = roundHalfUp(base * (1 + (lvl - 75) * 0.05));
  if (lvl > 100) base = roundHalfUp(base * (1 + (lvl - 100) * 0.05));

  return base;
}

export function BattlepassExpView({ colors, fmt }) {
  const [startInput, setStartInput] = useState("1");
  const [endInput, setEndInput] = useState("150");
  const [range, setRange] = useState({ start: 1, end: 150 });
  const [sortDir, setSortDir] = useState("asc");
  const [isPending, startTransition] = useTransition();

  function applyRange() {
    const start = Math.max(1, parseInt(startInput) || 1);
    const end = Math.max(start, parseInt(endInput) || start);
    setStartInput(String(start));
    setEndInput(String(end));
    setRange({ start, end });
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") applyRange();
  }

  const { rows, totalExp } = useMemo(() => {
    const nextRows = [];
    let cumulative = 0;

    for (let level = range.start; level <= range.end; level++) {
      const required = battpassExpForLevel(level - 1);
      cumulative += required;
      nextRows.push({ level, required, cumulative });
    }

    return {
      rows: nextRows,
      totalExp: nextRows.reduce((sum, row) => sum + row.required, 0),
    };
  }, [range]);

  const displayRows = sortDir === "asc" ? rows : [...rows].reverse();

  const inputStyle = {
    background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 6,
    color: colors.text, padding: "6px 10px", fontSize: 14, fontFamily: "inherit",
    width: 90, textAlign: "center", outline: "none",
  };

  const thBase = {
    padding: "10px 16px",
    fontWeight: 600,
    textAlign: "left",
    borderBottom: `1px solid ${colors.border}`,
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  };
  const thMuted = { ...thBase, color: colors.muted };
  const thSortable = {
    ...thBase,
    color: colors.accent,
    cursor: isPending ? "wait" : "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ color: colors.muted, fontSize: 13 }}>From level</span>
        <input
          type="number" value={startInput} min={1}
          onChange={event => setStartInput(event.target.value)}
          onKeyDown={handleKeyDown}
          style={inputStyle}
        />
        <span style={{ color: colors.muted, fontSize: 13 }}>to</span>
        <input
          type="number" value={endInput} min={1}
          onChange={event => setEndInput(event.target.value)}
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
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "inline-block", background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 16px" }}>
          <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total EXP (Levels {range.start}-{range.end})</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.positive, fontFamily: "monospace" }}>{fmt(totalExp)}</div>
        </div>
      </div>
      <div style={{ background: colors.header, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: colors.panel }}>
              <th onClick={() => !isPending && startTransition(() => setSortDir(current => current === "asc" ? "desc" : "asc"))} style={thSortable}>
                Level{isPending ? <span className="sort-spinner" /> : (sortDir === "asc" ? " ▲" : " ▼")}
              </th>
              <th style={thMuted}>EXP Required</th>
              <th style={thMuted}>Cumulative EXP</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, index) => (
              <tr key={row.level} style={{ background: index % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                <td style={{ padding: "8px 16px", color: colors.accent, fontWeight: 600 }}>{row.level}</td>
                <td style={{ padding: "8px 16px", color: colors.text, fontFamily: "monospace" }}>{fmt(row.required)}</td>
                <td style={{ padding: "8px 16px", color: colors.positive, fontFamily: "monospace" }}>{fmt(row.cumulative)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const MAP_PERK_START = 25000;
const MAP_PERK_INTERVAL = 1000;

export function MapPerksView({ colors, getIconUrl }) {
  const [startWave, setStartWave] = useState(MAP_PERK_START);
  const [endWave, setEndWave] = useState(75000);
  const [startInput, setStartInput] = useState(String(MAP_PERK_START));
  const [endInput, setEndInput] = useState("75000");

  const clampWave = (value) => Math.max(MAP_PERK_START, Math.round(value / MAP_PERK_INTERVAL) * MAP_PERK_INTERVAL);

  function commitStart() {
    const nextWave = clampWave(parseInt(startInput) || MAP_PERK_START);
    setStartWave(nextWave);
    setStartInput(nextWave.toLocaleString().replace(/,/g, ""));

    if (nextWave > endWave) {
      setEndWave(nextWave);
      setEndInput(String(nextWave));
    }
  }

  function commitEnd() {
    const rawWave = clampWave(parseInt(endInput) || MAP_PERK_START);
    const nextWave = Math.max(rawWave, startWave);
    setEndWave(nextWave);
    setEndInput(String(nextWave));
  }

  const rows = useMemo(() => {
    const nextRows = [];

    for (let wave = startWave; wave <= endWave; wave += MAP_PERK_INTERVAL) {
      const milestoneIndex = (wave - MAP_PERK_START) / MAP_PERK_INTERVAL;
      const granted = milestoneIndex;
      const cumulative = milestoneIndex * (milestoneIndex + 1) / 2;
      nextRows.push({ wave, granted, cumulative });
    }

    return nextRows;
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
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <img src={getIconUrl("_starEmpty_0.png")} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Map Perks</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Perk points earned per wave milestone (every 1,000 waves from {MAP_PERK_START.toLocaleString()})</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "12px 16px" }}>
        <span style={{ color: colors.muted, fontSize: 13 }}>From wave</span>
        <input type="number" value={startInput} min={MAP_PERK_START} step={MAP_PERK_INTERVAL}
          onChange={event => setStartInput(event.target.value)}
          onBlur={commitStart}
          onKeyDown={event => event.key === "Enter" && commitStart()}
          style={inputStyle} />
        <span style={{ color: colors.muted, fontSize: 13 }}>to</span>
        <input type="number" value={endInput} min={MAP_PERK_START} step={MAP_PERK_INTERVAL}
          onChange={event => setEndInput(event.target.value)}
          onBlur={commitEnd}
          onKeyDown={event => event.key === "Enter" && commitEnd()}
          style={inputStyle} />
        <span style={{ fontSize: 13, color: colors.muted }}>
          - <span style={{ color: colors.accent, fontWeight: 700 }}>{rows[rows.length - 1]?.cumulative.toLocaleString() ?? 0}</span> total perks at wave {endWave.toLocaleString()}
        </span>
      </div>

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
            {rows.map((row, index) => (
              <tr key={row.wave} style={{ background: index % 2 === 0 ? "transparent" : colors.panel + "60", borderBottom: `1px solid ${colors.border}22` }}>
                <td style={{ padding: "7px 16px", color: colors.accent, fontWeight: 600 }}>{row.wave.toLocaleString()}</td>
                <td style={{ padding: "7px 16px", textAlign: "right", color: row.granted === 0 ? colors.muted : colors.text, fontWeight: row.granted > 0 ? 600 : 400 }}>
                  {row.granted === 0 ? "-" : `+${row.granted}`}
                </td>
                <td style={{ padding: "7px 16px", textAlign: "right", color: colors.gold, fontWeight: 600 }}>
                  {row.cumulative.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}