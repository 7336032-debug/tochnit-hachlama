import { Link } from 'react-router-dom';
import './StatRing.css';

function colorFor(ratio) {
  if (ratio >= 1) return 'var(--green)';
  if (ratio >= 0.7) return 'var(--amber)';
  return 'var(--red)';
}

export default function StatRing({ emoji, label, ratio, displayValue, to }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, ratio));
  const offset = circumference * (1 - clamped);
  const color = colorFor(ratio);

  const content = (
    <>
      <div className="stat-ring">
        <svg viewBox="0 0 64 64" className="stat-ring-svg">
          <circle cx="32" cy="32" r={radius} className="stat-ring-track" />
          <circle
            cx="32" cy="32" r={radius}
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="stat-ring-fill"
          />
        </svg>
        <div className="stat-ring-center">
          <span aria-hidden="true">{emoji}</span>
        </div>
      </div>
      <div className="stat-ring-value num" style={{ color }}>{displayValue}</div>
      <div className="stat-ring-label">{label}</div>
    </>
  );

  if (to) {
    return <Link to={to} className="stat-ring-item">{content}</Link>;
  }
  return <div className="stat-ring-item">{content}</div>;
}
