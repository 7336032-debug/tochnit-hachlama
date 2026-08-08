import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { loadState, saveState, newId, mergeWithDefaults } from '../lib/db.js';
import { computeBehaviorProfile } from '../lib/behaviorProfile.js';
import { computeStreakCount, nextShieldGrantAt } from '../lib/streak.js';
import { computeNewlyAchieved } from '../lib/milestones.js';
import { todayISO } from '../lib/format.js';
import { encodeStateToCode, decodeCodeToState } from '../lib/exportImport.js';
import { loadGoogleSyncConfig, saveGoogleSyncConfig, clearGoogleSyncConfig } from '../lib/googleSyncConfig.js';
import {
  requestAccessToken,
  getValidAccessToken,
  clearCachedToken,
  findOrCreateSyncFileId,
  readSyncFile,
  writeSyncFile,
} from '../lib/googleSync.js';

const DataContext = createContext(null);
const GOOGLE_SYNC_DEBOUNCE_MS = 2500;

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

  // Fully offline device-to-device transfer (no network call, nothing that
  // can be "down") - the user copies the code herself between devices.
  const exportStateCode = useCallback(() => encodeStateToCode(state), [state]);

  const importStateCode = useCallback((code) => {
    const imported = decodeCodeToState(code);
    setState(recompute(mergeWithDefaults(imported)));
  }, []);

  // ---------- automatic sync via the user's Google account ----------
  const [googleConfig, setGoogleConfig] = useState(() => loadGoogleSyncConfig());
  const [googleStatus, setGoogleStatus] = useState({ signedIn: !!loadGoogleSyncConfig(), syncing: false, lastSyncAt: null, error: null });

  const googlePullNow = useCallback(async (fileId, { silent = false } = {}) => {
    setGoogleStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      const token = silent ? await getValidAccessToken() : await requestAccessToken();
      const remote = await readSyncFile(token, fileId);
      if (remote) setState(recompute(mergeWithDefaults(remote)));
      setGoogleStatus({ signedIn: true, syncing: false, lastSyncAt: new Date().toISOString(), error: null });
      return true;
    } catch (err) {
      setGoogleStatus((s) => ({ ...s, syncing: false, error: err.message }));
      return false;
    }
  }, []);

  const googlePushNow = useCallback(async () => {
    if (!googleConfig) return;
    setGoogleStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      const token = await getValidAccessToken();
      await writeSyncFile(token, googleConfig.fileId, state);
      setGoogleStatus({ signedIn: true, syncing: false, lastSyncAt: new Date().toISOString(), error: null });
    } catch (err) {
      setGoogleStatus((s) => ({ ...s, syncing: false, error: err.message }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleConfig, state]);

  const signInWithGoogle = useCallback(async () => {
    setGoogleStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      const token = await requestAccessToken();
      const fileId = await findOrCreateSyncFileId(token);
      const config = { fileId };
      saveGoogleSyncConfig(config);
      setGoogleConfig(config);
      const remote = await readSyncFile(token, fileId);
      if (remote) {
        setState(recompute(mergeWithDefaults(remote)));
      } else {
        await writeSyncFile(token, fileId, state);
      }
      setGoogleStatus({ signedIn: true, syncing: false, lastSyncAt: new Date().toISOString(), error: null });
      return true;
    } catch (err) {
      setGoogleStatus((s) => ({ ...s, syncing: false, error: err.message }));
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const signOutGoogle = useCallback(() => {
    clearCachedToken();
    clearGoogleSyncConfig();
    setGoogleConfig(null);
    setGoogleStatus({ signedIn: false, syncing: false, lastSyncAt: null, error: null });
  }, []);

  // silent resume on app load if this device previously signed in
  const resumedOnMount = useRef(false);
  useEffect(() => {
    if (googleConfig && !resumedOnMount.current) {
      resumedOnMount.current = true;
      googlePullNow(googleConfig.fileId, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounced auto-push whenever data changes on a signed-in device
  const googlePushTimer = useRef(null);
  useEffect(() => {
    if (!googleConfig) return undefined;
    if (googlePushTimer.current) clearTimeout(googlePushTimer.current);
    googlePushTimer.current = setTimeout(() => {
      googlePushNow();
    }, GOOGLE_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(googlePushTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, googleConfig]);

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
    () => ({
      state, ...actions, exportStateCode, importStateCode,
      googleStatus, signInWithGoogle, signOutGoogle, googlePushNow,
      googlePullNow: () => googleConfig && googlePullNow(googleConfig.fileId),
    }),
    [state, actions, exportStateCode, importStateCode, googleStatus, signInWithGoogle, signOutGoogle, googlePushNow, googlePullNow, googleConfig],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
