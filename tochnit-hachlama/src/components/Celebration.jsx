import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useData } from '../context/DataContext.jsx';
import './Celebration.css';

export default function Celebration() {
  const { state, dismissCelebration } = useData();
  const current = state.pendingCelebrations?.[0] || null;
  const firedFor = useRef(null);

  useEffect(() => {
    if (!current || firedFor.current === current.key) return;
    firedFor.current = current.key;
    if (navigator.vibrate) navigator.vibrate([30, 40, 30, 40, 60]);
    const duration = 1400;
    const end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 65, origin: { x: 0, y: 0.6 }, colors: ['#8c5cf5', '#eab308', '#1f9d68'] });
      confetti({ particleCount: 4, angle: 120, spread: 65, origin: { x: 1, y: 0.6 }, colors: ['#8c5cf5', '#eab308', '#1f9d68'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [current]);

  if (!current) return null;

  return (
    <div className="celebration-overlay" role="dialog" aria-modal="true">
      <div className="celebration-card pop">
        <div className="celebration-emoji">{current.emoji}</div>
        <h2 className="celebration-title">{current.title}</h2>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={dismissCelebration}>
          יאללה, קדימה! 💪
        </button>
      </div>
    </div>
  );
}
