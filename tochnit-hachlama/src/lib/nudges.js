import { NUDGE_TECHNIQUES } from './db.js';
import { money, humanDate, todayISO, dayOfWeekIndex, monthKey, HEBREW_DAYS } from './format.js';
import {
  estimateSlippageMonths,
  projectedFreedomDateISO,
  originalFreedomDateISO,
  envelopeRemaining,
} from './projections.js';

function pickEnvelopeNearLimit(state, mKey) {
  const withStatus = state.envelopes
    .filter((e) => e.monthlyBudget > 0)
    .map((e) => ({ e, ...envelopeRemaining(state, e.id, mKey) }))
    .sort((a, b) => b.pct - a.pct);
  return withStatus[0] || null;
}

// ---- generators: each returns a nudge string, or null if not applicable today ----

function genIfThen(state, ctx) {
  const near = pickEnvelopeNearLimit(state, ctx.mKey);
  if (near && near.pct >= 60) {
    return `אם היום תרגישי דחף לקנות משהו בקטגוריית ${near.e.emoji} ${near.e.name}, אז עצרי לרגע, חכי 24 שעות, ותרשמי את זה כאן קודם.`;
  }
  return 'אם תרגישי היום דחף לקנות משהו שלא היה מתוכנן, אז תחכי 24 שעות ותרשמי אותו כאן לפני שתחליטי.';
}

function genLossFraming(state) {
  const sampleGap = 300;
  const slip = estimateSlippageMonths(state, sampleGap);
  const freedom = projectedFreedomDateISO(state);
  if (!freedom) return null;
  if (slip > 0) {
    const original = originalFreedomDateISO(state);
    return `אם החריגה השבועית תחזור על עצמה (כ-${money(sampleGap)}), תאריך סגירת החוב עלול לזוז מ-${humanDate(original || freedom)} לאחור בכ-${slip} חודשים. שמירה על התוואי היום שומרת על התאריך.`;
  }
  return `את בקצב טוב - אם תשמרי עליו, תאריך החופש מחוב שלך הוא ${humanDate(freedom)}. כל חריגה קטנה יכולה לדחות אותו.`;
}

function genFutureSelf(state) {
  const spouseDebt = state.debts.find((d) => d.id === 'debt-spouse');
  if (spouseDebt && spouseDebt.currentBalance > 0) {
    return `עוד ${money(spouseDebt.currentBalance)} ועד שאת חופשייה לגמרי מהחוב לבן/בת הזוג. כל שקל שלא יוצא מיותר היום מקרב אותך לשם.`;
  }
  const freedom = projectedFreedomDateISO(state);
  const totalLeft = state.debts.reduce((s, d) => s + d.currentBalance, 0);
  if (freedom && totalLeft > 0) {
    return `עוד ${money(totalLeft)} ותאריך ${humanDate(freedom)} - ואת עצמך בעוד כמה חודשים, בלי חוב. ההחלטה של היום היא חלק מהדרך לשם.`;
  }
  return 'כל שקל שאת שומרת היום הוא צעד לעברך העתידית - בלי חובות, עם ראש שקט.';
}

function genCommitment(state, ctx) {
  const near = pickEnvelopeNearLimit(state, ctx.mKey);
  if (near) {
    return `רוצה להתחייב מראש כמה תוציאי השבוע על ${near.e.emoji} ${near.e.name}? נשארו לך ${money(Math.max(0, near.remaining))} החודש - התחייבות מראש עוזרת לעמוד ביעד.`;
  }
  return 'התחייבות קטנה מראש עוזרת מאוד: כמה מותר לך להוציא השבוע על הוצאות לא מתוכננות?';
}

function genStreak(state) {
  const { count } = state.streak;
  if (count > 0) {
    return `🔥 ${count} ימים ברצף שבהם עמדת בתקציב היומי. תמשיכי כך - כל יום נוסף מחזק את ההרגל.`;
  }
  return 'היום זה יום טוב להתחיל רצף חדש 💪 יום 1 מתחיל עכשיו.';
}

function genValues(state) {
  const statement = state.settings.valuesStatement?.trim();
  if (statement) {
    return `זוכרת למה התחלת? כתבת: "${statement}"`;
  }
  return 'זכרי למה חשוב לך לצאת מהחוב הזה - זו הדרך לחופש כלכלי אמיתי.';
}

function genPattern(state, ctx) {
  const profile = state.behaviorProfile;
  if (profile.topDayIndex == null) return null;
  const isRiskDayToday = dayOfWeekIndex(ctx.today) === profile.topDayIndex;
  const dayName = HEBREW_DAYS[profile.topDayIndex];
  const cat = state.envelopes.find((e) => e.id === profile.topImpulsiveCategoryId);
  if (isRiskDayToday && cat) {
    return `שמנו לב שיום ${dayName} הוא היום שבו את נוטה להוציא הכי הרבה, לרוב על ${cat.emoji} ${cat.name}. תכננית מראש להיום?`;
  }
  if (isRiskDayToday) {
    return `לפי ההיסטוריה שלך, יום ${dayName} הוא היום שבו קשה לך יותר לשמור על התקציב. שימי לב היום קצת יותר.`;
  }
  return null;
}

function genReframePast() {
  return 'ההרגלים הישנים לא נעלמים ביום אחד, וזה בסדר גמור - כל יום שאת מתעדת ועוקבת הוא כבר משהו אחר לגמרי ממה שהיה. העבר לא קובע את מה שקורה עכשיו.';
}

const GENERATORS = {
  if_then: genIfThen,
  loss_framing: genLossFraming,
  future_self: genFutureSelf,
  commitment: genCommitment,
  streak: genStreak,
  values: genValues,
  pattern: genPattern,
  reframe_past: genReframePast,
};

export function buildCandidateNudges(state) {
  const ctx = { today: todayISO(), mKey: monthKey(todayISO()) };
  const candidates = [];
  for (const t of NUDGE_TECHNIQUES) {
    const text = GENERATORS[t.id](state, ctx);
    if (text) candidates.push({ techniqueId: t.id, text });
  }
  return candidates;
}

function weightFor(state, techniqueId, isRiskDayBoost) {
  const score = state.behaviorProfile.techniqueScores?.[techniqueId] || { helpful: 0, notRelevant: 0 };
  let w = 1 + score.helpful * 2 - score.notRelevant * 1;
  w = Math.max(0.4, w);
  if (isRiskDayBoost && techniqueId === 'pattern') w *= 2;
  return w;
}

export function selectDailyNudge(state) {
  const candidates = buildCandidateNudges(state);
  if (candidates.length === 0) return null;

  const yesterdayEntry = [...state.nudgeLog].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const avoidRepeat = candidates.length > 1 && yesterdayEntry ? yesterdayEntry.techniqueId : null;
  const pool = candidates.filter((c) => c.techniqueId !== avoidRepeat);
  const finalPool = pool.length > 0 ? pool : candidates;

  const todayIdx = dayOfWeekIndex(todayISO());
  const isRiskDayBoost = todayIdx === state.behaviorProfile.topDayIndex;

  const weighted = finalPool.map((c) => ({ ...c, weight: weightFor(state, c.techniqueId, isRiskDayBoost) }));
  const totalWeight = weighted.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (const c of weighted) {
    r -= c.weight;
    if (r <= 0) return { techniqueId: c.techniqueId, text: c.text };
  }
  return { techniqueId: weighted[0].techniqueId, text: weighted[0].text };
}

export function todaysNudgeLogEntry(state) {
  const today = todayISO();
  return state.nudgeLog.find((n) => n.date === today) || null;
}
