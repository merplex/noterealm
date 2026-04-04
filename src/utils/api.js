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
  create: (data) => request('/api/notes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/notes/${id}`, { method: 'DELETE' }),
};

export const todosApi = {
  list: () => request('/api/todos'),
  create: (data) => request('/api/todos', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/todos/${id}`, { method: 'DELETE' }),
};
