import { useRef, useState } from 'react';
import './SwipeRow.css';

const THRESHOLD = 56;

export default function SwipeRow({ children, onSwipeLeft, onSwipeRight, leftHint, rightHint }) {
  const startX = useRef(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  function handleStart(clientX) {
    startX.current = clientX;
    setDragging(true);
  }
  function handleMove(clientX) {
    if (startX.current == null) return;
    setDx(clientX - startX.current);
  }
  function handleEnd() {
    if (dx <= -THRESHOLD && onSwipeLeft) onSwipeLeft();
    else if (dx >= THRESHOLD && onSwipeRight) onSwipeRight();
    setDx(0);
    setDragging(false);
    startX.current = null;
  }

  return (
    <div className="swipe-row-outer">
      <div className="swipe-row-hint swipe-row-hint-start">{rightHint}</div>
      <div className="swipe-row-hint swipe-row-hint-end">{leftHint}</div>
      <div
        className="swipe-row-content"
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform 0.2s ease' }}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={handleEnd}
        onMouseDown={(e) => handleStart(e.clientX)}
        onMouseMove={(e) => { if (startX.current != null) handleMove(e.clientX); }}
        onMouseUp={handleEnd}
        onMouseLeave={() => { if (startX.current != null) handleEnd(); }}
      >
        {children}
      </div>
    </div>
  );
}
