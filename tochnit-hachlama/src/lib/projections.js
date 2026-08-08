import { monthlyStep } from './amortization.js';
import { addMonthsISO, monthKey, monthsBetween, todayISO } from './format.js';
import { monthDailyIncomeTotal } from './dailyIncome.js';

const MAX_MONTHS = 72;

// ---------- basic aggregations ----------

export function effectiveRemainingInstallments(state, commitment, todayIso = todayISO()) {
  const elapsed = Math.max(0, monthsBetween(state.settings.planStartDate, todayIso));
  return Math.max(0, commitment.remainingAtStart - elapsed);
}

export function activeTempCommitmentsTotal(state) {
  return state.tempCommitments
    .filter((t) => effectiveRemainingInstallments(state, t) > 0)
    .reduce((sum, t) => sum + t.amount, 0);
}

export function layer1Total(state) {
  const fixed = state.fixedCosts.reduce((sum, c) => sum + c.amount, 0);
  return fixed + activeTempCommitmentsTotal(state);
}

export function monthIncome(state, mKey) {
  const fromEntries = state.incomeEntries
    .filter((e) => monthKey(e.date) === mKey)
    .reduce((sum, e) => sum + e.amount, 0);
  return fromEntries + monthDailyIncomeTotal(state, mKey);
}

export function expenseCountedAmount(e) {
  return e.isShared ? e.amount / 2 : e.amount;
}

export function monthExpensesByEnvelope(state, mKey) {
  const map = {};
  for (const e of state.expenses) {
    if (e.categoryType !== 'envelope') continue;
    if (monthKey(e.date) !== mKey) continue;
    map[e.categoryId] = (map[e.categoryId] || 0) + expenseCountedAmount(e);
  }
  return map;
}

export function envelopeRemaining(state, envelopeId, mKey) {
  const env = state.envelopes.find((x) => x.id === envelopeId);
  if (!env) return { spent: 0, budget: 0, remaining: 0, pct: 0 };
  const spent = monthExpensesByEnvelope(state, mKey)[envelopeId] || 0;
  const remaining = env.monthlyBudget - spent;
  const pct = env.monthlyBudget > 0 ? (spent / env.monthlyBudget) * 100 : spent > 0 ? 100 : 0;
  return { spent, budget: env.monthlyBudget, remaining, pct };
}

export function monthDebtPayments(state, mKey) {
  return state.debtPayments
    .filter((p) => monthKey(p.date) === mKey)
    .reduce((sum, p) => sum + p.amount, 0);
}

export function monthImpulsiveVsPlanned(state, mKey) {
  let impulsive = 0;
  let planned = 0;
  let unmarked = 0;
  for (const e of state.expenses) {
    if (e.categoryType !== 'envelope') continue;
    if (monthKey(e.date) !== mKey) continue;
    const amt = expenseCountedAmount(e);
    if (e.isImpulsive === true) impulsive += amt;
    else if (e.isImpulsive === false) planned += amt;
    else unmarked += amt;
  }
  return { impulsive, planned, unmarked, total: impulsive + planned + unmarked };
}

// ---------- layer 2 (accelerated debt payoff) status ----------

export function layer2Status(state, mKey = monthKey(todayISO())) {
  const income = monthIncome(state, mKey);
  const layer1 = layer1Total(state);
  const surplus = income - layer1;
  const target = state.settings.layer2MonthlyTarget;
  const gap = target - surplus; // positive = shortfall, negative = ahead
  const paidToDebtThisMonth = monthDebtPayments(state, mKey);
  return { income, layer1, surplus, target, gap, paidToDebtThisMonth, hasIncome: income > 0 };
}

// suggested concrete actions when there's a monthly shortfall, ranked by ease
export function suggestedActionsForGap(state, gap, mKey) {
  if (gap <= 0) return [];
  const actions = [];
  const savingsTarget = state.settings.savingsMonthlyTarget;
  if (savingsTarget > 0) {
    actions.push({
      id: 'pause-savings',
      text: `להשהות את החיסכון החודשי (${savingsTarget} ₪) עד לסגירת הפער`,
      covers: Math.min(gap, savingsTarget),
    });
  }
  const envStatuses = state.envelopes
    .map((env) => ({ env, ...envelopeRemaining(state, env.id, mKey) }))
    .filter((s) => s.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);
  for (const s of envStatuses) {
    actions.push({
      id: `trim-${s.env.id}`,
      text: `לצמצם את מעטפת ${s.env.emoji} ${s.env.name} - נשארו בה ${Math.round(s.remaining)} ₪ שאפשר להעביר`,
      covers: Math.min(gap, s.remaining),
    });
  }
  actions.push({
    id: 'review-subscriptions',
    text: 'לבדוק מנויים לא בשימוש ולבטל אחד או שניים',
    covers: null,
  });
  return actions;
}

