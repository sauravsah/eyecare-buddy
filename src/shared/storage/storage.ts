import type { StorageKey, StorageSchema } from "../../domain/types";
import { DEFAULT_STORAGE } from "./defaults";

const FALLBACK_PREFIX = "eyecare-buddy:";
const memoryStorage = new Map<string, string>();

function extensionStorageAvailable(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

function fallbackGet(key: StorageKey): string | null {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem(`${FALLBACK_PREFIX}${key}`);
  }

  return memoryStorage.get(key) ?? null;
}

function fallbackSet(key: StorageKey, value: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(`${FALLBACK_PREFIX}${key}`, value);
    return;
  }

  memoryStorage.set(key, value);
}

function defaultFor<K extends StorageKey>(key: K): StorageSchema[K] {
  return structuredClone(DEFAULT_STORAGE[key]);
}

export async function getStorage<K extends StorageKey>(
  key: K
): Promise<StorageSchema[K]> {
  if (extensionStorageAvailable()) {
    const stored = await chrome.storage.local.get(key);
    const value = stored[key] as StorageSchema[K] | undefined;
    return value === undefined ? defaultFor(key) : value;
  }

  const rawValue = fallbackGet(key);
  if (!rawValue) {
    return defaultFor(key);
  }

  try {
    return JSON.parse(rawValue) as StorageSchema[K];
  } catch {
    return defaultFor(key);
  }
}

export async function setStorage<K extends StorageKey>(
  key: K,
  value: StorageSchema[K]
): Promise<void> {
  if (extensionStorageAvailable()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }

  fallbackSet(key, JSON.stringify(value));
}

export async function updateStorage<K extends StorageKey>(
  key: K,
  update: (current: StorageSchema[K]) => StorageSchema[K]
): Promise<StorageSchema[K]> {
  const current = await getStorage(key);
  const next = update(current);
  await setStorage(key, next);
  return next;
}
