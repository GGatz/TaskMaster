import { useEffect, useMemo, useState } from 'react';
import { impliedDefaults, visibleRows } from '../../lib/dbquery.js';
import { newView } from '../../lib/dbdefaults.js';
import { uid } from '../../lib/blocks.js';
import { opsFor } from '../../lib/dbquery.js';
import { useWorkspace } from '../../lib/store.jsx';
import Icon from '../Icon.jsx';
import EmojiPicker from '../EmojiPicker.jsx';
import Popover from '../Popover.jsx';
import PageIcon from '../PageIcon.jsx';
import useDatabase from './useDatabase.js';
import TableView from './TableView.jsx';
import BoardView from './BoardView.jsx';
import { GalleryView, ListView } from './ListGalleryViews.jsx';
import CalendarView from './CalendarView.jsx';
import { AddViewMenu, FilterMenu, PropertiesMenu, SortMenu, ViewSettingsMenu } from './menus.jsx';
import { VIEW_TYPES } from '../../lib/dbdefaults.js';

const ICON_OF = Object.fromEntries(VIEW_TYPES.map((v) => [v.type, v.icon]));

const readView = (dbId) => { try { return localStorage.getItem(`tm.view.${dbId}`); } catch { return null; } };
const writeView = (dbId, id) => { try { localStorage.setItem(`tm.view.${dbId}`, id); } catch { /* storage unavailable */ } };

/**
 * A database: view tabs, toolbar (filter / sort / properties / search) and the active layout.
 * `inline` shows an editable title row (full-page databases use the page title instead).
 */
