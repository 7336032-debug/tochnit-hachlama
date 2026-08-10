import { useData } from '../context/DataContext.jsx';
import './NoticeBanner.css';

export default function NoticeBanner() {
  const { state, dismissNotice } = useData();
  const notice = state.pendingNotices?.[0] || null;
  if (!notice) return null;

  return (
    <div className="notice-banner fade-in card">
      <span className="notice-banner-emoji">{notice.emoji}</span>
      <div className="notice-banner-body">
        <div className="notice-banner-title">{notice.title}</div>
        <p className="notice-banner-text">{notice.body}</p>
      </div>
      <button type="button" className="icon-btn" aria-label="סגירה" onClick={() => dismissNotice(notice.id)}>✕</button>
    </div>
  );
}
