import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useData } from '../context/DataContext.jsx';
import {
  generateSchedule,
  debtBalanceHistory,
  totalOriginalDebt,
  totalCurrentDebt,
  perDebtProjectedCloseMonth,
} from '../lib/projections.js';
import { money, humanDate, addMonthsISO, monthsBetween, todayISO, shortMoney } from '../lib/format.js';
import './Debts.css';

function buildChartData(state) {
  const planned = generateSchedule(state, { fromCurrent: false });
  const forecast = generateSchedule(state, { fromCurrent: true });
  const history = debtBalanceHistory(state);
  const currentMonthIndex = Math.max(0, monthsBetween(state.settings.planStartDate, todayISO()));

  const byMonth = {};
  const ensure = (m) => {
    if (!byMonth[m]) byMonth[m] = { month: m };
    return byMonth[m];
  };

  ensure(0).planned = totalOriginalDebt(state);
  planned.schedule.forEach((row, idx) => {
    ensure(idx + 1).planned = row.total;
  });

  ensure(0).actual = totalOriginalDebt(state);
  history.forEach((row) => {
    ensure(row.month).actual = row.total;
  });
  ensure(currentMonthIndex).actual = totalCurrentDebt(state);

  ensure(currentMonthIndex).forecast = totalCurrentDebt(state);
  forecast.schedule.forEach((row, idx) => {
    ensure(currentMonthIndex + idx + 1).forecast = row.total;
  });

  return Object.values(byMonth).sort((a, b) => a.month - b.month);
}

export default function Debts() {
  const { state } = useData();
  const chartData = buildChartData(state);
  const totalOriginal = totalOriginalDebt(state);
  const totalCurrent = totalCurrentDebt(state);

  const sortedDebts = [...state.debts].sort((a, b) => a.priority - b.priority);

  return (
    <div className="stack">
      <div className="section-title">📉 תחזית סילוק החוב</div>
      <div className="card">
        <div className="row-between" style={{ marginBottom: 4 }}>
          <div>
            <div className="muted" style={{ fontSize: 13 }}>יתרה כוללת כרגע</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 900 }}>{money(totalCurrent)}</div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <div className="muted" style={{ fontSize: 13 }}>מתוך</div>
            <div className="num" style={{ fontSize: 16, fontWeight: 700 }}>{money(totalOriginal)}</div>
          </div>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="month"
                tickFormatter={(m) => `${m}`}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                label={{ value: 'חודש', position: 'insideBottomRight', offset: -4, fontSize: 11, fill: 'var(--text-muted)' }}
              />
              <YAxis
                tickFormatter={(v) => shortMoney(v)}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                width={64}
              />
              <Tooltip
                formatter={(value, name) => [money(value), name]}
                labelFormatter={(m) => `חודש ${m}`}
                contentStyle={{ direction: 'rtl', borderRadius: 10, fontSize: 13 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="planned" name="מסלול מקורי" stroke="var(--blue)" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="actual" name="בפועל" stroke="var(--green)" strokeWidth={3} dot={false} connectNulls />
              <Line type="monotone" dataKey="forecast" name="תחזית קדימה" stroke="var(--amber)" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="section-title">🎯 התקדמות לכל חוב</div>
      <div className="stack">
        {sortedDebts.map((debt) => {
          const paid = debt.openingBalance - debt.currentBalance;
          const pct = debt.openingBalance > 0 ? Math.min(100, Math.round((paid / debt.openingBalance) * 100)) : 0;
          const projectedClose = perDebtProjectedCloseMonth(state, debt.id);
          const originalTargetDate = addMonthsISO(state.settings.planStartDate, debt.targetMonth);
          return (
            <div className="card debt-card" key={debt.id}>
              <div className="row-between" style={{ marginBottom: 8 }}>
                <div className="row">
                  <span className="envelope-emoji">{debt.emoji}</span>
                  <strong>{debt.name}</strong>
                </div>
                {debt.closed ? (
                  <span className="pill green">✅ נסגר</span>
                ) : (
                  <span className="pill blue">{pct}% הושלם</span>
                )}
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${pct}%`, background: debt.closed ? 'var(--purple)' : 'var(--blue)' }}
                />
              </div>
              <div className="debt-grid">
                <div>
                  <div className="muted debt-grid-label">יתרת פתיחה</div>
                  <div className="num">{money(debt.openingBalance)}</div>
                </div>
                <div>
                  <div className="muted debt-grid-label">שולם עד כה</div>
                  <div className="num">{money(paid)}</div>
                </div>
                <div>
                  <div className="muted debt-grid-label">יתרה נוכחית</div>
                  <div className="num">{money(debt.currentBalance)}</div>
                </div>
              </div>
              <div className="debt-dates">
                <span className="muted">יעד מקורי: {humanDate(originalTargetDate)}</span>
                <span className="muted">
                  {debt.closed
                    ? `נסגר בפועל: ${humanDate(debt.closedDate)}`
                    : projectedClose
                    ? `צפי בקצב הנוכחי: ${humanDate(projectedClose)}`
                    : 'לא ניתן להעריך עדיין'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
