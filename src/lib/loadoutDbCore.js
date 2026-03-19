const LOADOUT_DB_NAME = "ihtddataLoadouts";
const LOADOUT_DB_VERSION = 1;

export const LOADOUT_DB_RUNTIME_STORE = "runtime";
export const LOADOUT_DB_SAVES_STORE = "savedLoadouts";

let openRequestPromise = null;

function createDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(LOADOUT_DB_NAME, LOADOUT_DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(LOADOUT_DB_RUNTIME_STORE)) {
        database.createObjectStore(LOADOUT_DB_RUNTIME_STORE);
      }

      if (!database.objectStoreNames.contains(LOADOUT_DB_SAVES_STORE)) {
        database.createObjectStore(LOADOUT_DB_SAVES_STORE, { keyPath: "id" });
      }
    });

    request.addEventListener("success", () => {
      const database = request.result;
      database.addEventListener("versionchange", () => database.close());
      resolve(database);
    });

    request.addEventListener("error", () => {
      reject(request.error ?? new Error("Unable to open the loadout database."));
    });
  });
}

export function openLoadoutDatabase() {
  if (!openRequestPromise) {
    openRequestPromise = createDatabase().catch((error) => {
      openRequestPromise = null;
      throw error;
    });
  }

  return openRequestPromise;
}

export async function readStoreValue(storeName, key) {
  const database = await openLoadoutDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error ?? new Error(`Unable to read ${String(key)} from ${storeName}.`)));
  });
}

export async function writeStoreValue(storeName, value, key) {
  const database = await openLoadoutDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = key === undefined ? store.put(value) : store.put(value, key);

    transaction.addEventListener("complete", () => resolve(request.result));
    transaction.addEventListener("error", () => reject(transaction.error ?? request.error ?? new Error(`Unable to write to ${storeName}.`)));
    transaction.addEventListener("abort", () => reject(transaction.error ?? request.error ?? new Error(`Unable to write to ${storeName}.`)));
  });
}

export async function deleteStoreValue(storeName, key) {
  const database = await openLoadoutDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    store.delete(key);

    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error(`Unable to delete ${String(key)} from ${storeName}.`)));
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error(`Unable to delete ${String(key)} from ${storeName}.`)));
  });
}

export async function readAllStoreValues(storeName) {
  const database = await openLoadoutDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.addEventListener("success", () => resolve(request.result ?? []));
    request.addEventListener("error", () => reject(request.error ?? new Error(`Unable to read values from ${storeName}.`)));
  });
}

export function supportsLoadoutDatabase() {
  return typeof indexedDB !== "undefined";
}