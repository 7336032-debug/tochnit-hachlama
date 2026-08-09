import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import SwipeRow from '../components/SwipeRow.jsx';
import Toast from '../components/Toast.jsx';
import DailyIncomeForm from '../components/DailyIncomeForm.jsx';
import { money, todayISO, humanDateShort } from '../lib/format.js';
import { expenseCountedAmount, totalSavingsBalance, activeEnvelopes } from '../lib/projections.js';
import './Entry.css';

const QUICK_AMOUNTS = [20, 50, 100, 200, 350, 500];
const SAVINGS_QUICK_AMOUNTS = [100, 200, 300, 500, 1000, 2000];
const INCOME_SOURCES = [
  { id: 'business', label: 'עסק', emoji: '💅' },
  { id: 'rental', label: 'שכירות', emoji: '🏠' },
  { id: 'other', label: 'אחר', emoji: '✨' },
];

function useSuccessToast() {
  const [show, setShow] = useState(false);
  function trigger() {
    if (navigator.vibrate) navigator.vibrate(40);
    setShow(true);
    setTimeout(() => setShow(false), 1100);
  }
  return [show, trigger];
}

function ExpenseForm({ onSaved }) {
  const { state, addExpense } = useData();
  const [date, setDate] = useState(todayISO());
  const [useFixed, setUseFixed] = useState(false);
  const list = useFixed ? state.fixedCosts : activeEnvelopes(state);
  const [categoryId, setCategoryId] = useState(list[0]?.id);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isImpulsive, setIsImpulsive] = useState(null);
  const [isShared, setIsShared] = useState(false);

  function pickList(nextUseFixed) {
    setUseFixed(nextUseFixed);
    const nextList = nextUseFixed ? state.fixedCosts : activeEnvelopes(state);
    setCategoryId(nextList[0]?.id);
  }

  function submit(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0 || !categoryId) return;
    addExpense({
      date, categoryType: useFixed ? 'fixed' : 'envelope', categoryId,
      amount: amt, note, isImpulsive, isShared,
    });
    setAmount('');
    setNote('');
    setIsImpulsive(null);
    setIsShared(false);
    onSaved();
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="segmented">
        <button type="button" className={!useFixed ? 'active' : ''} onClick={() => pickList(false)}>💌 הוצאה משתנה</button>
        <button type="button" className={useFixed ? 'active' : ''} onClick={() => pickList(true)}>🏠 הוצאה קבועה</button>
      </div>

      <div className="category-grid">
        {list.map((c) => (
          <button
            type="button"
            key={c.id}
            className={`category-chip${categoryId === c.id ? ' active' : ''}`}
            onClick={() => setCategoryId(c.id)}
          >
            <span className="category-emoji">{c.emoji}</span>
            <span>{c.name}</span>
          </button>
        ))}
      </div>

      <label className="field-label" htmlFor="amount-input">סכום</label>
      <input
        id="amount-input"
        className="amount-input"
        type="number"
        inputMode="decimal"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <div className="quick-amounts">
        {QUICK_AMOUNTS.map((v) => (
          <button type="button" key={v} className="quick-amount-btn" onClick={() => setAmount(String(v))}>
            {v} ₪
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 8 }}>
        <input type="date" className="date-input" value={date} onChange={(e) => setDate(e.target.value)} max={todayISO()} />
        <label className="shared-toggle">
          <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
          משותפת 50/50
        </label>
      </div>
      {isShared && amount && (
        <div className="shared-note muted">החלק שלך: {money(Number(amount) / 2)}</div>
      )}

      <div className="segmented">
        <button
          type="button"
          className={isImpulsive === false ? 'active planned' : ''}
          onClick={() => setIsImpulsive(isImpulsive === false ? null : false)}
        >
          ✅ מתוכנן
        </button>
        <button
          type="button"
          className={isImpulsive === true ? 'active impulsive' : ''}
          onClick={() => setIsImpulsive(isImpulsive === true ? null : true)}
        >
          🎲 אימפולסיבי
        </button>
      </div>

      <input
        className="note-input"
        placeholder="הערה (רשות)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <button type="submit" className="btn btn-primary btn-lg btn-block">💾 שמירת הוצאה</button>
    </form>
  );
}

