import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { GRADIENTS, coverStyle } from '../lib/constants.js';
import { blocksToMarkdown } from '../lib/markdown.js';
import { pageUrl } from '../lib/router.js';
import { saver } from '../lib/saver.js';
import { useWorkspace } from '../lib/store.jsx';
import Editor from './editor/Editor.jsx';
import EmojiPicker from './EmojiPicker.jsx';
import Icon, { StarFilled } from './Icon.jsx';
import PageIcon from './PageIcon.jsx';
import Popover, { MenuItem } from './Popover.jsx';
import { SearchModal } from './Modals.jsx';
import { Cell } from './database/cells.jsx';
import { PropIcon } from './database/cells.jsx';

const DatabaseView = lazy(() => import('./database/DatabaseView.jsx'));

function SaveStatus() {
  const [status, setStatus] = useState('saved');
  useEffect(() => saver.subscribe(setStatus), []);
  return (
    <span className={`save-status ${status}`} role="status" aria-live="polite">
      {status === 'saving' ? 'Saving…' : status === 'error' ? 'Offline — retrying' : 'Saved'}
    </span>
  );
}

export function Topbar({ page, children }) {
  const ws = useWorkspace();
  return (
    <header className="topbar">
      {!ws.sidebarOpen && (
        <button className="icon-btn" title="Open sidebar (Ctrl/⌘ + \)" aria-label="Open sidebar" onClick={() => ws.setSidebarOpen(true)}><Icon name="sidebar" /></button>
      )}
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        {page?.path?.map((a) => (
          <span key={a.id} className="crumb-wrap">
            <button className="crumb" onClick={() => ws.go(a.id)}>
              <PageIcon icon={a.icon} type={a.type} size={16} />
              <span className="truncate">{a.title || 'Untitled'}</span>
            </button>
            <span className="crumb-sep">/</span>
          </span>
        ))}
        {page && (
          <span className="crumb current">
            <PageIcon icon={page.icon} type={page.type} size={16} />
            <span className="truncate">{page.title || 'Untitled'}</span>
          </span>
        )}
      </nav>
      <span className="push" />
      {page && <SaveStatus />}
      {children}
    </header>
  );
}

