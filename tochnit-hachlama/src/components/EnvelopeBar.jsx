import { money, clamp } from '../lib/format.js';

function statusColor(pct) {
  if (pct >= 100) return { fill: 'var(--red)', pillClass: 'red', text: 'חרגת' };
  if (pct >= 80) return { fill: 'var(--amber)', pillClass: 'amber', text: 'מתקרבת לגבול' };
  return { fill: 'var(--green)', pillClass: 'green', text: 'בטוח' };
}

export default function EnvelopeBar({ envelope, spent, budget, remaining, pct, compact }) {
  const status = statusColor(pct);
  const widthPct = clamp(pct, 0, 100);

  if (envelope.needsSetup && budget === 0) {
    return (
      <div className="card envelope-card">
        <div className="row-between">
          <div className="row">
            <span className="envelope-emoji">{envelope.emoji}</span>
            <strong>{envelope.name}</strong>
          </div>
          <span className="pill amber">⚠️ יש להגדיר תקציב</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card envelope-card">
      <div className="row-between" style={{ marginBottom: 8 }}>
        <div className="row">
          <span className="envelope-emoji">{envelope.emoji}</span>
          <strong>{envelope.name}</strong>
        </div>
        {!compact && (
          <span className={`pill ${status.pillClass}`}>
            {pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : '✅'} {status.text}
          </span>
        )}
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${widthPct}%`, background: status.fill }} />
      </div>
      <div className="row-between envelope-meta">
        <span className="muted num">
          {remaining >= 0 ? `נשארו ${money(remaining)}` : `חרגת ב-${money(Math.abs(remaining))}`}
        </span>
        <span className="muted num">הוצאת {money(spent)} מתוך {money(budget)}</span>
      </div>
    </div>
  );
}
