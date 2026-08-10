import { useData } from '../context/DataContext.jsx';
import { allMilestoneDefs } from '../lib/milestones.js';
import { overallPercentPaid, totalCurrentDebt, totalOriginalDebt, projectedFreedomDateISO } from '../lib/projections.js';
import { monthMicroWinsCount } from '../lib/microWins.js';
import { money, humanDate, todayISO, monthKey, clamp } from '../lib/format.js';
import './Milestones.css';

export default function Milestones() {
  const { state, applyStreakShield } = useData();
  const achievedKeys = new Set(state.achievedMilestones.map((m) => m.key));
  const defs = allMilestoneDefs(state).filter((d) => !d.key.startsWith('layer2_met_'));
  const achieved = state.achievedMilestones
    .filter((m) => !m.key.startsWith('layer2_met_'))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const upcoming = defs.filter((d) => !achievedKeys.has(d.key));

  const pctPaid = overallPercentPaid(state);
  const freedomDate = projectedFreedomDateISO(state);
  const microWinsThisMonth = monthMicroWinsCount(state, monthKey(todayISO()));

  return (
    <div className="stack">
      <div className="card freedom-hero">
        <div className="freedom-hero-pct">{Math.round(pctPaid)}%</div>
        <div className="muted">מהחוב שולם</div>
        <div className="freedom-road-track" style={{ margin: '14px 0 6px' }}>
          <div className="freedom-road-fill" style={{ width: `${clamp(pctPaid, 3, 100)}%` }} />
          <div className="freedom-road-dot" style={{ insetInlineStart: `${clamp(pctPaid, 0, 96)}%` }}>🚗</div>
        </div>
        <div className="row-between envelope-meta">
          <span className="muted">{money(totalOriginalDebt(state) - totalCurrentDebt(state))} שולם</span>
          <span className="muted">{money(totalOriginalDebt(state))} סה"כ</span>
        </div>
        {freedomDate && <div className="freedom-date" style={{ textAlign: 'center', marginTop: 14 }}>🏁 יעד חופש: {humanDate(freedomDate)}</div>}
      </div>

      <div className="section-title">✨ ניצחונות קטנים</div>
      <div className="card row-between">
        <div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{microWinsThisMonth}</div>
          <div className="muted" style={{ fontSize: 13 }}>ניצחונות קטנים החודש - כל תיעוד, כל תשלום, כל יום שהמשכת</div>
        </div>
        <span style={{ fontSize: 32 }}>✨</span>
      </div>

      <div className="section-title">🔥 רצף נוכחי</div>
      <div className="card row-between">
        <div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{state.streak.count} <span style={{ fontSize: 16 }}>ימים</span></div>
          <div className="muted" style={{ fontSize: 13 }}>ימים ברצף שבהם עמדת בתקציב</div>
        </div>
        {state.streak.count > 0 && (
          state.streak.shieldAvailable ? (
            <button type="button" className="btn btn-secondary" onClick={() => applyStreakShield(todayISO())}>
              🛡️ השתמשי במגן
            </button>
          ) : (
            <span className="pill blue">🛡️ מגן ייפתח ברצף הבא</span>
          )
        )}
      </div>

      <div className="section-title">🏆 ארון ההישגים</div>
      {achieved.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center' }}>עדיין אין הישגים - כל צעד קטן נספר, תתחילי היום!</div>
      ) : (
        <div className="achievements-grid">
          {achieved.map((m) => (
            <div className="achievement-badge pop" key={m.key}>
              <div className="achievement-emoji">{m.emoji}</div>
              <div className="achievement-title">{m.title}</div>
              <div className="muted" style={{ fontSize: 11 }}>{humanDate(m.date)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">🎯 הישגים קרובים</div>
      <div className="stack">
        {upcoming.slice(0, 6).map((d) => (
          <div className="card upcoming-row" key={d.key}>
            <span className="achievement-emoji" style={{ opacity: 0.4 }}>{d.emoji}</span>
            <span className="muted">{d.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
