import JSZip from "jszip";

import {
  APP_SAVE_VERSION,
  applyAppSavePayload,
  buildAppSavePayload,
  buildDefaultAppSavePayload,
  validateAppSavePayload,
} from "./loadoutBuilderSave";
import {
  clearCurrentSavedLoadoutId,
  getCurrentSavedLoadoutId,
  persistLoadoutRuntime,
  setCurrentSavedLoadoutId,
} from "./loadoutRuntimeStore";
import {
  deleteStoreValue,
  LOADOUT_DB_SAVES_STORE,
  readAllStoreValues,
  readStoreValue,
  writeStoreValue,
} from "./loadoutDbCore";

export const LOADOUT_EXPORT_SCOPES = Object.freeze([
  {
    id: "full",
    label: "Whole Save",
    description: "Exports every loadout page together with the current notation preference.",
    sectionKeys: ["loadoutBuilder", "statsLoadout", "mapLoadout", "heroLoadout", "playerLoadout"],
  },
  {
    id: "mapLoadouts",
    label: "Map Loadouts Page",
    description: "Exports the map placements and map perk builder data.",
    sectionKeys: ["loadoutBuilder", "mapLoadout"],
  },
  {
    id: "heroLoadout",
    label: "Hero Loadout Page",
    description: "Exports the hero loadout page data only.",
    sectionKeys: ["heroLoadout"],
  },
  {
    id: "statsLoadout",
    label: "Upgrades Loadout Page",
    description: "Exports the upgrades loadout page data only.",
    sectionKeys: ["statsLoadout"],
  },
  {
    id: "playerLoadout",
    label: "Player Loadout Page",
    description: "Exports the player loadout page data only.",
    sectionKeys: ["playerLoadout"],
  },
]);

const LOADOUT_EXPORT_SCOPE_MAP = Object.freeze(
  Object.fromEntries(LOADOUT_EXPORT_SCOPES.map((scope) => [scope.id, scope]))
);

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

function normalizeRecord(record) {
  const payload = cloneValue(record?.payload ?? buildDefaultAppSavePayload());
  return {
    id: sanitizeString(record?.id, createId()),
    name: sanitizeString(record?.name, "Untitled Save"),
    description: sanitizeString(record?.description),
    createdAt: sanitizeString(record?.createdAt, new Date().toISOString()),
    updatedAt: sanitizeString(record?.updatedAt, new Date().toISOString()),
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
  };
}

function sortRecords(records) {
  return [...records].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt) || 0;
    const rightTime = Date.parse(right.updatedAt) || 0;
    return rightTime - leftTime;
  });
}

function getScopeDefinition(scopeId) {
  return LOADOUT_EXPORT_SCOPE_MAP[scopeId] ?? LOADOUT_EXPORT_SCOPE_MAP.full;
}

function buildEntryPayload(record, scopeId) {
  return {
    format: "ihtddata-loadout-entry",
    bundleVersion: BUNDLE_VERSION,
    scopeId: getScopeDefinition(scopeId).id,
    save: summarizeRecord(record),
    payload: cloneValue(record.payload),
  };
}

function mergePayloadForScope(basePayload, incomingPayload, scopeId) {
  const scope = getScopeDefinition(scopeId);
  const nextPayload = cloneValue(basePayload);

  scope.sectionKeys.forEach((sectionKey) => {
    nextPayload.sections[sectionKey] = cloneValue(incomingPayload.sections?.[sectionKey]);
  });

  return nextPayload;
}

