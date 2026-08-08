// Automatic cross-device sync via the user's own Google account, using the
// hidden per-app "app data" folder in their Google Drive. Unlike the earlier
// anonymous key-value service, this rides on Google's own infrastructure -
// well-documented, battle-tested for direct browser access, and something
// the user already trusts with her data.
//
// Requires a one-time OAuth Client ID created by the user in Google Cloud
// Console (see Settings for instructions). Until GOOGLE_CLIENT_ID is set to
// a real value, the sign-in UI stays disabled with an explanatory message.

export const GOOGLE_CLIENT_ID = '__PENDING_GOOGLE_CLIENT_ID__';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const SYNC_FILE_NAME = 'hachlama-sync-v1.json';

export function isGoogleConfigured() {
  return typeof GOOGLE_CLIENT_ID === 'string' && GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com');
}

let tokenClient = null;
let cachedToken = null; // { access_token, expiresAt }

function ensureScriptLoaded() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.getElementById('gis-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('טעינת שירות Google נכשלה')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('טעינת שירות Google נכשלה - בדקי את החיבור לאינטרנט'));
    document.head.appendChild(script);
  });
}

async function getTokenClient() {
  await ensureScriptLoaded();
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: () => {}, // overridden per-request below
    });
  }
  return tokenClient;
}

// Requests a fresh access token via an interactive Google popup (or silent
// refresh if the browser still has an active Google session).
export async function requestAccessToken({ silent = false } = {}) {
  const client = await getTokenClient();
  return new Promise((resolve, reject) => {
    client.callback = (resp) => {
      if (resp.error) {
        reject(new Error(resp.error === 'access_denied' ? 'ההתחברות בוטלה' : `שגיאת התחברות: ${resp.error}`));
        return;
      }
      cachedToken = { access_token: resp.access_token, expiresAt: Date.now() + (resp.expires_in - 60) * 1000 };
      resolve(cachedToken.access_token);
    };
    client.error_callback = (err) => reject(new Error(err?.message || 'ההתחברות נכשלה'));
    client.requestAccessToken({ prompt: silent ? '' : 'consent' });
  });
}

export async function getValidAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.access_token;
  return requestAccessToken({ silent: true });
}

export function clearCachedToken() {
  cachedToken = null;
}

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

async function driveFetch(url, options, accessToken) {
  const res = await fetch(url, {
    ...options,
    headers: { ...(options?.headers || {}), Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('התחברות ל-Google פגה - יש להתחבר שוב');
    throw new Error(`שגיאת Google Drive (${res.status})`);
  }
  return res;
}

export async function findOrCreateSyncFileId(accessToken) {
  const query = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${SYNC_FILE_NAME}'`,
    fields: 'files(id,name)',
  });
  const listRes = await driveFetch(`${DRIVE_FILES_URL}?${query}`, { method: 'GET' }, accessToken);
  const listData = await listRes.json();
  if (listData.files?.length > 0) return listData.files[0].id;

  const createRes = await driveFetch(
    DRIVE_FILES_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: SYNC_FILE_NAME, parents: ['appDataFolder'] }),
    },
    accessToken,
  );
  const created = await createRes.json();
  return created.id;
}

export async function readSyncFile(accessToken, fileId) {
  const res = await driveFetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, { method: 'GET' }, accessToken);
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

export async function writeSyncFile(accessToken, fileId, content) {
  await driveFetch(
    `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) },
    accessToken,
  );
}
