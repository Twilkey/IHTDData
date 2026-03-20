import { getLoadoutScopeSelectionKey } from "./loadoutScope";
import { LOADOUT_DB_RUNTIME_STORE, readStoreValue, supportsLoadoutDatabase, writeStoreValue } from "./loadoutDbCore";

export const CURRENT_SAVED_LOADOUT_ID_STORAGE_KEY = "ihtddata.savedLoadouts.currentId";
export const CURRENT_SAVED_LOADOUT_SELECTIONS_STORAGE_KEY = "ihtddata.savedLoadouts.currentSelections.v1";
export const LOADOUT_RUNTIME_CHANGED_EVENT = "ihtddata:loadout-runtime-changed";

const RUNTIME_SNAPSHOT_KEY = "workingLoadoutRuntime";

const LOADOUT_RUNTIME_STORAGE_KEYS = Object.freeze([
  "notation",
  "ihtddata.loadoutBuilder.selectedMapId",
  "ihtddata.loadoutBuilder.placements.v1",
  "ihtddata.loadoutBuilder.ranks.v1",
  "ihtddata.statsLoadout.selectedTab",
  "ihtddata.statsLoadout.previewLevelsByTab.v1",
  "ihtddata.statsLoadout.levelsByTab.v1",
  "ihtddata.statsLoadout.hideMaxedByTab.v1",
  "ihtddata.mapLoadout.builderMode",
  "ihtddata.mapLoadout.state.v1",
  "ihtddata.heroLoadout.state.v1",
  "ihtddata.playerLoadout.state.v1",
  CURRENT_SAVED_LOADOUT_ID_STORAGE_KEY,
  CURRENT_SAVED_LOADOUT_SELECTIONS_STORAGE_KEY,
]);

let persistTimerId = null;

function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot ?? {}));
}

function notifyLoadoutRuntimeChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LOADOUT_RUNTIME_CHANGED_EVENT));
  }
}

function readCurrentSavedLoadoutSelections(storage = localStorage) {
  let parsedSelections = {};

  try {
    parsedSelections = JSON.parse(storage.getItem(CURRENT_SAVED_LOADOUT_SELECTIONS_STORAGE_KEY) ?? "{}");
  } catch {
    parsedSelections = {};
  }

  const normalizedSelections = Object.fromEntries(
    Object.entries(parsedSelections ?? {}).filter(([, value]) => typeof value === "string" && value.trim())
  );
  const legacyCurrentId = storage.getItem(CURRENT_SAVED_LOADOUT_ID_STORAGE_KEY) ?? "";

  if (legacyCurrentId.trim() && !normalizedSelections.full) {
    normalizedSelections.full = legacyCurrentId.trim();
  }

  return normalizedSelections;
}

function writeCurrentSavedLoadoutSelections(selections, storage = localStorage) {
  const normalizedSelections = Object.fromEntries(
    Object.entries(selections ?? {}).filter(([, value]) => typeof value === "string" && value.trim())
  );

  storage.setItem(CURRENT_SAVED_LOADOUT_SELECTIONS_STORAGE_KEY, JSON.stringify(normalizedSelections));

  if (normalizedSelections.full) {
    storage.setItem(CURRENT_SAVED_LOADOUT_ID_STORAGE_KEY, normalizedSelections.full);
  } else {
    storage.removeItem(CURRENT_SAVED_LOADOUT_ID_STORAGE_KEY);
  }
}

export function captureLoadoutRuntimeSnapshot(storage = localStorage) {
  const snapshot = {};

  LOADOUT_RUNTIME_STORAGE_KEYS.forEach((key) => {
    const value = storage.getItem(key);
    if (typeof value === "string") {
      snapshot[key] = value;
    }
  });

  return snapshot;
}

export function restoreLoadoutRuntimeSnapshot(snapshot, storage = localStorage) {
  LOADOUT_RUNTIME_STORAGE_KEYS.forEach((key) => {
    storage.removeItem(key);
  });

  Object.entries(snapshot ?? {}).forEach(([key, value]) => {
    if (LOADOUT_RUNTIME_STORAGE_KEYS.includes(key) && typeof value === "string") {
      storage.setItem(key, value);
    }
  });

  notifyLoadoutRuntimeChanged();
}

