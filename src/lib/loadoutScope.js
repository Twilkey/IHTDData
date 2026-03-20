import { mapById } from "./gameData";
import {
  LOADOUT_BUILDER_PLACEMENTS_STORAGE_KEY,
  LOADOUT_BUILDER_RANKS_STORAGE_KEY,
  LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY,
  applyAppSavePayload,
  buildAppSavePayload,
  createComparableAppSavePayload,
} from "./loadoutBuilderSave";

export const LOADOUT_RECORD_SCOPE_FULL = "full";
export const LOADOUT_RECORD_SCOPE_MAP = "mapLoadoutMap";
export const LOADOUT_RECORD_SCOPE_HERO = "heroLoadoutPage";
export const LOADOUT_RECORD_SCOPE_STATS = "statsLoadoutPage";
export const LOADOUT_RECORD_SCOPE_PLAYER = "playerLoadoutPage";

export const LOADOUT_RECORD_SCOPES = Object.freeze([
  {
    id: LOADOUT_RECORD_SCOPE_FULL,
    label: "Whole Save",
    shortLabel: "Whole Save",
    description: "Includes every loadout page together with the working notation preference.",
  },
  {
    id: LOADOUT_RECORD_SCOPE_MAP,
    label: "Single Map Loadout",
    shortLabel: "Map",
    description: "Includes placements, map perks, and spell loadout data for one selected map.",
  },
  {
    id: LOADOUT_RECORD_SCOPE_HERO,
    label: "Hero Loadout Page",
    shortLabel: "Hero",
    description: "Includes the hero loadout page only.",
  },
  {
    id: LOADOUT_RECORD_SCOPE_STATS,
    label: "Upgrades Loadout Page",
    shortLabel: "Upgrades",
    description: "Includes the upgrades loadout page only.",
  },
  {
    id: LOADOUT_RECORD_SCOPE_PLAYER,
    label: "Player Loadout Page",
    shortLabel: "Player",
    description: "Includes the player loadout page only.",
  },
]);

const SCOPE_MAP = Object.freeze(
  Object.fromEntries(LOADOUT_RECORD_SCOPES.map((scope) => [scope.id, scope]))
);

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function getLoadoutRecordScope(scopeId) {
  return SCOPE_MAP[scopeId] ?? SCOPE_MAP[LOADOUT_RECORD_SCOPE_FULL];
}

export function normalizeLoadoutScopeContext(scopeId, scopeContext) {
  const normalizedScopeId = getLoadoutRecordScope(scopeId).id;

  if (normalizedScopeId !== LOADOUT_RECORD_SCOPE_MAP) {
    return null;
  }

  const mapId = String(scopeContext?.mapId ?? "").trim();
  const mapName = mapId ? ((mapById[mapId]?.name ?? String(scopeContext?.mapName ?? mapId).trim()) || mapId) : "";
  return { mapId, mapName };
}

export function getLoadoutScopeSelectionKey(scopeId, scopeContext) {
  const normalizedScopeId = getLoadoutRecordScope(scopeId).id;
  const normalizedScopeContext = normalizeLoadoutScopeContext(normalizedScopeId, scopeContext);

  if (normalizedScopeId === LOADOUT_RECORD_SCOPE_MAP) {
    return `${LOADOUT_RECORD_SCOPE_MAP}:${normalizedScopeContext?.mapId ?? ""}`;
  }

  return normalizedScopeId;
}

export function buildActiveLoadoutScope(activeKey, storage = localStorage) {
  switch (activeKey) {
    case "loadoutBuilder": {
      return {
        scopeId: LOADOUT_RECORD_SCOPE_MAP,
        scopeContext: normalizeLoadoutScopeContext(LOADOUT_RECORD_SCOPE_MAP, {
          mapId: storage.getItem(LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY) ?? "",
        }),
      };
    }
    case "heroLoadout":
      return { scopeId: LOADOUT_RECORD_SCOPE_HERO, scopeContext: null };
    case "statsLoadout":
      return { scopeId: LOADOUT_RECORD_SCOPE_STATS, scopeContext: null };
    case "playerLoadout":
      return { scopeId: LOADOUT_RECORD_SCOPE_PLAYER, scopeContext: null };
    default:
      return { scopeId: LOADOUT_RECORD_SCOPE_FULL, scopeContext: null };
  }
}

