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
  submitTask: (taskId, sql) => jsonFetch(`/api/workspace/tasks/${taskId}/submit`, { method: 'POST', body: JSON.stringify({ sql }) }),
  sendMessage: (archetype, body, subject) => jsonFetch('/api/workspace/messages', { method: 'POST', body: JSON.stringify({ archetype, body, subject }) }),
  toggleChecklist: (itemKey, checked) => jsonFetch('/api/workspace/checklist', { method: 'POST', body: JSON.stringify({ itemKey, checked }) }),
  startProject: (projectKey) => jsonFetch(`/api/workspace/projects/${projectKey}/start`, { method: 'POST' }),
  markEmails: (ids, patch) => jsonFetch('/api/workspace/emails/mark', { method: 'POST', body: JSON.stringify({ ids, ...patch }) }),
};
