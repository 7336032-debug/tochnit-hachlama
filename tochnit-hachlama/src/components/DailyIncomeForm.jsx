import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import { entryForDate } from '../lib/dailyIncome.js';
import { money, todayISO } from '../lib/format.js';
import './DailyIncomeForm.css';

const FIELDS = [
  { key: 'cash', label: 'מזומן', emoji: '💵' },
  { key: 'bit', label: 'ביט', emoji: '📲' },
  { key: 'credit', label: 'אשראי', emoji: '💳' },
  { key: 'transfer', label: 'העברה בנקאית', emoji: '🏦' },
];

const EMPTY = { cash: '', bit: '', credit: '', transfer: '' };

export default function DailyIncomeForm({ date, onDateChange, onSaved, allowDatePick = true }) {
  const { state, upsertDailyIncome, deleteDailyIncome } = useData();
  const [values, setValues] = useState(EMPTY);
  const existing = entryForDate(state, date);

  useEffect(() => {
    const entry = entryForDate(state, date);
    setValues(
      entry
        ? { cash: String(entry.cash ?? ''), bit: String(entry.bit ?? ''), credit: String(entry.credit ?? ''), transfer: String(entry.transfer ?? '') }
        : EMPTY,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const total = FIELDS.reduce((sum, f) => sum + (Number(values[f.key]) || 0), 0);

  function submit(e) {
    e.preventDefault();
    upsertDailyIncome({ date, ...values });
    onSaved?.();
  }

  function clearDay() {
    deleteDailyIncome(date);
    setValues(EMPTY);
    onSaved?.();
  }

  return (
    <form className="stack" onSubmit={submit}>
      {allowDatePick && (
        <input
          type="date"
          className="date-input"
          value={date}
          onChange={(e) => onDateChange?.(e.target.value)}
          max={todayISO()}
        />
      )}

      <div className="daily-income-total">
        <span>סה״כ היום</span>
        <span className="num daily-income-total-val">{money(total)}</span>
      </div>

      <div className="daily-income-grid">
        {FIELDS.map((f) => (
          <label className="daily-income-field" key={f.key}>
            <span className="daily-income-field-label">{f.emoji} {f.label}</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>

      <button type="submit" className="btn btn-primary btn-lg btn-block">💾 שמירת הכנסה יומית</button>
      {existing && (
        <button type="button" className="btn btn-outline btn-block" onClick={clearDay}>
          🗑️ מחיקת הכנסת היום
        </button>
      )}
    </form>
  );
}