export function createComparableLoadoutScopePayload(payload, scopeId, scopeContext) {
  const normalizedScopeId = getLoadoutRecordScope(scopeId).id;
  const comparablePayload = createComparableAppSavePayload(payload);

  if (normalizedScopeId === LOADOUT_RECORD_SCOPE_FULL) {
    return comparablePayload;
  }

  if (normalizedScopeId === LOADOUT_RECORD_SCOPE_HERO) {
    return {
      scopeId: normalizedScopeId,
      sections: {
        heroLoadout: cloneValue(comparablePayload.sections.heroLoadout),
      },
    };
  }

  if (normalizedScopeId === LOADOUT_RECORD_SCOPE_STATS) {
    return {
      scopeId: normalizedScopeId,
      sections: {
        statsLoadout: cloneValue(comparablePayload.sections.statsLoadout),
      },
    };
  }

  if (normalizedScopeId === LOADOUT_RECORD_SCOPE_PLAYER) {
    return {
      scopeId: normalizedScopeId,
      sections: {
        playerLoadout: cloneValue(comparablePayload.sections.playerLoadout),
      },
    };
  }

  const normalizedScopeContext = normalizeLoadoutScopeContext(normalizedScopeId, scopeContext);
  const mapId = normalizedScopeContext?.mapId ?? "";

  return {
    scopeId: normalizedScopeId,
    scopeContext: cloneValue(normalizedScopeContext),
    sections: {
      loadoutBuilder: {
        selectedMapId: mapId,
        placementsByMap: {
          [mapId]: cloneValue(comparablePayload.sections.loadoutBuilder.placementsByMap?.[mapId] ?? {}),
        },
        placementRanksByMap: {
          [mapId]: cloneValue(comparablePayload.sections.loadoutBuilder.placementRanksByMap?.[mapId] ?? {}),
        },
      },
      mapLoadout: {
        perksByMap: {
          [mapId]: cloneValue(comparablePayload.sections.mapLoadout.perksByMap?.[mapId] ?? {}),
        },
        placementBonusLevelsByMap: {
          [mapId]: cloneValue(comparablePayload.sections.mapLoadout.placementBonusLevelsByMap?.[mapId] ?? {}),
        },
        placementBonusPlacementsByMap: {
          [mapId]: cloneValue(comparablePayload.sections.mapLoadout.placementBonusPlacementsByMap?.[mapId] ?? {}),
        },
        spellLoadoutsByMap: {
          [mapId]: cloneValue(comparablePayload.sections.mapLoadout.spellLoadoutsByMap?.[mapId] ?? {}),
        },
      },
    },
  };
}

export function buildComparableLoadoutScopePayload(storage = localStorage, scopeId, scopeContext) {
  return createComparableLoadoutScopePayload(buildAppSavePayload(storage), scopeId, scopeContext);
}

