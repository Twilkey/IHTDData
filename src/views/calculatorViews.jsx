import { useMemo, useState } from "react";

import combatStylesData from "../data/combat_styles.json";
import enemyHpData from "../data/enemy_hp.json";

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