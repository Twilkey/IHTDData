import JSZip from "jszip";

import {
  APP_SAVE_VERSION,
  buildAppSavePayload,
  buildDefaultAppSavePayload,
  validateAppSavePayload,
} from "./loadoutBuilderSave";
import {
  clearCurrentSavedLoadoutSelections,
  getCurrentSavedLoadoutSelections,
  persistLoadoutRuntime,
  setCurrentScopedSavedLoadoutId,
} from "./loadoutRuntimeStore";
import {
  deleteStoreValue,
  LOADOUT_DB_SAVES_STORE,
  readAllStoreValues,
  readStoreValue,
  writeStoreValue,
} from "./loadoutDbCore";
import {
  applyPayloadForLoadoutScope,
  getLegacySelectedMapIdFromPayload,
  getLoadoutRecordScope,
  getLoadoutScopeDisplayName,
  LOADOUT_RECORD_SCOPES,
  LOADOUT_RECORD_SCOPE_FULL,
  normalizeLoadoutScopeContext,
} from "./loadoutScope";

export const LOADOUT_EXPORT_SCOPES = LOADOUT_RECORD_SCOPES;

const BUNDLE_FORMAT = "ihtddata-loadout-bundle";
const BUNDLE_VERSION = 1;

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `loadout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeString(value, fallback = "") {
  const nextValue = String(value ?? "").trim();
  return nextValue || fallback;
}

function sanitizeFileName(value, fallback = "save") {
  const compact = sanitizeString(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return compact || fallback;
}

function getScopeDefinition(scopeId) {
  return getLoadoutRecordScope(scopeId);
}

function normalizeRecord(record) {
  const payload = cloneValue(record?.payload ?? buildDefaultAppSavePayload());
  const scopeId = getScopeDefinition(record?.scopeId).id;
  const fallbackMapId = scopeId === "mapLoadoutMap" ? getLegacySelectedMapIdFromPayload(payload) : "";
  const scopeContext = normalizeLoadoutScopeContext(scopeId, {
    ...(record?.scopeContext ?? {}),
    mapId: record?.scopeContext?.mapId ?? fallbackMapId,
  });

  return {
    id: sanitizeString(record?.id, createId()),
    name: sanitizeString(record?.name, "Untitled Save"),
    description: sanitizeString(record?.description),
    createdAt: sanitizeString(record?.createdAt, new Date().toISOString()),
    updatedAt: sanitizeString(record?.updatedAt, new Date().toISOString()),
    scopeId,
    scopeContext,
    payload,
  };
}

function summarizeRecord(record) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    scopeId: record.scopeId,
    scopeContext: cloneValue(record.scopeContext),
    scopeLabel: getLoadoutScopeDisplayName(record.scopeId, record.scopeContext),
  };
}

function sortRecords(records) {
  return [...records].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt) || 0;
    const rightTime = Date.parse(right.updatedAt) || 0;
    return rightTime - leftTime;
  });
}

function buildEntryPayload(record) {
  return {
    format: "ihtddata-loadout-entry",
    bundleVersion: BUNDLE_VERSION,
    scopeId: getScopeDefinition(record.scopeId).id,
    scopeContext: cloneValue(record.scopeContext),
    save: summarizeRecord(record),
    payload: cloneValue(record.payload),
  };
}

function validateImportedEntry(entry, fileName) {
  if (entry?.format !== "ihtddata-loadout-entry") {
    throw new Error(`${fileName} is not a valid IHTDData save entry.`);
  }

  const validation = validateAppSavePayload(entry.payload);
  if (!validation.ok) {
    throw new Error(`${fileName}: ${validation.message}`);
  }

  const scopeId = getScopeDefinition(entry.scopeId).id;
  return {
    importId: createId(),
    fileName,
    scopeId,
    scopeContext: normalizeLoadoutScopeContext(scopeId, entry.scopeContext),
    name: sanitizeString(entry.save?.name, "Imported Save"),
    description: sanitizeString(entry.save?.description),
    sourceSaveId: sanitizeString(entry.save?.id),
    createdAt: sanitizeString(entry.save?.createdAt, new Date().toISOString()),
    updatedAt: sanitizeString(entry.save?.updatedAt, new Date().toISOString()),
    payload: cloneValue(entry.payload),
  };
}

async function putRecord(record) {
  const normalized = normalizeRecord(record);
  await writeStoreValue(LOADOUT_DB_SAVES_STORE, normalized);
  return normalized;
}

export async function listSavedLoadouts() {
  const records = await readAllStoreValues(LOADOUT_DB_SAVES_STORE);
  return sortRecords(records.map(normalizeRecord)).map(summarizeRecord);
}

export async function getSavedLoadout(saveId) {
  const record = await readStoreValue(LOADOUT_DB_SAVES_STORE, saveId);
  return record ? normalizeRecord(record) : null;
}

export async function createSavedLoadout({
  name,
  description = "",
  payload,
  scopeId = LOADOUT_RECORD_SCOPE_FULL,
  scopeContext = null,
}) {
  const validation = validateAppSavePayload(payload);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const normalizedScopeId = getScopeDefinition(scopeId).id;
  const normalizedScopeContext = normalizeLoadoutScopeContext(normalizedScopeId, scopeContext);
  if (normalizedScopeId === "mapLoadoutMap" && !normalizedScopeContext?.mapId) {
    throw new Error("Single-map presets need a map before they can be saved.");
  }

  const timestamp = new Date().toISOString();
  const record = await putRecord({
    id: createId(),
    name,
    description,
    createdAt: timestamp,
    updatedAt: timestamp,
    scopeId: normalizedScopeId,
    scopeContext: normalizedScopeContext,
    payload,
  });

  return summarizeRecord(record);
}

export async function updateSavedLoadout(saveId, updates) {
  const existingRecord = await getSavedLoadout(saveId);
  if (!existingRecord) {
    throw new Error("That save no longer exists.");
  }

  const nextPayload = updates.payload ?? existingRecord.payload;
  const validation = validateAppSavePayload(nextPayload);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const nextScopeId = getScopeDefinition(updates.scopeId ?? existingRecord.scopeId).id;
  const nextScopeContext = normalizeLoadoutScopeContext(nextScopeId, updates.scopeContext ?? existingRecord.scopeContext);
  if (nextScopeId === "mapLoadoutMap" && !nextScopeContext?.mapId) {
    throw new Error("Single-map presets need a map before they can be saved.");
  }

  const record = await putRecord({
    ...existingRecord,
    name: updates.name ?? existingRecord.name,
    description: updates.description ?? existingRecord.description,
    scopeId: nextScopeId,
    scopeContext: nextScopeContext,
    payload: nextPayload,
    updatedAt: new Date().toISOString(),
  });

  return summarizeRecord(record);
}

export async function deleteSavedLoadout(saveId) {
  await deleteStoreValue(LOADOUT_DB_SAVES_STORE, saveId);
}

export async function saveWorkingLoadoutAsRecord({
  name,
  description = "",
  scopeId = LOADOUT_RECORD_SCOPE_FULL,
  scopeContext = null,
}, storage = localStorage) {
  const payload = buildAppSavePayload(storage);
  const record = await createSavedLoadout({ name, description, payload, scopeId, scopeContext });
  setCurrentScopedSavedLoadoutId(record.scopeId, record.scopeContext, record.id, storage);
  await persistLoadoutRuntime(storage);
  return record;
}

export async function saveWorkingLoadoutChanges(saveId, storage = localStorage) {
  const existingRecord = await getSavedLoadout(saveId);
  if (!existingRecord) {
    throw new Error("That save no longer exists.");
  }

  const payload = buildAppSavePayload(storage);
  const record = await updateSavedLoadout(saveId, {
    payload,
    scopeId: existingRecord.scopeId,
    scopeContext: existingRecord.scopeContext,
  });
  setCurrentScopedSavedLoadoutId(record.scopeId, record.scopeContext, record.id, storage);
  await persistLoadoutRuntime(storage);
  return record;
}

export async function loadSavedLoadoutIntoWorkingState(saveId, storage = localStorage) {
  const record = await getSavedLoadout(saveId);
  if (!record) {
    throw new Error("That save no longer exists.");
  }

  const result = applyPayloadForLoadoutScope(record.payload, record.scopeId, record.scopeContext, storage);
  if (!result.ok) {
    throw new Error(result.message);
  }

  setCurrentScopedSavedLoadoutId(record.scopeId, record.scopeContext, record.id, storage);
  await persistLoadoutRuntime(storage);
  return summarizeRecord(record);
}

export async function startFreshWorkingLoadout(storage = localStorage) {
  const result = applyPayloadForLoadoutScope(buildDefaultAppSavePayload(storage), LOADOUT_RECORD_SCOPE_FULL, null, storage);
  if (!result.ok) {
    throw new Error(result.message);
  }

  clearCurrentSavedLoadoutSelections(storage);
  await persistLoadoutRuntime(storage);
  return true;
}

export async function exportSavedLoadoutsBundle({ saveIds }) {
  const selectedIds = Array.from(new Set((saveIds ?? []).filter(Boolean)));
  if (!selectedIds.length) {
    throw new Error("Select at least one save to export.");
  }

  const records = [];
  for (const saveId of selectedIds) {
    const record = await getSavedLoadout(saveId);
    if (record) {
      records.push(record);
    }
  }

  if (!records.length) {
    throw new Error("None of the selected saves could be found.");
  }

  const zip = new JSZip();
  const manifest = {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    appSaveVersion: APP_SAVE_VERSION,
    loadouts: records.map((record, index) => {
      const safeBaseName = sanitizeFileName(`${index + 1}-${record.name}`, `save-${index + 1}`);
      return {
        id: record.id,
        name: record.name,
        description: record.description,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        scopeId: record.scopeId,
        scopeContext: cloneValue(record.scopeContext),
        file: `saves/${safeBaseName}.json`,
      };
    }),
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  manifest.loadouts.forEach((item) => {
    const record = records.find((candidate) => candidate.id === item.id);
    if (record) {
      zip.file(item.file, JSON.stringify(buildEntryPayload(record), null, 2));
    }
  });

  return {
    blob: await zip.generateAsync({ type: "blob" }),
    fileName: `ihtddata-loadouts-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`,
  };
}

export async function parseImportedLoadoutFile(file) {
  const lowerName = String(file?.name ?? "").toLowerCase();

  if (lowerName.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);
    const manifestEntry = zip.file("manifest.json");
    if (!manifestEntry) {
      throw new Error("The selected ZIP is missing manifest.json.");
    }

    const manifest = JSON.parse(await manifestEntry.async("string"));
    if (manifest?.format !== BUNDLE_FORMAT || !Array.isArray(manifest.loadouts)) {
      throw new Error("The selected ZIP is not a valid IHTDData save bundle.");
    }

    const entries = [];
    for (const item of manifest.loadouts) {
      const fileEntry = zip.file(item.file);
      if (!fileEntry) {
        throw new Error(`The bundle is missing ${item.file}.`);
      }

      const parsedEntry = JSON.parse(await fileEntry.async("string"));
      entries.push(validateImportedEntry(parsedEntry, item.file));
    }

    return { entries, warnings: [] };
  }

  const rawText = await file.text();
  const parsedJson = JSON.parse(rawText);

  if (parsedJson?.format === "ihtddata-loadout-entry") {
    return {
      entries: [validateImportedEntry(parsedJson, file.name || "import.json")],
      warnings: [],
    };
  }

  const validation = validateAppSavePayload(parsedJson);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    entries: [{
      importId: createId(),
      fileName: file.name || "import.json",
      scopeId: LOADOUT_RECORD_SCOPE_FULL,
      scopeContext: null,
      name: sanitizeString(file.name?.replace(/\.json$/i, ""), "Imported Save"),
      description: "",
      sourceSaveId: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      payload: cloneValue(parsedJson),
    }],
    warnings: ["Imported a legacy single-save JSON file. It will be treated as a whole save import."],
  };
}

export async function importLoadoutEntries(importPlans) {
  const created = [];
  const updated = [];

  for (const plan of importPlans) {
    const scopeId = getScopeDefinition(plan.scopeId).id;
    const scopeContext = normalizeLoadoutScopeContext(scopeId, plan.scopeContext);

    if (plan.mode === "new") {
      const record = await createSavedLoadout({
        name: plan.name,
        description: plan.description,
        payload: plan.payload,
        scopeId,
        scopeContext,
      });
      created.push(record.id);
      continue;
    }

    if (plan.mode === "overwrite" && plan.targetId) {
      await updateSavedLoadout(plan.targetId, {
        name: plan.name,
        description: plan.description,
        payload: plan.payload,
        scopeId,
        scopeContext,
      });
      updated.push(plan.targetId);
    }
  }

  return {
    createdIds: Array.from(new Set(created)),
    updatedIds: Array.from(new Set(updated)),
    currentSavedLoadoutSelections: getCurrentSavedLoadoutSelections(localStorage),
  };
}

export function getLoadoutExportScope(scopeId) {
  return getScopeDefinition(scopeId);
}