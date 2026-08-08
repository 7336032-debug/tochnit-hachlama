import { useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import { isGoogleConfigured } from '../lib/googleSync.js';
import './SyncSection.css';

function formatTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export default function GoogleSyncPanel() {
  const { googleStatus, signInWithGoogle, signOutGoogle, googlePushNow, googlePullNow } = useData();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  if (!isGoogleConfigured()) {
    return (
      <div className="card" style={{ background: 'var(--surface-alt)' }}>
        <p className="sync-hint" style={{ margin: 0 }}>
          🔧 סנכרון אוטומטי עם Google עדיין לא הוגדר במערכת. עד אז אפשר להשתמש בייצוא/יבוא הידני למטה.
        </p>
      </div>
    );
  }

  if (!googleStatus.signedIn) {
    return (
      <div className="stack">
        <p className="sync-hint">
          מומלץ: התחברות עם חשבון Google שלך מסנכרנת את הנתונים אוטומטית בין כל המכשירים - בלי לחזור על שום פעולה.
          יש להתחבר עם <b>אותו חשבון Google</b> בכל מכשיר.
        </p>
        <button type="button" className="btn btn-primary btn-block" onClick={signInWithGoogle} disabled={googleStatus.syncing}>
          {googleStatus.syncing ? 'מתחברת...' : '🔵 התחברות עם Google'}
        </button>
        {googleStatus.error && <p className="sync-error">⚠️ {googleStatus.error}</p>}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="sync-status-row">
        <span className="pill green">✅ מחוברת ל-Google</span>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {googleStatus.syncing ? 'מסנכרן...' : googleStatus.lastSyncAt ? `סונכרן לאחרונה ב-${formatTime(googleStatus.lastSyncAt)}` : 'טרם בוצע סנכרון'}
        </span>
      </div>
      {googleStatus.error && <p className="sync-error">⚠️ {googleStatus.error}</p>}

      <div className="grid-2">
        <button type="button" className="btn btn-secondary" onClick={googlePushNow} disabled={googleStatus.syncing}>📤 שמירה עכשיו</button>
        <button type="button" className="btn btn-secondary" onClick={googlePullNow} disabled={googleStatus.syncing}>📥 טעינה עכשיו</button>
      </div>

      {!confirmingSignOut ? (
        <button type="button" className="btn btn-outline btn-block" onClick={() => setConfirmingSignOut(true)}>
          🔌 התנתקות מ-Google במכשיר הזה
        </button>
      ) : (
        <div className="sync-disconnect-confirm">
          <p>להתנתק? הנתונים ב-Google Drive לא יימחקו.</p>
          <div className="grid-2">
            <button type="button" className="btn btn-danger" onClick={signOutGoogle}>כן, התנתקי</button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmingSignOut(false)}>ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}
