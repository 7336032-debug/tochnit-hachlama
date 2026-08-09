// Cross-device sync via Supabase - a shared "household code" (PIN)
// identifies the family's row, no sign-in screen or popups. Requires a
// one-time Supabase project setup (see Settings for instructions).
//
// The app never talks to the sync_state table directly - only through
// SECURITY DEFINER functions gated by the PIN (see
// supabase/migrations/001_secure_sync_state.sql). Realtime postgres_changes
// subscriptions require open SELECT access via RLS, which is exactly what
// those functions exist to avoid - so updates are delivered by fast polling
// instead of a websocket push (see SUPABASE_POLL_INTERVAL_MS in DataContext).
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://zmosgennriwcdkvgafqt.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptb3NnZW5ucml3Y2RrdmdhZnF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQxMTAsImV4cCI6MjEwMTY5MDExMH0.FYDnYBUQHUBil1b6hy9e-DfRnr6ITKhvQKp7IRg-z1M';

export function isSupabaseConfigured() {
  return (
    typeof SUPABASE_URL === 'string' && SUPABASE_URL.startsWith('https://') && SUPABASE_URL.includes('.supabase.co') &&
    typeof SUPABASE_ANON_KEY === 'string' && SUPABASE_ANON_KEY.length > 20
  );
}

// avoid ambiguous characters (0/O, 1/I/l) so a hand-copied code is unambiguous
const PIN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePin() {
  let code = '';
  for (let i = 0; i < 8; i += 1) code += PIN_CHARS[Math.floor(Math.random() * PIN_CHARS.length)];
  return code;
}

let client = null;
function getClient() {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

function mapError(error) {
  if (!error) return 'שגיאה לא ידועה';
  if (error.message?.includes('קוד לא תקין')) return 'קוד משפחה שגוי';
  if (error.message?.includes('Failed to fetch')) return 'אין חיבור לאינטרנט - בדקי את הרשת ונסי שוב';
  return `שגיאת Supabase: ${error.message}`;
}

// Atomic connect-or-create: if no household exists yet for this pin, it's
// created seeded with initialData; if one already exists, initialData is
// ignored and the existing data is returned - so the same call safely
// covers both "first device" and "joining device" without a race between
// separate fetch + create calls.
export async function connectOrCreateHousehold(pin, initialData) {
  const { data, error } = await getClient().rpc('household_connect', { p_pin: pin, p_initial_data: initialData ?? {} });
  if (error) throw new Error(mapError(error));
  return data;
}

export async function fetchHouseholdState(pin) {
  const { data, error } = await getClient().rpc('household_fetch', { p_pin: pin });
  if (error) throw new Error(mapError(error));
  return data;
}

export async function upsertHouseholdState(pin, stateData) {
  const { error } = await getClient().rpc('household_upsert', { p_pin: pin, p_data: stateData });
  if (error) throw new Error(mapError(error));
}
