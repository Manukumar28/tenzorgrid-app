import React, { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import Overview from './components/Overview.jsx';
import Projects from './components/Projects.jsx';
import Tasks from './components/Tasks.jsx';
import CalendarTab from './components/CalendarTab.jsx';
import Today from './components/Today.jsx';
import Emails from './components/Emails.jsx';
import Team from './components/Team.jsx';
import Timesheets from './components/Timesheets.jsx';
import SettingsTab from './components/SettingsTab.jsx';
import EnrollForm from './components/EnrollForm.jsx';
import SkillTest from './components/SkillTest.jsx';
import Standup from './components/Standup.jsx';
import ChatDock from './components/ChatDock.jsx';
import { Mic } from 'lucide-react';
import { api } from './api.js';
import { announceArrivals, countMessages, armSound } from './sound.js';


export default function App() {
  const [loading, setLoading] = useState(true);
  const [learnerName, setLearnerName] = useState('');
  const [learnerPhotoUrl, setLearnerPhotoUrl] = useState(null);
  const [state, setRawState] = useState(null);
  // Every path that changes state goes through here, so anything that arrives makes a
  // noise without each caller having to remember to ring a bell. Counting messages rather
  // than being told what happened means a manager's review, a newsletter and a chat line
  // are all covered by the same four lines.
  const heard = useRef(null);
  const setState = useCallback((next) => {
    if (!next) heard.current = null;
    if (next) {
      const counts = countMessages(next);
      if (heard.current) announceArrivals(heard.current, counts);
      heard.current = counts;
    }
    setRawState(next);
  }, []);
  const [tab, setTab] = useState('overview');
  // A stand-up you can ignore is not a stand-up — it opens by itself, once a day, the
  // way a real one starts whether or not you feel like it. Closing it is one click, and
  // the banner is there all day if you want it back.
  const [standupOpen, setStandupOpen] = useState(false);
  const [standupSeen, setStandupSeen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Lifted so the Tasks tab can open a conversation — the sign-off pointer there needs
  // to be able to bring the manager's window up.
  const [chatWith, setChatWith] = useState(null);
  // Typing habits, not account data — they belong to the machine you type on.
  const [prefs, setPrefs] = useState(() => {
    try { return { enterToSend: true, ...JSON.parse(localStorage.getItem('tg.prefs') || '{}') }; }
    catch { return { enterToSend: true }; }
  });
  function savePrefs(next) {
    setPrefs(next);
    try { localStorage.setItem('tg.prefs', JSON.stringify(next)); } catch { /* private window */ }
  }

  // Browsers will not make a sound until the page has been interacted with, which is
  // correct and not worth fighting. The audio context is created on the first click or
  // key press and never again.
  useEffect(() => {
    const arm = () => armSound();
    window.addEventListener('pointerdown', arm, { once: true });
    window.addEventListener('keydown', arm, { once: true });
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, []);

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
          timeTravel={state.timeTravel}
          onDone={(next) => { if (next) setState(next); }}
        />
      </div>
    );
  }

  const roleLabel = state.enrollment.levelTitle || state.enrollment.roleLabel || 'Data Analyst';
  const pendingCount = state.tasks.filter((t) => t.status === 'assigned').length;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        tab={tab}
        onTab={setTab}
        roleLabel={(state.enrollment.roleLabel || 'Data Analyst').toUpperCase()}
        levelLabel={state.enrollment.levelTitle || ''}
        level={state.enrollment.level}
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
      <main className="flex-1 min-w-0 w-full px-4 sm:px-6 md:px-8 py-5 sm:py-6">
        <Header
          name={learnerName}
          photoUrl={learnerPhotoUrl}
          roleLabel={roleLabel}
          checkedIn={state.attendance.checkedInToday}
          onToggleCheckIn={toggleCheckIn}
          onLogout={logout}
          pendingCount={pendingCount}
          onOpenMenu={() => setMenuOpen(true)}
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
        {tab === 'today' && <Today state={state} onStateChange={setState} onTab={setTab} />}
        {tab === 'projects' && <Projects state={state} onStateChange={setState} onTab={setTab} />}
        {tab === 'tasks' && <Tasks state={state} learnerName={learnerName} learnerPhotoUrl={learnerPhotoUrl} onStateChange={setState} onOpenChat={(a) => setChatWith({ archetype: a, at: Date.now() })} />}
        {tab === 'calendar' && <CalendarTab state={state} />}
        {tab === 'emails' && <Emails state={state} onStateChange={setState} />}
        {tab === 'team' && <Team state={state} onStateChange={setState} onTab={setTab} />}
        {tab === 'timesheets' && <Timesheets state={state} onStateChange={setState} />}
        {tab === 'settings' && <SettingsTab prefs={prefs} onPrefs={savePrefs} timeTravel={state.timeTravel} onStateChange={setState} />}
      </main>

      {/* Always reachable, deliberately outside the tab system: you ask a colleague a
          question WHILE you are stuck in the workbench, not by navigating away from it. */}
      <ChatDock state={state} onStateChange={setState} enterToSend={prefs.enterToSend} openWith={chatWith} />
    </div>
  );
}
