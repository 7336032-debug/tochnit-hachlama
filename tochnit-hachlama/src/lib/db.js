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
    // home (split with spouse, already halved into these amounts)
    { id: 'fc-rent', type: 'home', emoji: '🏠', name: 'שכירות', amount: 5000 },
    { id: 'fc-taxes', type: 'home', emoji: '🧾', name: 'מיסים (ארנונה+ועד בית+טלוויזיה+חשמל+גז+מים)', amount: 2600 },
    { id: 'fc-cleaning', type: 'home', emoji: '🧹', name: 'ניקיון', amount: 1000 },
    { id: 'fc-ironing', type: 'home', emoji: '👕', name: 'גיהוץ', amount: 400 },
    { id: 'fc-groceries', type: 'home', emoji: '🛒', name: 'קניות בית/מזון', amount: 3000 },
    { id: 'fc-fun', type: 'home', emoji: '🎉', name: 'בילויים', amount: 800 },
    { id: 'fc-fun-family', type: 'home', emoji: '👨‍👩‍👧', name: 'בילויים משפחתיים מורחב', amount: 400 },
    // personal
    { id: 'fc-insurance', type: 'personal', emoji: '🛡️', name: 'ביטוחים', amount: 2373 },
    { id: 'fc-national-insurance', type: 'personal', emoji: '🏛️', name: 'ביטוח לאומי', amount: 1538 },
    { id: 'fc-pension-fund', type: 'personal', emoji: '🎓', name: 'קרן השתלמות', amount: 1000 },
    { id: 'fc-provident', type: 'personal', emoji: '💼', name: 'קופת גמל', amount: 500 },
    { id: 'fc-healthcare', type: 'personal', emoji: '⚕️', name: 'קופת חולים', amount: 300 },
    { id: 'fc-phone', type: 'personal', emoji: '📱', name: 'טלפון', amount: 150 },
    { id: 'fc-studies', type: 'personal', emoji: '📚', name: 'לימודים', amount: 1200 },
    { id: 'fc-mortgage', type: 'personal', emoji: '🏘️', name: 'משכנתא (דירת ההשקעה המושכרת)', amount: 4000 },
    { id: 'fc-biz-running', type: 'personal', emoji: '💅', name: 'הוצאות עסק שוטפות (כולל סליקה)', amount: 1293 },
  ];
}

function defaultEnvelopes() {
  return [
    { id: 'env-cosmetics', emoji: '💅', name: 'קוסמטיקה / עסק', monthlyBudget: 0, needsSetup: true },
    { id: 'env-clothing', emoji: '👗', name: 'ביגוד', monthlyBudget: 0, needsSetup: true },
    { id: 'env-subs', emoji: '📱', name: 'מנויים', monthlyBudget: 631, needsReview: true },
    { id: 'env-misc', emoji: '🎲', name: 'שונות / בלתי צפוי', monthlyBudget: 600 },
  ];
}

// One-time restructure from the old flat fixed-costs list (single "house
// share" line + a redundant debt-minimum line double-counted against the
// layer2 target) and from envelopes that included "בילויים" (now a fixed
// cost, since it's budgeted every month regardless). Runs on every load so
// data pulled from another device/sync gets the same shape; a no-op once a
// state is already on the new structure.
function migrateExpenseStructure(state) {
  let fixedCosts = state.fixedCosts;
  if (fixedCosts.some((c) => !c.type)) {
    fixedCosts = defaultFixedCosts();
  }
  let envelopes = state.envelopes;
  if (envelopes.some((e) => e.id === 'env-fun')) {
    // בילויים moved to a fixed cost. If old expense records still point at
    // it, keep it around archived (name/emoji intact for those lookups)
    // instead of dropping it - a hard delete would turn those records into
    // unresolvable "לא ידוע" entries.
    const hasHistory = (state.expenses || []).some((e) => e.categoryType === 'envelope' && e.categoryId === 'env-fun');
    envelopes = envelopes
      .map((e) => {
        if (e.id !== 'env-fun') {
          return e.id === 'env-subs' && e.monthlyBudget === 300 ? { ...e, monthlyBudget: 631 } : e;
        }
        return hasHistory ? { ...e, monthlyBudget: 0, archived: true } : null;
      })
      .filter(Boolean);
  }
  return fixedCosts === state.fixedCosts && envelopes === state.envelopes
    ? state
    : { ...state, fixedCosts, envelopes };
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
    pendingNotices: [],
    microWins: [],
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
  return migrateExpenseStructure(deepMerge(getDefaultState(), externalState));
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
