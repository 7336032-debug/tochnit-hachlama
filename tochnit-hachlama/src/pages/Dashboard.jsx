import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import CoachCard from '../components/CoachCard.jsx';
import HealthGauge from '../components/HealthGauge.jsx';
import EnvelopeBar from '../components/EnvelopeBar.jsx';
import BusinessPaceCard from '../components/BusinessPaceCard.jsx';
import SavingsCard from '../components/SavingsCard.jsx';
import {
  layer2Status,
  healthScore,
  totalCurrentDebt,
  totalOriginalDebt,
  overallPercentPaid,
  projectedFreedomDateISO,
  envelopeRemaining,
  suggestedActionsForGap,
} from '../lib/projections.js';
import { money, monthKey, todayISO, humanDate, humanMonthYear, clamp } from '../lib/format.js';
import './Dashboard.css';

export default function Dashboard() {
  const { state } = useData();
  const mKey = monthKey(todayISO());
  const status = layer2Status(state, mKey);
  const score = healthScore(state, mKey);
  const totalDebt = totalCurrentDebt(state);
  const originalDebt = totalOriginalDebt(state);
  const pctPaid = overallPercentPaid(state);
  const freedomDate = projectedFreedomDateISO(state);
  const actions = status.gap > 0 ? suggestedActionsForGap(state, status.gap, mKey) : [];

  const paceRatio = status.target > 0 ? status.paidToDebtThisMonth / status.target : 0;
  const paceColor = paceRatio >= 1 ? 'green' : paceRatio >= 0.6 ? 'amber' : 'red';
  const paceColorVar = paceRatio >= 1 ? 'var(--green)' : paceRatio >= 0.6 ? 'var(--amber)' : 'var(--red)';

  return (
    <div className="stack">
      <CoachCard />

      <div className="card dashboard-top-row">
        <HealthGauge score={score} />
        <div className="dashboard-quick-stats">
          <div className="quick-stat">
            <span className="muted">💰 הכנסה החודש</span>
            <span className="num quick-stat-val">{money(status.income)}</span>
          </div>
          <div className="quick-stat">
            <span className="muted">🏠 הוצאות קבועות</span>
            <span className="num quick-stat-val">{money(status.layer1)}</span>
          </div>
          <div className="quick-stat">
            <span className="muted">{status.surplus >= 0 ? '✅ עודף החודש' : '🚨 גירעון החודש'}</span>
            <span className="num quick-stat-val" style={{ color: status.surplus >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {money(status.surplus)}
            </span>
          </div>
        </div>
      </div>

      <div className="section-title">📆 {humanMonthYear(todayISO())}</div>
      <div className="card">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <strong>⚡ מד קצב סילוק החוב</strong>
          <span className={`pill ${paceColor}`}>{Math.round(paceRatio * 100)}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${clamp(paceRatio * 100, 0, 100)}%`, background: paceColorVar }} />
        </div>
        <div className="row-between envelope-meta">
          <span className="muted num">שולם החודש: {money(status.paidToDebtThisMonth)}</span>
          <span className="muted num">יעד: {money(status.target)}</span>
        </div>
        {status.paidToDebtThisMonth >= status.target ? (
          <p className="pace-gap-note pace-gap-good">🎉 כבר העברת החודש את מלוא היעד לסילוק החוב - כל הכבוד!</p>
        ) : status.hasIncome && status.gap > 0 ? (
          <div className="pace-gap-note">
            <p>
              החודש יש לך עודף של <b className="num">{money(status.surplus)}</b>, היעד דורש{' '}
              <b className="num">{money(status.target)}</b> - חסר <b className="num">{money(status.gap)}</b>.
            </p>
            {actions.length > 0 && (
              <ul className="pace-actions">
                {actions.slice(0, 3).map((a) => (
                  <li key={a.id}>{a.text}</li>
                ))}
              </ul>
            )}
          </div>
        ) : status.hasIncome ? (
          <p className="pace-gap-note pace-gap-good">🎉 את בקצב טוב להשלים את היעד החודשי!</p>
        ) : (
          <p className="pace-gap-note muted">עוד לא הזנת הכנסה לחודש הזה - הזיני כדי לראות את הפער בזמן אמת.</p>
        )}
      </div>

      <BusinessPaceCard />

      <div className="section-title">🛣️ המרחק לחופש מחוב</div>
      <Link to="/debts" className="card freedom-card">
        <div className="freedom-numbers">
          <div>
            <div className="muted">יתרת חוב כוללת</div>
            <div className="num freedom-total">{money(totalDebt)}</div>
          </div>
          <div className="freedom-pct-badge">{Math.round(pctPaid)}%</div>
        </div>
        <div className="freedom-road">
          <div className="freedom-road-track">
            <div className="freedom-road-fill" style={{ width: `${clamp(pctPaid, 3, 100)}%` }} />
            <div className="freedom-road-dot" style={{ insetInlineStart: `${clamp(pctPaid, 0, 96)}%` }}>🚗</div>
          </div>
          <div className="row-between envelope-meta">
            <span className="muted">0 ₪</span>
            <span className="muted">{money(originalDebt)}</span>
          </div>
        </div>
        <div className="freedom-date">
          🏁 {freedomDate ? `תאריך יעד משוער: ${humanDate(freedomDate)}` : 'לא ניתן להעריך תאריך עדיין'}
        </div>
      </Link>

      <div className="section-title">💌 המעטפות שלך החודש</div>
      <div className="stack">
        {state.envelopes.map((env) => (
          <EnvelopeBar key={env.id} envelope={env} {...envelopeRemaining(state, env.id, mKey)} />
        ))}
      </div>

      <div className="section-title">🐷 חיסכון</div>
      <SavingsCard />
    </div>
  );
}