export function estimateSlippageMonths(state, recurringMonthlyGap) {
  if (recurringMonthlyGap <= 0) return 0;
  const baseline = generateSchedule(state, { fromCurrent: true });
  const reducedExtra = Math.max(0, state.settings.layer2ExtraAllocation - recurringMonthlyGap);
  const withGap = generateSchedule(state, { fromCurrent: true, extraOverride: reducedExtra });
  const baselineMonths = baseline.finishMonth ?? MAX_MONTHS;
  const withGapMonths = withGap.finishMonth ?? MAX_MONTHS;
  return Math.max(0, withGapMonths - baselineMonths);
}

// ---------- waterfall payoff simulation ----------

// Simulates monthly minimum + extra payments across debts by priority.
// debts: [{id, balance, annualRatePct, minPayment, priority, accelerated, closed}]
function simulateWaterfall(debts, extraPool) {
  const working = debts.map((d) => ({ ...d }));
  const schedule = [];
  const closedAtMonth = {};
  let month = 0;
  let allClosed = working.every((d) => d.balance <= 0);
  if (allClosed) {
    schedule.push({ month: 0, balances: Object.fromEntries(working.map((d) => [d.id, 0])), total: 0 });
    return { schedule, closedAtMonth, finishMonth: 0 };
  }

  while (!allClosed && month < MAX_MONTHS) {
    month += 1;
    // accrue interest + apply minimum payments
    for (const d of working) {
      if (d.balance <= 0) continue;
      const { newBalance } = monthlyStep(d.balance, d.annualRatePct, d.minPayment);
      d.balance = newBalance;
      if (d.balance <= 0.5) {
        d.balance = 0;
        if (!closedAtMonth[d.id]) closedAtMonth[d.id] = month;
      }
    }
    // distribute extra pool by priority to accelerated, still-open debts
    let extraRemaining = extraPool;
    const ordered = [...working].filter((d) => d.balance > 0 && d.accelerated).sort((a, b) => a.priority - b.priority);
    for (const d of ordered) {
      if (extraRemaining <= 0) break;
      const applied = Math.min(extraRemaining, d.balance);
      d.balance -= applied;
      extraRemaining -= applied;
      if (d.balance <= 0.5) {
        d.balance = 0;
        if (!closedAtMonth[d.id]) closedAtMonth[d.id] = month;
      }
    }
    schedule.push({
      month,
      balances: Object.fromEntries(working.map((d) => [d.id, Math.round(d.balance)])),
      total: Math.round(working.reduce((s, d) => s + d.balance, 0)),
    });
    allClosed = working.every((d) => d.balance <= 0);
  }
  const finishMonth = allClosed ? month : null;
  return { schedule, closedAtMonth, finishMonth };
}

export function estimateRecentMonthlyExtra(state) {
  const debtIds = new Set(state.debts.filter((d) => !d.closed).map((d) => d.id));
  const totalMin = state.debts.filter((d) => !d.closed).reduce((s, d) => s + d.minMonthlyPayment, 0);
  // look at last 3 distinct months that have any payments
  const byMonth = {};
  for (const p of state.debtPayments) {
    if (!debtIds.has(p.debtId) && !state.debts.some((d) => d.id === p.debtId)) continue;
    const mk = monthKey(p.date);
    byMonth[mk] = (byMonth[mk] || 0) + p.amount;
  }
  const months = Object.keys(byMonth).sort().slice(-3);
  if (months.length === 0) return state.settings.layer2ExtraAllocation;
  const avgTotal = months.reduce((s, mk) => s + byMonth[mk], 0) / months.length;
  return Math.max(0, avgTotal - totalMin);
}

