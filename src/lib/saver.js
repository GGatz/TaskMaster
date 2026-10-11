// Debounced, per-page write-behind queue. Edits are merged shallowly per page and flushed
// after a short pause, on navigation, and when the tab is hidden. Failures retry with backoff.

import { api } from './api.js';

const DELAY = 500;
const pending = new Map(); // id -> { patch, timer, inflight, attempts }
const listeners = new Set();
let status = 'saved'; // 'saved' | 'saving' | 'error'

function setStatus(next) {
  if (status === next) return;
  status = next;
  listeners.forEach((fn) => fn(status));
}

function refreshStatus() {
  if ([...pending.values()].some((e) => e.error)) return setStatus('error');
  if (pending.size) return setStatus('saving');
  setStatus('saved');
}

async function send(id, keepalive = false) {
  const entry = pending.get(id);
  if (!entry || entry.inflight) return;
  clearTimeout(entry.timer);
  if (entry.hold) {
    entry.inflight = true;
    try { await entry.hold; } catch { pending.delete(id); refreshStatus(); return; } finally { entry.inflight = false; }
    entry.hold = null;
  }
  const patch = entry.patch;
  entry.patch = {};
  entry.sent = patch;
  entry.inflight = true;
  try {
    await api.patchPage(id, patch, { keepalive });
    entry.error = false;
    entry.attempts = 0;
  } catch (err) {
    // Re-queue what failed underneath anything newer, unless the page is gone.
    if (err.status === 404) {
      pending.delete(id);
      return refreshStatus();
    }
    entry.patch = { ...patch, ...entry.patch };
    entry.error = true;
    entry.attempts += 1;
    entry.timer = setTimeout(() => send(id), Math.min(30000, 1000 * 2 ** entry.attempts));
  } finally {
    entry.inflight = false;
    entry.sent = null;
  }
  if (!entry.error && Object.keys(entry.patch).length) await send(id);
  else if (!entry.error) pending.delete(id);
  refreshStatus();
}

export const saver = {
  queue(id, patch) {
    let entry = pending.get(id);
    if (!entry) {
      entry = { patch: {}, timer: null, inflight: false, attempts: 0, error: false };
      pending.set(id, entry);
    }
    entry.patch = { ...entry.patch, ...patch };
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => send(id), DELAY);
    refreshStatus();
  },
  /** Delay all writes for `id` until `promise` settles (used while the page is still being created). */
  hold(id, promise) {
    let entry = pending.get(id);
    if (!entry) {
      entry = { patch: {}, timer: null, inflight: false, attempts: 0, error: false };
      pending.set(id, entry);
    }
    entry.hold = promise;
    promise.then(() => { if (!Object.keys(entry.patch).length && !entry.inflight && entry.hold === promise) { entry.hold = null; pending.delete(id); refreshStatus(); } }, () => {});
  },
  flush(id, keepalive = false) {
    return send(id, keepalive);
  },
  flushAll(keepalive = false) {
    return Promise.all([...pending.keys()].map((id) => send(id, keepalive)));
  },
  hasPending: () => pending.size > 0,
  /** Edits for a page that have not been confirmed by the server yet. */
  peek(id) {
    const e = pending.get(id);
    return e ? { ...(e.sent || {}), ...e.patch } : null;
  },
  subscribe(fn) {
    listeners.add(fn);
    fn(status);
    return () => listeners.delete(fn);
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => saver.flushAll(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saver.flushAll(true);
  });
  window.addEventListener('beforeunload', () => {
    if (saver.hasPending()) saver.flushAll(true);
  });
}