function IncomeForm({ onSaved }) {
  const { addIncome } = useData();
  const [date, setDate] = useState(todayISO());
  const [source, setSource] = useState('business');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  function submit(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    addIncome({ date, source, amount: amt, note });
    setAmount('');
    setNote('');
    onSaved();
  }

  return (
    <div className="stack">
      <div className="category-grid">
        {INCOME_SOURCES.map((s) => (
          <button
            type="button"
            key={s.id}
            className={`category-chip${source === s.id ? ' active' : ''}`}
            onClick={() => setSource(s.id)}
          >
            <span className="category-emoji">{s.emoji}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {source === 'business' ? (
        <>
          <DailyIncomeForm date={date} onDateChange={setDate} onSaved={onSaved} />
          <Link to="/income-journal" className="btn btn-secondary btn-block">📅 צפייה ביומן ההכנסות המלא</Link>
        </>
      ) : (
        <form className="stack" onSubmit={submit}>
          <label className="field-label" htmlFor="income-amount">סכום</label>
          <input
            id="income-amount"
            className="amount-input"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <input type="date" className="date-input" value={date} onChange={(e) => setDate(e.target.value)} max={todayISO()} />
          <input className="note-input" placeholder="הערה (רשות)" value={note} onChange={(e) => setNote(e.target.value)} />

          <button type="submit" className="btn btn-primary btn-lg btn-block">💰 שמירת הכנסה</button>
        </form>
      )}
    </div>
  );
}

function DebtPaymentForm({ onSaved }) {
  const { state, addDebtPayment } = useData();
  const openDebts = state.debts.filter((d) => !d.closed);
  const [debtId, setDebtId] = useState(openDebts[0]?.id);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');

  const selectedDebt = state.debts.find((d) => d.id === debtId);

  function submit(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0 || !debtId) return;
    addDebtPayment({ date, debtId, amount: amt });
    setAmount('');
    onSaved();
  }

  if (openDebts.length === 0) {
    return <p className="muted" style={{ padding: 20, textAlign: 'center' }}>🎉 כל החובות נסגרו!</p>;
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="category-grid">
        {openDebts.map((d) => (
          <button
            type="button"
            key={d.id}
            className={`category-chip${debtId === d.id ? ' active' : ''}`}
            onClick={() => setDebtId(d.id)}
          >
            <span className="category-emoji">{d.emoji}</span>
            <span>{d.name}</span>
            <span className="muted num" style={{ fontSize: 11 }}>{money(d.currentBalance)}</span>
          </button>
        ))}
      </div>

      <label className="field-label" htmlFor="payment-amount">סכום התשלום</label>
      <input
        id="payment-amount"
        className="amount-input"
        type="number"
        inputMode="decimal"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {selectedDebt?.minMonthlyPayment > 0 && (
        <div className="quick-amounts">
          <button type="button" className="quick-amount-btn" onClick={() => setAmount(String(selectedDebt.minMonthlyPayment))}>
            מינימום: {selectedDebt.minMonthlyPayment} ₪
          </button>
          {selectedDebt.currentBalance > 0 && (
            <button type="button" className="quick-amount-btn" onClick={() => setAmount(String(selectedDebt.currentBalance))}>
              סגירה מלאה: {Math.round(selectedDebt.currentBalance)} ₪
            </button>
          )}
        </div>
      )}

      <input type="date" className="date-input" value={date} onChange={(e) => setDate(e.target.value)} max={todayISO()} />

      <button type="submit" className="btn btn-primary btn-lg btn-block">💳 שמירת תשלום</button>
    </form>
  );
}

function SavingsForm({ onSaved }) {
  const { state, addSavingsEntry } = useData();
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const balance = totalSavingsBalance(state);

  function submit(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    addSavingsEntry({ date, amount: amt, note });
    setAmount('');
    setNote('');
    onSaved();
  }

  return (
    <form className="stack" onSubmit={submit}>
      <p className="sync-hint">
        יש לך כבר <b className="num">{money(balance)}</b> בחיסכון. אפשר לרשום כאן גם כסף עודף שנכנס החודש
        וגם החלטה להעביר פחות להחזר ההלוואה ולשים את ההפרש כאן - בשני המקרים פשוט רשמי את הסכום ששמת בצד.
      </p>

      <label className="field-label" htmlFor="savings-amount">סכום לחיסכון</label>
      <input
        id="savings-amount"
        className="amount-input"
        type="number"
        inputMode="decimal"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <div className="quick-amounts">
        {SAVINGS_QUICK_AMOUNTS.map((v) => (
          <button type="button" key={v} className="quick-amount-btn" onClick={() => setAmount(String(v))}>
            {v} ₪
          </button>
        ))}
      </div>

      <input type="date" className="date-input" value={date} onChange={(e) => setDate(e.target.value)} max={todayISO()} />
      <input className="note-input" placeholder="הערה (רשות)" value={note} onChange={(e) => setNote(e.target.value)} />

      <button type="submit" className="btn btn-primary btn-lg btn-block">🐷 שמירת חיסכון</button>
    </form>
  );
}

function RecentExpenses() {
  const { state, updateExpense, deleteExpense } = useData();
  const recent = [...state.expenses].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  const nameFor = (e) => {
    const list = e.categoryType === 'fixed' ? state.fixedCosts : state.envelopes;
    return list.find((c) => c.id === e.categoryId);
  };

  if (recent.length === 0) return null;

  return (
    <div className="stack">
      <div className="section-title">🕒 הוצאות אחרונות <span className="muted" style={{ fontWeight: 400 }}>(להחליק כדי לסמן)</span></div>
      {recent.map((e) => {
        const cat = nameFor(e);
        return (
          <SwipeRow
            key={e.id}
            leftHint="🎲 אימפולסיבי"
            rightHint="✅ מתוכנן"
            onSwipeLeft={() => updateExpense(e.id, { isImpulsive: true })}
            onSwipeRight={() => updateExpense(e.id, { isImpulsive: false })}
          >
            <div className="recent-row card">
              <div className="row" style={{ minWidth: 0, flex: 1 }}>
                <span className="category-emoji">{cat?.emoji || '❔'}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="recent-row-name">{cat?.name || 'לא ידוע'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{humanDateShort(e.date)} · {money(expenseCountedAmount(e))}</div>
                </div>
              </div>
              <span className={`pill ${e.isImpulsive === true ? 'amber' : e.isImpulsive === false ? 'green' : 'blue'}`}>
                {e.isImpulsive === true ? '🎲 אימפולסיבי' : e.isImpulsive === false ? '✅ מתוכנן' : '❔ לא מסומן'}
              </span>
              <button type="button" className="icon-btn" aria-label="מחיקה" onClick={() => deleteExpense(e.id)}>🗑️</button>
            </div>
          </SwipeRow>
        );
      })}
    </div>
  );
}

export default function Entry() {
  const [tab, setTab] = useState('expense');
  const [show, trigger] = useSuccessToast();

  return (
    <div className="stack">
      <div className="segmented entry-tabs entry-tabs-4">
        <button type="button" className={tab === 'expense' ? 'active' : ''} onClick={() => setTab('expense')}>💸 הוצאה</button>
        <button type="button" className={tab === 'income' ? 'active' : ''} onClick={() => setTab('income')}>💰 הכנסה</button>
        <button type="button" className={tab === 'payment' ? 'active' : ''} onClick={() => setTab('payment')}>💳 חוב</button>
        <button type="button" className={tab === 'savings' ? 'active' : ''} onClick={() => setTab('savings')}>🐷 חיסכון</button>
      </div>

      <div className="card">
        {tab === 'expense' && <ExpenseForm onSaved={trigger} />}
        {tab === 'income' && <IncomeForm onSaved={trigger} />}
        {tab === 'payment' && <DebtPaymentForm onSaved={trigger} />}
        {tab === 'savings' && <SavingsForm onSaved={trigger} />}
      </div>

      <RecentExpenses />
      <Toast show={show} text="✓ נשמר בהצלחה" />
    </div>
  );
}
