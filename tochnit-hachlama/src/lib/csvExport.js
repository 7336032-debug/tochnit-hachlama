import { dailyTotal } from './dailyIncome.js';

function toCsvRows(rows) {
  return rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

function download(filename, content) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAllToCsv(state) {
  const catName = (id) =>
    state.envelopes.find((e) => e.id === id)?.name || state.fixedCosts.find((c) => c.id === id)?.name || id;

  const expensesCsv = toCsvRows([
    ['תאריך', 'קטגוריה', 'סכום', 'משותף (50/50)', 'מתוכנן/אימפולסיבי', 'הערה'],
    ...state.expenses.map((e) => [
      e.date,
      catName(e.categoryId),
      e.amount,
      e.isShared ? 'כן' : 'לא',
      e.isImpulsive === true ? 'אימפולסיבי' : e.isImpulsive === false ? 'מתוכנן' : '',
      e.note || '',
    ]),
  ]);

  const incomeCsv = toCsvRows([
    ['תאריך', 'מקור', 'סכום', 'הערה'],
    ...state.incomeEntries.map((i) => [i.date, i.source, i.amount, i.note || '']),
  ]);

  const dailyIncomeCsv = toCsvRows([
    ['תאריך', 'מזומן', 'ביט', 'אשראי', 'העברה בנקאית', 'סה"כ'],
    ...state.dailyIncome.map((e) => [e.date, e.cash, e.bit, e.credit, e.transfer, dailyTotal(e)]),
  ]);

  const paymentsCsv = toCsvRows([
    ['תאריך', 'חוב', 'סכום ששולם'],
    ...state.debtPayments.map((p) => [p.date, state.debts.find((d) => d.id === p.debtId)?.name || p.debtId, p.amount]),
  ]);

  const debtsCsv = toCsvRows([
    ['שם החוב', 'יתרת פתיחה', 'יתרה נוכחית', 'ריבית שנתית', 'עדיפות'],
    ...state.debts.map((d) => [d.name, d.openingBalance, d.currentBalance, `${d.annualRatePct}%`, d.priority]),
  ]);

  const combined = [
    'הוצאות', expensesCsv, '',
    'הכנסות', incomeCsv, '',
    'יומן הכנסות יומי (עסק)', dailyIncomeCsv, '',
    'תשלומי חוב', paymentsCsv, '',
    'חובות', debtsCsv,
  ].join('\r\n');

  download(`תוכנית-הבראה-${new Date().toISOString().slice(0, 10)}.csv`, combined);
}
