import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { loadState, saveState, newId, mergeWithDefaults } from '../lib/db.js';
import { computeBehaviorProfile } from '../lib/behaviorProfile.js';
import { computeStreakCount, nextShieldGrantAt } from '../lib/streak.js';
import { computeNewlyAchieved } from '../lib/milestones.js';
import { todayISO } from '../lib/format.js';
import { loadSyncConfig, saveSyncConfig, clearSyncConfig } from '../lib/syncConfig.js';
import { encryptPayload, decryptPayload, generatePin, createCloudBlob, pushCloudBlob, pullCloudBlob } from '../lib/cloudSync.js';

const DataContext = createContext(null);
const SYNC_DEBOUNCE_MS = 2500;

function recompute(next) {
  next.behaviorProfile = computeBehaviorProfile(next);
  const count = computeStreakCount(next, todayISO());
  const grantedShield = nextShieldGrantAt(count) && count !== next.streak.count ? true : next.streak.shieldAvailable;
  next.streak = { ...next.streak, count, shieldAvailable: grantedShield };
  const fresh = computeNewlyAchieved(next);
  if (fresh.length > 0) {
    next.achievedMilestones = [...next.achievedMilestones, ...fresh];
    next.pendingCelebrations = [...(next.pendingCelebrations || []), ...fresh];
  }
  return next;
}