// Generates a payoff schedule. fromCurrent=true uses live debt balances (the "actual" line),
// otherwise replays the original plan from opening balances (the "planned" line).
export function generateSchedule(state, { fromCurrent = false, extraOverride = null } = {}) {
  const debts = state.debts.map((d) => ({
    id: d.id,
    balance: fromCurrent ? d.currentBalance : d.openingBalance,
    annualRatePct: d.annualRatePct,
    minPayment: d.minMonthlyPayment,
    priority: d.priority,
    accelerated: d.accelerated,
  }));
  const extraPool = extraOverride ?? (fromCurrent ? estimateRecentMonthlyExtra(state) : state.settings.layer2ExtraAllocation);
  const result = simulateWaterfall(debts, extraPool);
  const startDate = fromCurrent ? todayISO() : state.settings.planStartDate;
  return { ...result, startDate, extraPoolUsed: extraPool };
}

export function totalOriginalDebt(state) {
  return state.debts.reduce((s, d) => s + d.openingBalance, 0);
}

export function totalCurrentDebt(state) {
  return state.debts.reduce((s, d) => s + d.currentBalance, 0);
}

// Reconstructs the actual total-debt-balance trajectory from real payment history,
// walking forward from opening balances applying real debt_payments (with interest
// accrual for the bank loan) up to today.
export function debtBalanceHistory(state) {
  const paymentsByMonth = {};
  for (const p of state.debtPayments) {
    const mk = monthKey(p.date);
    if (!paymentsByMonth[mk]) paymentsByMonth[mk] = {};
    paymentsByMonth[mk][p.debtId] = (paymentsByMonth[mk][p.debtId] || 0) + p.amount;
  }
  const months = Object.keys(paymentsByMonth).sort();
  if (months.length === 0) return [];

  const balances = Object.fromEntries(state.debts.map((d) => [d.id, d.openingBalance]));
  const rateById = Object.fromEntries(state.debts.map((d) => [d.id, d.annualRatePct]));
  const history = [];
  const totalSpanMonths = Math.max(monthsBetween(state.settings.planStartDate, months.at(-1) + '-01'), 0);

  for (let i = 0; i <= totalSpanMonths; i += 1) {
    const mIso = addMonthsISO(state.settings.planStartDate, i);
    const mk = monthKey(mIso);
    for (const d of state.debts) {
      const paid = paymentsByMonth[mk]?.[d.id] || 0;
      const { newBalance } = monthlyStep(balances[d.id], rateById[d.id], paid);
      balances[d.id] = paid > 0 ? newBalance : balances[d.id];
    }
    if (paymentsByMonth[mk]) {
      history.push({ month: i, dateISO: mIso, total: Math.round(Object.values(balances).reduce((s, b) => s + b, 0)) });
    }
  }
  return history;
}

export function projectedFreedomDateISO(state) {
  const forecast = generateSchedule(state, { fromCurrent: true });
  if (forecast.finishMonth == null) return null;
  return addMonthsISO(todayISO(), forecast.finishMonth);
}

export function originalFreedomDateISO(state) {
  const planned = generateSchedule(state, { fromCurrent: false });
  if (planned.finishMonth == null) return null;
  return addMonthsISO(state.settings.planStartDate, planned.finishMonth);
}

export function perDebtProjectedCloseMonth(state, debtId) {
  const forecast = generateSchedule(state, { fromCurrent: true });
  const m = forecast.closedAtMonth[debtId];
  if (!m) return null;
  return addMonthsISO(todayISO(), m);
}

export function overallPercentPaid(state) {
  const original = totalOriginalDebt(state);
  const current = totalCurrentDebt(state);
  if (original <= 0) return 0;
  return Math.max(0, Math.min(100, ((original - current) / original) * 100));
}

export function healthScore(state, mKey = monthKey(todayISO())) {
  let score = 10;
  const status = layer2Status(state);
  if (status.hasIncome && status.gap > 0) {
    score -= status.gap > 2000 ? 3 : 1.5;
  }
  const overBudgetEnvelopes = state.envelopes.filter((e) => envelopeRemaining(state, e.id, mKey).pct > 100);
  score -= overBudgetEnvelopes.length * 1.2;
  const { impulsive, total } = monthImpulsiveVsPlanned(state, mKey);
  if (total > 0) {
    const impulsiveShare = impulsive / total;
    if (impulsiveShare > 0.4) score -= 2;
    else if (impulsiveShare > 0.2) score -= 1;
  }
  return Math.round(Math.max(1, Math.min(10, score)) * 10) / 10;
}
