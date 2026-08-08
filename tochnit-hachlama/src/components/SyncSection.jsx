import { useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import './SyncSection.css';

function ExportPanel() {
  const { exportStateCode } = useData();
  const [code, setCode] = useState(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    setCode(exportStateCode());
    setCopied(false);
  }

  function copy() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (!code) {
    return (
      <button type="button" className="btn btn-primary btn-block" onClick={generate}>
        📤 יצירת קוד עדכני לייצוא
      </button>
    );
  }

  return (
    <div className="stack">
      <p className="sync-hint">
        זה קוד ארוך שמכיל את כל הנתונים שלך. העתיקי אותו ושלחי לעצמך (וואטסאפ, מייל, AirDrop, Notes) -
        ואז במכשיר השני: הגדרות ← סנכרון ← "יבוא" ← הדביקי כאן.
      </p>
      <textarea className="sync-code-box" readOnly value={code} onFocus={(e) => e.target.select()} rows={6} />
      <button type="button" className="btn btn-primary btn-block" onClick={copy}>
        {copied ? '✓ הועתק' : '📋 העתקת הקוד'}
      </button>
      <button type="button" className="btn btn-secondary btn-block" onClick={generate}>
        🔄 יצירת קוד מעודכן
      </button>
    </div>
  );
}

function ImportPanel() {
  const { importStateCode } = useData();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  function handleLoad() {
    if (!code.trim()) return;
    setConfirming(true);
  }

  function confirmLoad() {
    try {
      importStateCode(code);
      setError(null);
      setConfirming(false);
      setCode('');
    } catch (err) {
      setError(err.message);
      setConfirming(false);
    }
  }

  return (
    <div className="stack">
      <p className="sync-hint">
        הדביקי כאן את הקוד שקיבלת מהמכשיר השני. <b>שימי לב:</b> זה יחליף את כל הנתונים במכשיר הזה בנתונים מהקוד.
      </p>
      <textarea
        className="sync-code-box"
        placeholder="הדביקי כאן את הקוד..."
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={6}
      />
      {error && <p className="sync-error">⚠️ {error}</p>}

      {!confirming ? (
        <button type="button" className="btn btn-primary btn-block" onClick={handleLoad} disabled={!code.trim()}>
          📥 טעינת הנתונים
        </button>
      ) : (
        <div className="sync-disconnect-confirm">
          <p>להחליף את כל הנתונים במכשיר הזה בנתונים מהקוד שהדבקת?</p>
          <div className="grid-2">
            <button type="button" className="btn btn-danger" onClick={confirmLoad}>כן, טעני</button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SyncSection() {
  const [mode, setMode] = useState('export');

  return (
    <div className="stack">
      <p className="sync-hint">
        גיבוי/העברה ידניים - שימושי גם כגיבוי נוסף וגם למי שמעדיפה לא להתחבר עם Google. מייצאים קוד במכשיר אחד
        ומייבאים אותו במכשיר השני. לא אוטומטי (צריך לחזור על זה כל פעם שרוצים לעדכן מכשיר אחר), אבל עובד תמיד
        בלי תלות באינטרנט או בשירות חיצוני.
      </p>
      <div className="segmented">
        <button type="button" className={mode === 'export' ? 'active' : ''} onClick={() => setMode('export')}>📤 ייצוא</button>
        <button type="button" className={mode === 'import' ? 'active' : ''} onClick={() => setMode('import')}>📥 יבוא</button>
      </div>
      {mode === 'export' ? <ExportPanel /> : <ImportPanel />}
    </div>
  );
}
