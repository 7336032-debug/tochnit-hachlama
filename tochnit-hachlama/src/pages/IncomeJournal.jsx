import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import DailyIncomeForm from '../components/DailyIncomeForm.jsx';
import { entryForDate, dailyTotal, monthEntries } from '../lib/dailyIncome.js';
import { money, todayISO, humanMonthYear, HEBREW_DAYS } from '../lib/format.js';
import './IncomeJournal.css';

function monthKeyOf(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function buildGridCells(year, month) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const cells = [];
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return cells;
}

export default function IncomeJournal() {
  const { state } = useData();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);

  const mKey = monthKeyOf(year, month);
  const cells = useMemo(() => buildGridCells(year, month), [year, month]);
  const entries = monthEntries(state, mKey);
  const monthTotal = entries.reduce((sum, e) => sum + dailyTotal(e), 0);
  const workDays = entries.length;

  function shiftMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  }

  return (
    <div className="stack">
      <div className="card journal-header">
        <button type="button" className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="חודש קודם">➡️</button>
        <div className="journal-title">{humanMonthYear(`${mKey}-01`)}</div>
        <button type="button" className="icon-btn" onClick={() => shiftMonth(1)} aria-label="חודש הבא">⬅️</button>
      </div>

      <div className="card journal-summary">
        <div>
          <div className="muted" style={{ fontSize: 12 }}>סה״כ הכנסה מהעסק</div>
          <div className="num" style={{ fontWeight: 900, fontSize: 20 }}>{money(monthTotal)}</div>
        </div>
        <div style={{ textAlign: 'end' }}>
          <div className="muted" style={{ fontSize: 12 }}>ימי עבודה</div>
          <div className="num" style={{ fontWeight: 900, fontSize: 20 }}>{workDays}</div>
        </div>
      </div>

      <div className="card">
        <div className="journal-weekdays">
          {HEBREW_DAYS.map((d) => (
            <div key={d} className="journal-weekday">{d.slice(0, 2)}</div>
          ))}
        </div>
        <div className="journal-grid">
          {cells.map((date, idx) => {
            if (!date) return <div key={`b${idx}`} className="journal-cell journal-cell-blank" />;
            const entry = entryForDate(state, date);
            const dayNum = Number(date.slice(8, 10));
            const isFuture = date > todayISO();
            const isToday = date === todayISO();
            let cellClass = 'journal-cell';
            if (isFuture) cellClass += ' journal-cell-future';
            else if (!entry) cellClass += ' journal-cell-noWork';
            else if (dailyTotal(entry) === 0) cellClass += ' journal-cell-zero';
            else cellClass += ' journal-cell-worked';
            if (isToday) cellClass += ' journal-cell-today';
            return (
              <button
                type="button"
                key={date}
                className={cellClass}
                disabled={isFuture}
                onClick={() => setSelectedDate(date)}
              >
                <span className="journal-daynum">{dayNum}</span>
                {entry && <span className="journal-daytotal num">{Math.round(dailyTotal(entry)).toLocaleString('he-IL')}</span>}
              </button>
            );
          })}
        </div>
        <div className="journal-legend">
          <span><i className="legend-dot legend-worked" /> עבדה</span>
          <span><i className="legend-dot legend-zero" /> עבדה, 0 ₪</span>
          <span><i className="legend-dot legend-noWork" /> לא עבדה</span>
        </div>
      </div>

      {selectedDate && (
        <div className="journal-modal-overlay" onClick={() => setSelectedDate(null)}>
          <div className="journal-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <strong>עריכת יום {selectedDate.slice(8, 10)}/{selectedDate.slice(5, 7)}</strong>
              <button type="button" className="icon-btn" onClick={() => setSelectedDate(null)} aria-label="סגירה">✕</button>
            </div>
            <DailyIncomeForm date={selectedDate} allowDatePick={false} onSaved={() => setSelectedDate(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