export function mergePayloadForLoadoutScope(basePayload, incomingPayload, scopeId, scopeContext) {
  const normalizedScopeId = getLoadoutRecordScope(scopeId).id;
  const nextPayload = cloneValue(basePayload);

  if (normalizedScopeId === LOADOUT_RECORD_SCOPE_FULL) {
    return cloneValue(incomingPayload);
  }

  if (normalizedScopeId === LOADOUT_RECORD_SCOPE_HERO) {
    nextPayload.sections.heroLoadout = cloneValue(incomingPayload.sections?.heroLoadout ?? {});
    return nextPayload;
  }

  if (normalizedScopeId === LOADOUT_RECORD_SCOPE_STATS) {
    nextPayload.sections.statsLoadout = cloneValue(incomingPayload.sections?.statsLoadout ?? {});
    return nextPayload;
  }

  if (normalizedScopeId === LOADOUT_RECORD_SCOPE_PLAYER) {
    nextPayload.sections.playerLoadout = cloneValue(incomingPayload.sections?.playerLoadout ?? {});
    return nextPayload;
  }

  const normalizedScopeContext = normalizeLoadoutScopeContext(normalizedScopeId, scopeContext);
  const mapId = normalizedScopeContext?.mapId ?? "";
  if (!mapId) {
    return nextPayload;
  }

  nextPayload.sections.loadoutBuilder.selectedMapId = mapId;
  nextPayload.sections.loadoutBuilder.placementsByMap = {
    ...nextPayload.sections.loadoutBuilder.placementsByMap,
    [mapId]: cloneValue(incomingPayload.sections?.loadoutBuilder?.placementsByMap?.[mapId] ?? {}),
  };
  nextPayload.sections.loadoutBuilder.placementRanksByMap = {
    ...nextPayload.sections.loadoutBuilder.placementRanksByMap,
    [mapId]: cloneValue(incomingPayload.sections?.loadoutBuilder?.placementRanksByMap?.[mapId] ?? {}),
  };

  nextPayload.sections.mapLoadout.perksByMap = {
    ...nextPayload.sections.mapLoadout.perksByMap,
    [mapId]: cloneValue(incomingPayload.sections?.mapLoadout?.perksByMap?.[mapId] ?? {}),
  };
  nextPayload.sections.mapLoadout.placementBonusLevelsByMap = {
    ...nextPayload.sections.mapLoadout.placementBonusLevelsByMap,
    [mapId]: cloneValue(incomingPayload.sections?.mapLoadout?.placementBonusLevelsByMap?.[mapId] ?? {}),
  };
  nextPayload.sections.mapLoadout.placementBonusPlacementsByMap = {
    ...nextPayload.sections.mapLoadout.placementBonusPlacementsByMap,
    [mapId]: cloneValue(incomingPayload.sections?.mapLoadout?.placementBonusPlacementsByMap?.[mapId] ?? {}),
  };
  nextPayload.sections.mapLoadout.spellLoadoutsByMap = {
    ...nextPayload.sections.mapLoadout.spellLoadoutsByMap,
    [mapId]: cloneValue(incomingPayload.sections?.mapLoadout?.spellLoadoutsByMap?.[mapId] ?? {}),
  };

  return nextPayload;
}

export function applyPayloadForLoadoutScope(payload, scopeId, scopeContext, storage = localStorage) {
  const normalizedScopeId = getLoadoutRecordScope(scopeId).id;

  if (normalizedScopeId === LOADOUT_RECORD_SCOPE_FULL) {
    return applyAppSavePayload(payload, storage);
  }

  const mergedPayload = mergePayloadForLoadoutScope(buildAppSavePayload(storage), payload, normalizedScopeId, scopeContext);
  return applyAppSavePayload(mergedPayload, storage);
}

export function getLoadoutScopeDisplayName(scopeId, scopeContext) {
  const scope = getLoadoutRecordScope(scopeId);
  const normalizedScopeContext = normalizeLoadoutScopeContext(scope.id, scopeContext);

  if (scope.id === LOADOUT_RECORD_SCOPE_MAP && normalizedScopeContext?.mapId) {
    return `${scope.label}: ${normalizedScopeContext.mapName}`;
  }

  return scope.label;
}

export function isLoadoutScopeContextValid(scopeId, scopeContext) {
  if (getLoadoutRecordScope(scopeId).id !== LOADOUT_RECORD_SCOPE_MAP) {
    return true;
  }

  return Boolean(normalizeLoadoutScopeContext(scopeId, scopeContext)?.mapId);
}

export function getLegacySelectedMapIdFromPayload(payload) {
  const loadoutBuilderSection = payload?.sections?.loadoutBuilder;
  if (!isObject(loadoutBuilderSection)) {
    return "";
  }

  if (typeof loadoutBuilderSection.selectedMapId === "string") {
    return loadoutBuilderSection.selectedMapId;
  }

  const mapIds = Object.keys(loadoutBuilderSection.placementsByMap ?? {});
  return mapIds[0] ?? "";
}

export {
  LOADOUT_BUILDER_PLACEMENTS_STORAGE_KEY,
  LOADOUT_BUILDER_RANKS_STORAGE_KEY,
  LOADOUT_BUILDER_SELECTED_MAP_STORAGE_KEY,
};