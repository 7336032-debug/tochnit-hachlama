import { dayOfWeekIndex, HEBREW_DAYS } from './format.js';
import { expenseCountedAmount } from './projections.js';
import { NUDGE_TECHNIQUES } from './db.js';

export function computeBehaviorProfile(state) {
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  const categoryImpulsiveCounts = {};

  for (const e of state.expenses) {
    if (e.categoryType !== 'envelope') continue;
    const idx = dayOfWeekIndex(e.date);
    dayTotals[idx] += expenseCountedAmount(e);
    dayCounts[idx] += 1;
    if (e.isImpulsive === true) {
      categoryImpulsiveCounts[e.categoryId] = (categoryImpulsiveCounts[e.categoryId] || 0) + 1;
    }
  }

  let topDayIndex = null;
  let topDayAmount = 0;
  dayTotals.forEach((total, idx) => {
    if (total > topDayAmount) {
      topDayAmount = total;
      topDayIndex = idx;
    }
  });

  let topImpulsiveCategoryId = null;
  let topImpulsiveCount = 0;
  for (const [catId, count] of Object.entries(categoryImpulsiveCounts)) {
    if (count > topImpulsiveCount) {
      topImpulsiveCount = count;
      topImpulsiveCategoryId = catId;
    }
  }

  const techniqueScores = {};
  for (const t of NUDGE_TECHNIQUES) {
    const entries = state.nudgeLog.filter((n) => n.techniqueId === t.id);
    const helpful = entries.filter((n) => n.response === 'helpful').length;
    const notRelevant = entries.filter((n) => n.response === 'not_relevant').length;
    techniqueScores[t.id] = { shown: entries.length, helpful, notRelevant };
  }

  return {
    updatedAt: new Date().toISOString(),
    dayTotals,
    dayCounts,
    topDayIndex,
    topDayName: topDayIndex != null ? HEBREW_DAYS[topDayIndex] : null,
    categoryImpulsiveCounts,
    topImpulsiveCategoryId,
    techniqueScores,
  };
}
