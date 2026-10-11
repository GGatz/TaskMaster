async function request(method, url, body, opts = {}) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    keepalive: opts.keepalive,
  });
  if (!res.ok) {
    let message = res.statusText;
    try { message = (await res.json()).error || message; } catch { /* not JSON */ }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  tree: () => request('GET', '/api/pages'),
  trash: () => request('GET', '/api/trash'),
  emptyTrash: () => request('DELETE', '/api/trash'),
  search: (q) => request('GET', `/api/search?q=${encodeURIComponent(q)}`),
  getPage: (id) => request('GET', `/api/pages/${id}`),
  createPage: (body) => request('POST', '/api/pages', body),
  patchPage: (id, patch, opts) => request('PATCH', `/api/pages/${id}`, patch, opts),
  trashPage: (id) => request('DELETE', `/api/pages/${id}`),
  purgePage: (id) => request('DELETE', `/api/pages/${id}?permanent=1`),
  restorePage: (id) => request('POST', `/api/pages/${id}/restore`, {}),
  duplicatePage: (id) => request('POST', `/api/pages/${id}/duplicate`, {}),
  rows: (dbId) => request('GET', `/api/databases/${dbId}/rows`),
  async upload(file) {
    const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed');
    return (await res.json()).url;
  },
};
