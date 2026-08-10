import { uid } from './id.js';
import { todayISO, monthKey } from './format.js';

// Small, frequent wins - deliberately separate from the milestone/celebration
// system (achievedMilestones), which is for big rare moments with confetti.
// These are meant to be common: several a day is normal and good.
export const MICRO_WIN_TEXTS = {
  income_entry: [
    '💰 ההכנסה של היום נרשמה - כל שקל שאת רואה עוזר לך לשלוט בתמונה האמיתית.',
    '💰 יופי, נרשם! עוד צעד קטן קרוב אל היעד.',
  ],
  expense_entry: [
    '✍️ ההוצאה נרשמה - עצם התיעוד הוא ניצחון, לפני שבודקים בכלל מה היא הייתה.',
    '✍️ נרשם! תיעוד בזמן אמת בונה לך תמונה ברורה יותר מכל דבר אחר.',
  ],
  expense_entry_impulsive: [
    '🎲 תיעדת גם את זה - בדיוק בשביל זה המערכת כאן. מודעות היא הצעד הראשון והכי קשה, וכבר עשית אותו.',
    '🎲 נרשם, בלי שיפוט. לתעד הוצאה אימפולסיבית זו עבודה אמיתית על ההרגלים - כל הכבוד שלא התחמקת מזה.',
  ],
  debt_payment: [
    '💪 התשלום נרשם - עוד סכום, קטן או גדול, שיוצא מהדרך שלך לחופש מחוב.',
    '💪 כל תשלום מקרב אותך בפועל. יופי שהמשכת.',
  ],
  savings_entry: [
    '🐷 עוד קצת בצד - כל שקל בחיסכון הוא רשת ביטחון שאת בונה לעצמך.',
  ],
  debt_milestone_1000: [], // built dynamically with the exact amount, see debtMilestoneToastText
  no_impulsive_day: [],
  return_after_break: [],
};

export function pickMicroWinText(type) {
  const options = MICRO_WIN_TEXTS[type];
  if (!options || options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)];
}

export function debtMilestoneToastText(markCrossed) {
  return `🎉 עוד ${markCrossed.toLocaleString('he-IL')} ₪ סולקו מסך כל החוב מאז ההתחלה - תחנה קטנה נוספת מאחורייך!`;
}

// Returns the ₪ mark just crossed (e.g. 15000) if paying `amount` pushed the
// total-ever-paid-across-all-debts past a multiple of 1,000, else null.
export function debtMilestoneCrossed(totalPaidBefore, totalPaidAfter) {
  const before = Math.floor(totalPaidBefore / 1000);
  const after = Math.floor(totalPaidAfter / 1000);
  return after > before ? after * 1000 : null;
}

export function logMicroWin(state, type, date = todayISO()) {
  state.microWins = [...(state.microWins || []), { id: uid(), type, date }];
}

export function hasMicroWin(state, type, date) {
  return (state.microWins || []).some((w) => w.type === type && w.date === date);
}

export function monthMicroWinsCount(state, mKey = monthKey(todayISO())) {
  return (state.microWins || []).filter((w) => monthKey(w.date) === mKey).length;
}
