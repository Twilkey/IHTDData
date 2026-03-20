export const LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY = "ihtddata.loadoutBuilder.selectedMapId";
export const LOADOUT_BUILDER_PLACEMENTS_STORAGE_KEY = "ihtddata.loadoutBuilder.placements.v1";
export const LOADOUT_BUILDER_RANKS_STORAGE_KEY = "ihtddata.loadoutBuilder.ranks.v1";
export const APP_SAVE_VERSION = 9;

import { normalizeStatsLoadoutState, readStatsLoadoutState, writeStatsLoadoutState } from "./statsLoadout";
import { normalizeMapLoadoutState, readMapLoadoutState, writeMapLoadoutState } from "./mapLoadout";
import * as heroLoadoutModule from "./heroLoadout";
import { normalizePlayerLoadoutState, readPlayerLoadoutState, writePlayerLoadoutState } from "./playerLoadout";

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function readLoadoutBuilderState(storage = localStorage) {
  let placementsByMap = {};
  let placementRanksByMap = {};

  try {
    const parsedPlacements = JSON.parse(storage.getItem(LOADOUT_BUILDER_PLACEMENTS_STORAGE_KEY) ?? "{}");
    if (isObject(parsedPlacements)) {
      placementsByMap = parsedPlacements;
    }
  } catch {
    placementsByMap = {};
  }

  try {
    const parsedRanks = JSON.parse(storage.getItem(LOADOUT_BUILDER_RANKS_STORAGE_KEY) ?? "{}");
    if (isObject(parsedRanks)) {
      placementRanksByMap = parsedRanks;
    }
  } catch {
    placementRanksByMap = {};
  }

  return {
    selectedMapId: storage.getItem(LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY) ?? "",
    placementsByMap,
    placementRanksByMap,
  };
}

export function buildAppSavePayload(storage = localStorage) {
  return {
    version: APP_SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    preferences: {
      notation: storage.getItem("notation") ?? "scientific",
    },
    sections: {
      loadoutBuilder: readLoadoutBuilderState(storage),
      statsLoadout: readStatsLoadoutState(storage),
      mapLoadout: readMapLoadoutState(storage),
      heroLoadout: heroLoadoutModule.readHeroLoadoutState(storage),
      playerLoadout: readPlayerLoadoutState(storage),
    },
  };
}

export function buildDefaultAppSavePayload(storage = localStorage) {
  return {
    version: APP_SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    preferences: {
      notation: storage.getItem("notation") ?? "scientific",
    },
    sections: {
      loadoutBuilder: readLoadoutBuilderState({
        getItem(key) {
          return key === LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY ? "" : "{}";
        },
      }),
      statsLoadout: normalizeStatsLoadoutState({}),
      mapLoadout: normalizeMapLoadoutState({}),
      heroLoadout: heroLoadoutModule.normalizeHeroLoadoutState({}),
      playerLoadout: normalizePlayerLoadoutState({}),
    },
  };
}

export function createComparableAppSavePayload(payload) {
  return {
    version: payload?.version ?? APP_SAVE_VERSION,
    preferences: {
      notation: payload?.preferences?.notation ?? "scientific",
    },
    sections: {
      loadoutBuilder: readLoadoutBuilderState({
        getItem(key) {
          if (key === LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY) {
            return payload?.sections?.loadoutBuilder?.selectedMapId ?? "";
          }

          if (key === LOADOUT_BUILDER_PLACEMENTS_STORAGE_KEY) {
            return JSON.stringify(payload?.sections?.loadoutBuilder?.placementsByMap ?? {});
          }

          if (key === LOADOUT_BUILDER_RANKS_STORAGE_KEY) {
            return JSON.stringify(payload?.sections?.loadoutBuilder?.placementRanksByMap ?? {});
          }

          return null;
        },
      }),
      statsLoadout: normalizeStatsLoadoutState(payload?.sections?.statsLoadout ?? {}),
      mapLoadout: normalizeMapLoadoutState(payload?.sections?.mapLoadout ?? {}),
      heroLoadout: heroLoadoutModule.normalizeHeroLoadoutState(payload?.sections?.heroLoadout ?? {}),
      playerLoadout: normalizePlayerLoadoutState(payload?.sections?.playerLoadout ?? {}),
    },
  };
}

