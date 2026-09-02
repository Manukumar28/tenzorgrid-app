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
  enroll: (level, scheduleType) => jsonFetch('/api/workspace/enroll', { method: 'POST', body: JSON.stringify({ level, scheduleType }) }),
  checkIn: () => jsonFetch('/api/workspace/checkin', { method: 'POST' }),
  submitSkillTest: (answers) => jsonFetch('/api/workspace/skill-test', { method: 'POST', body: JSON.stringify({ answers }) }),
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
};
