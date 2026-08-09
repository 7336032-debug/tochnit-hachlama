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
import { loadSupabaseSyncConfig, saveSupabaseSyncConfig, clearSupabaseSyncConfig } from '../lib/supabaseSyncConfig.js';
import { generatePin, connectOrCreateHousehold, fetchHouseholdState, upsertHouseholdState } from '../lib/supabaseSync.js';

const DataContext = createContext(null);
const GOOGLE_SYNC_DEBOUNCE_MS = 2500;
const GOOGLE_AUTO_PULL_INTERVAL_MS = 20000;
const SUPABASE_SYNC_DEBOUNCE_MS = 1500;
// No realtime websocket here (see supabaseSync.js) - fast polling instead
const SUPABASE_POLL_INTERVAL_MS = 4000;

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
  const googlePushPending = useRef(false);
  useEffect(() => {
    if (!googleConfig) return undefined;
    googlePushPending.current = true;
    if (googlePushTimer.current) clearTimeout(googlePushTimer.current);
    googlePushTimer.current = setTimeout(() => {
      googlePushNow().finally(() => { googlePushPending.current = false; });
    }, GOOGLE_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(googlePushTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, googleConfig]);

  // periodic + on-return auto-pull, so changes made on another device show up
  // here without needing a manual reload - skipped while a local edit is
  // still waiting to be pushed, so it never clobbers unsaved local changes
  useEffect(() => {
    if (!googleConfig) return undefined;
    const tryPull = () => {
      if (document.visibilityState !== 'visible') return;
      if (googlePushPending.current) return;
      googlePullNow(googleConfig.fileId, { silent: true });
    };
    document.addEventListener('visibilitychange', tryPull);
    window.addEventListener('focus', tryPull);
    const interval = setInterval(tryPull, GOOGLE_AUTO_PULL_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', tryPull);
      window.removeEventListener('focus', tryPull);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleConfig]);

  // ---------- automatic sync via a shared Supabase household code ----------
  const [supabaseConfig, setSupabaseConfig] = useState(() => loadSupabaseSyncConfig());
  const [supabaseStatus, setSupabaseStatus] = useState({
    connected: !!loadSupabaseSyncConfig(),
    syncing: false,
    lastSyncAt: null,
    error: null,
  });

  const connectSupabase = useCallback(async (pin) => {
    const cleanPin = (pin || '').trim().toUpperCase();
    if (!cleanPin) return false;
    setSupabaseStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      // atomic: creates the household seeded with local state if this pin
      // is new, or returns the existing household's data if it already
      // exists - no separate fetch-then-maybe-create race
      const remote = await connectOrCreateHousehold(cleanPin, state);
      setState(recompute(mergeWithDefaults(remote)));
      const config = { pin: cleanPin };
      saveSupabaseSyncConfig(config);
      setSupabaseConfig(config);
      setSupabaseStatus({ connected: true, syncing: false, lastSyncAt: new Date().toISOString(), error: null });
      return true;
    } catch (err) {
      setSupabaseStatus((s) => ({ ...s, syncing: false, error: err.message }));
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const createHousehold = useCallback(() => connectSupabase(generatePin()), [connectSupabase]);

  const disconnectSupabase = useCallback(() => {
    clearSupabaseSyncConfig();
    setSupabaseConfig(null);
    setSupabaseStatus({ connected: false, syncing: false, lastSyncAt: null, error: null });
  }, []);

  const supabasePushNow = useCallback(async () => {
    if (!supabaseConfig) return;
    setSupabaseStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      await upsertHouseholdState(supabaseConfig.pin, state);
      setSupabaseStatus({ connected: true, syncing: false, lastSyncAt: new Date().toISOString(), error: null });
    } catch (err) {
      setSupabaseStatus((s) => ({ ...s, syncing: false, error: err.message }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseConfig, state]);

  // debounced auto-push whenever data changes on a connected device
  const supabasePushTimer = useRef(null);
  const supabasePushPending = useRef(false);
  useEffect(() => {
    if (!supabaseConfig) return undefined;
    supabasePushPending.current = true;
    if (supabasePushTimer.current) clearTimeout(supabasePushTimer.current);
    supabasePushTimer.current = setTimeout(() => {
      supabasePushNow().finally(() => { supabasePushPending.current = false; });
    }, SUPABASE_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(supabasePushTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, supabaseConfig]);

  // Fast polling instead of a realtime websocket - the secure RPC functions
  // (see supabaseSync.js) don't allow direct table SELECT, which is what
  // postgres_changes subscriptions require. Skipped while a local edit is
  // still queued to push, so it can't clobber unsaved local changes.
  useEffect(() => {
    if (!supabaseConfig) return undefined;
    const tryPull = async () => {
      if (document.visibilityState !== 'visible') return;
      if (supabasePushPending.current) return;
      try {
        const remote = await fetchHouseholdState(supabaseConfig.pin);
        setState(recompute(mergeWithDefaults(remote)));
        setSupabaseStatus({ connected: true, syncing: false, lastSyncAt: new Date().toISOString(), error: null });
      } catch (err) {
        setSupabaseStatus((s) => ({ ...s, error: err.message }));
      }
    };
    document.addEventListener('visibilitychange', tryPull);
    window.addEventListener('focus', tryPull);
    const interval = setInterval(tryPull, SUPABASE_POLL_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', tryPull);
      window.removeEventListener('focus', tryPull);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseConfig]);

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
      supabaseConfig, supabaseStatus, createHousehold, connectSupabase, disconnectSupabase, supabasePushNow,
    }),
    [
      state, actions, exportStateCode, importStateCode,
      googleStatus, signInWithGoogle, signOutGoogle, googlePushNow, googlePullNow, googleConfig,
      supabaseConfig, supabaseStatus, createHousehold, connectSupabase, disconnectSupabase, supabasePushNow,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