export default function DatabaseView({ dbId, inline = false }) {
  const ws = useWorkspace();
  const d = useDatabase(dbId);
  const { db, rows } = d;
  const [activeId, setActiveId] = useState(() => readView(dbId));
  const [menu, setMenu] = useState(null); // { kind, anchor }
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [newRowId, setNewRowId] = useState(null);
  const [emoji, setEmoji] = useState(null);

  const view = useMemo(() => db?.views.find((v) => v.id === activeId) || db?.views[0], [db, activeId]);

  useEffect(() => { if (view && view.id !== activeId) setActiveId(view.id); }, [view, activeId]);

  // A database whose views were all deleted gets a fresh table view.
  useEffect(() => {
    if (db && db.views.length === 0) d.updateDb({ views: [newView('table')] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const shown = useMemo(() => (db && view ? visibleRows(rows, db.schema, view, query) : []), [rows, db, view, query]);

  if (d.error) return <div className="empty-note db-error">{d.error}</div>;
  if (!db || !view) return <div className="empty-note">Loading…</div>;

  const selectView = (id) => { setActiveId(id); writeView(dbId, id); };
  const closeMenu = () => setMenu(null);
  const open = (kind) => (e) => setMenu({ kind, anchor: e.currentTarget });
  const patchView = (patch) => d.updateView(view.id, patch);

  const addRow = async (init = {}) => {
    const props = { ...impliedDefaults(db.schema, view), ...(init.props || {}) };
    const row = await d.addRow({ ...init, props });
    setNewRowId(row.id);
    return row;
  };

  const addView = (type) => {
    const extra = {};
    if (type === 'board') extra.groupBy = db.schema.find((p) => p.type === 'status' || p.type === 'select')?.id || null;
    if (type === 'calendar') extra.dateBy = db.schema.find((p) => p.type === 'date')?.id || null;
    const v = newView(type, undefined, extra);
    d.updateDb({ views: [...db.views, v] });
    selectView(v.id);
  };
  const duplicateView = () => {
    const v = { ...structuredClone(view), id: uid(), name: `${view.name} copy` };
    d.updateDb({ views: [...db.views, v] });
    selectView(v.id);
  };
  const deleteView = () => {
    const views = db.views.filter((v) => v.id !== view.id);
    d.updateDb({ views });
    selectView(views[0].id);
  };
  const filterBy = (prop) => {
    patchView({ filters: [...view.filters, { id: uid(), prop: prop.id, op: opsFor(prop.type)[0][0], value: '' }] });
    setTimeout(() => setMenu({ kind: 'filter', anchor: document.querySelector('.db-toolbar .btn-filter') }), 0);
  };

  const common = { d, view, rows: shown, go: ws.go, newRowId, setNewRowId, onAddRow: addRow, onFilterBy: filterBy };
  const Body = { table: TableView, board: BoardView, list: ListView, gallery: GalleryView, calendar: CalendarView }[view.type] || TableView;
  const filterCount = (view.filters || []).length;
  const sortCount = (view.sorts || []).length;

  return (
    <div className={`database${inline ? ' inline' : ''}`}>
      {inline && (
        <div className="db-title">
          <button className="db-icon" onClick={(e) => setEmoji(e.currentTarget)} aria-label="Change icon"><PageIcon icon={db.icon} type="database" size={22} /></button>
          <input
            className="db-title-input"
            value={db.title}
            placeholder="Untitled database"
            onChange={(e) => d.updateDb({ title: e.target.value })}
            aria-label="Database title"
          />
          <button className="icon-btn" title="Open as full page" aria-label="Open as full page" onClick={() => ws.go(db.id)}><Icon name="expand" /></button>
        </div>
      )}
      <div className="db-bar">
        <div className="view-tabs" role="tablist">
          {db.views.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={v.id === view.id}
              className={`view-tab${v.id === view.id ? ' active' : ''}`}
              onClick={(e) => { if (v.id === view.id) setMenu({ kind: 'view', anchor: e.currentTarget }); else selectView(v.id); }}
              title={v.id === view.id ? 'View settings' : v.name}
            >
              <Icon name={ICON_OF[v.type] || 'table'} size={14} />
              <span>{v.name}</span>
            </button>
          ))}
          <button className="icon-btn small" title="Add a view" aria-label="Add a view" onClick={open('addview')}><Icon name="plus" size={14} /></button>
        </div>
        <div className="db-toolbar">
          <button className={`tool-btn btn-filter${filterCount ? ' on' : ''}`} onClick={open('filter')}><Icon name="filter" size={14} /> Filter{filterCount ? ` · ${filterCount}` : ''}</button>
          <button className={`tool-btn${sortCount ? ' on' : ''}`} onClick={open('sort')}><Icon name="sort" size={14} /> Sort{sortCount ? ` · ${sortCount}` : ''}</button>
          {(view.type === 'table' || view.type === 'board' || view.type === 'gallery' || view.type === 'list' || view.type === 'calendar') && (
            <button className={`tool-btn${(view.hidden || []).length ? ' on' : ''}`} onClick={open('props')}><Icon name="properties" size={14} /> Properties</button>
          )}
          {searchOpen ? (
            <input
              className="db-search"
              autoFocus
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => { if (!query) setSearchOpen(false); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); } }}
              aria-label="Search rows"
            />
          ) : (
            <button className="icon-btn" title="Search" aria-label="Search rows" onClick={() => setSearchOpen(true)}><Icon name="search" size={15} /></button>
          )}
          <button className="btn primary small new-btn" onClick={() => addRow()}>New</button>
        </div>
      </div>
      <div className="db-body">
        <Body {...common} />
      </div>

      {menu?.kind === 'filter' && <FilterMenu anchor={menu.anchor} db={db} view={view} onChange={patchView} onClose={closeMenu} />}
      {menu?.kind === 'sort' && <SortMenu anchor={menu.anchor} db={db} view={view} onChange={patchView} onClose={closeMenu} />}
      {menu?.kind === 'props' && <PropertiesMenu anchor={menu.anchor} db={db} view={view} onChange={patchView} onClose={closeMenu} />}
      {menu?.kind === 'addview' && <AddViewMenu anchor={menu.anchor} onAdd={addView} onClose={closeMenu} />}
      {menu?.kind === 'view' && (
        <ViewSettingsMenu
          anchor={menu.anchor}
          db={db}
          view={view}
          canDelete={db.views.length > 1}
          onChange={(patch) => {
            if (patch.type === 'board' && !view.groupBy) patch.groupBy = db.schema.find((p) => p.type === 'status' || p.type === 'select')?.id || null;
            if (patch.type === 'calendar' && !view.dateBy) patch.dateBy = db.schema.find((p) => p.type === 'date')?.id || null;
            patchView(patch);
          }}
          onDuplicate={duplicateView}
          onDelete={deleteView}
          onClose={closeMenu}
          onCreateProperty={(type) => {
            const p = d.addProperty(type === 'status' ? 'Status' : 'Date', type);
            patchView(type === 'status' ? { groupBy: p.id } : { dateBy: p.id });
          }}
        />
      )}
      {emoji && (
        <Popover anchor={emoji} onClose={() => setEmoji(null)} width={320}>
          <EmojiPicker onPick={(e) => d.updateDb({ icon: e })} onRemove={() => d.updateDb({ icon: null })} onClose={() => setEmoji(null)} />
        </Popover>
      )}
    </div>
  );
}
