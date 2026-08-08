import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import { computeBusinessPace, computeBusinessForecast, businessForecastShortfall } from '../lib/dailyIncome.js';
import { suggestedActionsForGap } from '../lib/projections.js';
import { money, todayISO, monthKey, clamp } from '../lib/format.js';
import './BusinessPaceCard.css';

export default function BusinessPaceCard() {
  const { state } = useData();
  const today = todayISO();
  const mKey = monthKey(today);
  const pace = computeBusinessPace(state, today);
  const forecast = computeBusinessForecast(state, today);
  const shortfall = businessForecastShortfall(state, today);

  const paceColor = pace.ratio >= 1 ? 'green' : pace.ratio >= 0.7 ? 'amber' : 'red';
  const paceColorVar = pace.ratio >= 1 ? 'var(--green)' : pace.ratio >= 0.7 ? 'var(--amber)' : 'var(--red)';
  const actions = shortfall ? suggestedActionsForGap(state, shortfall.gap, mKey) : [];

  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 8 }}>
        <strong>💅 קצב הכנסות מהעסק</strong>
        <span className={`pill ${paceColor}`}>{Math.round(pace.ratio * 100)}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${clamp(pace.ratio * 100, 0, 100)}%`, background: paceColorVar }} />
      </div>
      <div className="row-between envelope-meta">
        <span className="muted num">נכנס עד היום: {money(pace.totalSoFar)}</span>
        <span className="muted num">יעד יחסי ליום {pace.dIndex}: {money(Math.round(pace.proratedTarget))}</span>
      </div>

      <div className="business-forecast-box">
        {forecast.hasData ? (
          <p>
            📈 בקצב הנוכחי, צפי לסוף החודש:{' '}
            <b className="num">
              {forecast.low === forecast.high ? money(forecast.low) : `${money(forecast.low)} - ${money(forecast.high)}`}
            </b>
            {forecast.workDaysSoFar < 3 && <span className="muted"> (עוד מוקדם, מעט נתונים)</span>}
          </p>
        ) : (
          <p className="muted">עוד אין מספיק נתונים החודש כדי להעריך צפי - כל יום עבודה שתזיני משפר את הדיוק.</p>
        )}

        {shortfall && (
          <div className="business-shortfall-note">
            <p>
              ⚠️ גם התרחיש השמרני נמוך מהיעד הדרוש לסילוק החוב החודשי ({money(shortfall.target)}) -
              חסר בערך <b className="num">{money(shortfall.gap)}</b>.
            </p>
            <ul className="pace-actions">
              <li>לשקול ימי עבודה נוספים החודש</li>
              {actions.slice(0, 2).map((a) => (
                <li key={a.id}>{a.text}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Link to="/income-journal" className="btn btn-secondary btn-block" style={{ marginTop: 10 }}>
        📅 יומן הכנסות מלא
      </Link>
    </div>
  );
}
