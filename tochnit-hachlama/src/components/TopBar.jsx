import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import './TopBar.css';

export default function TopBar() {
  const { state } = useData();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-title">
          <span aria-hidden="true">🧭</span> המסלול שלי
        </div>
        <div className="topbar-actions">
          {state.streak.count > 0 && (
            <div className="topbar-streak pill amber" title="רצף ימים בתקציב">
              <span aria-hidden="true">🔥</span> {state.streak.count}
            </div>
          )}
          <Link to="/settings" className="icon-btn topbar-settings" aria-label="הגדרות">
            ⚙️
          </Link>
        </div>
      </div>
    </header>
  );
}
