import { useEffect, useMemo, useState } from "react";
import { GuideLines, HeroToken, MapStage, OverlayAnchor, SpotBadge } from "../map/MapStage";
import { SearchableSelect } from "../SearchableSelect";
import { coordToSlider, pixelsToNormalized, roundCoord, sliderToCoord } from "../../lib/coords";
import { createSpotId, normalizeMapSpots } from "../../lib/gameData";
import { readMapsJsonFromServer, writeMapSpotsToServer } from "../../lib/mapsAdminApi";

const SELECTED_MAP_STORAGE_KEY = "ihtddata.coordFinder.selectedMapId";

function getNextSpotNumber(spots) {
  const highestFromIds = spots.reduce((highest, spot) => {
    const match = spot.id.match(/(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return highestFromIds + 1;
}

function createDraftSpot(mapId, spots, seed = null) {
  const nextNumber = getNextSpotNumber(spots);
  const baseSpot = seed ?? spots[spots.length - 1] ?? { x: 0.5, y: 0.5 };

  return {
    id: createSpotId(mapId, nextNumber - 1),
    label: `Spot ${nextNumber}`,
    x: roundCoord(baseSpot.x ?? 0.5, 3),
    y: roundCoord(baseSpot.y ?? 0.5, 3),
  };
}

export function CoordFinderPage({ colors, getIconUrl, maps, heroes, onMapSpotsChange, onMapsJsonHydrate, onNavigate }) {
  const [selectedMapId, setSelectedMapId] = useState(() => localStorage.getItem(SELECTED_MAP_STORAGE_KEY) ?? maps[0]?.id ?? "");
  const [draftMode, setDraftMode] = useState("view");
  const [draftSpot, setDraftSpot] = useState(null);
  const [editingSpotId, setEditingSpotId] = useState(null);
  const [previewHeroId, setPreviewHeroId] = useState(heroes.find((hero) => hero.heroIcon)?.id ?? heroes[0]?.id ?? "");
  const [hoverCoord, setHoverCoord] = useState(null);
  const [serverStatus, setServerStatus] = useState({ tone: "muted", message: "Spot saves write directly to src/data/maps.json through the local app server." });
  const [isWriting, setIsWriting] = useState(false);
  const selectedMap = useMemo(() => maps.find((map) => map.id === selectedMapId) ?? maps[0] ?? null, [maps, selectedMapId]);
  const previewHero = useMemo(() => heroes.find((hero) => hero.id === previewHeroId) ?? heroes[0] ?? null, [heroes, previewHeroId]);
  const selectedMapSpots = selectedMap?.spots ?? [];
  const liveCoord = hoverCoord ?? draftSpot;

  useEffect(() => {
    if (selectedMap?.id) {
      localStorage.setItem(SELECTED_MAP_STORAGE_KEY, selectedMap.id);
    }
    setDraftMode("view");
    setDraftSpot(null);
    setEditingSpotId(null);
  }, [selectedMap]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromServer() {
      try {
        const payload = await readMapsJsonFromServer();
        if (cancelled) {
          return;
        }
        onMapsJsonHydrate?.(payload.text);
        setServerStatus({ tone: "positive", message: "Connected to the local maps.json writer. Save and remove actions will update src/data/maps.json directly." });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setServerStatus({ tone: "error", message: error instanceof Error ? error.message : "Could not reach the local maps.json writer." });
      }
    }

    hydrateFromServer();
    return () => {
      cancelled = true;
    };
  }, []);

  const duplicateDraftId = Boolean(
    draftSpot?.id && selectedMapSpots.some((spot) => spot.id === draftSpot.id && spot.id !== editingSpotId)
  );

  function updateDraftField(field, value) {
    setHoverCoord(null);
    setDraftSpot((current) => current ? { ...current, [field]: value } : current);
  }

  function updateHoverCoord(event) {
    if (!draftSpot) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    setHoverCoord(pixelsToNormalized(localX, localY, rect.width, rect.height, 3));
  }

  function startAddSpot() {
    if (!selectedMap) {
      return;
    }
    setDraftMode("add");
    setEditingSpotId(null);
    setDraftSpot(createDraftSpot(selectedMap.id, selectedMapSpots));
  }

  function startEditSpot(spot) {
    setDraftMode("edit");
    setEditingSpotId(spot.id);
    setDraftSpot({ ...spot });
  }

  function cancelDraft() {
    setDraftMode("view");
    setEditingSpotId(null);
    setDraftSpot(null);
    setHoverCoord(null);
  }

  async function persistSpots(nextSpots, successMessage) {
    if (!selectedMap) {
      return false;
    }

    try {
      setIsWriting(true);
      const payload = await writeMapSpotsToServer(selectedMap.id, nextSpots);
      onMapSpotsChange(selectedMap.id, nextSpots);
      onMapsJsonHydrate?.(payload.text);
      setServerStatus({ tone: "positive", message: successMessage });
      return true;
    } catch (error) {
      setServerStatus({ tone: "error", message: error instanceof Error ? error.message : "Could not update src/data/maps.json." });
      return false;
    } finally {
      setIsWriting(false);
    }
  }

  async function commitDraft(coordsOverride = null) {
    if (!selectedMap || !draftSpot || duplicateDraftId) {
      return;
    }

    const committedSpot = normalizeMapSpots(selectedMap.id, [{
      ...draftSpot,
      x: coordsOverride?.x ?? liveCoord?.x ?? draftSpot.x,
      y: coordsOverride?.y ?? liveCoord?.y ?? draftSpot.y,
    }])[0];

    const nextSpots = normalizeMapSpots(selectedMap.id,
      draftMode === "edit"
        ? selectedMapSpots.map((spot) => (spot.id === editingSpotId ? committedSpot : spot))
        : [...selectedMapSpots, committedSpot]
    );

    const didPersist = await persistSpots(
      nextSpots,
      draftMode === "edit"
        ? `Updated ${committedSpot.label} in src/data/maps.json.`
        : `Added ${committedSpot.label} to src/data/maps.json.`
    );

    if (didPersist) {
      cancelDraft();
    }
  }

  function updateDraftPositionFromClick(event) {
    if (!draftSpot) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const coords = pixelsToNormalized(localX, localY, rect.width, rect.height, 3);
    void commitDraft(coords);
  }

  async function removeSpot(spotId) {
    if (!selectedMap) {
      return;
    }

    const nextSpots = normalizeMapSpots(selectedMap.id, selectedMapSpots.filter((spot) => spot.id !== spotId));
    const removedSpot = selectedMapSpots.find((spot) => spot.id === spotId);
    const didPersist = await persistSpots(nextSpots, `Removed ${removedSpot?.label ?? spotId} from src/data/maps.json.`);

    if (didPersist && editingSpotId === spotId) {
      cancelDraft();
    }
  }
  const statusColor = serverStatus.tone === "error" ? "#ff8c8c" : serverStatus.tone === "positive" ? colors.positive : colors.muted;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{
        border: `1px solid ${colors.border}`,
        background: `linear-gradient(135deg, rgba(68,136,238,0.16) 0%, rgba(21,46,74,0.92) 44%, rgba(21,46,74,0.92) 100%)`,
        borderRadius: 18,
        padding: 22,
      }}>
        <div style={{ display: "flex", gap: 16, justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: colors.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>Coordinate Finder</div>
            <div style={{ color: colors.muted, fontSize: 13, marginTop: 6, maxWidth: 760 }}>
              Author normalized placement nodes visually with cursor-linked guide lines. Saving and removing spots writes directly into src/data/maps.json.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={startAddSpot} style={{ background: colors.accent, color: "#08111a", border: `1px solid ${colors.accent}`, borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>Add Spot</button>
            <button type="button" onClick={() => onNavigate("loadoutBuilderPlacement")} style={{ background: colors.header, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>Open Builder</button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 430px)", gap: 20, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 14 }}>
          {selectedMap && (
            <MapStage map={selectedMap} colors={colors} getIconUrl={getIconUrl} minHeight={440}>
              {({ tokenSize, spotSize }) => (
                <>
                  {draftSpot && (
                    <button
                      type="button"
                      onClick={updateDraftPositionFromClick}
                      onMouseMove={updateHoverCoord}
                      onMouseLeave={() => setHoverCoord(null)}
                      style={{
                        position: "absolute",
                        inset: 0,
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: "crosshair",
                        zIndex: 1,
                      }}
                    />
                  )}

                  {selectedMapSpots
                    .filter((spot) => !(draftMode === "edit" && editingSpotId === spot.id))
                    .map((spot, index) => (
                    <OverlayAnchor key={spot.id} x={spot.x} y={spot.y} zIndex={4}>
                      <button type="button" onClick={(event) => { event.stopPropagation(); startEditSpot(spot); }} title={`Edit ${spot.label}`} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                        <SpotBadge size={spotSize} colors={colors} occupied={false} active={editingSpotId === spot.id} highlighted label={String(index + 1).padStart(2, "0")} />
                      </button>
                    </OverlayAnchor>
                  ))}

                  {draftSpot && liveCoord && (
                    <>
                      <GuideLines
                        x={liveCoord.x}
                        y={liveCoord.y}
                        colors={colors}
                        zIndex={5}
                      />
                      <OverlayAnchor x={liveCoord.x} y={liveCoord.y} zIndex={6} style={{ pointerEvents: "none" }}>
                        <HeroToken hero={previewHero} getIconUrl={getIconUrl} colors={colors} size={tokenSize} label={previewHero?.name} opacity={0.58} />
                      </OverlayAnchor>
                    </>
                  )}
                </>
              )}
            </MapStage>
          )}

          <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16, display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 8, color: colors.muted, fontSize: 12, fontWeight: 700 }}>
                X Position
                <input type="range" min="0" max="1000" value={liveCoord ? coordToSlider(liveCoord.x) : 500} onChange={(event) => updateDraftField("x", sliderToCoord(event.target.value))} disabled={!draftSpot} />
                <span style={{ color: colors.text, fontWeight: 800 }}>{liveCoord ? liveCoord.x.toFixed(3) : "0.500"}</span>
              </label>
              <label style={{ display: "grid", gap: 8, color: colors.muted, fontSize: 12, fontWeight: 700 }}>
                Y Position
                <input type="range" min="0" max="1000" value={liveCoord ? coordToSlider(liveCoord.y) : 500} onChange={(event) => updateDraftField("y", sliderToCoord(event.target.value))} disabled={!draftSpot} />
                <span style={{ color: colors.text, fontWeight: 800 }}>{liveCoord ? liveCoord.y.toFixed(3) : "0.500"}</span>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 6, color: colors.muted, fontSize: 12, fontWeight: 700 }}>
                Spot Id
                <input value={draftSpot?.id ?? ""} disabled={!draftSpot} onChange={(event) => updateDraftField("id", event.target.value)} style={{ background: "#0f2640", border: `1px solid ${duplicateDraftId ? "#e05555" : colors.border}`, color: colors.text, borderRadius: 10, padding: "10px 12px", font: "inherit" }} />
              </label>
              <label style={{ display: "grid", gap: 6, color: colors.muted, fontSize: 12, fontWeight: 700 }}>
                Label
                <input value={draftSpot?.label ?? ""} disabled={!draftSpot} onChange={(event) => updateDraftField("label", event.target.value)} style={{ background: "#0f2640", border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 10, padding: "10px 12px", font: "inherit" }} />
              </label>
            </div>

            {duplicateDraftId && <div style={{ color: "#ff8c8c", fontSize: 12 }}>Spot ids must stay unique within the selected map.</div>}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => void commitDraft()} disabled={!draftSpot || duplicateDraftId || isWriting} style={{ background: !draftSpot || duplicateDraftId || isWriting ? colors.border : colors.accent, color: !draftSpot || duplicateDraftId || isWriting ? colors.muted : "#08111a", border: `1px solid ${!draftSpot || duplicateDraftId || isWriting ? colors.border : colors.accent}`, borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: !draftSpot || duplicateDraftId || isWriting ? "not-allowed" : "pointer" }}>{draftMode === "edit" ? "Save Current Position" : "Add Current Position"}</button>
              <button type="button" onClick={cancelDraft} disabled={!draftSpot || isWriting} style={{ background: colors.header, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: !draftSpot || isWriting ? "not-allowed" : "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 14, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6, color: colors.muted, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Map
                <SearchableSelect
                  value={selectedMap?.id ?? ""}
                  onChange={setSelectedMapId}
                  colors={colors}
                  options={maps.map((map) => ({ value: map.id, label: map.name }))}
                  searchPlaceholder="Search maps..."
                  containerStyle={{ minWidth: 220 }}
                />
              </label>

              <label style={{ display: "grid", gap: 6, color: colors.muted, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Preview Hero
                <SearchableSelect
                  value={previewHero?.id ?? ""}
                  onChange={setPreviewHeroId}
                  colors={colors}
                  options={heroes.map((hero) => ({ value: hero.id, label: hero.name }))}
                  searchPlaceholder="Search heroes..."
                  containerStyle={{ minWidth: 220 }}
                />
              </label>
            </div>

            <div style={{ padding: "10px 12px", background: colors.header, borderRadius: 10, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 10, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Mode</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>{draftMode === "view" ? "Viewing" : draftMode === "add" ? "Adding" : "Editing"}</div>
            </div>
          </div>

          <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Spot List</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>{selectedMapSpots.length} spots on {selectedMap?.name}</div>
              </div>
            </div>

            {selectedMapSpots.length ? selectedMapSpots.map((spot) => (
              <div key={spot.id} style={{ background: colors.header, border: `1px solid ${editingSpotId === spot.id ? colors.accent : colors.border}`, borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800, color: colors.text, fontSize: 13 }}>{spot.label}</div>
                    <div style={{ fontSize: 11, color: colors.muted }}>{spot.id}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => startEditSpot(spot)} style={{ background: "transparent", color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "8px 10px", fontWeight: 700, cursor: "pointer" }}>Edit</button>
                    <button type="button" onClick={() => removeSpot(spot.id)} disabled={isWriting} style={{ background: "transparent", color: "#ff8c8c", border: `1px solid ${colors.border}`, borderRadius: 8, padding: "8px 10px", fontWeight: 700, cursor: isWriting ? "not-allowed" : "pointer", opacity: isWriting ? 0.6 : 1 }}>Remove</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  <div style={{ color: colors.muted, fontSize: 12 }}>X: <span style={{ color: colors.text, fontWeight: 800 }}>{spot.x.toFixed(3)}</span></div>
                  <div style={{ color: colors.muted, fontSize: 12 }}>Y: <span style={{ color: colors.text, fontWeight: 800 }}>{spot.y.toFixed(3)}</span></div>
                </div>
              </div>
            )) : (
              <div style={{ color: colors.muted, fontSize: 13, lineHeight: 1.6 }}>
                No spots saved for this map yet. Start with <strong style={{ color: colors.text }}>Add Spot</strong>, align the guide lines to a yellow placement circle, and save the first normalized node.
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
        <div style={{ fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Info</div>
        <div style={{ color: colors.muted, fontSize: 12, lineHeight: 1.6 }}>
          When Add or Edit mode is active, moving the cursor across the map updates the guide lines, hero preview, and slider positions live. Clicking records that hovered coordinate into the draft spot.
        </div>
        {(serverStatus.message || isWriting) && (
          <div style={{ fontSize: 12, color: isWriting ? colors.accent : statusColor, lineHeight: 1.5 }}>
            {isWriting ? "Updating src/data/maps.json..." : serverStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}