import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useWorkspace } from '../lib/store.jsx';
import { timeAgo } from '../lib/constants.js';
import { Modal } from './Popover.jsx';
import PageIcon from './PageIcon.jsx';
import Icon from './Icon.jsx';

/** Quick find. With `onPick` it doubles as a page picker (link to page, move to…). */
export function SearchModal({ onClose, onPick, placeholder = 'Search or jump to…', excludeId }) {
  const ws = useWorkspace();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await api.search(q);
        if (live) { setResults(r.filter((x) => x.id !== excludeId)); setIndex(0); }
      } catch { if (live) setResults([]); }
    }, q ? 120 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q, excludeId]);

  useEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const choose = (r) => {
    if (!r) return;
    onClose();
    if (onPick) onPick(r); else ws.go(r.id);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[index]); }
  };

  return (
    <Modal onClose={onClose} className="search-modal">
      <div className="search-input">
        <Icon name="search" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={placeholder} aria-label="Search" />
      </div>
      <div className="search-results" ref={listRef} role="listbox">
        <div className="side-title">{q ? 'Results' : 'Recent'}</div>
        {results.map((r, i) => (
          <button key={r.id} role="option" aria-selected={i === index} className={`search-result${i === index ? ' active' : ''}`} onMouseMove={() => setIndex(i)} onClick={() => choose(r)}>
            <PageIcon icon={r.icon} type={r.type} size={20} />
            <span className="sr-text">
              <span className="sr-title">{r.title || 'Untitled'}</span>
              {r.snippet && <span className="sr-snippet">{r.snippet}</span>}
            </span>
            <span className="sr-time">{timeAgo(r.updated_at)}</span>
          </button>
        ))}
        {results.length === 0 && <div className="empty-note">{q ? 'No results' : 'Nothing here yet'}</div>}
      </div>
    </Modal>
  );
}

export function TrashModal({ onClose }) {
  const ws = useWorkspace();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');

  const load = async () => setItems(await api.trash());
  useEffect(() => { load(); }, []);

  const restore = async (id) => { await ws.restorePage(id); await load(); };
  const purge = async (id) => {
    if (!window.confirm('Delete this page permanently? This cannot be undone.')) return;
    await api.purgePage(id);
    await load();
  };
  const empty = async () => {
    if (!window.confirm('Permanently delete everything in the trash? This cannot be undone.')) return;
    await api.emptyTrash();
    await load();
  };
  const shown = (items || []).filter((i) => (i.title || 'Untitled').toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal onClose={onClose} className="trash-modal">
      <div className="search-input">
        <Icon name="search" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages in Trash" />
        {items?.length > 0 && <button className="btn-small danger" onClick={empty}>Empty trash</button>}
      </div>
      <div className="search-results">
        {items === null && <div className="empty-note">Loading…</div>}
        {shown.map((r) => (
          <div key={r.id} className="search-result">
            <PageIcon icon={r.icon} type={r.type} size={20} />
            <span className="sr-text">
              <span className="sr-title">{r.title || 'Untitled'}</span>
              <span className="sr-snippet">Deleted {timeAgo(r.trashed_at)}</span>
            </span>
            <button className="icon-btn" title="Restore" onClick={() => restore(r.id)}><Icon name="undo" /></button>
            <button className="icon-btn" title="Delete permanently" onClick={() => purge(r.id)}><Icon name="trash" /></button>
          </div>
        ))}
        {items && shown.length === 0 && <div className="empty-note">{items.length ? 'No matches' : 'Trash is empty'}</div>}
      </div>
    </Modal>
  );
}

export function SettingsModal({ onClose }) {
  const { theme, setTheme } = useWorkspace();
  return (
    <Modal onClose={onClose} className="settings-modal" top="15vh">
      <div className="modal-title">Settings</div>
      <div className="setting-row">
        <div>
          <div className="setting-name">Appearance</div>
          <div className="setting-desc">Choose how TaskMaster looks on this device.</div>
        </div>
        <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Theme">
          <option value="system">Use system setting</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div className="setting-row col">
        <div className="setting-name">Keyboard shortcuts</div>
        <div className="shortcut-grid">
          {[
            ['Search', 'Ctrl/⌘ K'], ['Toggle sidebar', 'Ctrl/⌘ \\'], ['Block menu', '/'], ['Mention a page', '@'],
            ['Bold / Italic / Underline', 'Ctrl/⌘ B / I / U'], ['Inline code', 'Ctrl/⌘ E'], ['Link', 'Ctrl/⌘ K (with selection)'],
            ['Indent / Outdent', 'Tab / Shift Tab'], ['Undo / Redo', 'Ctrl/⌘ Z / Shift Z'], ['Select block', 'Esc'],
            ['Duplicate block', 'Ctrl/⌘ D'], ['Move block', 'Ctrl/⌘ Shift ↑ / ↓'],
          ].map(([a, b]) => <div key={a} className="shortcut"><span>{a}</span><kbd>{b}</kbd></div>)}
        </div>
      </div>
      <div className="modal-actions"><button className="btn primary" onClick={onClose}>Done</button></div>
    </Modal>
  );
}

export function Toast() {
  const { toast, dismissToast } = useWorkspace();
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.key}>
      <span>{toast.message}</span>
      {toast.action && <button onClick={async () => { await toast.action.run(); dismissToast(); }}>{toast.action.label}</button>}
    </div>
  );
}
