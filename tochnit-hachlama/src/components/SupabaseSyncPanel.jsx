import { useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import { isSupabaseConfigured } from '../lib/supabaseSync.js';
import './SyncSection.css';

function formatTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export default function SupabaseSyncPanel() {
  const { supabaseConfig, supabaseStatus, createHousehold, connectSupabase, disconnectSupabase } = useData();
  const [joinPin, setJoinPin] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="card" style={{ background: 'var(--surface-alt)' }}>
        <p className="sync-hint" style={{ margin: 0 }}>
          🔧 סנכרון מיידי (Supabase) עדיין לא הוגדר במערכת.
        </p>
      </div>
    );
  }

  function copyPin() {
    navigator.clipboard?.writeText(supabaseConfig.pin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (!supabaseConfig) {
    return (
      <div className="stack">
        <p className="sync-hint">
          סנכרון מיידי בין המכשירים, בלי מסך התחברות - רק "קוד משפחה" משותף. במכשיר הראשון יוצרים קוד חדש,
          ובכל מכשיר נוסף מזינים את אותו קוד.
        </p>
        <button type="button" className="btn btn-primary btn-block" onClick={createHousehold} disabled={supabaseStatus.syncing}>
          {supabaseStatus.syncing ? 'יוצרת קוד...' : '✨ יצירת קוד משפחה חדש (מכשיר ראשון)'}
        </button>
        <div className="sync-hint" style={{ textAlign: 'center', margin: '4px 0' }}>או</div>
        <div className="grid-2">
          <input
            className="settings-text-input"
            placeholder="הזיני קוד קיים"
            value={joinPin}
            onChange={(e) => setJoinPin(e.target.value.toUpperCase())}
            maxLength={8}
            style={{ textAlign: 'center', fontWeight: 800, letterSpacing: '1px' }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => connectSupabase(joinPin)}
            disabled={supabaseStatus.syncing || !joinPin.trim()}
          >
            🔗 התחברות
          </button>
        </div>
        {supabaseStatus.error && <p className="sync-error">⚠️ {supabaseStatus.error}</p>}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="sync-status-row">
        <span className="pill green">✅ מחוברת - מסתנכרן אוטומטית</span>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {supabaseStatus.syncing ? 'מסנכרן...' : supabaseStatus.lastSyncAt ? `סונכרן לאחרונה ב-${formatTime(supabaseStatus.lastSyncAt)}` : 'טרם בוצע סנכרון'}
        </span>
      </div>
      <div className="sync-code-box" style={{ textAlign: 'center', fontWeight: 900, fontSize: 22, letterSpacing: '3px', padding: '14px 0' }}>
        {supabaseConfig.pin}
      </div>
      <p className="sync-hint" style={{ margin: 0 }}>
        זה קוד המשפחה שלכם - הזיני אותו בדיוק ככה בכל מכשיר נוסף כדי לחבר אותו. הסנכרון עצמו קורה לבד ברקע
        אחרי כל שינוי - אין צורך ללחוץ על שום כפתור.
      </p>
      <button type="button" className="btn btn-secondary btn-block" onClick={copyPin}>
        {copied ? '✓ הועתק' : '📋 העתקת הקוד'}
      </button>
      {supabaseStatus.error && (
        <p className="sync-error">⚠️ {supabaseStatus.error} - המערכת תנסה לסנכרן שוב לבד ברגע שהחיבור יחזור.</p>
      )}

      {!confirmingDisconnect ? (
        <button type="button" className="btn btn-outline btn-block" onClick={() => setConfirmingDisconnect(true)}>
          🔌 התנתקות במכשיר הזה
        </button>
      ) : (
        <div className="sync-disconnect-confirm">
          <p>להתנתק? הנתונים בענן לא יימחקו, אפשר להתחבר שוב עם אותו קוד.</p>
          <div className="grid-2">
            <button type="button" className="btn btn-danger" onClick={disconnectSupabase}>כן, התנתקי</button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmingDisconnect(false)}>ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}
