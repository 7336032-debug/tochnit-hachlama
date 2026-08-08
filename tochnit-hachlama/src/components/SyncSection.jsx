import { useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import './SyncSection.css';

function formatTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div className="sync-copy-row">
      <div>
        <div className="sync-copy-label">{label}</div>
        <div className="sync-copy-value num">{value}</div>
      </div>
      <button type="button" className="btn btn-secondary" onClick={copy}>
        {copied ? '✓ הועתק' : '📋 העתקה'}
      </button>
    </div>
  );
}

function JustCreatedPanel({ config, onDone }) {
  return (
    <div className="stack">
      <p className="sync-hint">
        הסנכרון הופעל! העתיקי את שני הפרטים האלה, ובמכשיר השני: הגדרות ← סנכרון בין מכשירים ← "יש לי כבר קוד" ← הדביקי כאן.
      </p>
      <CopyRow label="קוד סנכרון" value={config.id} />
      <CopyRow label="פין" value={config.pin} />
      <button type="button" className="btn btn-primary btn-block" onClick={onDone}>סיימתי, חזרה</button>
    </div>
  );
}

function SetupPanel({ onCreated }) {
  const { startCloudSync, syncStatus } = useData();

  async function handleStart() {
    const config = await startCloudSync();
    if (config) onCreated(config);
  }

  return (
    <div className="stack">
      <button type="button" className="btn btn-primary btn-block" onClick={handleStart} disabled={syncStatus.syncing}>
        {syncStatus.syncing ? 'יוצרת סנכרון...' : '✨ הפעלת סנכרון (המכשיר הראשון)'}
      </button>
      {syncStatus.error && <p className="sync-error">⚠️ {syncStatus.error}</p>}
    </div>
  );
}

function ConnectPanel({ onDone }) {
  const { connectCloudSync, syncStatus } = useData();
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');

  async function handleConnect(e) {
    e.preventDefault();
    const ok = await connectCloudSync(code.trim(), pin.trim());
    if (ok) onDone();
  }

  return (
    <form className="stack" onSubmit={handleConnect}>
      <input className="settings-text-input" placeholder="קוד סנכרון" value={code} onChange={(e) => setCode(e.target.value)} />
      <input className="settings-text-input" placeholder="פין (6 ספרות)" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" />
      <button type="submit" className="btn btn-primary btn-block" disabled={syncStatus.syncing || !code || !pin}>
        {syncStatus.syncing ? 'מתחברת...' : '🔗 התחברות'}
      </button>
      {syncStatus.error && <p className="sync-error">⚠️ {syncStatus.error}</p>}
    </form>
  );
}

function ConnectedPanel() {
  const { syncConfig, syncStatus, pushNow, pullNow, disconnectSync } = useData();
  const [showCode, setShowCode] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  return (
    <div className="stack">
      <div className="sync-status-row">
        <span className="pill green">☁️ הסנכרון פעיל</span>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {syncStatus.syncing ? 'מסנכרן...' : syncStatus.lastSyncAt ? `סונכרן לאחרונה ב-${formatTime(syncStatus.lastSyncAt)}` : 'טרם בוצע סנכרון'}
        </span>
      </div>
      {syncStatus.error && <p className="sync-error">⚠️ {syncStatus.error}</p>}

      <div className="grid-2">
        <button type="button" className="btn btn-secondary" onClick={pushNow} disabled={syncStatus.syncing}>📤 שמירה עכשיו</button>
        <button type="button" className="btn btn-secondary" onClick={pullNow} disabled={syncStatus.syncing}>📥 טעינה עכשיו</button>
      </div>

      <button type="button" className="btn btn-outline btn-block" onClick={() => setShowCode((v) => !v)}>
        {showCode ? 'הסתרת הקוד' : '➕ צימוד מכשיר נוסף'}
      </button>
      {showCode && (
        <div className="stack">
          <CopyRow label="קוד סנכרון" value={syncConfig.id} />
          <CopyRow label="פין" value={syncConfig.pin} />
        </div>
      )}

      {!confirmingDisconnect ? (
        <button type="button" className="btn btn-outline btn-block" onClick={() => setConfirmingDisconnect(true)}>
          🔌 ניתוק סנכרון במכשיר הזה
        </button>
      ) : (
        <div className="sync-disconnect-confirm">
          <p>לנתק רק את המכשיר הזה? הנתונים בענן לא יימחקו.</p>
          <div className="grid-2">
            <button type="button" className="btn btn-danger" onClick={disconnectSync}>כן, נתקי</button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmingDisconnect(false)}>ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SyncSection() {
  const { syncConfig } = useData();
  const [mode, setMode] = useState('choice'); // 'choice' | 'setup' | 'connect'
  const [justCreated, setJustCreated] = useState(null);

  // show the freshly-created pairing code before ever falling through to the
  // normal "connected" status view, even though syncConfig is already set
  if (justCreated) {
    return <JustCreatedPanel config={justCreated} onDone={() => setJustCreated(null)} />;
  }

  if (syncConfig) return <ConnectedPanel />;

  return (
    <div className="stack">
      <p className="sync-hint">
        סנכרון שומר את הנתונים שלך מוצפנים בענן כדי שיהיו זמינים גם באייפד, גם באייפון וגם במחשב - בלי צורך בהרשמה או חשבון.
      </p>
      {mode === 'choice' && (
        <div className="stack">
          <button type="button" className="btn btn-primary btn-block" onClick={() => setMode('setup')}>✨ הפעלת סנכרון (מכשיר ראשון)</button>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setMode('connect')}>🔗 יש לי כבר קוד ממכשיר אחר</button>
        </div>
      )}
      {mode === 'setup' && <SetupPanel onCreated={setJustCreated} />}
      {mode === 'connect' && <ConnectPanel onDone={() => setMode('choice')} />}
    </div>
  );
}