function validateImportedEntry(entry, fileName) {
  if (entry?.format !== "ihtddata-loadout-entry") {
    throw new Error(`${fileName} is not a valid IHTDData save entry.`);
  }

  const validation = validateAppSavePayload(entry.payload);
  if (!validation.ok) {
    throw new Error(`${fileName}: ${validation.message}`);
  }

  return {
    importId: createId(),
    fileName,
    scopeId: getScopeDefinition(entry.scopeId).id,
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

export async function createSavedLoadout({ name, description = "", payload }) {
  const validation = validateAppSavePayload(payload);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const timestamp = new Date().toISOString();
  const record = await putRecord({
    id: createId(),
    name,
    description,
    createdAt: timestamp,
    updatedAt: timestamp,
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

  const record = await putRecord({
    ...existingRecord,
    name: updates.name ?? existingRecord.name,
    description: updates.description ?? existingRecord.description,
    payload: nextPayload,
    updatedAt: new Date().toISOString(),
  });

  return summarizeRecord(record);
}

export async function deleteSavedLoadout(saveId) {
  await deleteStoreValue(LOADOUT_DB_SAVES_STORE, saveId);
}

export async function saveWorkingLoadoutAsRecord({ name, description = "" }, storage = localStorage) {
  const payload = buildAppSavePayload(storage);
  const record = await createSavedLoadout({ name, description, payload });
  setCurrentSavedLoadoutId(record.id, storage);
  await persistLoadoutRuntime(storage);
  return record;
}

export async function saveWorkingLoadoutChanges(saveId, storage = localStorage) {
  const payload = buildAppSavePayload(storage);
  const record = await updateSavedLoadout(saveId, { payload });
  setCurrentSavedLoadoutId(record.id, storage);
  await persistLoadoutRuntime(storage);
  return record;
}

export async function loadSavedLoadoutIntoWorkingState(saveId, storage = localStorage) {
  const record = await getSavedLoadout(saveId);
  if (!record) {
    throw new Error("That save no longer exists.");
  }

  const result = applyAppSavePayload(record.payload, storage);
  if (!result.ok) {
    throw new Error(result.message);
  }

  setCurrentSavedLoadoutId(record.id, storage);
  await persistLoadoutRuntime(storage);
  return summarizeRecord(record);
}

export async function startFreshWorkingLoadout(storage = localStorage) {
  const result = applyAppSavePayload(buildDefaultAppSavePayload(storage), storage);
  if (!result.ok) {
    throw new Error(result.message);
  }

  clearCurrentSavedLoadoutId(storage);
  await persistLoadoutRuntime(storage);
  return true;
}

export async function exportSavedLoadoutsBundle({ saveIds, scopeId = "full" }) {
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

  const scope = getScopeDefinition(scopeId);
  const zip = new JSZip();
  const manifest = {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    appSaveVersion: APP_SAVE_VERSION,
    scopeId: scope.id,
    loadouts: records.map((record, index) => {
      const safeBaseName = sanitizeFileName(`${index + 1}-${record.name}`, `save-${index + 1}`);
      return {
        id: record.id,
        name: record.name,
        description: record.description,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        scopeId: scope.id,
        file: `saves/${safeBaseName}.json`,
      };
    }),
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  manifest.loadouts.forEach((item) => {
    const record = records.find((candidate) => candidate.id === item.id);
    if (record) {
      zip.file(item.file, JSON.stringify(buildEntryPayload(record, item.scopeId), null, 2));
    }
  });

  return {
    blob: await zip.generateAsync({ type: "blob" }),
    fileName: `ihtddata-loadouts-${scope.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`,
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
      scopeId: "full",
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

    if (scopeId === "full") {
      if (plan.mode === "new") {
        const record = await createSavedLoadout({
          name: plan.name,
          description: plan.description,
          payload: plan.payload,
        });
        created.push(record.id);
        continue;
      }

      if (plan.mode === "overwrite") {
        await updateSavedLoadout(plan.targetId, {
          name: plan.name,
          description: plan.description,
          payload: plan.payload,
        });
        updated.push(plan.targetId);
        continue;
      }
    }

    if (plan.mode === "overwrite-page") {
      for (const targetId of plan.targetIds ?? []) {
        const existingRecord = await getSavedLoadout(targetId);
        if (!existingRecord) {
          continue;
        }

        const mergedPayload = mergePayloadForScope(existingRecord.payload, plan.payload, scopeId);
        await updateSavedLoadout(targetId, { payload: mergedPayload });
        updated.push(targetId);
      }
    }
  }

  const uniqueUpdated = Array.from(new Set(updated));
  return {
    createdIds: Array.from(new Set(created)),
    updatedIds: uniqueUpdated,
    currentSavedLoadoutId: getCurrentSavedLoadoutId(localStorage),
  };
}

export function getLoadoutExportScope(scopeId) {
  return getScopeDefinition(scopeId);
}