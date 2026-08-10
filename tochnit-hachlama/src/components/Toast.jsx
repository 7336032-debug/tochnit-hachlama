import './Toast.css';

export default function Toast({ show, text = '✓ נשמר בהצלחה' }) {
  if (!show) return null;
  return (
    <div className="toast-overlay">
      <div className="toast-card pop">
        <div>{text}</div>
      </div>
    </div>
  );
}
