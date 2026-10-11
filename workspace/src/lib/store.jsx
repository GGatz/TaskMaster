import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { saver } from './saver.js';
import { navigate } from './router.js';

const Ctx = createContext(null);
export const useWorkspace = () => useContext(Ctx);

const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

export function WorkspaceProvider({ children }) {
  const [pages, setPages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [theme, setThemeState] = useState(() => read('tm.theme', 'system'));
  const [sidebarOpen, setSidebarOpenState] = useState(() => read('tm.sidebar', true));
  const [sidebarWidth, setSidebarWidthState] = useState(() => read('tm.sidebarWidth', 260));
  const [expanded, setExpandedState] = useState(() => new Set(read('tm.expanded', [])));
  const [toast, setToast] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const list = await api.tree();
      // A page edited moments ago may not be saved yet; never let a stale fetch undo it.
      setPages(list.map((p) => {
        const pend = saver.peek(p.id);
        if (!pend) return p;
        const meta = {};
        for (const k of ['title', 'icon', 'favorite', 'parent_id', 'position']) if (k in pend) meta[k] = pend[k];
        return { ...p, ...meta };
      }));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    if (theme !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = (t) => { setThemeState(t); write('tm.theme', t); };
  const setSidebarOpen = (v) => {
    setSidebarOpenState((cur) => {
      const next = typeof v === 'function' ? v(cur) : v;
      write('tm.sidebar', next);
      return next;
    });
  };
  const setSidebarWidth = (w) => { setSidebarWidthState(w); write('tm.sidebarWidth', w); };
  const toggleExpanded = (id, force) => {
    setExpandedState((cur) => {
      const next = new Set(cur);
      const open = force ?? !next.has(id);
      if (open) next.add(id); else next.delete(id);
      write('tm.expanded', [...next]);
      return next;
    });
  };

  const showToast = useCallback((message, action) => {
    setToast({ message, action, key: Date.now() });
    setTimeout(() => setToast((t) => (t && Date.now() - t.key >= 4900 ? null : t)), 5000);
  }, []);

  /** Patch sidebar metadata locally (title/icon/favorite/parent/position). */
  const updateMeta = useCallback((id, patch) => {
    setPages((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const createPage = useCallback(async (input = {}) => {
    const page = await api.createPage({ title: '', ...input });
    const isRowOrInline = page.inline;
    if (!isRowOrInline) {
      const parent = input.parent_id && pages.find((p) => p.id === input.parent_id);
      const parentIsDb = parent?.type === 'database';
      if (!parentIsDb) {
        setPages((cur) => [...cur, { id: page.id, parent_id: page.parent_id, type: page.type, title: page.title, icon: page.icon, favorite: false, position: page.position, updated_at: page.updated_at, created_at: page.created_at }]);
      }
      if (input.parent_id) toggleExpanded(input.parent_id, true);
    }
    return page;
  }, [pages]);

  const patchPage = useCallback((id, patch) => {
    const meta = {};
    for (const k of ['title', 'icon', 'favorite', 'parent_id', 'position']) if (k in patch) meta[k] = patch[k];
    if (Object.keys(meta).length) updateMeta(id, meta);
    saver.queue(id, patch);
  }, [updateMeta]);

  const trashPage = useCallback(async (id, { silent } = {}) => {
    await saver.flush(id);
    await api.trashPage(id);
    await refresh();
    if (!silent) {
      showToast('Moved to trash', {
        label: 'Undo',
        run: async () => { await api.restorePage(id); await refresh(); },
      });
    }
  }, [refresh, showToast]);

  const restorePage = useCallback(async (id) => {
    await api.restorePage(id);
    await refresh();
  }, [refresh]);

  const duplicatePage = useCallback(async (id) => {
    await saver.flush(id);
    const copy = await api.duplicatePage(id);
    await refresh();
    return copy;
  }, [refresh]);

  const movePage = useCallback(async (id, parentId, position) => {
    updateMeta(id, { parent_id: parentId, position });
    if (parentId) toggleExpanded(parentId, true);
    try {
      await api.patchPage(id, { parent_id: parentId, position });
    } catch (e) {
      showToast(e.message);
      await refresh();
    }
  }, [updateMeta, refresh, showToast]);

  const value = useMemo(() => ({
    pages, loaded, error, refresh, updateMeta, createPage, patchPage, trashPage, restorePage, duplicatePage, movePage,
    theme, setTheme, sidebarOpen, setSidebarOpen, sidebarWidth, setSidebarWidth, expanded, toggleExpanded,
    toast, showToast, dismissToast: () => setToast(null), go: navigate,
  }), [pages, loaded, error, theme, sidebarOpen, sidebarWidth, expanded, toast, refresh, updateMeta, createPage, patchPage, trashPage, restorePage, duplicatePage, movePage, showToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
