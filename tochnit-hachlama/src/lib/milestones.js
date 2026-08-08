import { overallPercentPaid, layer2Status } from './projections.js';
import { monthKey, todayISO } from './format.js';

function debtMilestones() {
  return [
    { key: 'debt_closed_debt-spouse', emoji: '🎉', title: 'סגרת את החוב לבן/בת הזוג!', check: (s) => s.debts.find((d) => d.id === 'debt-spouse')?.closed },
    { key: 'debt_closed_debt-bank', emoji: '🏆', title: 'סגרת את הלוואת הבנק!', check: (s) => s.debts.find((d) => d.id === 'debt-bank')?.closed },
    { key: 'debt_closed_debt-nonbank', emoji: '🏆', title: 'סגרת את ההלוואה החוץ-בנקאית!', check: (s) => s.debts.find((d) => d.id === 'debt-nonbank')?.closed },
  ];
}

function percentMilestones() {
  return [25, 50, 75, 90].map((p) => ({
    key: `debt_pct_${p}`,
    emoji: p >= 90 ? '👑' : '🏅',
    title: `סילקת ${p}% מסך כל החוב!`,
    check: (s) => overallPercentPaid(s) >= p,
  })).concat([{
    key: 'debt_pct_100',
    emoji: '👑',
    title: 'חופשייה מחוב! סיימת את התוכנית 🎊',
    check: (s) => overallPercentPaid(s) >= 99.9,
  }]);
}

function streakMilestones() {
  return [7, 14, 30, 60, 100].map((n) => ({
    key: `streak_${n}`,
    emoji: '🔥',
    title: `רצף של ${n} ימים בתקציב!`,
    check: (s) => s.streak.count >= n,
  }));
}

function monthlyTargetMilestone(state) {
  const mKey = monthKey(todayISO());
  const status = layer2Status(state, mKey);
  return [{
    key: `layer2_met_${mKey}`,
    emoji: '✅',
    title: 'עמדת ביעד סילוק החוב החודשי!',
    check: () => status.hasIncome && status.gap <= 0,
  }];
}

function firstStepsMilestones() {
  return [
    { key: 'first_expense', emoji: '✍️', title: 'תיעדת את ההוצאה הראשונה שלך!', check: (s) => s.expenses.length >= 1 },
    { key: 'first_income', emoji: '💰', title: 'רשמת את ההכנסה הראשונה שלך!', check: (s) => s.incomeEntries.length >= 1 || s.dailyIncome.length >= 1 },
    { key: 'first_payment', emoji: '💳', title: 'ביצעת את התשלום הראשון לסילוק חוב!', check: (s) => s.debtPayments.length >= 1 },
    { key: 'first_savings', emoji: '🐷', title: 'שמת בצד את החיסכון הראשון שלך!', check: (s) => s.savingsEntries.length >= 1 },
  ];
}

export function allMilestoneDefs(state) {
  return [...firstStepsMilestones(), ...debtMilestones(), ...percentMilestones(), ...streakMilestones(), ...monthlyTargetMilestone(state)];
}

export function computeNewlyAchieved(state) {
  const already = new Set(state.achievedMilestones.map((m) => m.key));
  const defs = allMilestoneDefs(state);
  const fresh = [];
  for (const def of defs) {
    if (already.has(def.key)) continue;
    if (def.check(state)) {
      fresh.push({ key: def.key, emoji: def.emoji, title: def.title, date: todayISO() });
    }
  }
  return fresh;
}