function CoverMenu({ anchor, onPick, onClose, onRemove, hasCover }) {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try { onPick(await api.upload(file)); onClose(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Popover anchor={anchor} onClose={onClose} width={340} className="cover-menu">
      <div className="menu-group">Gradients</div>
      <div className="gradient-grid">
        {Object.entries(GRADIENTS).map(([name, bg]) => (
          <button key={name} className="gradient-swatch" style={{ background: bg }} title={name} aria-label={`${name} gradient`} onClick={() => { onPick(`gradient:${name}`); onClose(); }} />
        ))}
      </div>
      <div className="menu-group">Image</div>
      <div className="menu-inline">
        <button className="btn-small" disabled={busy} onClick={() => fileRef.current.click()}>{busy ? 'Uploading…' : 'Upload image'}</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" hidden onChange={(e) => upload(e.target.files[0])} />
        {hasCover && <button className="btn-small danger" onClick={() => { onRemove(); onClose(); }}>Remove</button>}
      </div>
      <form className="menu-inline" onSubmit={(e) => { e.preventDefault(); if (/^https?:\/\//i.test(link.trim())) { onPick(link.trim()); onClose(); } else setError('Enter a valid http(s) URL'); }}>
        <input className="menu-input" placeholder="Paste an image link…" value={link} onChange={(e) => { setLink(e.target.value); setError(''); }} aria-label="Image link" />
        <button className="btn-small" type="submit">Add</button>
      </form>
      {error && <div className="form-error">{error}</div>}
    </Popover>
  );
}

function RowProperties({ page, parentId, onChangeProps }) {
  const [parent, setParent] = useState(null);
  useEffect(() => {
    let live = true;
    api.getPage(parentId).then((p) => live && setParent(p)).catch(() => {});
    return () => { live = false; };
  }, [parentId]);
  if (!parent) return null;
  const props = parent.schema.filter((p) => p.type !== 'title');
  const updateProp = (propId, patch) => {
    const schema = parent.schema.map((p) => (p.id === propId ? { ...p, ...patch } : p));
    setParent({ ...parent, schema });
    saver.queue(parentId, { schema });
  };
  return (
    <div className="row-props" aria-label="Properties">
      {props.map((p) => (
        <div className="row-prop" key={p.id}>
          <div className="row-prop-name"><PropIcon type={p.type} /><span className="truncate">{p.name}</span></div>
          <div className="row-prop-value">
            <Cell prop={p} row={page} onChange={(v) => onChangeProps({ ...page.props, [p.id]: v })} onUpdateProp={(patch) => updateProp(p.id, patch)} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PageView({ id }) {
  const ws = useWorkspace();
  const [page, setPage] = useState(null);
  const [error, setError] = useState(null);
  const [emoji, setEmoji] = useState(null);
  const [cover, setCover] = useState(null);
  const [menu, setMenu] = useState(null);
  const [mover, setMover] = useState(false);
  const blocksRef = useRef([]);
  const editorRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await saver.flush(id);
        const p = await api.getPage(id);
        if (!live) return;
        blocksRef.current = p.blocks;
        setPage(p);
        document.title = `${p.title || 'Untitled'} · TaskMaster`;
      } catch (e) {
        if (live) setError(e.status === 404 ? 'This page does not exist or was deleted.' : e.message);
      }
    })();
    return () => { live = false; saver.flush(id); };
  }, [id]);

  useEffect(() => {
    if (page) document.title = `${page.title || 'Untitled'} · TaskMaster`;
    return () => { document.title = 'TaskMaster'; };
  }, [page?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosize the title textarea.
  useEffect(() => {
    const el = titleRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [page?.title, page?.id, ws.sidebarOpen, ws.sidebarWidth]);

  useEffect(() => {
    if (page && !page.title && !page.inline && (page.type === 'database' || page.blocks.length === 0)) titleRef.current?.focus();
  }, [page?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useCallback((fields) => {
    setPage((p) => (p ? { ...p, ...fields } : p));
    ws.patchPage(id, fields);
  }, [id, ws]);

  const onBlocksChange = useCallback((blocks) => {
    blocksRef.current = blocks;
    saver.queue(id, { blocks });
  }, [id]);

  if (error) {
    return (
      <>
        <Topbar />
        <div className="page-scroll"><div className="empty-state"><h2>Page not found</h2><p>{error}</p><button className="btn" onClick={() => ws.go(null)}>Go home</button></div></div>
      </>
    );
  }
  if (!page) return <><Topbar /><div className="page-scroll"><div className="empty-note" style={{ padding: 40 }}>Loading…</div></div></>;

  const settings = page.settings || {};
  const locked = !!settings.locked;
  const isDb = page.type === 'database';
  const parentDb = page.path?.at(-1)?.type === 'database' ? page.path.at(-1) : null;
  const meta = ws.pages.find((p) => p.id === id);
  const favorite = meta?.favorite ?? page.favorite;
  const setSetting = (k, v) => patch({ settings: { ...settings, [k]: v } });

  const exportMarkdown = () => {
    const md = `# ${page.title || 'Untitled'}\n\n${blocksToMarkdown(blocksRef.current)}\n`;
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(page.title || 'Untitled').replace(/[^\w\- ]+/g, '').trim() || 'page'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const moveTo = async (target) => {
    try {
      const last = ws.pages.filter((p) => p.parent_id === target.id).reduce((m, p) => Math.max(m, p.position), 0);
      await ws.movePage(id, target.id, last + 1);
      const fresh = await api.getPage(id);
      setPage((p) => ({ ...p, path: fresh.path, parent_id: fresh.parent_id }));
      ws.showToast(`Moved to ${target.title || 'Untitled'}`);
    } catch (e) { ws.showToast(e.message); }
  };

  return (
    <>
      <Topbar page={page}>
        <button className="icon-btn" title={favorite ? 'Remove from favorites' : 'Add to favorites'} aria-label="Toggle favorite" aria-pressed={!!favorite} onClick={() => { patch({ favorite: !favorite }); }}>
          {favorite ? <StarFilled /> : <Icon name="star" />}
        </button>
        <button className="icon-btn" title="Page options" aria-label="Page options" onClick={(e) => setMenu(e.currentTarget)}><Icon name="dots" /></button>
      </Topbar>
      <div className={`page-scroll font-${settings.font || 'default'}${settings.small ? ' small-text' : ''}${settings.wide || isDb ? ' wide' : ''}`}>
        {page.cover && (
          <div className="cover" style={coverStyle(page.cover)}>
            {!locked && (
              <div className="cover-actions">
                <button className="btn-small" onClick={(e) => setCover(e.currentTarget)}>Change cover</button>
                <button className="btn-small" onClick={() => patch({ cover: null })}>Remove</button>
              </div>
            )}
          </div>
        )}
        <div className={`page-inner${page.cover ? ' has-cover' : ''}`}>
          <div className="page-head">
            {page.icon && (
              <button className="big-icon" onClick={(e) => !locked && setEmoji(e.currentTarget)} aria-label="Change icon" disabled={locked}>{page.icon}</button>
            )}
            {!locked && (!page.icon || !page.cover) && (
              <div className="head-actions">
                {!page.icon && <button className="ghost-btn" onClick={(e) => setEmoji(e.currentTarget)}><Icon name="star" size={14} /> Add icon</button>}
                {!page.cover && <button className="ghost-btn" onClick={(e) => setCover(e.currentTarget)}><Icon name="image" size={14} /> Add cover</button>}
              </div>
            )}
            <textarea
              ref={titleRef}
              className="page-title"
              rows={1}
              value={page.title}
              placeholder="Untitled"
              readOnly={locked}
              aria-label="Page title"
              onChange={(e) => patch({ title: e.target.value.replace(/\n/g, ' ') })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.focusStart(); }
              }}
            />
          </div>
          {parentDb && !isDb && <RowProperties page={page} parentId={parentDb.id} onChangeProps={(props) => patch({ props })} />}
          {isDb ? (
            <Suspense fallback={<div className="empty-note">Loading…</div>}>
              <DatabaseView dbId={id} />
            </Suspense>
          ) : (
            <Editor
              ref={editorRef}
              key={id}
              pageId={id}
              initialBlocks={page.blocks}
              onChange={onBlocksChange}
              readOnly={locked}
              onExitTop={() => { const t = titleRef.current; if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }}
            />
          )}
        </div>
      </div>

      {emoji && (
        <Popover anchor={emoji} onClose={() => setEmoji(null)} width={320}>
          <EmojiPicker onPick={(e) => patch({ icon: e })} onRemove={() => patch({ icon: null })} onClose={() => setEmoji(null)} />
        </Popover>
      )}
      {cover && <CoverMenu anchor={cover} hasCover={!!page.cover} onPick={(c) => patch({ cover: c })} onRemove={() => patch({ cover: null })} onClose={() => setCover(null)} />}
      {menu && (
        <Popover anchor={menu} onClose={() => setMenu(null)} width={250} align="right">
          <div className="menu-group">Style</div>
          <div className="font-picker">
            {[['default', 'Default', 'Ag'], ['serif', 'Serif', 'Ag'], ['mono', 'Mono', 'Ag']].map(([k, label, sample]) => (
              <button key={k} className={`font-btn font-${k}${(settings.font || 'default') === k ? ' active' : ''}`} onClick={() => setSetting('font', k)}><span>{sample}</span><small>{label}</small></button>
            ))}
          </div>
          <label className="switch-row"><span>Small text</span><input type="checkbox" checked={!!settings.small} onChange={(e) => setSetting('small', e.target.checked)} /></label>
          <label className="switch-row"><span>Full width</span><input type="checkbox" checked={!!settings.wide} onChange={(e) => setSetting('wide', e.target.checked)} /></label>
          <label className="switch-row"><span>Lock page</span><input type="checkbox" checked={locked} onChange={(e) => setSetting('locked', e.target.checked)} /></label>
          <div className="menu-sep" />
          <MenuItem icon={<Icon name="link" />} onClick={() => { navigator.clipboard?.writeText(pageUrl(id)); ws.showToast('Link copied'); setMenu(null); }}>Copy link</MenuItem>
          <MenuItem icon={<Icon name="duplicate" />} onClick={async () => { setMenu(null); const c = await ws.duplicatePage(id); ws.go(c.id); }}>Duplicate</MenuItem>
          {!parentDb && <MenuItem icon={<Icon name="move" />} onClick={() => { setMenu(null); setMover(true); }}>Move to…</MenuItem>}
          {!isDb && <MenuItem icon={<Icon name="download" />} onClick={() => { exportMarkdown(); setMenu(null); }}>Export as Markdown</MenuItem>}
          <div className="menu-sep" />
          <MenuItem icon={<Icon name="trash" />} danger onClick={async () => { setMenu(null); await ws.trashPage(id); ws.go(page.parent_id || null); }}>Move to Trash</MenuItem>
        </Popover>
      )}
      {mover && <SearchModal excludeId={id} placeholder="Move page to…" onClose={() => setMover(false)} onPick={(t) => (t.type === 'database' ? ws.showToast('Choose a page, not a database') : moveTo(t))} />}
    </>
  );
}
