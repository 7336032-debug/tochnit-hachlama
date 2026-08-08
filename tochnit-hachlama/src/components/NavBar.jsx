import { NavLink } from 'react-router-dom';
import './NavBar.css';

const ITEMS = [
  { to: '/', label: 'בית', emoji: '🏠', end: true },
  { to: '/debts', label: 'חובות', emoji: '💳' },
  { to: '/entry', label: 'הוספה', emoji: '➕', primary: true },
  { to: '/reports', label: 'דוחות', emoji: '📊' },
  { to: '/milestones', label: 'הישגים', emoji: '🏆' },
];

export default function NavBar() {
  return (
    <nav className="navbar" aria-label="ניווט ראשי">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `nav-item${item.primary ? ' nav-item-primary' : ''}${isActive ? ' active' : ''}`}
        >
          <span className="nav-emoji" aria-hidden="true">{item.emoji}</span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
