// Device-local cache: which household PIN this device is linked to.
const KEY = 'hachlama_supabase_sync_v1';

export function loadSupabaseSyncConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSupabaseSyncConfig(config) {
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    // ignore - worst case, re-enter the PIN next time
  }
}

export function clearSupabaseSyncConfig() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
