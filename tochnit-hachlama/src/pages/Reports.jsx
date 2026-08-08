import { useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import HealthGauge from '../components/HealthGauge.jsx';
import {
  layer2Status,
  monthImpulsiveVsPlanned,
  healthScore,
  expenseCountedAmount,
  envelopeRemaining,
} from '../lib/projections.js';
import { money, todayISO, monthKey, addMonthsISO, humanMonthYear, pct } from '../lib/format.js';
import './Reports.css';

function startOfWeekISO(dateISO) {
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
function endOfWeekISO(dateISO) {
  const d = new Date(startOfWeekISO(dateISO) + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

function WeeklyReport() {
  const { state } = useData();
  const today = todayISO();
  const weekStart = startOfWeekISO(today);
  const weekEnd = endOfWeekISO(today);
  const mKey = monthKey(today);
  const status = layer2Status(state, mKey);

  const weekByEnvelope = {};
  for (const e of state.expenses) {
    if (e.categoryType !== 'envelope') continue;
    if (e.date < weekStart || e.date > weekEnd) continue;
    weekByEnvelope[e.categoryId] = (weekByEnvelope[e.categoryId] || 0) + expenseCountedAmount(e);
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <strong>יעד סילוק חוב חודשי</strong>
          <span className={`pill ${status.gap <= 0 ? 'green' : 'amber'}`}>
            {status.gap <= 0 ? '✅ בתוואי' : '⚠️ בפער'}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          שולם החודש: <b className="num">{money(status.paidToDebtThisMonth)}</b> מתוך יעד <b className="num">{money(status.target)}</b>
        </p>
      </div>

      <div className="section-title">💌 הוצאות השבוע לפי מעטפת</div>
      <div className="stack">
        {state.envelopes.map((env) => {
          const spentWeek = weekByEnvelope[env.id] || 0;
          const monthly = envelopeRemaining(state, env.id, mKey);
          return (
            <div className="card" key={env.id}>
              <div className="row-between">
                <div className="row"><span className="envelope-emoji">{env.emoji}</span><strong>{env.name}</strong></div>
                <span className="num">{money(spentWeek)} השבוע</span>
              </div>
              <div className="muted envelope-meta" style={{ marginTop: 6 }}>
                נשארו החודש: {money(monthly.remaining)} מתוך {money(monthly.budget)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyReport() {
  const { state } = useData();
  const today = todayISO();
  const mKey = monthKey(today);
  const prevKey = monthKey(addMonthsISO(today, -1));
  const current = monthImpulsiveVsPlanned(state, mKey);
  const prev = monthImpulsiveVsPlanned(state, prevKey);
  const score = healthScore(state, mKey);
  const impulsiveShare = pct(current.impulsive, current.total || 1);
  const overBudgetCount = state.envelopes.filter((e) => envelopeRemaining(state, e.id, mKey).pct >= 100).length;

  return (
    <div className="stack">
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <HealthGauge score={score} />
        <div>
          <div className="muted" style={{ fontSize: 13 }}>{humanMonthYear(today)}</div>
          <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4 }}>
            {score >= 8 ? 'חודש מצוין! 🎉' : score >= 5 ? 'חודש סביר, יש לאן להשתפר' : 'חודש מאתגר - זה בסדר, מחר יום חדש'}
          </div>
          {overBudgetCount > 0 && (
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{overBudgetCount} מעטפות חרגו החודש</div>
          )}
        </div>
      </div>

      <div className="section-title">🎲 אימפולסיבי מול מתוכנן</div>
      <div className="card">
        <div className="impulsive-bar-track">
          <div className="impulsive-bar-fill" style={{ width: `${impulsiveShare}%` }} />
        </div>
        <div className="row-between envelope-meta" style={{ marginTop: 8 }}>
          <span className="muted">🎲 אימפולסיבי: {money(current.impulsive)} ({Math.round(impulsiveShare)}%)</span>
          <span className="muted">✅ מתוכנן: {money(current.planned)}</span>
        </div>
        {current.unmarked > 0 && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
            {money(current.unmarked)} עדיין לא סומנו - סימון עוזר לזהות דפוסים.
          </p>
        )}
      </div>

      <div className="section-title">📊 השוואה לחודש קודם</div>
      <div className="card grid-2">
        <div>
          <div className="muted" style={{ fontSize: 12 }}>אימפולסיבי החודש</div>
          <div className="num" style={{ fontWeight: 800, fontSize: 18 }}>{money(current.impulsive)}</div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>אימפולסיבי חודש קודם</div>
          <div className="num" style={{ fontWeight: 800, fontSize: 18 }}>{money(prev.impulsive)}</div>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [tab, setTab] = useState('weekly');
  return (
    <div className="stack">
      <div className="segmented">
        <button type="button" className={tab === 'weekly' ? 'active' : ''} onClick={() => setTab('weekly')}>📅 שבועי</button>
        <button type="button" className={tab === 'monthly' ? 'active' : ''} onClick={() => setTab('monthly')}>🗓️ חודשי</button>
      </div>
      {tab === 'weekly' ? <WeeklyReport /> : <MonthlyReport />}
    </div>
  );
}
