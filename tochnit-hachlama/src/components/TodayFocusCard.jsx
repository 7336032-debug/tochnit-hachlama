import { todayISO } from '../lib/format.js';
import './TodayFocusCard.css';

// "Habit of today" framing - deliberately about the next 24 hours only, not
// the 24-month goal. A long, distant target doesn't build daily momentum the
// way a small, doable-today task does. Message rotates by day-of-year (not
// randomly) so it's stable across re-renders within the same day.
const MESSAGES = [
  'היום צריך רק: להזין את מה שנכנס ומה שיצא. זהו. מחר נדאג למחר.',
  'משימה אחת קטנה להיום: לתעד כל הוצאה ברגע שהיא קורית. שאר החודש לא רלוונטי עכשיו.',
  'רק היום: אם עולה דחף לקנות משהו שלא תכננת, לעצור לרגע ולרשום אותו כאן קודם.',
  'המשימה של היום: לבדוק מה נכנס עד עכשיו ולוודא שהוא מתועד. זה הכול.',
];

function dayOfYear(dateISO) {
  const d = new Date(dateISO + 'T00:00:00');
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}

export default function TodayFocusCard() {
  const message = MESSAGES[dayOfYear(todayISO()) % MESSAGES.length];
  return (
    <div className="today-focus-card fade-in">
      <span className="today-focus-emoji">🌤️</span>
      <div>
        <div className="today-focus-label">ההרגל של היום</div>
        <p className="today-focus-text">{message}</p>
      </div>
    </div>
  );
}
