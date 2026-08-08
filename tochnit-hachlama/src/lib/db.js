import { uid } from './id.js';
import { firstOfMonthISO } from './format.js';

export const STORAGE_KEY = 'hachlama_v1';
export const SCHEMA_VERSION = 1;

// ---------- techniques used by the daily coach (see lib/nudges.js) ----------
export const NUDGE_TECHNIQUES = [
  { id: 'if_then', label: 'תכנון אם-אז' },
  { id: 'loss_framing', label: 'מסגור אבדן' },
  { id: 'future_self', label: 'העצמי העתידי' },
  { id: 'commitment', label: 'מנגנון מחויבות' },
  { id: 'streak', label: 'רצף והישגים' },
  { id: 'values', label: 'תזכורת ערכים' },
  { id: 'pattern', label: 'דרבון ממוקד-דפוס' },
];

function defaultFixedCosts() {
  return [
    { id: 'fc-house', emoji: '🏠', name: 'חלק בהוצאות הבית המשותף', amount: 13200 },
    { id: 'fc-mortgage', emoji: '🏠', name: 'משכנתא', amount: 4000 },
    { id: 'fc-insurance', emoji: '🛡️', name: 'ביטוחים + ביטוח לאומי + קופת חולים', amount: 4211 },
    { id: 'fc-pension', emoji: '🎓', name: 'קרן השתלמות + קופת גמל', amount: 1500 },
    { id: 'fc-phone-biz', emoji: '📱', name: 'טלפון + עסק שוטף', amount: 1443 },
    { id: 'fc-studies', emoji: '📚', name: 'לימודים', amount: 1200 },
    { id: 'fc-min-debts', emoji: '💳', name: 'מינימום חודשי לחובות (בנק + חוץ-בנקאית)', amount: 3200 },
  ];
}

function defaultEnvelopes() {
  return [
    { id: 'env-cosmetics', emoji: '💅', name: 'קוסמטיקה / עסק', monthlyBudget: 0, needsSetup: true },
    { id: 'env-clothing', emoji: '👗', name: 'ביגוד', monthlyBudget: 0, needsSetup: true },
    { id: 'env-fun', emoji: '🎉', name: 'בילויים', monthlyBudget: 800 },
    { id: 'env-subs', emoji: '📱', name: 'מנויים', monthlyBudget: 300, needsReview: true },
    { id: 'env-misc', emoji: '🎲', name: 'שונות / בלתי צפוי', monthlyBudget: 600 },
  ];
}

function defaultDebts() {
  return [
    {
      id: 'debt-spouse', emoji: '🤝', name: 'חוב לבן/בת הזוג',
      openingBalance: 36000, currentBalance: 36000, annualRatePct: 0,
      minMonthlyPayment: 0, contractEndDate: null, priority: 1,
      targetMonth: 6, accelerated: true, closed: false, closedDate: null,
    },
    {
      id: 'debt-bank', emoji: '🏦', name: 'הלוואת בנק',
      openingBalance: 161800, currentBalance: 161800, annualRatePct: 7.9,
      minMonthlyPayment: 2600, contractEndDate: '2033-02-15', priority: 2,
      targetMonth: 24, accelerated: true, closed: false, closedDate: null,
    },
    {
      id: 'debt-nonbank', emoji: '🐢', name: 'הלוואה חוץ-בנקאית',
      openingBalance: 21600, currentBalance: 21600, annualRatePct: 0,
      minMonthlyPayment: 600, contractEndDate: null, priority: 3,
      targetMonth: 36, accelerated: false, closed: false, closedDate: null,
    },
  ];
}

function defaultTempCommitments() {
  return [
    { id: 'tmp-creams', emoji: '🧴', name: 'קרמים', amount: 665, totalInstallments: 2, remainingAtStart: 2 },
    { id: 'tmp-flight', emoji: '✈️', name: 'טיסה', amount: 1845, totalInstallments: 2, remainingAtStart: 2 },
    { id: 'tmp-clothes', emoji: '👗', name: 'ביגוד (תשלומים)', amount: 350, totalInstallments: 4, remainingAtStart: 4 },
  ];
}

export function getDefaultState() {
  const planStartDate = firstOfMonthISO();
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      theme: 'system',
      planStartDate,
      totalDebtGoal: 219400,
      targetMonths: 24,
      layer2MonthlyTarget: 9608,
      layer2ExtraAllocation: 6408,
      savingsMonthlyTarget: 300,
      businessMonthlyTarget: 32500,
      valuesStatement: '',
      onboardingComplete: false,
    },
    fixedCosts: defaultFixedCosts(),
    envelopes: defaultEnvelopes(),
    debts: defaultDebts(),
    tempCommitments: defaultTempCommitments(),
    incomeEntries: [],
    dailyIncome: [],
    debtPayments: [],
    expenses: [],
    savingsEntries: [],
    nudgeLog: [],
    behaviorProfile: {
      updatedAt: null,
      dayTotals: [0, 0, 0, 0, 0, 0, 0],
      dayCounts: [0, 0, 0, 0, 0, 0, 0],
      topDayIndex: null,
      categoryImpulsiveCounts: {},
      topImpulsiveCategoryId: null,
      techniqueScores: {},
    },
    streak: { count: 0, lastQualifyingDate: null, shieldAvailable: true, shieldUsedDates: [] },
    achievedMilestones: [],
    pendingCelebrations: [],
  };
}

function deepMerge(base, override) {
  if (Array.isArray(base)) return override ?? base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    if (override && typeof override === 'object') {
      for (const key of Object.keys(base)) {
        out[key] = deepMerge(base[key], override[key]);
      }
    }
    return out;
  }
  return override === undefined ? base : override;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch {
    return getDefaultState();
  }
}

// Merges any externally-sourced state (e.g. pulled from cloud sync) over the
// current schema's defaults, so a payload saved by an older app version
// (missing newer fields) doesn't crash the app - same safety net loadState
// gives locally-stored data.
export function mergeWithDefaults(externalState) {
  return deepMerge(getDefaultState(), externalState);
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable - fail silently, in-memory state still works this session
  }
}

export function newId() {
  return uid();
}
