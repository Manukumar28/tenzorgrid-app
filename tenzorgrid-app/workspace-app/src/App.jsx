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
import SkillTest from './components/SkillTest.jsx';
import Standup from './components/Standup.jsx';
import { Mic } from 'lucide-react';
import { api } from './api.js';

const ROLE_LABEL = { data_analyst: 'Data Analyst' };

export default function App() {
  const [loading, setLoading] = useState(true);
  const [learnerName, setLearnerName] = useState('');
  const [learnerPhotoUrl, setLearnerPhotoUrl] = useState(null);
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('overview');
  // A stand-up you can ignore is not a stand-up — it opens by itself, once a day, the
  // way a real one starts whether or not you feel like it. Closing it is one click, and
  // the banner is there all day if you want it back.
  const [standupOpen, setStandupOpen] = useState(false);
  const [standupSeen, setStandupSeen] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await api.me();
      if (!me.authenticated) { window.location.href = '/login.html'; return; }
      if (!me.hasProfile) { window.location.href = '/welcome.html'; return; }
      setLearnerName(((me.profile && me.profile.name) || '').split(' ')[0] || 'there');
      setLearnerPhotoUrl((me.profile && me.profile.photoUrl) || null);
      const data = await api.getState();
      setState(data.state);
      if (data.state && data.state.standup && !data.state.standup.done && !data.state.skillTest.required) {
        setStandupOpen(true);
      }
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

  // Day one is the skills check, and until it is done there is genuinely nothing else on
  // the dashboard — no project, no tasks. Showing the empty shell behind a dismissable
  // modal would just invite people to skip past it and then wonder why the board is bare.
  if (state.skillTest && state.skillTest.required) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-6">
        <SkillTest
          skillTest={state.skillTest}
          onDone={(next) => { if (next) setState(next); }}
        />
      </div>
    );
  }

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
      {standupOpen && state.standup && !state.standup.done && (
        <Standup
          standup={state.standup}
          manager={(state.roster || []).find((r) => r.archetype === 'line_manager')}
          learnerName={learnerName}
          learnerPhotoUrl={learnerPhotoUrl}
          onClose={() => { setStandupOpen(false); setStandupSeen(true); }}
          onDone={(next) => { setStandupOpen(false); setStandupSeen(true); if (next) setState(next); }}
        />
      )}
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

        {state.standup && !state.standup.done && standupSeen && (
          <button
            onClick={() => setStandupOpen(true)}
            aria-label="Open your daily stand-up"
            className="w-full flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 mb-5 text-left hover:bg-indigo-100 transition-colors"
          >
            <Mic size={16} className="text-indigo-600 shrink-0" />
            <span className="text-sm font-bold text-slate-900">
              Your stand-up with {state.standup.manager.split(' ')[0]} is still open
            </span>
            <span className="ml-auto text-xs font-bold text-indigo-600 shrink-0">{state.standup.minutes} min</span>
          </button>
        )}

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
