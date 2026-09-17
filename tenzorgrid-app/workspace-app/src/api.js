async function jsonFetch(url, options) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options && options.headers) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export const api = {
  me: () => fetch('/api/me').then((r) => r.json()),
  logout: () => fetch('/api/logout', { method: 'POST' }),
  getState: () => jsonFetch('/api/workspace/state'),
  enroll: (role, level, scheduleType) => jsonFetch('/api/workspace/enroll', { method: 'POST', body: JSON.stringify({ role, level, scheduleType }) }),
  getCatalogue: () => jsonFetch('/api/workspace/catalogue'),
  resetPreview: () => jsonFetch('/api/workspace/reset-preview'),
  resetWorkspace: () => jsonFetch('/api/workspace/reset', { method: 'POST', body: JSON.stringify({ confirm: true }) }),
  registerRoleInterest: (role) => jsonFetch('/api/workspace/role-interest', { method: 'POST', body: JSON.stringify({ role }) }),
  checkIn: () => jsonFetch('/api/workspace/checkin', { method: 'POST' }),
  submitSkillTest: (answers) => jsonFetch('/api/workspace/skill-test', { method: 'POST', body: JSON.stringify({ answers }) }),
  submitStandup: (answers, spoken) => jsonFetch('/api/workspace/standup', { method: 'POST', body: JSON.stringify({ answers, spoken }) }),
  completeActivity: (key, answer) => jsonFetch('/api/workspace/activity', { method: 'POST', body: JSON.stringify({ key, answer }) }),
  handleSituation: (key, action, text) => jsonFetch('/api/workspace/situation', { method: 'POST', body: JSON.stringify({ key, action, text }) }),
  submitQuiz: (answers) => jsonFetch('/api/workspace/quiz', { method: 'POST', body: JSON.stringify({ answers }) }),
  redoSubmission: (taskId) => jsonFetch('/api/workspace/redo', { method: 'POST', body: JSON.stringify({ taskId }) }),
  completeChore: (key, values) => jsonFetch('/api/workspace/chore', { method: 'POST', body: JSON.stringify({ key, values }) }),
  closeDay: () => jsonFetch('/api/workspace/day/close', { method: 'POST', body: '{}' }),
  startNextDay: () => jsonFetch('/api/workspace/day/next', { method: 'POST', body: '{}' }),
  timeTravel: (spec) => jsonFetch('/api/workspace/time-travel', { method: 'POST', body: JSON.stringify(spec) }),
  submitTask: (taskId, sql) => jsonFetch(`/api/workspace/tasks/${taskId}/submit`, { method: 'POST', body: JSON.stringify({ sql }) }),
  sendMessage: (archetype, body, subject) => jsonFetch('/api/workspace/messages', { method: 'POST', body: JSON.stringify({ archetype, body, subject }) }),
  toggleChecklist: (itemKey, checked) => jsonFetch('/api/workspace/checklist', { method: 'POST', body: JSON.stringify({ itemKey, checked }) }),
  startProject: (projectKey) => jsonFetch(`/api/workspace/projects/${projectKey}/start`, { method: 'POST' }),
  markEmails: (ids, patch) => jsonFetch('/api/workspace/emails/mark', { method: 'POST', body: JSON.stringify({ ids, ...patch }) }),

  // Project document + workbench.
  projectBrief: (key) => jsonFetch(`/api/workspace/projects/${key}/brief`),
  workbench: (taskId) => jsonFetch(`/api/workspace/tasks/${taskId}/workbench`),
  // Scratch execution — not graded, not rate limited, run as often as you like.
  runQuery: (taskId, sql) => jsonFetch(`/api/workspace/tasks/${taskId}/run`, { method: 'POST', body: JSON.stringify({ sql }) }),
  // The dataset as JSON, for the Python notebook to load into the interpreter.
  taskData: (taskId) => jsonFetch(`/api/workspace/tasks/${taskId}/data`),
  // Answering Asha's review question is what actually completes a task.
  answerReview: (taskId, answer) =>
    jsonFetch(`/api/workspace/tasks/${taskId}/review`, { method: 'POST', body: JSON.stringify({ answer }) }),
  // Python runs in the browser, so the result is computed client-side and sent
  // alongside the code — see the trust note in lib/workspace.js submitTask().
  submitPython: (taskId, code, result) =>
    jsonFetch(`/api/workspace/tasks/${taskId}/submit`, { method: 'POST', body: JSON.stringify({ code, result }) }),

  // ---- The management cycle ----
  timesheets: () => jsonFetch('/api/workspace/timesheets'),
  submitTimesheet: (day, values) =>
    jsonFetch('/api/workspace/timesheets/submit', { method: 'POST', body: JSON.stringify({ day, ...values }) }),
  remindTimesheet: (archetype, day) =>
    jsonFetch('/api/workspace/timesheets/remind', { method: 'POST', body: JSON.stringify({ archetype, day }) }),

  attendance: () => jsonFetch('/api/workspace/attendance'),
  // Not through jsonFetch: this one is a file, and the browser's own download is the
  // point. The URL is the same origin and the session cookie rides along.
  attendanceCsvUrl: '/api/workspace/attendance/register.csv',
  submitAttendance: (csv) =>
    jsonFetch('/api/workspace/attendance/submit', { method: 'POST', body: JSON.stringify({ csv }) }),

  appraisal: () => jsonFetch('/api/workspace/appraisal'),
  appraisalCsvUrl: '/api/workspace/appraisal/performance.csv',
  submitAppraisal: (entries) =>
    jsonFetch('/api/workspace/appraisal/submit', { method: 'POST', body: JSON.stringify({ entries }) }),
  promotePerson: (archetype, justification) =>
    jsonFetch('/api/workspace/appraisal/promote', { method: 'POST', body: JSON.stringify({ archetype, justification }) }),
};
