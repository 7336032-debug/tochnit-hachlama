import { todayISO } from './format.js';

function prevDayISO(dateISO) {
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function dayHasImpulsive(state, dateISO) {
  return state.expenses.some((e) => e.categoryType === 'envelope' && e.date === dateISO && e.isImpulsive === true);
}

// The streak only credits days the user actually engaged with the app (logged
// something) - otherwise a brand-new install with zero data would instantly
// read as a multi-day streak just because nothing has been marked impulsive yet.
function firstActivityDate(state) {
  const dates = [
    ...state.expenses.map((e) => e.date),
    ...state.incomeEntries.map((e) => e.date),
    ...state.dailyIncome.map((e) => e.date),
    ...state.debtPayments.map((e) => e.date),
    ...state.savingsEntries.map((e) => e.date),
  ];
  if (dates.length === 0) return null;
  return dates.reduce((min, d) => (d < min ? d : min));
}

export function computeStreakCount(state, todayIso = todayISO()) {
  const activityFloor = firstActivityDate(state);
  if (!activityFloor) return 0;
  let count = 0;
  let cursor = todayIso;
  const floor = activityFloor > state.settings.planStartDate ? activityFloor : state.settings.planStartDate;
  const safetyLimit = 730;
  let i = 0;
  while (cursor >= floor && i < safetyLimit) {
    const broken = dayHasImpulsive(state, cursor) && !state.streak.shieldUsedDates.includes(cursor);
    if (broken) break;
    count += 1;
    cursor = prevDayISO(cursor);
    i += 1;
  }
  return count;
}

export function nextShieldGrantAt(count) {
  return count > 0 && count % 7 === 0;
}
