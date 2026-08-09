// Realtime cross-device sync via Supabase - a shared "household code" (PIN)
// identifies the family's row, no sign-in screen or popups. Requires a
// one-time Supabase project setup (see Settings for instructions).
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = '__PENDING_SUPABASE_URL__';
export const SUPABASE_ANON_KEY = '__PENDING_SUPABASE_ANON_KEY__';
export const SYNC_TABLE = 'sync_state';

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
  if (error.message?.includes('Failed to fetch')) return 'אין חיבור לאינטרנט - בדקי את הרשת ונסי שוב';
  return `שגיאת Supabase: ${error.message}`;
}

export async function fetchHouseholdState(pin) {
  const { data, error } = await getClient().from(SYNC_TABLE).select('data').eq('id', pin).maybeSingle();
  if (error) throw new Error(mapError(error));
  return data ? data.data : null;
}

export async function upsertHouseholdState(pin, stateData) {
  const { error } = await getClient()
    .from(SYNC_TABLE)
    .upsert({ id: pin, data: stateData, updated_at: new Date().toISOString() });
  if (error) throw new Error(mapError(error));
}

// Subscribes to realtime changes on this household's row. Returns an
// unsubscribe function. onChange receives the new full state object.
export function subscribeToHouseholdChanges(pin, onChange) {
  const channel = getClient()
    .channel(`sync_state_${pin}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: SYNC_TABLE, filter: `id=eq.${pin}` },
      (payload) => {
        if (payload.new && payload.new.data) onChange(payload.new.data);
      },
    )
    .subscribe();
  return () => getClient().removeChannel(channel);
}