export function DataProvider({ children }) {
  const [state, setState] = useState(() => recompute(loadState()));
  const [syncConfig, setSyncConfig] = useState(() => loadSyncConfig());
  const [syncStatus, setSyncStatus] = useState({ syncing: false, lastSyncAt: null, error: null });

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    const theme = state.settings.theme;
    if (theme === 'dark' || theme === 'light') root.dataset.theme = theme;
    else delete root.dataset.theme;
  }, [state.settings.theme]);

  const mutate = useCallback((fn) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      const result = fn(draft) || draft;
      return recompute(result);
    });
  }, []);

  const pullNow = useCallback(async () => {
    if (!syncConfig) return;
    setSyncStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      const blob = await pullCloudBlob(syncConfig.id);
      const cloudState = await decryptPayload(blob, syncConfig.pin);
      setState(recompute(mergeWithDefaults(cloudState)));
      setSyncStatus({ syncing: false, lastSyncAt: new Date().toISOString(), error: null });
    } catch (err) {
      setSyncStatus((s) => ({ ...s, syncing: false, error: err.message }));
    }
  }, [syncConfig]);

  const pushNow = useCallback(async () => {
    if (!syncConfig) return;
    setSyncStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      const payload = await encryptPayload(state, syncConfig.pin);
      await pushCloudBlob(syncConfig.id, payload);
      setSyncStatus({ syncing: false, lastSyncAt: new Date().toISOString(), error: null });
    } catch (err) {
      setSyncStatus((s) => ({ ...s, syncing: false, error: err.message }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncConfig, state]);

  // one-time pull when a device that's already paired opens the app
  const pulledOnMount = useRef(false);
  useEffect(() => {
    if (syncConfig && !pulledOnMount.current) {
      pulledOnMount.current = true;
      pullNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounced auto-push whenever data changes on a paired device
  const pushTimer = useRef(null);
  useEffect(() => {
    if (!syncConfig) return undefined;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      pushNow();
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(pushTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, syncConfig]);

  const startCloudSync = useCallback(async () => {
    setSyncStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      const pin = generatePin();
      const payload = await encryptPayload(state, pin);
      const id = await createCloudBlob(payload);
      const config = { id, pin };
      saveSyncConfig(config);
      setSyncConfig(config);
      setSyncStatus({ syncing: false, lastSyncAt: new Date().toISOString(), error: null });
      return config;
    } catch (err) {
      setSyncStatus((s) => ({ ...s, syncing: false, error: err.message }));
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const connectCloudSync = useCallback(async (id, pin) => {
    setSyncStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      const blob = await pullCloudBlob(id);
      const cloudState = await decryptPayload(blob, pin);
      const config = { id, pin };
      saveSyncConfig(config);
      setSyncConfig(config);
      setState(recompute(mergeWithDefaults(cloudState)));
      setSyncStatus({ syncing: false, lastSyncAt: new Date().toISOString(), error: null });
      return true;
    } catch (err) {
      setSyncStatus((s) => ({ ...s, syncing: false, error: err.message }));
      return false;
    }
  }, []);

  const disconnectSync = useCallback(() => {
    clearSyncConfig();
    setSyncConfig(null);
    setSyncStatus({ syncing: false, lastSyncAt: null, error: null });
  }, []);

  const actions = useMemo(
    () => ({
      addIncome: ({ date, source, amount, note }) => {
        mutate((s) => {
          s.incomeEntries.push({ id: newId(), date, source, amount: Number(amount), note: note || '' });
        });
      },
      deleteIncome: (id) => mutate((s) => { s.incomeEntries = s.incomeEntries.filter((e) => e.id !== id); }),

      upsertDailyIncome: ({ date, cash, bit, credit, transfer }) => {
        mutate((s) => {
          const values = {
            cash: Number(cash) || 0,
            bit: Number(bit) || 0,
            credit: Number(credit) || 0,
            transfer: Number(transfer) || 0,
          };
          const idx = s.dailyIncome.findIndex((e) => e.date === date);
          if (idx >= 0) s.dailyIncome[idx] = { ...s.dailyIncome[idx], ...values };
          else s.dailyIncome.push({ id: newId(), date, ...values });
        });
      },
      deleteDailyIncome: (date) => mutate((s) => { s.dailyIncome = s.dailyIncome.filter((e) => e.date !== date); }),

      addExpense: ({ date, categoryType, categoryId, amount, note, isImpulsive, isShared }) => {
        mutate((s) => {
          s.expenses.push({
            id: newId(), date, categoryType, categoryId,
            amount: Number(amount), note: note || '',
            isImpulsive: isImpulsive ?? null, isShared: !!isShared,
          });
        });
      },
      updateExpense: (id, patch) => {
        mutate((s) => {
          const idx = s.expenses.findIndex((e) => e.id === id);
          if (idx >= 0) s.expenses[idx] = { ...s.expenses[idx], ...patch };
        });
      },
      deleteExpense: (id) => mutate((s) => { s.expenses = s.expenses.filter((e) => e.id !== id); }),

      addDebtPayment: ({ date, debtId, amount }) => {
        mutate((s) => {
          s.debtPayments.push({ id: newId(), date, debtId, amount: Number(amount) });
          const debt = s.debts.find((d) => d.id === debtId);
          if (debt) {
            const paid = s.debtPayments.filter((p) => p.debtId === debtId).reduce((sum, p) => sum + p.amount, 0);
            debt.currentBalance = Math.max(0, Math.round((debt.openingBalance - paid) * 100) / 100);
            if (debt.currentBalance <= 0 && !debt.closed) {
              debt.closed = true;
              debt.closedDate = date;
            } else if (debt.currentBalance > 0) {
              debt.closed = false;
              debt.closedDate = null;
            }
          }
        });
      },
      deleteDebtPayment: (id) => {
        mutate((s) => {
          const payment = s.debtPayments.find((p) => p.id === id);
          s.debtPayments = s.debtPayments.filter((p) => p.id !== id);
          if (payment) {
            const debt = s.debts.find((d) => d.id === payment.debtId);
            if (debt) {
              const paid = s.debtPayments.filter((p) => p.debtId === debt.id).reduce((sum, p) => sum + p.amount, 0);
              debt.currentBalance = Math.max(0, Math.round((debt.openingBalance - paid) * 100) / 100);
              debt.closed = debt.currentBalance <= 0;
              if (!debt.closed) debt.closedDate = null;
            }
          }
        });
      },

      addSavingsEntry: ({ date, amount, note }) => {
        mutate((s) => {
          s.savingsEntries.push({ id: newId(), date, amount: Number(amount), note: note || '' });
        });
      },
      deleteSavingsEntry: (id) => mutate((s) => { s.savingsEntries = s.savingsEntries.filter((e) => e.id !== id); }),

      addDebt: (debt) => mutate((s) => { s.debts.push({ id: newId(), closed: false, closedDate: null, currentBalance: debt.openingBalance, accelerated: true, ...debt }); }),
      updateDebt: (id, patch) => mutate((s) => {
        const idx = s.debts.findIndex((d) => d.id === id);
        if (idx >= 0) s.debts[idx] = { ...s.debts[idx], ...patch };
      }),
      deleteDebt: (id) => mutate((s) => { s.debts = s.debts.filter((d) => d.id !== id); }),

      addTempCommitment: (commitment) => mutate((s) => { s.tempCommitments.push({ id: newId(), ...commitment }); }),
      updateTempCommitment: (id, patch) => mutate((s) => {
        const idx = s.tempCommitments.findIndex((t) => t.id === id);
        if (idx >= 0) s.tempCommitments[idx] = { ...s.tempCommitments[idx], ...patch };
      }),
      deleteTempCommitment: (id) => mutate((s) => { s.tempCommitments = s.tempCommitments.filter((t) => t.id !== id); }),

      addFixedCost: (item) => mutate((s) => { s.fixedCosts.push({ id: newId(), ...item }); }),
      updateFixedCost: (id, patch) => mutate((s) => {
        const idx = s.fixedCosts.findIndex((c) => c.id === id);
        if (idx >= 0) s.fixedCosts[idx] = { ...s.fixedCosts[idx], ...patch };
      }),
      deleteFixedCost: (id) => mutate((s) => { s.fixedCosts = s.fixedCosts.filter((c) => c.id !== id); }),

      updateEnvelope: (id, patch) => mutate((s) => {
        const idx = s.envelopes.findIndex((e) => e.id === id);
        if (idx >= 0) s.envelopes[idx] = { ...s.envelopes[idx], ...patch };
      }),
      addEnvelope: (env) => mutate((s) => { s.envelopes.push({ id: newId(), ...env }); }),
      deleteEnvelope: (id) => mutate((s) => { s.envelopes = s.envelopes.filter((e) => e.id !== id); }),

      updateSettings: (patch) => mutate((s) => { s.settings = { ...s.settings, ...patch }; }),

      logNudge: (entry) => mutate((s) => { s.nudgeLog.push({ id: newId(), date: todayISO(), response: null, ...entry }); }),
      respondToNudge: (id, response) => mutate((s) => {
        const idx = s.nudgeLog.findIndex((n) => n.id === id);
        if (idx >= 0) s.nudgeLog[idx] = { ...s.nudgeLog[idx], response };
      }),

      applyStreakShield: (dateISO) => mutate((s) => {
        if (!s.streak.shieldAvailable) return;
        s.streak.shieldUsedDates.push(dateISO);
        s.streak.shieldAvailable = false;
      }),

      dismissCelebration: () => mutate((s) => {
        s.pendingCelebrations = (s.pendingCelebrations || []).slice(1);
      }),
    }),
    [mutate],
  );

  const value = useMemo(
    () => ({ state, ...actions, syncConfig, syncStatus, startCloudSync, connectCloudSync, pushNow, pullNow, disconnectSync }),
    [state, actions, syncConfig, syncStatus, startCloudSync, connectCloudSync, pushNow, pullNow, disconnectSync],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
