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

export function ScopedLoadoutPresetsPanel({
  colors,
  title,
  description,
  scopeId,
  presets,
  currentSavedLoadoutId,
  onLoadSave,
  onDeleteSave,
  onImportComplete,
}) {
  const importInputRef = useRef(null);
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

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
      setMessage({ type: "success", text: "Exported preset." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to export that preset." });
    } finally {
      setBusyAction("");
    }
  }

  async function handleImportChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setBusyAction("import");
      const parsed = await parseImportedLoadoutFile(file);
      const matchingEntries = parsed.entries.filter((entry) => entry.scopeId === scopeId);

      if (!matchingEntries.length) {
        throw new Error(`No ${title.toLowerCase()} presets were found in that file.`);
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
      setMessage({ type: "success", text: `Imported ${matchingEntries.length} preset${matchingEntries.length === 1 ? "" : "s"}.` });
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
      await onLoadSave(saveId);
      setMessage({ type: "success", text: "Loaded preset." });
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
          <div style={{ fontSize: 11, color: colors.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</div>
          <div style={{ fontSize: 12, color: colors.muted }}>{presets.length} preset{presets.length === 1 ? "" : "s"} saved for this page.</div>
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
          title={title}
          subtitle={description}
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
              {busyAction === "import" ? "Importing..." : "Import Presets"}
            </button>
          )}
        >
          <div style={{ display: "grid", gap: 14 }}>
            {message ? (
              <div style={{ fontSize: 12, fontWeight: 700, color: message.type === "error" ? "#ffb3a8" : "#9ff3b0" }}>
                {message.text}
              </div>
            ) : null}

            {presets.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                {presets.map((save) => {
                  const isCurrent = save.id === currentSavedLoadoutId;
                  return (
                    <div
                      key={save.id}
                      style={{
                        background: isCurrent ? "rgba(245,146,30,0.12)" : colors.header,
                        border: `1px solid ${isCurrent ? colors.accent : colors.border}`,
                        borderRadius: 14,
                        padding: 14,
                        display: "grid",
                        gap: 10,
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
                      </div>
                      <div style={{ fontSize: 11, color: colors.muted }}>Updated: {formatDateTime(save.updatedAt)}</div>
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
                No saved presets for this page yet. Use the header save button to create one, or import presets here.
              </div>
            )}
          </div>
        </PresetsModalShell>
      ) : null}
    </>
  );
}