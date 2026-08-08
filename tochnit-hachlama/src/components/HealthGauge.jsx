import './HealthGauge.css';

function colorFor(score) {
  if (score >= 8) return 'var(--green)';
  if (score >= 5) return 'var(--amber)';
  return 'var(--red)';
}

export default function HealthGauge({ score }) {
  const pct = (score / 10) * 100;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const color = colorFor(score);

  return (
    <div className="health-gauge">
      <svg viewBox="0 0 110 110" className="health-gauge-svg">
        <circle cx="55" cy="55" r={radius} className="health-gauge-track" />
        <circle
          cx="55" cy="55" r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="health-gauge-fill"
        />
      </svg>
      <div className="health-gauge-center">
        <div className="health-gauge-score" style={{ color }}>{score}</div>
        <div className="health-gauge-label">עמידה בתוכנית</div>
      </div>
    </div>
  );
}
