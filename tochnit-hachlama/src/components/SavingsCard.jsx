import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import { monthSavingsTotal, totalSavingsBalance } from '../lib/projections.js';
import { money, todayISO, monthKey, clamp } from '../lib/format.js';

export default function SavingsCard() {
  const { state } = useData();
  const mKey = monthKey(todayISO());
  const thisMonth = monthSavingsTotal(state, mKey);
  const target = state.settings.savingsMonthlyTarget;
  const balance = totalSavingsBalance(state);
  const pct = target > 0 ? (thisMonth / target) * 100 : thisMonth > 0 ? 100 : 0;

  return (
    <Link to="/entry" className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <strong>🐷 חיסכון</strong>
        <span className="pill green">{Math.round(pct)}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${clamp(pct, 0, 100)}%`, background: 'var(--green)' }} />
      </div>
      <div className="row-between envelope-meta">
        <span className="muted num">נחסך החודש: {money(thisMonth)}</span>
        <span className="muted num">יעד: {money(target)}</span>
      </div>
      <div className="muted" style={{ marginTop: 10, fontSize: 13.5, fontWeight: 700 }}>
        💰 סה״כ בחיסכון: <span className="num">{money(balance)}</span>
      </div>
    </Link>
  );
}
