import { useEffect, useMemo, useRef, useState } from "react";

import {
  exportSavedLoadoutsBundle,
  getLoadoutExportScope,
  importLoadoutEntries,
  LOADOUT_EXPORT_SCOPES,
  parseImportedLoadoutFile,
} from "../../lib/loadoutSavedRepository";

function formatDateTime(value) {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleString();
}

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

function buildEntryPlan(entry, currentSavedLoadoutId) {
  return {
    ...entry,
    mode: entry.scopeId === "full" ? "new" : "overwrite-page",
    targetId: currentSavedLoadoutId || "",
    targetIds: currentSavedLoadoutId ? [currentSavedLoadoutId] : [],
  };
}

function SaveModal({ children, onClose, title, subtitle, colors, maxWidth = 880 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3, 8, 18, 0.82)",
        backdropFilter: "blur(10px)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "88vh",
          overflow: "hidden",
          borderRadius: 18,
          border: `1px solid ${colors.border}`,
          background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 20%, ${colors.bg} 100%)`,
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.42)",
          display: "grid",
          gridTemplateRows: "auto 1fr",
        }}
      >
        <div style={{ padding: 20, borderBottom: `1px solid ${colors.border}`, display: "grid", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.03em" }}>{title}</div>
              {subtitle ? <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>{subtitle}</div> : null}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                color: colors.muted,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                width: 40,
                height: 40,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

export function SavesPage({
  colors,
  saves,
  currentSavedLoadoutId,
  onLoadSave,
  onDeleteSave,
  onStartFreshSave,
  onImportComplete,
}) {
  const importInputRef = useRef(null);
  const [selectedSaveIds, setSelectedSaveIds] = useState(() => []);
  const [exportScopeId, setExportScopeId] = useState("full");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [importState, setImportState] = useState({
    isOpen: false,
    entries: [],
    warnings: [],
    sourceName: "",
    applying: false,
    error: "",
  });

  useEffect(() => {
    setSelectedSaveIds((current) => current.filter((saveId) => saves.some((save) => save.id === saveId)));
  }, [saves]);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timerId = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timerId);
  }, [message]);

  const selectedSaves = useMemo(
    () => saves.filter((save) => selectedSaveIds.includes(save.id)),
    [saves, selectedSaveIds]
  );

  const exportScope = getLoadoutExportScope(exportScopeId);

  function toggleSaveSelection(saveId) {
    setSelectedSaveIds((current) => (
      current.includes(saveId)
        ? current.filter((value) => value !== saveId)
        : [...current, saveId]
    ));
  }

  function updateImportEntry(importId, patch) {
    setImportState((current) => ({
      ...current,
      entries: current.entries.map((entry) => (
        entry.importId === importId ? { ...entry, ...patch } : entry
      )),
    }));
  }

  function toggleImportTarget(importId, targetId) {
    setImportState((current) => ({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.importId !== importId) {
          return entry;
        }

        const targetIds = entry.targetIds.includes(targetId)
          ? entry.targetIds.filter((value) => value !== targetId)
          : [...entry.targetIds, targetId];
        return { ...entry, targetIds };
      }),
    }));
  }

  function isImportPlanValid(entry) {
    if (entry.scopeId === "full") {
      return entry.mode === "new" || (entry.mode === "overwrite" && entry.targetId);
    }

    return entry.targetIds.length > 0;
  }

  async function handleExportSelected() {
    try {
      setBusyAction("export");
      const { blob, fileName } = await exportSavedLoadoutsBundle({
        saveIds: selectedSaveIds,
        scopeId: exportScopeId,
      });
      downloadBlob(blob, fileName);
      setIsExportModalOpen(false);
      setMessage({ type: "success", text: `Exported ${selectedSaveIds.length} save${selectedSaveIds.length === 1 ? "" : "s"} as ${exportScope.label.toLowerCase()}.` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to export the selected saves." });
    } finally {
      setBusyAction("");
    }
  }

  function handleImportClick() {
    importInputRef.current?.click();
  }

  async function handleImportChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setBusyAction("prepare-import");
      const parsed = await parseImportedLoadoutFile(file);
      setImportState({
        isOpen: true,
        sourceName: file.name,
        warnings: parsed.warnings,
        entries: parsed.entries.map((entry) => buildEntryPlan(entry, currentSavedLoadoutId)),
        applying: false,
        error: "",
      });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to read that import file." });
    } finally {
      setBusyAction("");
    }
  }

  async function handleApplyImport() {
    const invalidEntry = importState.entries.find((entry) => !isImportPlanValid(entry));
    if (invalidEntry) {
      setImportState((current) => ({
        ...current,
        error: `Choose valid targets for ${invalidEntry.name}.`,
      }));
      return;
    }

    try {
      setImportState((current) => ({ ...current, applying: true, error: "" }));

      const summary = await importLoadoutEntries(importState.entries.map((entry) => ({
        scopeId: entry.scopeId,
        mode: entry.scopeId === "full" ? entry.mode : "overwrite-page",
        targetId: entry.targetId,
        targetIds: entry.targetIds,
        name: entry.name,
        description: entry.description,
        payload: entry.payload,
      })));

      await onImportComplete(summary);
      setImportState({ isOpen: false, entries: [], warnings: [], sourceName: "", applying: false, error: "" });
      const totalApplied = summary.createdIds.length + summary.updatedIds.length;
      setMessage({ type: "success", text: `Imported ${totalApplied} save change${totalApplied === 1 ? "" : "s"} from ${importState.sourceName}.` });
    } catch (error) {
      setImportState((current) => ({
        ...current,
        applying: false,
        error: error instanceof Error ? error.message : "Unable to import those saves.",
      }));
    }
  }

  async function handleLoadSave(saveId) {
    try {
      setBusyAction(`load:${saveId}`);
      await onLoadSave(saveId);
      setMessage({ type: "success", text: "Loaded save into the site." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to load that save." });
    } finally {
      setBusyAction("");
    }
  }

  async function handleDeleteSave() {
    if (!deleteTarget) {
      return;
    }

    try {
      setBusyAction(`delete:${deleteTarget.id}`);
      await onDeleteSave(deleteTarget.id);
      setMessage({ type: "success", text: `Deleted ${deleteTarget.name}.` });
      setDeleteTarget(null);
      setSelectedSaveIds((current) => current.filter((saveId) => saveId !== deleteTarget.id));
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to delete that save." });
    } finally {
      setBusyAction("");
    }
  }

  async function handleStartFresh() {
    try {
      setBusyAction("fresh");
      await onStartFreshSave();
      setMessage({ type: "success", text: "Started a fresh loadout and cleared the current working inputs back to defaults." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to start a fresh save." });
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <input ref={importInputRef} type="file" accept="application/zip,.zip,application/json,.json" style={{ display: "none" }} onChange={handleImportChange} />

      <div
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 18,
          padding: 20,
          background: `linear-gradient(135deg, ${colors.header} 0%, ${colors.panel} 45%, rgba(13, 30, 53, 0.96) 100%)`,
          boxShadow: "0 16px 50px rgba(0, 0, 0, 0.24)",
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "0.03em" }}>Saved Loadouts</div>
            <div style={{ fontSize: 13, color: colors.muted, lineHeight: 1.55 }}>
              Saved loadouts live only in this browser on this device. They can be lost if you clear site data, switch browsers, use a different device, or use a private browsing session. Export your saves and import them on the other browser or device whenever you want to transfer them.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              onClick={handleStartFresh}
              disabled={busyAction === "fresh"}
              style={{
                background: "rgba(255,255,255,0.04)",
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: "10px 14px",
                cursor: busyAction === "fresh" ? "wait" : "pointer",
                fontFamily: "inherit",
                fontWeight: 700,
              }}
            >
              {busyAction === "fresh" ? "Resetting..." : "Start Fresh Save"}
            </button>
            <button
              onClick={() => setIsExportModalOpen(true)}
              disabled={!selectedSaveIds.length || busyAction === "export"}
              style={{
                background: selectedSaveIds.length ? colors.accent : colors.header,
                color: selectedSaveIds.length ? "#08111d" : colors.muted,
                border: `1px solid ${selectedSaveIds.length ? colors.accent : colors.border}`,
                borderRadius: 10,
                padding: "10px 14px",
                cursor: selectedSaveIds.length ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                fontWeight: 800,
              }}
            >
              Export Selected
            </button>
            <button
              onClick={handleImportClick}
              disabled={busyAction === "prepare-import"}
              style={{
                background: colors.header,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: "10px 14px",
                cursor: busyAction === "prepare-import" ? "wait" : "pointer",
                fontFamily: "inherit",
                fontWeight: 800,
              }}
            >
              {busyAction === "prepare-import" ? "Reading Import..." : "Import Bundle"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setSelectedSaveIds(saves.map((save) => save.id))}
            style={{ background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedSaveIds([])}
            style={{ background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
          >
            Clear Selection
          </button>
          <div style={{ fontSize: 12, color: colors.muted }}>
            {selectedSaveIds.length} selected
          </div>
          {message ? (
            <div style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: message.type === "error" ? "#ff9c95" : "#9ff3b0" }}>
              {message.text}
            </div>
          ) : null}
        </div>
      </div>

      {saves.length ? (
        <div style={{ display: "grid", gap: 14 }}>
          {saves.map((save) => {
            const isCurrent = save.id === currentSavedLoadoutId;
            const isSelected = selectedSaveIds.includes(save.id);
            return (
              <div
                key={save.id}
                style={{
                  border: `1px solid ${isCurrent ? colors.accent : colors.border}`,
                  borderRadius: 16,
                  padding: 18,
                  background: isCurrent
                    ? `linear-gradient(135deg, rgba(245, 146, 30, 0.16) 0%, ${colors.panel} 52%, rgba(17, 36, 61, 0.98) 100%)`
                    : `linear-gradient(180deg, ${colors.panel} 0%, ${colors.header} 100%)`,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", gap: 14, alignItems: "start", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", paddingTop: 4 }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSaveSelection(save.id)} />
                    <span style={{ fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Export</span>
                  </label>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 19, fontWeight: 800 }}>{save.name}</div>
                      {isCurrent ? (
                        <span style={{ borderRadius: 999, padding: "4px 10px", background: "rgba(245,146,30,0.16)", color: colors.accent, border: `1px solid rgba(245,146,30,0.45)`, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          Current Working Save
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 13, color: save.description ? colors.text : colors.muted, marginTop: 6, lineHeight: 1.5 }}>
                      {save.description || "No description."}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 10, gridAutoFlow: "column", justifyContent: "end", flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleLoadSave(save.id)}
                      disabled={busyAction === `load:${save.id}`}
                      style={{ background: colors.accent, color: "#07111d", border: `1px solid ${colors.accent}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}
                    >
                      {busyAction === `load:${save.id}` ? "Loading..." : "Load on Site"}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(save)}
                      disabled={busyAction === `delete:${save.id}`}
                      style={{ background: "transparent", color: "#ffb3a8", border: "1px solid rgba(255, 122, 103, 0.45)", borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: colors.muted }}>
                  <div>Created: {formatDateTime(save.createdAt)}</div>
                  <div>Updated: {formatDateTime(save.updatedAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ border: `1px dashed ${colors.border}`, borderRadius: 18, padding: 28, background: colors.panel, color: colors.muted, textAlign: "center", lineHeight: 1.6 }}>
          You do not have any saved loadouts yet. Use the header save button to create one, or import a bundle here.
        </div>
      )}

      {isExportModalOpen ? (
        <SaveModal
          colors={colors}
          onClose={() => setIsExportModalOpen(false)}
          title="Export Saves"
          subtitle="Choose whether to export the whole save or only one loadout page from each selected save."
          maxWidth={720}
        >
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "grid", gap: 12 }}>
              {LOADOUT_EXPORT_SCOPES.map((scope) => (
                <label key={scope.id} style={{ display: "flex", gap: 14, padding: 14, borderRadius: 14, border: `1px solid ${scope.id === exportScopeId ? colors.accent : colors.border}`, background: scope.id === exportScopeId ? "rgba(245,146,30,0.12)" : "rgba(255,255,255,0.02)", cursor: "pointer" }}>
                  <input type="radio" checked={scope.id === exportScopeId} onChange={() => setExportScopeId(scope.id)} />
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{scope.label}</div>
                    <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>{scope.description}</div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ borderRadius: 14, border: `1px solid ${colors.border}`, background: colors.panel, padding: 14, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Selected Saves</div>
              <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
                {selectedSaves.map((save) => save.name).join(", ")}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "end", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setIsExportModalOpen(false)} style={{ background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>Cancel</button>
              <button onClick={handleExportSelected} style={{ background: colors.accent, color: "#07111d", border: `1px solid ${colors.accent}`, borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>
                Export {selectedSaveIds.length} Save{selectedSaveIds.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </SaveModal>
      ) : null}

      {importState.isOpen ? (
        <SaveModal
          colors={colors}
          onClose={() => setImportState({ isOpen: false, entries: [], warnings: [], sourceName: "", applying: false, error: "" })}
          title="Import Saves"
          subtitle="Choose how each imported entry should be applied. Whole saves can be imported as new records or overwrite one record. Page exports can overwrite one or more existing saves for that page only."
        >
          <div style={{ display: "grid", gap: 16 }}>
            {importState.warnings.length ? (
              <div style={{ borderRadius: 14, padding: 14, background: "rgba(245,146,30,0.12)", border: "1px solid rgba(245,146,30,0.32)", color: colors.text, display: "grid", gap: 8 }}>
                {importState.warnings.map((warning) => (
                  <div key={warning} style={{ fontSize: 12, lineHeight: 1.5 }}>{warning}</div>
                ))}
              </div>
            ) : null}

            {importState.entries.map((entry) => {
              const scope = getLoadoutExportScope(entry.scopeId);
              return (
                <div key={entry.importId} style={{ borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.panel, padding: 16, display: "grid", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{entry.name}</div>
                        <span style={{ borderRadius: 999, padding: "4px 10px", background: "rgba(255,255,255,0.05)", border: `1px solid ${colors.border}`, fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{scope.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: colors.muted }}>{entry.description || "No description."}</div>
                      <div style={{ fontSize: 11, color: colors.muted }}>Updated: {formatDateTime(entry.updatedAt)}</div>
                    </div>
                  </div>

                  {entry.scopeId === "full" ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                        <input type="radio" checked={entry.mode === "new"} onChange={() => updateImportEntry(entry.importId, { mode: "new", targetId: "" })} />
                        <span>Import as a new save record</span>
                      </label>
                      <label style={{ display: "grid", gap: 8, cursor: "pointer" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <input type="radio" checked={entry.mode === "overwrite"} onChange={() => updateImportEntry(entry.importId, { mode: "overwrite" })} />
                          <span>Overwrite one existing save record</span>
                        </div>
                        {entry.mode === "overwrite" ? (
                          <select value={entry.targetId} onChange={(event) => updateImportEntry(entry.importId, { targetId: event.target.value })} style={{ marginLeft: 28, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 12px", fontFamily: "inherit" }}>
                            <option value="">Choose a save</option>
                            {saves.map((save) => (
                              <option key={save.id} value={save.id}>{save.name}</option>
                            ))}
                          </select>
                        ) : null}
                      </label>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
                        This page export will only overwrite the {scope.label.toLowerCase()} data inside the selected saves.
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {saves.length ? saves.map((save) => {
                          const checked = entry.targetIds.includes(save.id);
                          return (
                            <label key={`${entry.importId}-${save.id}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 12, border: `1px solid ${checked ? colors.accent : colors.border}`, background: checked ? "rgba(245,146,30,0.10)" : "transparent", cursor: "pointer" }}>
                              <input type="checkbox" checked={checked} onChange={() => toggleImportTarget(entry.importId, save.id)} />
                              <div style={{ display: "grid", gap: 2 }}>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{save.name}</div>
                                <div style={{ fontSize: 11, color: colors.muted }}>{save.description || "No description."}</div>
                              </div>
                            </label>
                          );
                        }) : (
                          <div style={{ fontSize: 12, color: "#ffb3a8" }}>Import at least one whole save before applying page-only imports.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {importState.error ? (
              <div style={{ color: "#ffb3a8", fontSize: 12, fontWeight: 700 }}>{importState.error}</div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "end", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setImportState({ isOpen: false, entries: [], warnings: [], sourceName: "", applying: false, error: "" })} style={{ background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>Cancel</button>
              <button onClick={handleApplyImport} disabled={importState.applying} style={{ background: colors.accent, color: "#07111d", border: `1px solid ${colors.accent}`, borderRadius: 10, padding: "10px 16px", cursor: importState.applying ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 800 }}>
                {importState.applying ? "Applying Import..." : "Apply Import"}
              </button>
            </div>
          </div>
        </SaveModal>
      ) : null}

      {deleteTarget ? (
        <SaveModal
          colors={colors}
          onClose={() => setDeleteTarget(null)}
          title="Delete Save"
          subtitle="This removes the saved record from this browser. Export it first if you want a backup."
          maxWidth={560}
        >
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              Delete <strong>{deleteTarget.name}</strong>?
            </div>
            <div style={{ display: "flex", justifyContent: "end", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setDeleteTarget(null)} style={{ background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>Cancel</button>
              <button onClick={handleDeleteSave} style={{ background: "rgba(255, 122, 103, 0.14)", color: "#ffb3a8", border: "1px solid rgba(255, 122, 103, 0.45)", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>
                Delete Save
              </button>
            </div>
          </div>
        </SaveModal>
      ) : null}
    </div>
  );
}