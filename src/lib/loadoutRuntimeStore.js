import { LOADOUT_DB_RUNTIME_STORE, readStoreValue, supportsLoadoutDatabase, writeStoreValue } from "./loadoutDbCore";

export const CURRENT_SAVED_LOADOUT_ID_STORAGE_KEY = "ihtddata.savedLoadouts.currentId";
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
  return storage.getItem(CURRENT_SAVED_LOADOUT_ID_STORAGE_KEY) ?? "";
}

export function setCurrentSavedLoadoutId(saveId, storage = localStorage) {
  if (typeof saveId === "string" && saveId.trim()) {
    storage.setItem(CURRENT_SAVED_LOADOUT_ID_STORAGE_KEY, saveId.trim());
  } else {
    storage.removeItem(CURRENT_SAVED_LOADOUT_ID_STORAGE_KEY);
  }

  schedulePersistLoadoutRuntime(storage);
}

export function clearCurrentSavedLoadoutId(storage = localStorage) {
  storage.removeItem(CURRENT_SAVED_LOADOUT_ID_STORAGE_KEY);
  schedulePersistLoadoutRuntime(storage);
}