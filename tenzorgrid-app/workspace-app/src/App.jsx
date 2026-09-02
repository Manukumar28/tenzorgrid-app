import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import Overview from './components/Overview.jsx';
import Projects from './components/Projects.jsx';
import Tasks from './components/Tasks.jsx';
import CalendarTab from './components/CalendarTab.jsx';
import Emails from './components/Emails.jsx';
import Team from './components/Team.jsx';
import SettingsTab from './components/SettingsTab.jsx';
import EnrollForm from './components/EnrollForm.jsx';
import { api } from './api.js';

const ROLE_LABEL = { data_analyst: 'Data Analyst' };

export default function App() {
  const [loading, setLoading] = useState(true);
  const [learnerName, setLearnerName] = useState('');
  const [learnerPhotoUrl, setLearnerPhotoUrl] = useState(null);
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    (async () => {
      const me = await api.me();
      if (!me.authenticated) { window.location.href = '/login.html'; return; }
      if (!me.hasProfile) { window.location.href = '/welcome.html'; return; }
      setLearnerName(((me.profile && me.profile.name) || '').split(' ')[0] || 'there');
      setLearnerPhotoUrl((me.profile && me.profile.photoUrl) || null);
      const data = await api.getState();
      setState(data.state);
      setLoading(false);
    })();
  }, []);

  async function logout() {
    await api.logout();
    window.location.href = '/login.html';
  }

  async function toggleCheckIn() {
    const data = await api.checkIn();
    setState(data.state);
  }

  if (loading) return null;
  if (!state) return <EnrollForm onEnrolled={setState} />;

  const roleLabel = `${state.enrollment.level === 'senior' ? 'Senior' : 'Junior'} ${ROLE_LABEL[state.enrollment.role] || 'Data Analyst'}`;
  const pendingCount = state.tasks.filter((t) => t.status === 'assigned').length;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        tab={tab}
        onTab={setTab}
        roleLabel={(ROLE_LABEL[state.enrollment.role] || 'Data Analyst').toUpperCase()}
        levelLabel={state.enrollment.level === 'senior' ? 'Senior' : 'Junior'}
        onLogout={logout}
        unreadCount={state.inbox ? state.inbox.counts.unread : 0}
      />
      <main className="flex-1 min-w-0 px-6 md:px-8 py-6">
        <Header
          name={learnerName}
          photoUrl={learnerPhotoUrl}
          roleLabel={roleLabel}
          checkedIn={state.attendance.checkedInToday}
          onToggleCheckIn={toggleCheckIn}
          onLogout={logout}
          pendingCount={pendingCount}
        />

        {tab === 'overview' && <Overview state={state} learnerName={learnerName} learnerPhotoUrl={learnerPhotoUrl} onStateChange={setState} />}
        {tab === 'projects' && <Projects state={state} onStateChange={setState} onTab={setTab} />}
        {tab === 'tasks' && <Tasks state={state} learnerName={learnerName} learnerPhotoUrl={learnerPhotoUrl} onStateChange={setState} />}
        {tab === 'calendar' && <CalendarTab state={state} />}
        {tab === 'emails' && <Emails state={state} onStateChange={setState} />}
        {tab === 'team' && <Team state={state} onStateChange={setState} onTab={setTab} />}
        {tab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}
