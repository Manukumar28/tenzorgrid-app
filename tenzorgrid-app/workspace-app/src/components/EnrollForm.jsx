import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';

export default function EnrollForm({ onEnrolled }) {
  const [level, setLevel] = useState('junior');
  const [scheduleType, setScheduleType] = useState('weekdays');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const data = await api.enroll(level, scheduleType);
      onEnrolled(data.state);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-white border border-gray-100 rounded-xl shadow-md p-8 w-full max-w-md"
      >
        <h2 className="text-xl font-extrabold text-gray-900">Start your Virtual Workspace</h2>
        <p className="text-sm text-gray-400 mt-2 mb-6">
          Data Analyst is the only role in early access right now — real tasks, a Line Manager who grades your work, and a real team around you.
        </p>

        <label className="block text-xs font-bold text-gray-500 mb-1.5">Level</label>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-4">
          <option value="junior">Junior — more hand-holding, slower ramp</option>
          <option value="senior">Senior — less hand-holding, higher quality bar</option>
        </select>

        <label className="block text-xs font-bold text-gray-500 mb-1.5">Training schedule</label>
        <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-4">
          <option value="weekdays">Weekdays</option>
          <option value="weekends">Weekends (Saturday + Sunday)</option>
          <option value="custom">Custom days</option>
        </select>

        <div className="bg-indigo-50 text-indigo-700 text-xs rounded-lg px-4 py-3 mb-5">
          Free while Virtual Workspace is in early access. A minimum of 3 months of hands-on experience is required before a certificate becomes eligible — same for every schedule.
        </div>

        {error && <div className="text-red-500 text-xs mb-3">{error}</div>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg py-2.5 transition-colors disabled:opacity-60"
        >
          {busy ? 'Starting…' : 'Start as a Data Analyst →'}
        </button>
      </motion.div>
    </div>
  );
}
