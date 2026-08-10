import { useMemo, useRef, useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import DailyIncomeForm from '../components/DailyIncomeForm.jsx';
import { entryForDate, dailyTotal, monthEntries } from '../lib/dailyIncome.js';
import { expensesForDate, expenseCategoryLabel, expenseCountedAmount } from '../lib/projections.js';
import { hebrewDateString, holidaysForDate, hasHoliday } from '../lib/hebrewCalendar.js';
import { money, todayISO, addDaysISO, humanMonthYear, humanDate, dayOfWeekIndex, HEBREW_DAYS } from '../lib/format.js';
import './IncomeJournal.css';

const SWIPE_THRESHOLD = 50;

// RTL layout: the "previous" control sits visually on the right (like the
// existing ➡️ חודש קודם / ⬅️ חודש הבא buttons below), so a finger swipe to
// the right (dx > 0) means "previous", mirroring that same convention.
function useSwipeNav(onPrev, onNext) {
  const startX = useRef(null);
  return {
    onTouchStart: (e) => { startX.current = e.touches[0].clientX; },
    onTouchEnd: (e) => {
      if (startX.current == null) return;
      const dx = e.changedTouches[0].clientX - startX.current;
      startX.current = null;
      if (dx > SWIPE_THRESHOLD) onPrev();
      else if (dx < -SWIPE_THRESHOLD) onNext();
    },
  };
}

function startOfWeekISO(dateISO) {
  return addDaysISO(dateISO, -dayOfWeekIndex(dateISO));
}

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

function DayDetail({ date }) {
  const { state } = useData();
  const expenses = expensesForDate(state, date);
  const holidays = holidaysForDate(date);
  const isFuture = date > todayISO();

  return (
    <div className="stack">
      <div className="day-detail-dates">
        <div className="day-detail-civil">{humanDate(date)} · {HEBREW_DAYS[dayOfWeekIndex(date)]}</div>
        <div className="muted day-detail-hebrew">{hebrewDateString(date)}</div>
      </div>

      {holidays.length > 0 && (
        <div className="day-holiday-banner">
          {holidays.map((h) => <span key={h.title}>🕎 {h.title}</span>)}
        </div>
      )}

      {isFuture ? (
        <p className="muted" style={{ textAlign: 'center', padding: 16 }}>תאריך עתידי - אין עדיין נתונים</p>
      ) : (
        <>
          <div className="section-title" style={{ margin: '2px 2px 6px' }}>💰 הכנסה</div>
          <DailyIncomeForm date={date} allowDatePick={false} />

          {expenses.length > 0 && (
            <>
              <div className="section-title" style={{ margin: '10px 2px 6px' }}>💸 הוצאות היום</div>
              <div className="stack">
                {expenses.map((e) => {
                  const cat = expenseCategoryLabel(state, e);
                  return (
                    <div className="card recent-row" key={e.id}>
                      <div className="row" style={{ minWidth: 0, flex: 1 }}>
                        <span className="category-emoji">{cat.emoji}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="recent-row-name">{cat.name}</div>
                          {e.note && <div className="muted" style={{ fontSize: 12 }}>{e.note}</div>}
                        </div>
                      </div>
                      <span className="num">{money(expenseCountedAmount(e))}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function DayView({ date, onNavigate }) {
  const swipe = useSwipeNav(() => onNavigate(addDaysISO(date, -1)), () => onNavigate(addDaysISO(date, 1)));
  return (
    <div {...swipe}>
      <div className="journal-header card">
        <button type="button" className="icon-btn" onClick={() => onNavigate(addDaysISO(date, -1))} aria-label="יום קודם">➡️</button>
        <button type="button" className="journal-title-btn" onClick={() => onNavigate(todayISO())}>
          {date === todayISO() ? 'היום' : humanDate(date)}
        </button>
        <button type="button" className="icon-btn" onClick={() => onNavigate(addDaysISO(date, 1))} aria-label="יום הבא">⬅️</button>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <DayDetail date={date} />
      </div>
    </div>
  );
}

function WeekView({ date, onNavigate, onOpenDay }) {
  const { state } = useData();
  const weekStart = startOfWeekISO(date);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart]);
  const swipe = useSwipeNav(() => onNavigate(addDaysISO(weekStart, -7)), () => onNavigate(addDaysISO(weekStart, 7)));
  const today = todayISO();

  return (
    <div {...swipe}>
      <div className="journal-header card">
        <button type="button" className="icon-btn" onClick={() => onNavigate(addDaysISO(weekStart, -7))} aria-label="שבוע קודם">➡️</button>
        <button type="button" className="journal-title-btn" onClick={() => onNavigate(todayISO())}>
          {humanDate(days[0])} - {humanDate(days[6])}
        </button>
        <button type="button" className="icon-btn" onClick={() => onNavigate(addDaysISO(weekStart, 7))} aria-label="שבוע הבא">⬅️</button>
      </div>
      <div className="card week-grid" style={{ marginTop: 12 }}>
        {days.map((d) => {
          const entry = entryForDate(state, d);
          const total = entry ? dailyTotal(entry) : null;
          const isFuture = d > today;
          const isToday = d === today;
          let cls = 'week-cell';
          if (isFuture) cls += ' week-cell-future';
          else if (!entry) cls += ' week-cell-noWork';
          else cls += ' week-cell-worked';
          if (isToday) cls += ' week-cell-today';
          return (
            <button type="button" key={d} className={cls} disabled={isFuture} onClick={() => onOpenDay(d)}>
              <span className="week-cell-dayname">{HEBREW_DAYS[dayOfWeekIndex(d)].slice(0, 2)}</span>
              <span className="week-cell-daynum">{Number(d.slice(8, 10))}</span>
              {hasHoliday(d) && <span className="week-cell-holiday-dot" aria-hidden="true">🕎</span>}
              {total != null && <span className="week-cell-total num">{Math.round(total).toLocaleString('he-IL')}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ date, onNavigate, onOpenDay }) {
  const { state } = useData();
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1;
  const mKey = monthKeyOf(year, month);
  const cells = useMemo(() => buildGridCells(year, month), [year, month]);
  const entries = monthEntries(state, mKey);
  const monthTotal = entries.reduce((sum, e) => sum + dailyTotal(e), 0);
  const workDays = entries.length;
  const today = todayISO();

  function shiftMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    onNavigate(`${y}-${String(m + 1).padStart(2, '0')}-01`);
  }

  const swipe = useSwipeNav(() => shiftMonth(-1), () => shiftMonth(1));

  return (
    <div {...swipe}>
      <div className="journal-header card">
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
          {cells.map((d, idx) => {
            if (!d) return <div key={`b${idx}`} className="journal-cell journal-cell-blank" />;
            const entry = entryForDate(state, d);
            const dayNum = Number(d.slice(8, 10));
            const isFuture = d > today;
            const isToday = d === today;
            let cellClass = 'journal-cell';
            if (isFuture) cellClass += ' journal-cell-future';
            else if (!entry) cellClass += ' journal-cell-noWork';
            else if (dailyTotal(entry) === 0) cellClass += ' journal-cell-zero';
            else cellClass += ' journal-cell-worked';
            if (isToday) cellClass += ' journal-cell-today';
            return (
              <button type="button" key={d} className={cellClass} disabled={isFuture} onClick={() => onOpenDay(d)}>
                {hasHoliday(d) && <span className="journal-cell-holiday-dot" aria-hidden="true">•</span>}
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
          <span>🕎 חג</span>
        </div>
      </div>
    </div>
  );
}

const VIEWS = [
  { id: 'day', label: '📆 יום' },
  { id: 'week', label: '📅 שבוע' },
  { id: 'month', label: '🗓️ חודש' },
];

export default function IncomeJournal() {
  const [view, setView] = useState('month');
  const [current, setCurrent] = useState(todayISO());
  const [modalDate, setModalDate] = useState(null);

  function openDay(d) {
    if (view === 'month' || view === 'week') setModalDate(d);
    else setCurrent(d);
  }

  return (
    <div className="stack">
      <div className="segmented">
        {VIEWS.map((v) => (
          <button type="button" key={v.id} className={view === v.id ? 'active' : ''} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      {view === 'day' && <DayView date={current} onNavigate={setCurrent} />}
      {view === 'week' && <WeekView date={current} onNavigate={setCurrent} onOpenDay={openDay} />}
      {view === 'month' && <MonthView date={current} onNavigate={setCurrent} onOpenDay={openDay} />}

      {modalDate && (
        <div className="journal-modal-overlay" onClick={() => setModalDate(null)}>
          <div className="journal-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <strong>עריכת יום</strong>
              <button type="button" className="icon-btn" onClick={() => setModalDate(null)} aria-label="סגירה">✕</button>
            </div>
            <DayDetail date={modalDate} />
          </div>
        </div>
      )}
    </div>
  );
}
