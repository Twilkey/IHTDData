import { useEffect, useRef, useState } from "react";

import { exportSavedLoadoutsBundle, importLoadoutEntries, parseImportedLoadoutFile } from "../../lib/loadoutSavedRepository";
import { PresetsModalShell } from "./PresetsModalShell";

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDateTime(value) {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown" : parsed.toLocaleString();
}

export function MapLoadoutPresetsPanel({
  colors,
  selectedMap,
  presets,
  heroPresets,
  currentSavedLoadoutId,
  onLoadSave,
  onDeleteSave,
  onImportComplete,
  onUpdateSave,
}) {
  const importInputRef = useRef(null);
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draftHeroPresetBySaveId, setDraftHeroPresetBySaveId] = useState({});

  useEffect(() => {
    setDraftHeroPresetBySaveId(
      Object.fromEntries(
        presets.map((save) => [save.id, save.linkedLoadouts?.heroLoadoutId ?? ""])
      )
    );
  }, [presets]);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timerId = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timerId);
  }, [message]);

  async function handleExport(saveId) {
    try {
      setBusyAction(`export:${saveId}`);
      const { blob, fileName } = await exportSavedLoadoutsBundle({ saveIds: [saveId] });
      downloadBlob(blob, fileName);
      setMessage({ type: "success", text: "Exported map preset." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to export that preset." });
    } finally {
      setBusyAction("");
    }
  }

  async function handleImportChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !selectedMap) {
      return;
    }

    try {
      setBusyAction("import");
      const parsed = await parseImportedLoadoutFile(file);
      const matchingEntries = parsed.entries.filter((entry) => entry.scopeId === "mapLoadoutMap" && entry.scopeContext?.mapId === selectedMap.id);

      if (!matchingEntries.length) {
        throw new Error(`No presets for ${selectedMap.name} were found in that file.`);
      }

      const summary = await importLoadoutEntries(matchingEntries.map((entry) => ({
        mode: "new",
        scopeId: entry.scopeId,
        scopeContext: entry.scopeContext,
        name: entry.name,
        description: entry.description,
        payload: entry.payload,
        linkedLoadouts: entry.linkedLoadouts,
        sourceSaveId: entry.sourceSaveId,
      })));

      await onImportComplete(summary);
      setMessage({ type: "success", text: `Imported ${matchingEntries.length} ${selectedMap.name} preset${matchingEntries.length === 1 ? "" : "s"}.` });
      setIsOpen(true);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to import presets." });
    } finally {
      setBusyAction("");
    }
  }

  async function handleLoad(saveId) {
    try {
      setBusyAction(`load:${saveId}`);
      const result = await onLoadSave(saveId);
      const linkedCount = result?.appliedLinkedLoadouts?.length ?? 0;
      setMessage({
        type: "success",
        text: linkedCount ? `Loaded map preset and ${linkedCount} linked preset${linkedCount === 1 ? "" : "s"}.` : "Loaded map preset.",
      });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to load that preset." });
    } finally {
      setBusyAction("");
    }
  }

  async function handleDelete(saveId, saveName) {
    try {
      setBusyAction(`delete:${saveId}`);
      await onDeleteSave(saveId);
      setMessage({ type: "success", text: `Deleted ${saveName}.` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to delete that preset." });
    } finally {
      setBusyAction("");
    }
  }

  async function handleSaveConnections(saveId) {
    try {
      setBusyAction(`link:${saveId}`);
      const nextHeroLoadoutId = draftHeroPresetBySaveId[saveId] ?? "";
      await onUpdateSave(saveId, {
        linkedLoadouts: nextHeroLoadoutId ? { heroLoadoutId: nextHeroLoadoutId } : null,
      });
      setMessage({ type: "success", text: "Updated connected loadouts." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to update connected loadouts." });
    } finally {
      setBusyAction("");
    }
  }

  if (!selectedMap) {
    return null;
  }

  return (
    <>
      <input
        ref={importInputRef}
        type="file"
        accept="application/zip,.zip,application/json,.json"
        style={{ display: "none" }}
        onChange={handleImportChange}
      />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Map Presets</div>
          <div style={{ fontSize: 12, color: colors.muted }}>{selectedMap.name} · {presets.length} preset{presets.length === 1 ? "" : "s"}</div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            background: colors.header,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            padding: "9px 14px",
            cursor: "pointer",
            fontWeight: 800,
            fontFamily: "inherit",
          }}
        >
          Presets
        </button>
      </div>

      {isOpen ? (
        <PresetsModalShell
          colors={colors}
          title={`${selectedMap.name} Presets`}
          subtitle="Each map preset already contains the Placement Loadout, Map Perks Loadout, and Spell Loadout for this map. Use the connection control below to pair that map preset with a Hero Loadout preset."
          onClose={() => setIsOpen(false)}
          actions={(
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={busyAction === "import"}
              style={{
                background: colors.header,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: "10px 14px",
                cursor: busyAction === "import" ? "wait" : "pointer",
                fontWeight: 800,
                fontFamily: "inherit",
              }}
            >
              {busyAction === "import" ? "Importing..." : "Import Map Presets"}
            </button>
          )}
          maxWidth={1080}
        >
          <div style={{ display: "grid", gap: 14 }}>
            {message ? (
              <div style={{ fontSize: 12, fontWeight: 700, color: message.type === "error" ? "#ffb3a8" : "#9ff3b0" }}>
                {message.text}
              </div>
            ) : null}

            {presets.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
                {presets.map((save) => {
                  const isCurrent = save.id === currentSavedLoadoutId;
                  const linkedHeroPresetId = draftHeroPresetBySaveId[save.id] ?? "";
                  const linkedHeroPreset = heroPresets.find((heroPreset) => heroPreset.id === linkedHeroPresetId) ?? null;
                  const persistedLinkedHeroPreset = heroPresets.find((heroPreset) => heroPreset.id === save.linkedLoadouts?.heroLoadoutId) ?? null;
                  const hasDirtyConnection = linkedHeroPresetId !== (save.linkedLoadouts?.heroLoadoutId ?? "");

                  return (
                    <div
                      key={save.id}
                      style={{
                        background: isCurrent ? "rgba(245,146,30,0.12)" : colors.header,
                        border: `1px solid ${isCurrent ? colors.accent : colors.border}`,
                        borderRadius: 14,
                        padding: 14,
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>{save.name}</div>
                          {isCurrent ? (
                            <span style={{ borderRadius: 999, padding: "4px 9px", background: "rgba(245,146,30,0.16)", color: colors.accent, border: "1px solid rgba(245,146,30,0.4)", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              Current
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 12, color: save.description ? colors.text : colors.muted, lineHeight: 1.5 }}>
                          {save.description || "No description."}
                        </div>
                        <div style={{ fontSize: 11, color: colors.muted }}>Updated: {formatDateTime(save.updatedAt)}</div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {[
                          "Placement Loadout",
                          "Map Perks Loadout",
                          "Spell Loadout",
                        ].map((label) => (
                          <span key={label} style={{ borderRadius: 999, padding: "4px 9px", background: "rgba(255,255,255,0.06)", color: colors.text, border: `1px solid ${colors.border}`, fontSize: 10, fontWeight: 800, letterSpacing: "0.05em" }}>
                            {label}
                          </span>
                        ))}
                      </div>

                      <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 12, background: "rgba(6, 16, 28, 0.28)", border: `1px solid ${colors.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontSize: 11, color: colors.muted, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Connected Hero Loadout</div>
                          <div style={{ fontSize: 11, color: persistedLinkedHeroPreset ? colors.accent : colors.muted }}>
                            {persistedLinkedHeroPreset ? persistedLinkedHeroPreset.name : "None linked"}
                          </div>
                        </div>
                        <select
                          value={linkedHeroPresetId}
                          onChange={(event) => setDraftHeroPresetBySaveId((current) => ({ ...current, [save.id]: event.target.value }))}
                          style={{ background: "#0f2640", border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 10, padding: "10px 12px", font: "inherit" }}
                        >
                          <option value="">No linked hero preset</option>
                          {heroPresets.map((heroPreset) => (
                            <option key={heroPreset.id} value={heroPreset.id}>{heroPreset.name}</option>
                          ))}
                        </select>
                        {linkedHeroPreset ? (
                          <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
                            Loading this map preset will also load <span style={{ color: colors.text, fontWeight: 700 }}>{linkedHeroPreset.name}</span>.
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
                            Leave this empty if the map preset should only change placements, map perks, and spells.
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => handleSaveConnections(save.id)}
                            disabled={busyAction === `link:${save.id}` || !hasDirtyConnection}
                            style={{
                              background: hasDirtyConnection ? colors.accent : colors.header,
                              color: hasDirtyConnection ? "#08111d" : colors.muted,
                              border: `1px solid ${hasDirtyConnection ? colors.accent : colors.border}`,
                              borderRadius: 10,
                              padding: "8px 12px",
                              fontWeight: 800,
                              cursor: hasDirtyConnection ? "pointer" : "default",
                              fontFamily: "inherit",
                            }}
                          >
                            {busyAction === `link:${save.id}` ? "Saving Link..." : "Save Connection"}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => handleLoad(save.id)}
                          disabled={busyAction === `load:${save.id}`}
                          style={{ background: colors.accent, color: "#08111d", border: `1px solid ${colors.accent}`, borderRadius: 10, padding: "8px 12px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          {busyAction === `load:${save.id}` ? "Loading..." : "Load"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExport(save.id)}
                          disabled={busyAction === `export:${save.id}`}
                          style={{ background: colors.header, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          {busyAction === `export:${save.id}` ? "Exporting..." : "Export"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(save.id, save.name)}
                          disabled={busyAction === `delete:${save.id}`}
                          style={{ background: "transparent", color: "#ffb3a8", border: "1px solid rgba(255, 122, 103, 0.45)", borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: colors.muted, fontSize: 13, lineHeight: 1.6 }}>
                No saved presets for this map yet. Save one from the header while this map is active, or import presets for {selectedMap.name} here.
              </div>
            )}
          </div>
        </PresetsModalShell>
      ) : null}
    </>
  );
}