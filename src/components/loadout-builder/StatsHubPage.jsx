import { useEffect, useMemo, useState } from "react";

import { SearchableSelect } from "../SearchableSelect";
import { LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY } from "../../lib/loadoutBuilderSave";
import { buildGlobalLoadoutStatModel, buildHeroStatModel, formatHeroStatValue, formatSignedHeroBonus } from "../../lib/loadoutStatEngine";
import { mapsData } from "../../lib/gameData";
import { readHeroLoadoutState } from "../../lib/heroLoadout";
import { readMapLoadoutState } from "../../lib/mapLoadout";
import { readPlayerLoadoutState } from "../../lib/playerLoadout";
import { readStatsLoadoutState } from "../../lib/statsLoadout";
import { schedulePersistLoadoutRuntime } from "../../lib/loadoutRuntimeStore";

function SelectorCard({ label, value, onChange, options, colors }) {
  return (
    <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
      <SearchableSelect
        label={label}
        value={value}
        onChange={onChange}
        options={options}
        colors={colors}
      />
    </div>
  );
}

function BreakdownGrid({ title, breakdown, colors, emptyMessage, fmt }) {
  return (
    <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 900, color: colors.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</div>
      {breakdown.orderedStats.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
          {breakdown.orderedStats.map((item) => (
            <div key={item.statKey} style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 13, color: colors.text, fontWeight: 800 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: colors.accent, fontWeight: 900 }}>{formatSignedHeroBonus(item.statKey, item.total, fmt)}</div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {item.entries.map((entry) => (
                  <div key={`${entry.system}-${entry.sourceType}-${entry.sourceId}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                    <span style={{ color: colors.muted }}>{entry.sourceLabel}</span>
                    <span style={{ color: colors.text, fontWeight: 700 }}>{formatSignedHeroBonus(item.statKey, entry.amount, fmt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: colors.muted, fontSize: 13 }}>{emptyMessage}</div>
      )}
    </div>
  );
}

function HeroStatTable({ hero, adjustedHero, colors, fmt }) {
  const statKeys = Array.from(new Set([
    ...Object.keys(hero.baseStats ?? {}),
    ...Object.keys(adjustedHero.baseStats ?? {}),
  ]));

  return (
    <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 900, color: colors.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>Hero Base And Adjusted Stats</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>Stat</th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>Base</th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>Adjusted</th>
            </tr>
          </thead>
          <tbody>
            {statKeys.map((statKey, index) => (
              <tr key={statKey} style={{ background: index % 2 === 0 ? "transparent" : `${colors.panel}66` }}>
                <td style={{ padding: "8px 10px", color: colors.text, fontWeight: 700 }}>{statKey.replace(/([a-z])([A-Z])/g, "$1 $2")}</td>
                <td style={{ padding: "8px 10px", color: colors.muted, textAlign: "right" }}>{formatHeroStatValue(hero.baseStats?.[statKey], fmt)}</td>
                <td style={{ padding: "8px 10px", color: colors.accent, textAlign: "right", fontWeight: 800 }}>{formatHeroStatValue(adjustedHero.baseStats?.[statKey], fmt)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: "8px 10px", color: colors.text, fontWeight: 700, borderTop: `1px solid ${colors.border}` }}>Skill Cooldown</td>
              <td style={{ padding: "8px 10px", color: colors.muted, textAlign: "right", borderTop: `1px solid ${colors.border}` }}>{formatHeroStatValue(hero.skill?.cooldown, fmt)}s</td>
              <td style={{ padding: "8px 10px", color: colors.accent, textAlign: "right", fontWeight: 800, borderTop: `1px solid ${colors.border}` }}>{formatHeroStatValue(adjustedHero.skill?.cooldown, fmt)}s</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatsHubPage({ colors, heroes, getIconUrl, fmt }) {
  const statsLoadoutState = useMemo(() => readStatsLoadoutState(localStorage), []);
  const playerLoadoutState = useMemo(() => readPlayerLoadoutState(localStorage), []);
  const heroLoadoutState = useMemo(() => readHeroLoadoutState(localStorage), []);
  const mapLoadoutState = useMemo(() => readMapLoadoutState(localStorage), []);
  const [selectedMapId, setSelectedMapId] = useState(() => localStorage.getItem(LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY) ?? "");
  const [selectedHeroId, setSelectedHeroId] = useState(() => heroLoadoutState.selectedHeroId || heroes[0]?.id || "");
  const selectedMap = useMemo(() => mapsData.maps.find((map) => map.id === selectedMapId) ?? null, [selectedMapId]);

  useEffect(() => {
    localStorage.setItem(LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY, selectedMapId ?? "");
    schedulePersistLoadoutRuntime(localStorage);
  }, [selectedMapId]);

  const selectedHero = useMemo(
    () => heroes.find((hero) => hero.id === selectedHeroId) ?? heroes[0] ?? null,
    [heroes, selectedHeroId]
  );
  const globalModel = useMemo(
    () => buildGlobalLoadoutStatModel({ statsLoadoutState, playerLoadoutState, mapLoadoutState, selectedMapId }),
    [mapLoadoutState, playerLoadoutState, selectedMapId, statsLoadoutState]
  );
  const heroModel = useMemo(
    () => selectedHero ? buildHeroStatModel({ hero: selectedHero, statsLoadoutState, playerLoadoutState, heroLoadoutState, mapLoadoutState, selectedMapId }) : null,
    [heroLoadoutState, mapLoadoutState, playerLoadoutState, selectedHero, selectedMapId, statsLoadoutState]
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 18, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: colors.panel, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={getIconUrl("_attributePoints_0.png")} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: colors.text }}>Stats Hub</div>
            <div style={{ fontSize: 13, color: colors.muted }}>Global loadout breakdown plus hero-specific overlays from the shared stat engine.</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <SelectorCard
          label="Selected Map"
          value={selectedMapId}
          onChange={setSelectedMapId}
          colors={colors}
          options={[
            { value: "", label: "None" },
            ...mapsData.maps.map((map) => ({ value: map.id, label: map.name })),
          ]}
        />
        <SelectorCard
          label="Selected Hero"
          value={selectedHero?.id ?? ""}
          onChange={setSelectedHeroId}
          colors={colors}
          options={heroes.map((hero) => ({ value: hero.id, label: hero.name }))}
        />
      </div>

      <BreakdownGrid
        title="Global Stat Breakdown"
        breakdown={globalModel}
        colors={colors}
        fmt={fmt}
        emptyMessage="No global loadout bonuses are active yet."
      />

      <div style={{ background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: colors.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>Hero Focus</div>
            <div style={{ fontSize: 12, color: colors.muted }}>Adds the selected hero's personal and conditional-global hero loadout bonuses on top of the global totals.</div>
          </div>
        </div>

        {selectedHero && heroModel ? (
          <>
            <HeroStatTable hero={selectedHero} adjustedHero={heroModel.adjustedHero} colors={colors} fmt={fmt} />
            <BreakdownGrid
              title="Hero Personal Breakdown"
              breakdown={heroModel.personal}
              colors={colors}
              fmt={fmt}
              emptyMessage="This hero has no personal hero-loadout bonuses set yet."
            />
            <BreakdownGrid
              title="Hero Conditional Global Breakdown"
              breakdown={heroModel.conditionalGlobal}
              colors={colors}
              fmt={fmt}
              emptyMessage="This hero has no conditional global hero-loadout bonuses set yet."
            />
            <BreakdownGrid
              title="Hero Combined Breakdown"
              breakdown={heroModel.combined}
              colors={colors}
              fmt={fmt}
              emptyMessage="No hero-specific bonuses are active for this hero."
            />
          </>
        ) : null}
      </div>
    </div>
  );
}