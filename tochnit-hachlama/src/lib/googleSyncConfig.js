// Device-local cache: the Drive file id (not secret, just saves a lookup)
// and a flag remembering this device previously signed in, so we know to
// attempt a silent (popup-free) token refresh on the next app load.
const KEY = 'hachlama_google_sync_v1';

export function loadGoogleSyncConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGoogleSyncConfig(config) {
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    // ignore - sync will just re-resolve the file id next time
  }
}

export function clearGoogleSyncConfig() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
