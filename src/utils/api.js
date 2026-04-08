const BASE = import.meta.env.VITE_API_URL ?? '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const notesApi = {
  list: () => request('/api/notes'),
  get: (id) => request(`/api/notes/${id}`),
  create: (data) => request('/api/notes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  softDelete: (id, deletedAt) => request(`/api/notes/${id}/soft-delete`, { method: 'PATCH', body: JSON.stringify({ deletedAt }) }),
  delete: (id) => request(`/api/notes/${id}`, { method: 'DELETE' }),
};

export const lineApi = {
  status: () => request('/webhook/line/status'),
  trim: (period) => request('/webhook/line/trim', { method: 'POST', body: JSON.stringify({ period }) }),
};

export const todosApi = {
  list: () => request('/api/todos'),
  create: (data) => request('/api/todos', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  softDelete: (id, deletedAt) => request(`/api/todos/${id}/soft-delete`, { method: 'PATCH', body: JSON.stringify({ deletedAt }) }),
  delete: (id) => request(`/api/todos/${id}`, { method: 'DELETE' }),
};
