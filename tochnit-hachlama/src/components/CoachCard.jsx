import { useEffect } from 'react';
import { useData } from '../context/DataContext.jsx';
import { selectDailyNudge, todaysNudgeLogEntry } from '../lib/nudges.js';
import './CoachCard.css';

const TECHNIQUE_EMOJI = {
  if_then: '🧭',
  loss_framing: '⏳',
  future_self: '🌅',
  commitment: '🤝',
  streak: '🔥',
  values: '💛',
  pattern: '🔎',
};

export default function CoachCard() {
  const { state, logNudge, respondToNudge } = useData();
  const entry = todaysNudgeLogEntry(state);

  useEffect(() => {
    if (entry) return;
    const nudge = selectDailyNudge(state);
    if (nudge) logNudge(nudge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, state.expenses.length, state.incomeEntries.length]);

  if (!entry) return null;

  const answered = entry.response != null;

  return (
    <div className="coach-card fade-in">
      <div className="coach-icon">{TECHNIQUE_EMOJI[entry.techniqueId] || '💪'}</div>
      <div className="coach-body">
        <div className="coach-label">המאמן היומי שלך</div>
        <p className="coach-text">{entry.text}</p>
        {!answered ? (
          <div className="coach-actions">
            <button type="button" className="btn btn-secondary" onClick={() => respondToNudge(entry.id, 'helpful')}>
              👍 עזר לי
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => respondToNudge(entry.id, 'not_relevant')}>
              🤷 לא רלוונטי
            </button>
          </div>
        ) : (
          <div className="coach-thanks muted">תודה על המשוב! 🙏</div>
        )}
      </div>
    </div>
  );
}
