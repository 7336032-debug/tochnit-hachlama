// Device-local pairing info (blob id + PIN). Deliberately kept out of the
// main app state - it must never be part of what gets encrypted and pushed
// to the cloud blob, and each device is free to remember its own copy.
const KEY = 'hachlama_sync_config_v1';

export function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSyncConfig(config) {
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    // ignore - sync will just require re-pairing this device
  }
}

export function clearSyncConfig() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
