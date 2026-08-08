import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import TopBar from './components/TopBar.jsx';
import Celebration from './components/Celebration.jsx';
import Onboarding from './components/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Debts from './pages/Debts.jsx';
import Entry from './pages/Entry.jsx';
import Reports from './pages/Reports.jsx';
import Milestones from './pages/Milestones.jsx';
import Settings from './pages/Settings.jsx';
import IncomeJournal from './pages/IncomeJournal.jsx';
import { useData } from './context/DataContext.jsx';

export default function App() {
  const { state } = useData();

  if (!state.settings.onboardingComplete) {
    return <Onboarding />;
  }

  return (
    <>
      <TopBar />
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/debts" element={<Debts />} />
          <Route path="/entry" element={<Entry />} />
          <Route path="/income-journal" element={<IncomeJournal />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/milestones" element={<Milestones />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
      <NavBar />
      <Celebration />
    </>
  );
}
