import { useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import './Onboarding.css';

export default function Onboarding() {
  const { updateSettings } = useData();
  const [values, setValues] = useState('');

  function finish() {
    updateSettings({ valuesStatement: values.trim(), onboardingComplete: true });
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card fade-in">
        <div className="onboarding-emoji">🌱</div>
        <h1>ברוכה הבאה למסלול שלך</h1>
        <p className="onboarding-sub">
          כאן תנהלי את תוכנית ההבראה הכלכלית שלך צעד-צעד. כל הנתונים כבר טעונים מראש
          לפי התוכנית שבנית - חובות, תקציבים ויעדים - ותוכלי לערוך הכל בכל רגע ב⚙️ הגדרות.
        </p>

        <div className="onboarding-facts">
          <div className="fact-pill blue">💳 219,400 ₪ חוב</div>
          <div className="fact-pill green">🎯 24 חודשים ליעד</div>
          <div className="fact-pill amber">📆 9,608 ₪ יעד חודשי לסילוק</div>
        </div>

        <label className="onboarding-label" htmlFor="values-input">
          לפני שמתחילים - למה חשוב לך לצאת מהחוב הזה? (רשות, אפשר גם אחר כך)
        </label>
        <textarea
          id="values-input"
          className="onboarding-textarea"
          placeholder="לדוגמה: כדי לישון בשקט בלילה, כדי לא להיות תלויה באף אחד..."
          value={values}
          onChange={(e) => setValues(e.target.value)}
          rows={3}
        />

        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={finish}>
          בואי נתחיל 🚀
        </button>
      </div>
    </div>
  );
}
