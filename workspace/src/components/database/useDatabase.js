import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { saver } from '../../lib/saver.js';
import { uid } from '../../lib/blocks.js';
import { useWorkspace } from '../../lib/store.jsx';

/** Loads a database page plus its rows and exposes optimistic mutations that write behind via the saver. */
export default function useDatabase(dbId) {
  const ws = useWorkspace();
  const [db, setDb] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const dbRef = useRef(null);
  const rowsRef = useRef([]);
  dbRef.current = db;
  rowsRef.current = rows;

  useEffect(() => {
    let live = true;
    setDb(null);
    setRows([]);
    setError(null);
    (async () => {
      try {
        await saver.flush(dbId);
        const [page, list] = await Promise.all([api.getPage(dbId), api.rows(dbId)]);
        if (!live) return;
        setDb(page);
        setRows(list);
      } catch (e) {
        if (live) setError(e.status === 404 ? 'This database no longer exists.' : e.message);
      }
    })();
    return () => { live = false; saver.flush(dbId); };
  }, [dbId]);

  const updateDb = useCallback((patch) => {
    setDb((cur) => (cur ? { ...cur, ...patch } : cur));
    saver.queue(dbId, patch);
    if ('title' in patch || 'icon' in patch) ws.updateMeta(dbId, patch);
  }, [dbId, ws]);

  const updateView = useCallback((viewId, patch) => {
    const views = dbRef.current.views.map((v) => (v.id === viewId ? { ...v, ...(typeof patch === 'function' ? patch(v) : patch) } : v));
    updateDb({ views });
  }, [updateDb]);

  const updateRow = useCallback((rowId, patch) => {
    setRows((cur) => cur.map((r) => {
      if (r.id !== rowId) return r;
      const next = { ...r, ...patch };
      if (patch.props) next.props = { ...r.props, ...patch.props };
      next.updated_at = Date.now();
      return next;
    }));
    const row = rowsRef.current.find((r) => r.id === rowId);
    const out = {};
    if ('title' in patch) out.title = patch.title;
    if ('icon' in patch) out.icon = patch.icon;
    if ('position' in patch) out.position = patch.position;
    if (patch.props) out.props = { ...(row?.props || {}), ...patch.props };
    saver.queue(rowId, out);
    if ('title' in patch || 'icon' in patch) ws.updateMeta(rowId, patch);
  }, [ws]);

  const addRow = useCallback(async (init = {}) => {
    const last = rowsRef.current.reduce((m, r) => Math.max(m, r.position), 0);
    const now = Date.now();
    // Optimistic: the row (and its title input) appears immediately; the server catches up behind it.
    const row = {
      id: uid() + uid(), parent_id: dbId, type: 'page', title: init.title || '', icon: null, cover: null,
      props: init.props || {}, position: init.position ?? last + 1, created_at: now, updated_at: now,
    };
    setRows((cur) => [...cur, row]);
    const creating = api.createPage({ id: row.id, parent_id: dbId, title: row.title, props: row.props, position: row.position });
    saver.hold(row.id, creating);
    creating.catch((e) => {
      setRows((cur) => cur.filter((r) => r.id !== row.id));
      ws.showToast(`Could not create the row: ${e.message}`);
    });
    return row;
  }, [dbId, ws]);

  const deleteRow = useCallback(async (rowId) => {
    setRows((cur) => cur.filter((r) => r.id !== rowId));
    await saver.flush(rowId);
    await api.trashPage(rowId);
    ws.showToast('Moved to trash', {
      label: 'Undo',
      run: async () => {
        await api.restorePage(rowId);
        setRows(await api.rows(dbId));
      },
    });
  }, [dbId, ws]);

  const duplicateRow = useCallback(async (rowId) => {
    await saver.flush(rowId);
    const copy = await api.duplicatePage(rowId);
    const row = { id: copy.id, parent_id: dbId, type: 'page', title: copy.title, icon: copy.icon, cover: copy.cover, props: copy.props, position: copy.position, created_at: copy.created_at, updated_at: copy.updated_at };
    setRows((cur) => [...cur, row]);
    return row;
  }, [dbId]);

  // ---- schema ----
  const addProperty = useCallback((name, type) => {
    const prop = { id: uid(), name: name || 'Property', type };
    if (['select', 'multi_select', 'status'].includes(type)) {
      prop.options = type === 'status'
        ? [
          { id: uid(), name: 'Not started', color: 'gray', group: 'todo' },
          { id: uid(), name: 'In progress', color: 'blue', group: 'in_progress' },
          { id: uid(), name: 'Done', color: 'green', group: 'complete' },
        ]
        : [];
    }
    updateDb({ schema: [...dbRef.current.schema, prop] });
    return prop;
  }, [updateDb]);

  const updateProperty = useCallback((propId, patch) => {
    updateDb({ schema: dbRef.current.schema.map((p) => (p.id === propId ? { ...p, ...patch } : p)) });
  }, [updateDb]);

  const deleteProperty = useCallback((propId) => {
    const schema = dbRef.current.schema.filter((p) => p.id !== propId);
    const views = dbRef.current.views.map((v) => ({
      ...v,
      filters: v.filters.filter((f) => f.prop !== propId),
      sorts: v.sorts.filter((s) => s.prop !== propId),
      hidden: v.hidden.filter((h) => h !== propId),
      groupBy: v.groupBy === propId ? null : v.groupBy,
      dateBy: v.dateBy === propId ? null : v.dateBy,
    }));
    updateDb({ schema, views });
    // Stored values for the removed property are dropped lazily; they are invisible and harmless.
  }, [updateDb]);

  return { db, rows, error, setRows, updateDb, updateView, updateRow, addRow, deleteRow, duplicateRow, addProperty, updateProperty, deleteProperty };
}
