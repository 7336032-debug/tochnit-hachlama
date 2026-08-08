import StatRing from './StatRing.jsx';
import { useData } from '../context/DataContext.jsx';
import { healthScore, layer2Status, monthSavingsTotal } from '../lib/projections.js';
import { computeBusinessPace } from '../lib/dailyIncome.js';
import { todayISO, monthKey } from '../lib/format.js';
import './DashboardSnapshot.css';

function severityOf(ratio) {
  if (ratio >= 1) return 2;
  if (ratio >= 0.7) return 1;
  return 0;
}

const BANNER = {
  2: { emoji: '🟢', text: 'הכל בתוואי מצוין החודש!', cls: 'green' },
  1: { emoji: '🟡', text: 'בסדר בגדול, אבל יש כמה דברים לשים לב אליהם', cls: 'amber' },
  0: { emoji: '🔴', text: 'יש נקודות שכדאי לטפל בהן היום', cls: 'red' },
};

export default function DashboardSnapshot() {
  const { state } = useData();
  const mKey = monthKey(todayISO());
  const score = healthScore(state, mKey);
  const status = layer2Status(state, mKey);
  const pace = computeBusinessPace(state, todayISO());
  const savingsThisMonth = monthSavingsTotal(state, mKey);
  const savingsTarget = state.settings.savingsMonthlyTarget;

  const healthRatio = score / 10;
  const debtRatio = status.target > 0 ? status.paidToDebtThisMonth / status.target : 0;
  const businessRatio = pace.proratedTarget > 0 ? pace.totalSoFar / pace.proratedTarget : 0;
  const savingsRatio = savingsTarget > 0 ? savingsThisMonth / savingsTarget : savingsThisMonth > 0 ? 1 : 0;

  const overallSeverity = Math.min(severityOf(healthRatio), severityOf(debtRatio), severityOf(businessRatio));
  const banner = BANNER[overallSeverity];

  return (
    <div className="card snapshot-card">
      <div className={`snapshot-banner snapshot-banner-${banner.cls}`}>
        <span className="snapshot-banner-emoji" aria-hidden="true">{banner.emoji}</span>
        <span>{banner.text}</span>
      </div>
      <div className="snapshot-rings">
        <StatRing emoji="🏆" label="עמידה בתוכנית" ratio={healthRatio} displayValue={score} to="/reports" />
        <StatRing emoji="💳" label="קצב חוב" ratio={debtRatio} displayValue={`${Math.round(debtRatio * 100)}%`} to="/debts" />
        <StatRing emoji="💅" label="קצב עסק" ratio={businessRatio} displayValue={`${Math.round(businessRatio * 100)}%`} to="/income-journal" />
        <StatRing emoji="🐷" label="חיסכון" ratio={savingsRatio} displayValue={`${Math.round(savingsRatio * 100)}%`} to="/entry" />
      </div>
    </div>
  );
}
