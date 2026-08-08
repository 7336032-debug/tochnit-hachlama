// Fully offline device-to-device transfer: encodes the whole app state as a
// copyable text code (no network call at all). The user shares that code
// however she likes (WhatsApp, email, AirDrop of a text snippet, Notes) and
// pastes it on the other device. No external service, nothing that can be
// "down" - this is the reliability fallback after a cloud backend failed.

function toBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeStateToCode(state) {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  return toBase64(bytes);
}

export function decodeCodeToState(code) {
  const cleaned = (code || '').trim().replace(/\s+/g, '');
  if (!cleaned) throw new Error('לא הודבק קוד');
  let bytes;
  try {
    bytes = fromBase64(cleaned);
  } catch {
    throw new Error('הקוד לא תקין - ודאי שהעתקת את כל הטקסט בלי לחתוך אותו');
  }
  try {
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch {
    throw new Error('הקוד לא תקין - ודאי שהעתקת את כל הטקסט בלי לחתוך אותו');
  }
}