export function buildComparableAppSavePayload(storage = localStorage) {
  return createComparableAppSavePayload(buildAppSavePayload(storage));
}

export function validateAppSavePayload(payload) {
  if (!isObject(payload)) {
    return { ok: false, message: "Save file is not a JSON object." };
  }

  if (!isObject(payload.sections)) {
    return { ok: false, message: "Save file is missing sections data." };
  }

  if (payload.preferences !== undefined && !isObject(payload.preferences)) {
    return { ok: false, message: "Save file preferences must be an object when provided." };
  }

  if (payload.preferences?.notation !== undefined && !["scientific", "letters"].includes(payload.preferences.notation)) {
    return { ok: false, message: "Save file notation must be scientific or letters when provided." };
  }

  const loadoutBuilder = payload.sections.loadoutBuilder;
  if (!isObject(loadoutBuilder)) {
    return { ok: false, message: "Save file is missing loadout builder data." };
  }

  if (loadoutBuilder.selectedMapId != null && typeof loadoutBuilder.selectedMapId !== "string") {
    return { ok: false, message: "Loadout builder selectedMapId must be a string." };
  }

  if (!isObject(loadoutBuilder.placementsByMap)) {
    return { ok: false, message: "Loadout builder placements must be an object." };
  }

  if (loadoutBuilder.placementRanksByMap !== undefined && !isObject(loadoutBuilder.placementRanksByMap)) {
    return { ok: false, message: "Loadout builder placement ranks must be an object when provided." };
  }

  const statsLoadout = payload.sections.statsLoadout;
  if (statsLoadout !== undefined && !isObject(statsLoadout)) {
    return { ok: false, message: "Stats loadout data must be an object when provided." };
  }

  const mapLoadout = payload.sections.mapLoadout;
  if (mapLoadout !== undefined && !isObject(mapLoadout)) {
    return { ok: false, message: "Map loadout data must be an object when provided." };
  }

  const heroLoadout = payload.sections.heroLoadout;
  if (heroLoadout !== undefined && !isObject(heroLoadout)) {
    return { ok: false, message: "Hero loadout data must be an object when provided." };
  }

  const playerLoadout = payload.sections.playerLoadout;
  if (playerLoadout !== undefined && !isObject(playerLoadout)) {
    return { ok: false, message: "Player loadout data must be an object when provided." };
  }

  return { ok: true };
}

export function applyAppSavePayload(payload, storage = localStorage) {
  const validation = validateAppSavePayload(payload);
  if (!validation.ok) {
    return validation;
  }

  const notation = payload.preferences?.notation;
  if (notation === "scientific" || notation === "letters") {
    storage.setItem("notation", notation);
  }

  const loadoutBuilder = payload.sections.loadoutBuilder;
  storage.setItem(LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY, loadoutBuilder.selectedMapId ?? "");
  storage.setItem(LOADOUT_BUILDER_PLACEMENTS_STORAGE_KEY, JSON.stringify(loadoutBuilder.placementsByMap ?? {}));
  storage.setItem(LOADOUT_BUILDER_RANKS_STORAGE_KEY, JSON.stringify(loadoutBuilder.placementRanksByMap ?? {}));

  const statsLoadout = payload.sections.statsLoadout === undefined
    ? normalizeStatsLoadoutState({})
    : normalizeStatsLoadoutState(payload.sections.statsLoadout);
  writeStatsLoadoutState(statsLoadout, storage);

  const mapLoadout = payload.sections.mapLoadout === undefined
    ? normalizeMapLoadoutState({})
    : normalizeMapLoadoutState(payload.sections.mapLoadout);
  writeMapLoadoutState(mapLoadout, storage);

  const heroLoadout = payload.sections.heroLoadout === undefined
    ? heroLoadoutModule.normalizeHeroLoadoutState({})
    : heroLoadoutModule.normalizeHeroLoadoutState(payload.sections.heroLoadout);
  heroLoadoutModule.writeHeroLoadoutState(heroLoadout, storage);

  const playerLoadout = payload.sections.playerLoadout === undefined
    ? normalizePlayerLoadoutState({})
    : normalizePlayerLoadoutState(payload.sections.playerLoadout);
  writePlayerLoadoutState(playerLoadout, storage);

  return { ok: true };
}