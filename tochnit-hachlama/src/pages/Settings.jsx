import { useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import { exportAllToCsv } from '../lib/csvExport.js';
import { effectiveRemainingInstallments, fixedCostsTotalByType, activeEnvelopes } from '../lib/projections.js';
import { money, todayISO } from '../lib/format.js';
import SyncSection from '../components/SyncSection.jsx';
import GoogleSyncPanel from '../components/GoogleSyncPanel.jsx';
import './Settings.css';

function Section({ title, emoji, children, defaultOpen }) {
  return (
    <details className="settings-section card" open={defaultOpen}>
      <summary>
        <span>{emoji} {title}</span>
        <span className="settings-chevron">›</span>
      </summary>
      <div className="settings-section-body stack">{children}</div>
    </details>
  );
}

export default function Settings() {
  const {
    state, updateSettings, updateEnvelope, addEnvelope, deleteEnvelope,
    updateFixedCost, addFixedCost, deleteFixedCost,
    updateDebt, updateTempCommitment, addTempCommitment, deleteTempCommitment,
  } = useData();
  const [newEnvName, setNewEnvName] = useState('');
  const [newFixedName, setNewFixedName] = useState('');
  const [newFixedType, setNewFixedType] = useState('home');
  const homeCosts = state.fixedCosts.filter((c) => c.type === 'home');
  const personalCosts = state.fixedCosts.filter((c) => c.type === 'personal');

  return (
    <div className="stack">
      <Section title="עיצוב" emoji="🎨" defaultOpen>
        <div className="segmented">
          <button type="button" className={state.settings.theme === 'light' ? 'active' : ''} onClick={() => updateSettings({ theme: 'light' })}>☀️ בהיר</button>
          <button type="button" className={state.settings.theme === 'dark' ? 'active' : ''} onClick={() => updateSettings({ theme: 'dark' })}>🌙 כהה</button>
          <button type="button" className={state.settings.theme === 'system' ? 'active' : ''} onClick={() => updateSettings({ theme: 'system' })}>📱 אוטומטי</button>
        </div>
      </Section>

      <Section title="סנכרון בין מכשירים" emoji="☁️" defaultOpen>
        <GoogleSyncPanel />
        <div className="settings-divider" />
        <SyncSection />
      </Section>

      <Section title="למה חשוב לי לצאת מהחוב" emoji="💛">
        <textarea
          className="onboarding-textarea"
          rows={3}
          defaultValue={state.settings.valuesStatement}
          onBlur={(e) => updateSettings({ valuesStatement: e.target.value })}
        />
      </Section>

      <Section title="הוצאות לא קבועות (שכבה 3)" emoji="💌" defaultOpen>
        {activeEnvelopes(state).map((env) => (
          <div className="settings-row" key={env.id}>
            <span className="settings-row-emoji">{env.emoji}</span>
            <input
              className="settings-text-input"
              defaultValue={env.name}
              onBlur={(e) => updateEnvelope(env.id, { name: e.target.value })}
            />
            <input
              type="number"
              className="settings-number-input"
              defaultValue={env.monthlyBudget}
              onBlur={(e) => updateEnvelope(env.id, { monthlyBudget: Number(e.target.value) || 0, needsSetup: false })}
            />
            <button type="button" className="icon-btn" onClick={() => deleteEnvelope(env.id)}>🗑️</button>
          </div>
        ))}
        <div className="settings-add-row">
          <input className="settings-text-input" placeholder="שם הוצאה חדשה" value={newEnvName} onChange={(e) => setNewEnvName(e.target.value)} />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { if (newEnvName.trim()) { addEnvelope({ emoji: '🏷️', name: newEnvName.trim(), monthlyBudget: 0 }); setNewEnvName(''); } }}
          >
            + הוספה
          </button>
        </div>
      </Section>

      <Section title="הוצאות קבועות" emoji="🏠" defaultOpen>
        <div className="fixed-costs-group">
          <div className="fixed-costs-group-title">
            <span>🏠 בית</span>
            <span className="muted num">{money(fixedCostsTotalByType(state, 'home'))}</span>
          </div>
          {homeCosts.map((c) => (
            <div className="settings-row" key={c.id}>
              <span className="settings-row-emoji">{c.emoji}</span>
              <input className="settings-text-input" defaultValue={c.name} onBlur={(e) => updateFixedCost(c.id, { name: e.target.value })} />
              <input
                type="number"
                className="settings-number-input"
                defaultValue={c.amount}
                onBlur={(e) => updateFixedCost(c.id, { amount: Number(e.target.value) || 0 })}
              />
              <button type="button" className="icon-btn" onClick={() => deleteFixedCost(c.id)}>🗑️</button>
            </div>
          ))}
        </div>
        <div className="fixed-costs-group">
          <div className="fixed-costs-group-title">
            <span>🙋 אישי</span>
            <span className="muted num">{money(fixedCostsTotalByType(state, 'personal'))}</span>
          </div>
          {personalCosts.map((c) => (
            <div className="settings-row" key={c.id}>
              <span className="settings-row-emoji">{c.emoji}</span>
              <input className="settings-text-input" defaultValue={c.name} onBlur={(e) => updateFixedCost(c.id, { name: e.target.value })} />
              <input
                type="number"
                className="settings-number-input"
                defaultValue={c.amount}
                onBlur={(e) => updateFixedCost(c.id, { amount: Number(e.target.value) || 0 })}
              />
              <button type="button" className="icon-btn" onClick={() => deleteFixedCost(c.id)}>🗑️</button>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12.5 }}>
          תשלומי המינימום להלוואות מנוהלים בנפרד במסך "חובות" למטה - הם לא נספרים כאן כדי לא לספור אותם פעמיים.
        </p>
        <div className="settings-add-row">
          <select className="settings-text-input" value={newFixedType} onChange={(e) => setNewFixedType(e.target.value)} style={{ flex: '0 0 90px' }}>
            <option value="home">בית</option>
            <option value="personal">אישי</option>
          </select>
          <input className="settings-text-input" placeholder="הוצאה קבועה חדשה" value={newFixedName} onChange={(e) => setNewFixedName(e.target.value)} />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { if (newFixedName.trim()) { addFixedCost({ emoji: '📌', type: newFixedType, name: newFixedName.trim(), amount: 0 }); setNewFixedName(''); } }}
          >
            + הוספה
          </button>
        </div>
      </Section>

      <Section title="חובות" emoji="💳">
        {state.debts.map((d) => (
          <div className="debt-settings-block" key={d.id}>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="settings-row-emoji">{d.emoji}</span>
              <input className="settings-text-input" defaultValue={d.name} onBlur={(e) => updateDebt(d.id, { name: e.target.value })} />
            </div>
            <div className="grid-2">
              <label className="settings-field">
                <span>יתרה נוכחית</span>
                <input type="number" defaultValue={d.currentBalance} onBlur={(e) => updateDebt(d.id, { currentBalance: Number(e.target.value) || 0 })} />
              </label>
              <label className="settings-field">
                <span>ריבית שנתית (%)</span>
                <input type="number" step="0.1" defaultValue={d.annualRatePct} onBlur={(e) => updateDebt(d.id, { annualRatePct: Number(e.target.value) || 0 })} />
              </label>
              <label className="settings-field">
                <span>מינימום חודשי</span>
                <input type="number" defaultValue={d.minMonthlyPayment} onBlur={(e) => updateDebt(d.id, { minMonthlyPayment: Number(e.target.value) || 0 })} />
              </label>
              <label className="settings-field">
                <span>סדר עדיפות</span>
                <input type="number" defaultValue={d.priority} onBlur={(e) => updateDebt(d.id, { priority: Number(e.target.value) || 1 })} />
              </label>
            </div>
            <label className="shared-toggle" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={d.accelerated} onChange={(e) => updateDebt(d.id, { accelerated: e.target.checked })} />
              מקבל תוספת האצה משכבה 2
            </label>
          </div>
        ))}
      </Section>

      <Section title="התחייבויות זמניות" emoji="⏳">
        {state.tempCommitments.map((t) => {
          const remaining = effectiveRemainingInstallments(state, t, todayISO());
          return (
            <div className="settings-row" key={t.id}>
              <span className="settings-row-emoji">{t.emoji}</span>
              <input className="settings-text-input" defaultValue={t.name} onBlur={(e) => updateTempCommitment(t.id, { name: e.target.value })} />
              <input
                type="number"
                className="settings-number-input"
                defaultValue={t.amount}
                onBlur={(e) => updateTempCommitment(t.id, { amount: Number(e.target.value) || 0 })}
              />
              <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{remaining} נותרו</span>
              <button type="button" className="icon-btn" onClick={() => deleteTempCommitment(t.id)}>🗑️</button>
            </div>
          );
        })}
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => addTempCommitment({ emoji: '🧾', name: 'התחייבות חדשה', amount: 0, totalInstallments: 1, remainingAtStart: 1 })}
        >
          + הוספת התחייבות זמנית
        </button>
      </Section>

      <Section title="יעדים כלליים" emoji="🎯">
        <label className="settings-field">
          <span>יעד חודשי לסילוק חוב (שכבה 2)</span>
          <input type="number" defaultValue={state.settings.layer2MonthlyTarget} onBlur={(e) => updateSettings({ layer2MonthlyTarget: Number(e.target.value) || 0 })} />
        </label>
        <label className="settings-field">
          <span>תוספת מואצת חודשית (מעבר למינימום)</span>
          <input type="number" defaultValue={state.settings.layer2ExtraAllocation} onBlur={(e) => updateSettings({ layer2ExtraAllocation: Number(e.target.value) || 0 })} />
        </label>
        <label className="settings-field">
          <span>יעד חיסכון חודשי (שכבה 4)</span>
          <input type="number" defaultValue={state.settings.savingsMonthlyTarget} onBlur={(e) => updateSettings({ savingsMonthlyTarget: Number(e.target.value) || 0 })} />
        </label>
        <label className="settings-field">
          <span>יעד הכנסה חודשי מהעסק</span>
          <input type="number" defaultValue={state.settings.businessMonthlyTarget} onBlur={(e) => updateSettings({ businessMonthlyTarget: Number(e.target.value) || 0 })} />
        </label>
      </Section>

      <Section title="ייצוא נתונים" emoji="📤">
        <p className="muted" style={{ fontSize: 13.5 }}>ייצוא כל הנתונים שלך (הוצאות, הכנסות, תשלומים, חובות) לקובץ CSV.</p>
        <button type="button" className="btn btn-primary btn-block" onClick={() => exportAllToCsv(state)}>⬇️ ייצוא ל-CSV</button>
      </Section>
    </div>
  );
}
