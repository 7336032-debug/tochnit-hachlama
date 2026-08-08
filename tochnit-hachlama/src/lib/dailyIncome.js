import { monthKey, daysInMonth, todayISO } from './format.js';

export function dailyTotal(entry) {
  return (entry.cash || 0) + (entry.bit || 0) + (entry.credit || 0) + (entry.transfer || 0);
}

export function entryForDate(state, dateISO) {
  return state.dailyIncome.find((e) => e.date === dateISO) || null;
}

export function monthEntries(state, mKey) {
  return state.dailyIncome.filter((e) => monthKey(e.date) === mKey).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function monthDailyIncomeTotal(state, mKey) {
  return monthEntries(state, mKey).reduce((sum, e) => sum + dailyTotal(e), 0);
}

function dayOfMonth(dateISO) {
  return Number(dateISO.slice(8, 10));
}

// Live pace: actual income so far this month vs the target prorated by how
// much of the month has elapsed (not the full monthly target).
export function computeBusinessPace(state, todayIso = todayISO()) {
  const mKey = monthKey(todayIso);
  const entries = monthEntries(state, mKey).filter((e) => e.date <= todayIso);
  const totalSoFar = entries.reduce((sum, e) => sum + dailyTotal(e), 0);
  const dIndex = dayOfMonth(todayIso);
  const totalDaysInMonth = daysInMonth(mKey);
  const target = state.settings.businessMonthlyTarget;
  const proratedTarget = target * (dIndex / totalDaysInMonth);
  const ratio = proratedTarget > 0 ? totalSoFar / proratedTarget : 0;
  return { totalSoFar, proratedTarget, ratio, dIndex, totalDaysInMonth, target };
}

// End-of-month forecast, built only from days she actually worked (days with
// no entry at all are excluded, not treated as zero-income days). Returned as
// a range (conservative..optimistic) rather than a single misleadingly-precise number.
export function computeBusinessForecast(state, todayIso = todayISO()) {
  const mKey = monthKey(todayIso);
  const entries = monthEntries(state, mKey).filter((e) => e.date <= todayIso);
  const workDaysSoFar = entries.length;
  const dIndex = dayOfMonth(todayIso);
  const totalDaysInMonth = daysInMonth(mKey);
  const totalSoFar = entries.reduce((sum, e) => sum + dailyTotal(e), 0);

  if (workDaysSoFar === 0) {
    return { hasData: false, totalSoFar: 0, workDaysSoFar: 0 };
  }

  const remainingCalendarDays = Math.max(0, totalDaysInMonth - dIndex);
  const workRatio = workDaysSoFar / dIndex;
  const estRemainingWorkDays = Math.round(remainingCalendarDays * workRatio);

  const amounts = entries.map(dailyTotal).sort((a, b) => b - a);
  const averageAll = totalSoFar / workDaysSoFar;
  const topN = Math.max(1, Math.ceil(amounts.length / 2));
  const averageGood = amounts.slice(0, topN).reduce((s, v) => s + v, 0) / topN;

  const conservative = totalSoFar + estRemainingWorkDays * averageAll;
  const optimistic = totalSoFar + estRemainingWorkDays * averageGood;
  const roundTo100 = (v) => Math.round(v / 100) * 100;

  return {
    hasData: true,
    totalSoFar,
    workDaysSoFar,
    estRemainingWorkDays,
    low: roundTo100(Math.min(conservative, optimistic)),
    high: roundTo100(Math.max(conservative, optimistic)),
  };
}

export function businessForecastShortfall(state, todayIso = todayISO()) {
  const forecast = computeBusinessForecast(state, todayIso);
  if (!forecast.hasData) return null;
  const target = state.settings.layer2MonthlyTarget;
  if (forecast.low >= target) return null;
  return { forecast, target, gap: target - forecast.low };
}
