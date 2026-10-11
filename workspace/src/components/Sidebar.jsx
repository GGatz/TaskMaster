import { useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../lib/store.jsx';
import { pageUrl } from '../lib/router.js';
import Icon, { StarFilled } from './Icon.jsx';
import PageIcon from './PageIcon.jsx';
import Popover, { MenuItem } from './Popover.jsx';

function useTree(pages) {
  return useMemo(() => {
    const byParent = new Map();
    for (const p of pages) {
      const key = p.parent_id || null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(p);
    }
    for (const list of byParent.values()) list.sort((a, b) => a.position - b.position || a.created_at - b.created_at);
    return byParent;
  }, [pages]);
}

export default function Sidebar({ currentId, onSearch, onTrash, onSettings }) {
  const ws = useWorkspace();
  const { pages, expanded, toggleExpanded } = ws;
  const byParent = useTree(pages);
  const ids = useMemo(() => new Set(pages.map((p) => p.id)), [pages]);
  // Pages whose parent is not visible in the tree (e.g. parent is an inline DB) float to the top level.
  const roots = useMemo(() => pages.filter((p) => !p.parent_id || !ids.has(p.parent_id)).sort((a, b) => a.position - b.position), [pages, ids]);
  const favorites = pages.filter((p) => p.favorite);
  const [drag, setDrag] = useState(null); // { id }
  const [drop, setDrop] = useState(null); // { id, zone }
  const resizing = useRef(false);

  const newPage = async (parent_id = null) => {
    const page = await ws.createPage({ parent_id });
    ws.go(page.id);
  };

  const startResize = (e) => {
    e.preventDefault();
    resizing.current = true;
    const move = (ev) => ws.setSidebarWidth(Math.max(200, Math.min(480, ev.clientX)));
    const up = () => {
      resizing.current = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.classList.remove('resizing');
    };
    document.body.classList.add('resizing');
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const onDropOn = (target, zone) => {
    if (!drag || drag.id === target.id) return;
    const dragged = pages.find((p) => p.id === drag.id);
    if (!dragged) return;
    // Refuse to drop into own subtree.
    let cur = target;
    while (cur) {
      if (cur.id === dragged.id) return;
      cur = pages.find((p) => p.id === cur.parent_id);
    }
    if (zone === 'inside') {
      const kids = byParent.get(target.id) || [];
      ws.movePage(dragged.id, target.id, (kids.at(-1)?.position ?? 0) + 1);
      return;
    }
    const siblings = (byParent.get(target.parent_id || null) || roots).filter((s) => s.id !== dragged.id);
    const idx = siblings.findIndex((s) => s.id === target.id);
    const prev = zone === 'before' ? siblings[idx - 1] : siblings[idx];
    const next = zone === 'before' ? siblings[idx] : siblings[idx + 1];
    const pos = prev && next ? (prev.position + next.position) / 2 : prev ? prev.position + 1 : next.position - 1;
    ws.movePage(dragged.id, target.parent_id || null, pos);
  };

  const rowProps = { currentId, byParent, expanded, toggleExpanded, newPage, drag, setDrag, drop, setDrop, onDropOn };

  return (
    <aside className="sidebar" style={{ width: ws.sidebarWidth }} aria-label="Sidebar">
      <div className="sidebar-head">
        <div className="workspace-switch">
          <span className="ws-avatar">T</span>
          <span className="ws-name">TaskMaster</span>
        </div>
        <button className="icon-btn" title="Close sidebar (Ctrl/⌘ + \)" onClick={() => ws.setSidebarOpen(false)}><Icon name="sidebar" /></button>
      </div>
      <nav className="sidebar-nav">
        <button className="side-row" onClick={onSearch}><Icon name="search" /><span>Search</span><kbd>⌘K</kbd></button>
        <button className="side-row" onClick={() => ws.go(null)}><Icon name="home" /><span>Home</span></button>
      </nav>
      <div className="sidebar-scroll">
        {favorites.length > 0 && (
          <section>
            <div className="side-title">Favorites</div>
            {favorites.map((p) => (
              <button key={p.id} className={`side-row page-row${currentId === p.id ? ' current' : ''}`} onClick={() => ws.go(p.id)}>
                <PageIcon icon={p.icon} type={p.type} size={18} />
                <span className="truncate">{p.title || 'Untitled'}</span>
              </button>
            ))}
          </section>
        )}
        <section>
          <div className="side-title">
            <span>Pages</span>
            <button className="icon-btn small" title="Add a page" onClick={() => newPage(null)}><Icon name="plus" size={14} /></button>
          </div>
          {roots.map((p) => <TreeRow key={p.id} page={p} depth={0} {...rowProps} />)}
          {roots.length === 0 && <div className="empty-note">No pages yet</div>}
          <button className="side-row subtle" onClick={() => newPage(null)}><Icon name="plus" /><span>Add a page</span></button>
        </section>
      </div>
      <div className="sidebar-foot">
        <button className="side-row" onClick={onTrash}><Icon name="trash" /><span>Trash</span></button>
        <button className="side-row" onClick={onSettings}><Icon name="settings" /><span>Settings</span></button>
        <button className="side-row new-page" onClick={() => newPage(null)}><Icon name="plus" /><span>New page</span></button>
      </div>
      <div className="sidebar-resizer" onMouseDown={startResize} />
    </aside>
  );
}

function TreeRow({ page, depth, currentId, byParent, expanded, toggleExpanded, newPage, drag, setDrag, drop, setDrop, onDropOn }) {
  const ws = useWorkspace();
  const kids = byParent.get(page.id) || [];
  const open = expanded.has(page.id);
  const [menu, setMenu] = useState(null);
  const rowRef = useRef(null);
  const isDrop = drop?.id === page.id;

  const zoneFor = (e) => {
    const r = rowRef.current.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    return y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside';
  };

  return (
    <div>
      <div
        ref={rowRef}
        className={`side-row page-row${currentId === page.id ? ' current' : ''}${isDrop ? ` drop-${drop.zone}` : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        draggable
        onDragStart={(e) => { setDrag({ id: page.id }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', page.id); }}
        onDragEnd={() => { setDrag(null); setDrop(null); }}
        onDragOver={(e) => {
          if (!drag || drag.id === page.id) return;
          e.preventDefault();
          const zone = zoneFor(e);
          if (!drop || drop.id !== page.id || drop.zone !== zone) setDrop({ id: page.id, zone });
        }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDrop((d) => (d?.id === page.id ? null : d)); }}
        onDrop={(e) => { e.preventDefault(); onDropOn(page, zoneFor(e)); setDrag(null); setDrop(null); }}
        onClick={() => ws.go(page.id)}
        onContextMenu={(e) => { e.preventDefault(); setMenu(e.currentTarget); }}
        role="treeitem"
        aria-expanded={kids.length ? open : undefined}
        aria-selected={currentId === page.id}
      >
        <button
          className={`twisty${open ? ' open' : ''}`}
          aria-label={open ? 'Collapse' : 'Expand'}
          onClick={(e) => { e.stopPropagation(); toggleExpanded(page.id); }}
        >
          <Icon name="chevronRight" size={12} />
        </button>
        <PageIcon icon={page.icon} type={page.type} size={18} />
        <span className="truncate">{page.title || 'Untitled'}</span>
        <span className="row-actions">
          <button className="icon-btn small" title="Options" onClick={(e) => { e.stopPropagation(); setMenu(e.currentTarget.closest('.page-row')); }}><Icon name="dots" size={14} /></button>
          <button className="icon-btn small" title="Add a page inside" onClick={(e) => { e.stopPropagation(); newPage(page.id); }}><Icon name="plus" size={14} /></button>
        </span>
      </div>
      {menu && (
        <Popover anchor={menu} onClose={() => setMenu(null)} width={220}>
          <MenuItem icon={<Icon name={page.favorite ? 'star' : 'star'} />} onClick={() => { ws.patchPage(page.id, { favorite: !page.favorite }); setMenu(null); }}>
            {page.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
          </MenuItem>
          <MenuItem icon={<Icon name="link" />} onClick={() => { navigator.clipboard?.writeText(pageUrl(page.id)); ws.showToast('Link copied'); setMenu(null); }}>Copy link</MenuItem>
          <MenuItem icon={<Icon name="duplicate" />} onClick={async () => { setMenu(null); const c = await ws.duplicatePage(page.id); ws.go(c.id); }}>Duplicate</MenuItem>
          <MenuItem icon={<Icon name="plus" />} onClick={() => { setMenu(null); newPage(page.id); }}>Add sub-page</MenuItem>
          <div className="menu-sep" />
          <MenuItem icon={<Icon name="trash" />} danger onClick={async () => { setMenu(null); await ws.trashPage(page.id); if (currentId === page.id) ws.go(null); }}>Move to Trash</MenuItem>
        </Popover>
      )}
      {open && (
        kids.length
          ? kids.map((k) => <TreeRow key={k.id} page={k} depth={depth + 1} {...{ currentId, byParent, expanded, toggleExpanded, newPage, drag, setDrag, drop, setDrop, onDropOn }} />)
          : <div className="side-row empty-child" style={{ paddingLeft: 8 + (depth + 1) * 14 + 22 }}>No pages inside</div>
      )}
    </div>
  );
}

export { StarFilled };