export async function persistLoadoutRuntime(storage = localStorage) {
  if (!supportsLoadoutDatabase()) {
    return false;
  }

  const snapshot = captureLoadoutRuntimeSnapshot(storage);
  await writeStoreValue(LOADOUT_DB_RUNTIME_STORE, cloneSnapshot(snapshot), RUNTIME_SNAPSHOT_KEY);
  notifyLoadoutRuntimeChanged();
  return true;
}

export function schedulePersistLoadoutRuntime(storage = localStorage, delay = 180) {
  notifyLoadoutRuntimeChanged();

  if (!supportsLoadoutDatabase()) {
    return;
  }

  if (persistTimerId != null) {
    window.clearTimeout(persistTimerId);
  }

  persistTimerId = window.setTimeout(() => {
    persistTimerId = null;
    void persistLoadoutRuntime(storage);
  }, delay);
}

export async function hydrateLoadoutRuntime(storage = localStorage) {
  if (!supportsLoadoutDatabase()) {
    return { hydrated: false, snapshot: null };
  }

  const snapshot = await readStoreValue(LOADOUT_DB_RUNTIME_STORE, RUNTIME_SNAPSHOT_KEY);
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    restoreLoadoutRuntimeSnapshot(snapshot, storage);
    return { hydrated: true, snapshot: cloneSnapshot(snapshot) };
  }

  await persistLoadoutRuntime(storage);
  return { hydrated: false, snapshot: null };
}

export function getCurrentSavedLoadoutId(storage = localStorage) {
  return getCurrentScopedSavedLoadoutId("full", null, storage);
}

export function setCurrentSavedLoadoutId(saveId, storage = localStorage) {
  setCurrentScopedSavedLoadoutId("full", null, saveId, storage);
}

export function clearCurrentSavedLoadoutId(storage = localStorage) {
  clearCurrentScopedSavedLoadoutId("full", null, storage);
}

export function getCurrentScopedSavedLoadoutId(scopeId, scopeContext, storage = localStorage) {
  const selectionKey = getLoadoutScopeSelectionKey(scopeId, scopeContext);
  return readCurrentSavedLoadoutSelections(storage)[selectionKey] ?? "";
}

export function setCurrentScopedSavedLoadoutId(scopeId, scopeContext, saveId, storage = localStorage) {
  const selectionKey = getLoadoutScopeSelectionKey(scopeId, scopeContext);
  const currentSelections = readCurrentSavedLoadoutSelections(storage);

  if (typeof saveId === "string" && saveId.trim()) {
    currentSelections[selectionKey] = saveId.trim();
  } else {
    delete currentSelections[selectionKey];
  }

  writeCurrentSavedLoadoutSelections(currentSelections, storage);
  schedulePersistLoadoutRuntime(storage);
}

export function clearCurrentScopedSavedLoadoutId(scopeId, scopeContext, storage = localStorage) {
  const selectionKey = getLoadoutScopeSelectionKey(scopeId, scopeContext);
  const currentSelections = readCurrentSavedLoadoutSelections(storage);
  delete currentSelections[selectionKey];
  writeCurrentSavedLoadoutSelections(currentSelections, storage);
  schedulePersistLoadoutRuntime(storage);
}

export function getCurrentSavedLoadoutSelections(storage = localStorage) {
  return readCurrentSavedLoadoutSelections(storage);
}

export function clearCurrentSavedLoadoutSelections(storage = localStorage) {
  storage.removeItem(CURRENT_SAVED_LOADOUT_SELECTIONS_STORAGE_KEY);
  storage.removeItem(CURRENT_SAVED_LOADOUT_ID_STORAGE_KEY);
  schedulePersistLoadoutRuntime(storage);
}

export function removeSavedLoadoutIdFromSelections(saveId, storage = localStorage) {
  const normalizedSaveId = typeof saveId === "string" ? saveId.trim() : "";
  if (!normalizedSaveId) {
    return false;
  }

  const currentSelections = readCurrentSavedLoadoutSelections(storage);
  let didChange = false;

  Object.entries(currentSelections).forEach(([selectionKey, selectedSaveId]) => {
    if (selectedSaveId === normalizedSaveId) {
      delete currentSelections[selectionKey];
      didChange = true;
    }
  });

  if (didChange) {
    writeCurrentSavedLoadoutSelections(currentSelections, storage);
    schedulePersistLoadoutRuntime(storage);
  }

  return didChange;
}