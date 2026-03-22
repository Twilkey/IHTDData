import { useEffect, useMemo, useRef, useState } from "react";

import combatStylesData from "../data/combat_styles.json";
import enemyHpData from "../data/enemy_hp.json";
import {
  createDefaultResourceOptimizerRows,
  formatResourceOptimizerInput,
  getResourceOptimizerCurrency,
  getResourceOptimizerLoadoutLevel,
  getResourceOptimizerResource,
  normalizeResourceOptimizerRows,
  optimizeResourceLevels,
  parseResourceOptimizerNumber,
  RESOURCE_OPTIMIZER_CURRENCIES,
} from "../lib/resourceOptimizer";
import { LOADOUT_RUNTIME_CHANGED_EVENT } from "../lib/loadoutRuntimeStore";
import { formatStatPerLevel, readStatsLoadoutState } from "../lib/statsLoadout";
import { useIsNarrowScreen } from "../lib/useIsNarrowScreen";

export function CombatStylesView({ colors, isMobile }) {
  const styles = combatStylesData.styles ?? [];

  function statLabel(key) {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()).trim();
  }

  const cols = isMobile ? 2 : 4;

  return (
    <div style={{ padding: "16px 12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
        {styles.map((style) => (
          <div
            key={style.id}
            style={{
              background: colors.panel,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>{style.name}</div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: "#0f2640",
                  border: "1px solid #2a5a8a",
                  color: "#7aaacf",
                  whiteSpace: "nowrap",
                }}
              >
                {style.rankReq > 0 ? `Rank ${style.rankReq.toLocaleString()}+` : "Available"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {style.bonuses.length === 0 ? (
                <span style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>No modifiers</span>
              ) : (
                style.bonuses.map((bonus, index) => (
                  <div key={index} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontWeight: 700, color: (() => {
                      const negatedGoodStats = ["skillCooldown"];
                      return (bonus.amount >= 0) !== negatedGoodStats.includes(bonus.stat) ? colors.positive : "#e05555";
                    })() }}>
                      {bonus.amount >= 0 ? "+" : ""}
                      {bonus.amount}
                      {bonus.isPercent ? "%" : ""}
                    </span>
                    <span style={{ color: colors.text, flex: 1 }}>{statLabel(bonus.stat)}</span>
                    {bonus.isGlobal ? (
                      <span style={{ fontSize: 10, color: colors.muted, background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "1px 5px", marginLeft: "auto" }}>Global</span>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EnemyHpView({ colors, fmt, getIconUrl, isMobile }) {
  const { enemy_hp_scaling, enemy_hp } = enemyHpData.playerStats;
  const wave_skip = enemyHpData.wave_skip_chance;

  const STORAGE_KEY = "enemyHpInputs";
  const savedInputs = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }, []);

  const [waveInput, setWaveInput] = useState(savedInputs.wave ?? "100");
  const [masteryInput, setMasteryInput] = useState(savedInputs.mastery ?? "0");
  const [ultimusInput, setUltimusInput] = useState(savedInputs.ultimus ?? "0");
  const [researchInput, setResearchInput] = useState(savedInputs.research ?? "0");
  const [techInput, setTechInput] = useState(savedInputs.tech ?? "0");
  const [runesInput, setRunesInput] = useState(savedInputs.runes ?? "0");
  const [tournSkipInput, setTournSkipInput] = useState(savedInputs.tournSkip ?? "0");
  const [runesSkipInput, setRunesSkipInput] = useState(savedInputs.runesSkip ?? "0");
  const [params, setParams] = useState(() => {
    const wave = Math.max(1, parseInt(savedInputs.wave, 10) || 100);
    return {
      wave,
      mastery: parseInt(savedInputs.mastery, 10) || 0,
      ultimus: parseInt(savedInputs.ultimus, 10) || 0,
      research: parseInt(savedInputs.research, 10) || 0,
      tech: parseInt(savedInputs.tech, 10) || 0,
      runes: parseInt(savedInputs.runes, 10) || 0,
      tournSkip: parseInt(savedInputs.tournSkip, 10) || 0,
      runesSkip: parseInt(savedInputs.runesSkip, 10) || 0,
    };
  });

  function clamp(value, max) {
    return Math.min(Math.max(parseInt(value, 10) || 0, 0), max);
  }

  function apply() {
    const wave = Math.max(1, parseInt(waveInput, 10) || 1);
    const mastery = clamp(masteryInput, enemy_hp_scaling.sources[0].maxLevel);
    const ultimus = clamp(ultimusInput, enemy_hp_scaling.sources[1].maxLevel);
    const research = clamp(researchInput, enemy_hp.sources[0].maxLevel);
    const tech = clamp(techInput, enemy_hp.sources[1].maxLevel);
    const runes = clamp(runesInput, enemy_hp.sources[2].maxLevel);
    const tournSkip = clamp(tournSkipInput, wave_skip.sources[0].maxLevel);
    const runesSkip = clamp(runesSkipInput, wave_skip.sources[1].maxLevel);
    const next = { wave, mastery, ultimus, research, tech, runes, tournSkip, runesSkip };

    setWaveInput(String(wave));
    setMasteryInput(String(mastery));
    setUltimusInput(String(ultimus));
    setResearchInput(String(research));
    setTechInput(String(tech));
    setRunesInput(String(runes));
    setTournSkipInput(String(tournSkip));
    setRunesSkipInput(String(runesSkip));
    setParams(next);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      wave: String(wave),
      mastery: String(mastery),
      ultimus: String(ultimus),
      research: String(research),
      tech: String(tech),
      runes: String(runes),
      tournSkip: String(tournSkip),
      runesSkip: String(runesSkip),
    }));
  }

  function clear() {
    setWaveInput("100");
    setMasteryInput("0");
    setUltimusInput("0");
    setResearchInput("0");
    setTechInput("0");
    setRunesInput("0");
    setTournSkipInput("0");
    setRunesSkipInput("0");
    setParams({ wave: 100, mastery: 0, ultimus: 0, research: 0, tech: 0, runes: 0, tournSkip: 0, runesSkip: 0 });
    localStorage.removeItem(STORAGE_KEY);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      apply();
    }
  }

  const result = useMemo(() => {
    const { startHp, moduloRates, waveRangeScales, enemyMultipliers } = enemyHpData;

    function getWaveRangeScale(wave) {
      for (const entry of waveRangeScales) {
        if (entry.maxWave === null || wave <= entry.maxWave) {
          return entry.scale;
        }
      }
      return 0.3;
    }

    function getBaseRate(wave) {
      if (wave % 10 === 0) {
        return moduloRates.mod10;
      }
      if (wave % 5 === 0) {
        return moduloRates.mod5;
      }
      return moduloRates.default;
    }

    function simulate(targetWave, scaleMultiplier) {
      const SAFE = Number.MAX_SAFE_INTEGER;
      let hp = startHp;

      for (let wave = 2; wave <= targetWave; wave += 1) {
        hp = Math.round((hp + 4) * (getBaseRate(wave) * getWaveRangeScale(wave) * scaleMultiplier + 1));
        if (hp >= SAFE) {
          let logHp = Math.log10(hp);
          for (let nextWave = wave + 1; nextWave <= targetWave; nextWave += 1) {
            logHp += Math.log10(getBaseRate(nextWave) * getWaveRangeScale(nextWave) * scaleMultiplier + 1);
          }
          return { logValue: logHp };
        }
      }

      return BigInt(Math.round(hp));
    }

    function mobsForWave(wave) {
      const digit = wave % 10;
      return { mobCount: digit === 0 ? 19 : 9 + digit, hasBoss: digit === 0 };
    }

    const scaleMultiplier = (1 - params.mastery * 0.005) * (1 - params.ultimus * 0.005);
    const hpMultiplier = (1 - params.research * enemy_hp.sources[0].amtPerLevel)
      * (1 - params.tech * enemy_hp.sources[1].amtPerLevel)
      * (1 - params.runes * enemy_hp.sources[2].amtPerLevel);

    const scalingPct = (1 - scaleMultiplier) * 100;
    const ehpPct = (1 - hpMultiplier) * 100;
    const skipChance = params.tournSkip * wave_skip.sources[0].amtPerLevel + params.runesSkip * wave_skip.sources[1].amtPerLevel;
    const effectiveWave = Math.max(1, Math.floor(params.wave * (1 - skipChance / 100)));

    const hp = simulate(params.wave, scaleMultiplier);
    const hpSkip = simulate(effectiveWave, scaleMultiplier);
    const logHpMultiplier = Math.log10(hpMultiplier);

    function buildTypes(rawHp, wave) {
      const { mobCount, hasBoss } = mobsForWave(wave);
      return [
        { key: "normal", label: "Normal", mult: 1, count: mobCount },
        { key: "boss", label: "Boss", mult: enemyMultipliers.boss, count: hasBoss ? 1 : 0 },
      ].map((type) => {
        let perHp;
        let totalHp;

        if (typeof rawHp === "bigint") {
          const PRECISION = 1_000_000_000_000n;
          const multiplier = BigInt(Math.round(type.mult * hpMultiplier * 1e12));
          perHp = (rawHp * multiplier + PRECISION / 2n) / PRECISION;
          totalHp = perHp * BigInt(type.count);
        } else {
          const logPerHp = rawHp.logValue + Math.log10(type.mult) + logHpMultiplier;
          perHp = { logValue: logPerHp };
          totalHp = { logValue: type.count > 0 ? logPerHp + Math.log10(type.count) : -Infinity };
        }

        return { ...type, hp: perHp, totalHp };
      });
    }

    const { mobCount, hasBoss } = mobsForWave(params.wave);
    const { mobCount: mobCountSkip, hasBoss: hasBossSkip } = mobsForWave(effectiveWave);

    return {
      baseHp: hp,
      types: buildTypes(hp, params.wave),
      typesSkip: buildTypes(hpSkip, effectiveWave),
      scalingPct,
      ehpPct,
      skipChance,
      effectiveWave,
      mobCount,
      hasBoss,
      mobCountSkip,
      hasBossSkip,
    };
  }, [params, wave_skip.sources, enemy_hp.sources, enemy_hp_scaling.sources]);

  const smallInput = {
    background: "#0f2640",
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    color: colors.text,
    padding: "5px 8px",
    fontSize: 13,
    fontFamily: "inherit",
    width: 68,
    textAlign: "center",
    outline: "none",
  };
  const typeColors = { normal: "#a3e8b0", boss: "#f87171" };

  const reductionCards = [
    {
      key: "ehp",
      label: "Enemy HP",
      badge: "Post-Sim",
      badgeColor: colors.accent,
      footer: { label: "Total reduction:", value: `-${result.ehpPct.toFixed(2)}%`, color: result.ehpPct > 0 ? colors.positive : colors.muted },
      sources: [
        { label: "Research", icon: "_energy.png", val: researchInput, set: setResearchInput, max: enemy_hp.sources[0].maxLevel, amtPer: enemy_hp.sources[0].amtPerLevel },
        { label: "Tech", icon: "_techPts_2.png", val: techInput, set: setTechInput, max: enemy_hp.sources[1].maxLevel, amtPer: enemy_hp.sources[1].amtPerLevel },
        { label: "Runes", icon: "_rune_2.png", val: runesInput, set: setRunesInput, max: enemy_hp.sources[2].maxLevel, amtPer: enemy_hp.sources[2].amtPerLevel },
      ],
    },
    {
      key: "scaling",
      label: "Enemy Scaling",
      badge: "Per Wave",
      badgeColor: "#60a5fa",
      footer: { label: "Total reduction:", value: `-${result.scalingPct.toFixed(2)}%`, color: result.scalingPct > 0 ? colors.positive : colors.muted },
      sources: [
        { label: "Mastery", icon: "_mastery_2.png", val: masteryInput, set: setMasteryInput, max: enemy_hp_scaling.sources[0].maxLevel, amtPer: enemy_hp_scaling.sources[0].amtPerLevel },
        { label: "Ultimus", icon: "token_red.png", val: ultimusInput, set: setUltimusInput, max: enemy_hp_scaling.sources[1].maxLevel, amtPer: enemy_hp_scaling.sources[1].amtPerLevel },
      ],
    },
    {
      key: "skip",
      label: "Enemy Skip Chance",
      badge: "Exploration",
      badgeColor: colors.gold,
      footer: { label: "Skip chance:", value: `${result.skipChance.toFixed(2)}%`, color: result.skipChance > 0 ? colors.gold : colors.muted },
      sources: [
        { label: "Tournament", icon: "_tournPts.png", val: tournSkipInput, set: setTournSkipInput, max: wave_skip.sources[0].maxLevel, amtPer: wave_skip.sources[0].amtPerLevel, isChance: true },
        { label: "Runes", icon: "_rune_2.png", val: runesSkipInput, set: setRunesSkipInput, max: wave_skip.sources[1].maxLevel, amtPer: wave_skip.sources[1].amtPerLevel, isChance: true },
      ],
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Wave</span>
          <input type="number" min={1} value={waveInput} onChange={(event) => setWaveInput(event.target.value)} onKeyDown={handleKeyDown} style={{ ...smallInput, width: 110, fontSize: 14, padding: "7px 10px" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {reductionCards.map((card) => (
          <div key={card.key} style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{card.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${card.badgeColor}22`, border: `1px solid ${card.badgeColor}55`, color: card.badgeColor }}>{card.badge}</span>
            </div>
            {card.sources.map((source) => {
              const over = (parseInt(source.val, 10) || 0) > source.max;
              return (
                <div key={source.label} style={{ marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {source.icon ? <img src={getIconUrl(source.icon)} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} /> : null}
                    <span style={{ fontSize: 12, color: colors.muted, minWidth: 80 }}>{source.label}</span>
                    <input type="number" min={0} max={source.max} value={source.val} onChange={(event) => source.set(event.target.value)} onKeyDown={handleKeyDown} style={{ ...smallInput, border: `1px solid ${over ? "#e05555" : colors.border}`, color: over ? "#e05555" : colors.text }} />
                    <span style={{ fontSize: 11, color: colors.muted }}>/ {source.max}</span>
                    <span style={{ fontSize: 11, color: source.isChance ? colors.gold : colors.positive, marginLeft: "auto" }}>
                      {source.isChance ? "" : "-"}
                      {((parseInt(source.val, 10) || 0) * source.amtPer * 100).toFixed(1)}%
                    </span>
                  </div>
                  {over ? <div style={{ fontSize: 11, color: "#e05555", marginTop: 3, paddingLeft: 26 }}>Max is {source.max}</div> : null}
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

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button onClick={apply} style={{ background: colors.accent, color: "#000", border: "none", borderRadius: 6, padding: "8px 24px", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>Apply</button>
        <button onClick={clear} style={{ background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>Clear</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Base HP", value: fmt(result.baseHp), color: colors.text },
          { label: "Mob Spawns", value: `${result.mobCount} normal${result.hasBoss ? " + 1 boss" : ""}`, color: colors.gold },
          ...(result.skipChance > 0 ? [{ label: "Est. Wave (with skip)", value: String(result.effectiveWave), color: colors.accent }] : []),
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "7px 14px" }}>
            <span style={{ fontSize: 11, color: colors.muted }}>{label} </span>
            <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
        {result.types.map((type, index) => {
          const isBoss = type.key === "boss";
          const spawns = isBoss ? result.hasBoss : true;
          const typeSkip = result.typesSkip[index];
          const spawnsSkip = isBoss ? result.hasBossSkip : true;

          return (
            <div key={type.key} style={{ background: colors.panel, border: `1px solid ${spawns ? colors.border : `${colors.border}55`}`, borderRadius: 10, padding: 16, textAlign: "center", display: "flex", flexDirection: "column", gap: 6, opacity: spawns ? 1 : 0.45 }}>
              <div style={{ fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{type.label}</div>
              <div style={{ fontSize: 11, color: colors.muted }}>
                ×{type.mult} multiplier · {isBoss ? (spawns ? "1 boss" : "×0 waves only") : `${type.count} mobs`}
              </div>

              <div style={{ borderTop: `1px solid ${colors.border}33`, paddingTop: 8 }}>
                <div style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Wave {params.wave} - Per mob</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: typeColors[type.key], fontFamily: "monospace", lineHeight: 1 }}>{fmt(type.hp)}</div>
                {spawns ? (
                  <>
                    <div style={{ fontSize: 11, color: colors.muted, marginTop: 6, marginBottom: 2 }}>Total this wave</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: typeColors[type.key], fontFamily: "monospace", lineHeight: 1 }}>{fmt(type.totalHp)}</div>
                  </>
                ) : null}
              </div>

              {result.skipChance > 0 ? (
                <div style={{ borderTop: `1px solid ${colors.gold}44`, paddingTop: 8, background: `${colors.gold}08`, borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: colors.gold, marginBottom: 4 }}>Est. Wave {result.effectiveWave} - Per mob</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: typeColors[type.key], fontFamily: "monospace", lineHeight: 1, opacity: 0.85 }}>{fmt(typeSkip.hp)}</div>
                  {spawnsSkip ? (
                    <>
                      <div style={{ fontSize: 11, color: colors.muted, marginTop: 6, marginBottom: 2 }}>Total this wave</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: typeColors[type.key], fontFamily: "monospace", lineHeight: 1, opacity: 0.85 }}>{fmt(typeSkip.totalHp)}</div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const RESOURCE_OPTIMIZER_STORAGE_KEY = "ihtddata.resourceOptimizer.state.v1";
const RESOURCE_OPTIMIZER_DEFAULT_BUDGET_INPUT = "10,000";

function readResourceOptimizerState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RESOURCE_OPTIMIZER_STORAGE_KEY) ?? "{}");
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // Ignore invalid storage payloads and fall back to defaults.
  }

  return {};
}

function ResourceButton({ label, icon, selected, colors, getIconUrl, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: selected ? `${colors.accent}22` : colors.panel,
        border: `1px solid ${selected ? colors.accent : colors.border}`,
        borderRadius: 12,
        color: colors.text,
        cursor: "pointer",
        display: "grid",
        gap: 8,
        justifyItems: "center",
        padding: "14px 12px",
      }}
    >
      <div style={{ width: 54, height: 54, borderRadius: 12, background: "rgba(8,17,29,0.72)", border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {icon ? <img src={getIconUrl(icon)} alt="" style={{ width: 34, height: 34, objectFit: "contain" }} /> : null}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: selected ? colors.accent : colors.text }}>{label}</div>
    </button>
  );
}

function SyncToggle({ checked, onChange, colors }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        background: colors.panel,
        border: `1px solid ${checked ? colors.accent : colors.border}`,
        borderRadius: 999,
        color: colors.text,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: 800,
        padding: "8px 12px 8px 8px",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 38,
          height: 22,
          borderRadius: 999,
          background: checked ? colors.accent : "#0f2640",
          border: `1px solid ${checked ? colors.accent : colors.border}`,
          position: "relative",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: checked ? "#08111d" : colors.text,
          }}
        />
      </span>
      {checked ? "Pull Upgrade Loadout" : "Don't pull Upgrade Loadout"}
    </button>
  );
}

function buildResourceOptimizerRowsFromLoadout(resource, currentRows, levelsByTab) {
  if (!resource) {
    return [];
  }

  return resource.tiers.map((tier, index) => {
    const currentRow = currentRows[index] ?? { enabled: true, level: 0, levelInput: "0" };
    const loadoutLevel = getResourceOptimizerLoadoutLevel(levelsByTab, tier);

    return {
      ...currentRow,
      level: loadoutLevel,
      levelInput: formatResourceOptimizerInput(loadoutLevel),
    };
  });
}

export function ResourceOptimizerView({ colors, fmt, getIconUrl, isMobile }) {
  const isCompactLayout = useIsNarrowScreen(1180);
  const savedState = useMemo(() => readResourceOptimizerState(), []);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState(savedState.selectedCurrencyId ?? RESOURCE_OPTIMIZER_CURRENCIES[0]?.id ?? "energy");
  const activeCurrency = useMemo(
    () => getResourceOptimizerCurrency(selectedCurrencyId),
    [selectedCurrencyId]
  );
  const [selectedResourceId, setSelectedResourceId] = useState(
    savedState.selectedResourceId ?? activeCurrency?.resources[0]?.id ?? RESOURCE_OPTIMIZER_CURRENCIES[0]?.resources[0]?.id ?? "gold"
  );
  const activeResource = useMemo(
    () => getResourceOptimizerResource(selectedCurrencyId, selectedResourceId),
    [selectedCurrencyId, selectedResourceId]
  );
  const [budgetInput, setBudgetInput] = useState(savedState.budgetInput ?? RESOURCE_OPTIMIZER_DEFAULT_BUDGET_INPUT);
  const [useStatsLoadoutLevels, setUseStatsLoadoutLevels] = useState(Boolean(savedState.useStatsLoadoutLevels));
  const [rowsBySelection, setRowsBySelection] = useState(() => savedState.rowsBySelection ?? {});
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const resultsRef = useRef(null);
  const [statsLoadoutLevelsByTab, setStatsLoadoutLevelsByTab] = useState(
    () => readStatsLoadoutState(localStorage).levelsByTab
  );

  const selectionKey = `${selectedCurrencyId}:${activeResource?.id ?? selectedResourceId}`;
  const separateRows = useMemo(() => {
    if (!activeResource) {
      return [];
    }

    return normalizeResourceOptimizerRows(rowsBySelection[selectionKey], activeResource);
  }, [activeResource, rowsBySelection, selectionKey]);
  const activeRows = separateRows;

  useEffect(() => {
    if (!activeCurrency) {
      return;
    }

    if (!activeCurrency.resources.some((resource) => resource.id === selectedResourceId)) {
      setSelectedResourceId(activeCurrency.resources[0]?.id ?? "gold");
      setResult(null);
    }
  }, [activeCurrency, selectedResourceId]);

  useEffect(() => {
    function syncStatsLoadoutLevels() {
      setStatsLoadoutLevelsByTab(readStatsLoadoutState(localStorage).levelsByTab);
      if (useStatsLoadoutLevels) {
        setResult(null);
        setErrorMessage(null);
      }
    }

    syncStatsLoadoutLevels();
    window.addEventListener(LOADOUT_RUNTIME_CHANGED_EVENT, syncStatsLoadoutLevels);

    return () => window.removeEventListener(LOADOUT_RUNTIME_CHANGED_EVENT, syncStatsLoadoutLevels);
  }, [useStatsLoadoutLevels]);

  useEffect(() => {
    if (!useStatsLoadoutLevels || !activeResource) {
      return;
    }

    setRowsBySelection((current) => ({
      ...current,
      [selectionKey]: buildResourceOptimizerRowsFromLoadout(
        activeResource,
        normalizeResourceOptimizerRows(current[selectionKey], activeResource),
        statsLoadoutLevelsByTab
      ),
    }));
    setResult(null);
    setErrorMessage(null);
  }, [activeResource, selectionKey, statsLoadoutLevelsByTab, useStatsLoadoutLevels]);

  useEffect(() => {
    if (!activeResource || rowsBySelection[selectionKey]) {
      return;
    }

    setRowsBySelection((current) => ({
      ...current,
      [selectionKey]: createDefaultResourceOptimizerRows(activeResource),
    }));
  }, [activeResource, rowsBySelection, selectionKey]);

  useEffect(() => {
    localStorage.setItem(RESOURCE_OPTIMIZER_STORAGE_KEY, JSON.stringify({
      selectedCurrencyId,
      selectedResourceId,
      budgetInput,
      useStatsLoadoutLevels,
      rowsBySelection,
    }));
  }, [budgetInput, rowsBySelection, selectedCurrencyId, selectedResourceId, useStatsLoadoutLevels]);

  useEffect(() => {
    if (!result || !resultsRef.current) {
      return;
    }

    resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  function updateRows(updater) {
    setRowsBySelection((current) => ({
      ...current,
      [selectionKey]: updater(normalizeResourceOptimizerRows(current[selectionKey], activeResource)),
    }));
    setResult(null);
    setErrorMessage(null);
  }

  function handleCurrencyChange(currencyId) {
    setSelectedCurrencyId(currencyId);
    setResult(null);
    setErrorMessage(null);
  }

  function handleResourceChange(resourceId) {
    setSelectedResourceId(resourceId);
    setResult(null);
    setErrorMessage(null);
  }

  function handleOptimize(event) {
    event.preventDefault();

    if (!activeResource) {
      setErrorMessage("Select a currency and resource before optimizing.");
      setResult(null);
      return;
    }

    const budget = parseResourceOptimizerNumber(budgetInput);
    const normalized = normalizeResourceOptimizerRows(activeRows, activeResource);
    const enabledCount = normalized.filter((row) => row.enabled).length;

    if (enabledCount === 0) {
      setErrorMessage("Enable at least one tier to optimize.");
      setResult(null);
      return;
    }

    const optimization = optimizeResourceLevels(activeResource, normalized, budget);
    setResult(optimization);
    setErrorMessage(null);
    setRowsBySelection((current) => ({
      ...current,
      [selectionKey]: normalized,
    }));
  }

  function handleReset() {
    setBudgetInput(RESOURCE_OPTIMIZER_DEFAULT_BUDGET_INPUT);
    const nextStatsLoadoutLevelsByTab = readStatsLoadoutState(localStorage).levelsByTab;
    setStatsLoadoutLevelsByTab(nextStatsLoadoutLevelsByTab);
    setRowsBySelection((current) => {
      if (!activeResource) {
        return current;
      }

      return {
        ...current,
        [selectionKey]: useStatsLoadoutLevels
          ? buildResourceOptimizerRowsFromLoadout(activeResource, [], nextStatsLoadoutLevelsByTab)
          : createDefaultResourceOptimizerRows(activeResource),
      };
    });
    setResult(null);
    setErrorMessage(null);
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: colors.accent }}>Resource Optimizer</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                background: colors.panel,
                border: `1px solid ${colors.border}`,
                borderRadius: 999,
                color: colors.text,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 800,
                padding: "9px 14px",
                whiteSpace: "nowrap",
              }}
            >
              Reset
            </button>
            <SyncToggle
              checked={useStatsLoadoutLevels}
              onChange={(value) => {
                setUseStatsLoadoutLevels(value);
                setResult(null);
                setErrorMessage(null);
              }}
              colors={colors}
            />
          </div>
        </div>
      </div>

      <form onSubmit={handleOptimize} style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile || isCompactLayout ? "1fr" : "minmax(0, 1.3fr) minmax(320px, 0.7fr)", gap: 18, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>Step 1: Select Currency</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(5, minmax(0, 1fr))", gap: 10 }}>
                {RESOURCE_OPTIMIZER_CURRENCIES.map((currency) => (
                  <ResourceButton
                    key={currency.id}
                    label={currency.label}
                    icon={currency.icon}
                    selected={currency.id === selectedCurrencyId}
                    colors={colors}
                    getIconUrl={getIconUrl}
                    onClick={() => handleCurrencyChange(currency.id)}
                  />
                ))}
              </div>
            </div>

            {activeCurrency ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>Step 2: Select Resource</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : `repeat(${Math.max(2, activeCurrency.resources.length)}, minmax(0, 1fr))`, gap: 10 }}>
                  {activeCurrency.resources.map((resource) => (
                    <ResourceButton
                      key={resource.id}
                      label={resource.label}
                      icon={resource.icon}
                      selected={resource.id === activeResource?.id}
                      colors={colors}
                      getIconUrl={getIconUrl}
                      onClick={() => handleResourceChange(resource.id)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {activeResource ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>Step 3: Configure Tiers</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  {activeResource.tiers.map((tier, index) => {
                    const row = activeRows[index];
                    const nextLevel = row.level + 1;
                    const nextCost = nextLevel <= tier.maxLevel ? tier.costFunction(nextLevel) : null;

                    return (
                      <div key={tier.id} style={{ background: row.enabled ? colors.panel : `${colors.panel}99`, border: `1px solid ${row.enabled ? colors.border : `${colors.border}66`}`, borderRadius: 12, padding: 14, display: "grid", gap: 10, opacity: row.enabled ? 1 : 0.7 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: colors.text }}>{tier.label}</div>
                            <div style={{ fontSize: 12, color: colors.positive }}>{formatStatPerLevel(tier.benefitValue, tier.statKey)} / level</div>
                          </div>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: colors.text, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={row.enabled}
                              onChange={() => updateRows((currentRows) => currentRows.map((entry, rowIndex) => rowIndex === index ? { ...entry, enabled: !entry.enabled } : entry))}
                            />
                            Enabled
                          </label>
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Current Level</div>
                          <input
                            type="text"
                            value={row.levelInput}
                            onChange={(event) => updateRows((currentRows) => currentRows.map((entry, rowIndex) => rowIndex === index ? { ...entry, levelInput: event.target.value, level: Math.min(tier.maxLevel, Math.floor(parseResourceOptimizerNumber(event.target.value))) } : entry))}
                            onBlur={() => updateRows((currentRows) => currentRows.map((entry, rowIndex) => rowIndex === index ? { ...entry, levelInput: formatResourceOptimizerInput(entry.level) } : entry))}
                            style={{ background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 14, fontWeight: 700, padding: "8px 10px", fontFamily: "inherit" }}
                          />
                        </div>
                        <div style={{ display: "grid", gap: 4, fontSize: 12, color: colors.muted }}>
                          <div>Next cost: <span style={{ color: colors.gold, fontWeight: 800 }}>{nextCost != null ? fmt(nextCost) : "Maxed"}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>Budget</div>
              <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Available Budget</div>
              <input
                type="text"
                value={budgetInput}
                onChange={(event) => {
                  setBudgetInput(event.target.value);
                  setResult(null);
                  setErrorMessage(null);
                }}
                placeholder="e.g. 10,000, 1.5e30, 5M"
                style={{ background: "#0f2640", border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 14, fontWeight: 700, padding: "10px 12px", fontFamily: "inherit" }}
              />
              <div style={{ fontSize: 12, color: colors.muted }}>Supports commas, K/M/B/T suffixes, and scientific notation.</div>
              <button type="submit" style={{ justifySelf: "start", background: colors.accent, border: "none", borderRadius: 10, color: "#08111d", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 900, padding: "10px 16px" }}>
                Optimize Resources
              </button>
            </div>

            {errorMessage ? (
              <div style={{ background: "rgba(224,85,85,0.16)", border: "1px solid rgba(224,85,85,0.45)", borderRadius: 10, color: "#ffb4b4", padding: "10px 12px", fontSize: 13, fontWeight: 700 }}>
                {errorMessage}
              </div>
            ) : null}

            {result ? (
              <div ref={resultsRef} style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Budget Spent</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: colors.accent }}>{fmt(result.budgetSpent)}</div>
                  </div>
                  <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Remaining</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: colors.positive }}>{fmt(result.budgetRemaining)}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {result.rows.map((row, index) => {
                    const tier = activeResource.tiers[index];
                    if (!row.enabled) {
                      return null;
                    }

                    return (
                      <div
                        key={tier.id}
                        style={{
                          background: `linear-gradient(180deg, ${colors.panel} 0%, ${colors.header} 100%)`,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 14,
                          padding: 14,
                          display: "grid",
                          gap: 12,
                          boxShadow: "0 8px 20px rgba(0,0,0,0.16)",
                        }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12, alignItems: "center" }}>
                          <div style={{ display: "grid", gap: 8, minWidth: 0, justifyItems: "start", textAlign: "left" }}>
                            <div style={{ fontSize: 15, fontWeight: 900, color: colors.text }}>{tier.label}</div>
                            <div style={{ fontSize: 12, color: colors.positive, fontWeight: 800 }}>{formatStatPerLevel(tier.benefitValue, tier.statKey)} / level</div>
                          </div>
                          <div style={{ display: "grid", gap: 6, justifyItems: "center", textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                              <div style={{ color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 11, fontWeight: 800 }}>Current</div>
                              <div style={{ color: colors.text, fontWeight: 800, fontSize: 14 }}>{row.currentLevel.toLocaleString("en-US")}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                              <div style={{ color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 11, fontWeight: 800 }}>Optimal</div>
                              <div style={{ color: colors.accent, fontWeight: 900, fontSize: 14 }}>{row.optimalLevel.toLocaleString("en-US")}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end" }}>
                            <div
                              style={{
                                background: row.buyAmount > 0 ? `${colors.positive}18` : `${colors.border}22`,
                                border: `1px solid ${row.buyAmount > 0 ? `${colors.positive}55` : colors.border}`,
                                borderRadius: 999,
                                color: row.buyAmount > 0 ? colors.positive : colors.muted,
                                fontSize: 12,
                                fontWeight: 900,
                                letterSpacing: "0.04em",
                                padding: "6px 10px",
                                textTransform: "uppercase",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.buyAmount > 0 ? `Buy +${row.buyAmount.toLocaleString("en-US")}` : "No Purchase"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}