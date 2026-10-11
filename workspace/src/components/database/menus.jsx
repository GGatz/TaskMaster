import { useState } from 'react';
import { uid } from '../../lib/blocks.js';
import { PROPERTY_TYPES, VIEW_TYPES, propTypeInfo } from '../../lib/dbdefaults.js';
import { filterKind, needsValue, opsFor } from '../../lib/dbquery.js';
import Popover, { MenuItem } from '../Popover.jsx';
import Icon from '../Icon.jsx';
import { PropIcon } from './cells.jsx';

const DATE_TOKENS = [['exact', 'Exact date'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['yesterday', 'Yesterday'], ['week_ago', 'One week ago'], ['week_ahead', 'One week from now']];

function FilterValue({ prop, filter, onChange }) {
  const kind = filterKind(prop.type);
  if (!needsValue(filter.op)) return null;
  if (kind === 'select' || kind === 'multi_select') {
    return (
      <select value={filter.value || ''} onChange={(e) => onChange({ value: e.target.value })} aria-label="Value">
        <option value="">Choose…</option>
        {(prop.options || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    );
  }
  if (kind === 'checkbox') {
    return (
      <select value={String(filter.value !== false && filter.value !== 'false')} onChange={(e) => onChange({ value: e.target.value === 'true' })} aria-label="Value">
        <option value="true">Checked</option>
        <option value="false">Unchecked</option>
      </select>
    );
  }
  if (kind === 'date') {
    const token = DATE_TOKENS.some(([t]) => t === filter.value) ? filter.value : 'exact';
    return (
      <span className="filter-date">
        <select value={token} onChange={(e) => onChange({ value: e.target.value === 'exact' ? '' : e.target.value })} aria-label="Date">
          {DATE_TOKENS.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
        </select>
        {token === 'exact' && <input type="date" value={filter.value || ''} onChange={(e) => onChange({ value: e.target.value })} aria-label="Date value" />}
      </span>
    );
  }
  return <input type={kind === 'number' ? 'number' : 'text'} value={filter.value ?? ''} placeholder="Value" onChange={(e) => onChange({ value: e.target.value })} aria-label="Value" />;
}

export function FilterMenu({ anchor, db, view, onChange, onClose }) {
  const filters = view.filters || [];
  const setFilters = (list) => onChange({ filters: list });
  const patch = (id, p) => setFilters(filters.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const add = () => {
    const prop = db.schema[0];
    setFilters([...filters, { id: uid(), prop: prop.id, op: opsFor(prop.type)[0][0], value: '' }]);
  };
  return (
    <Popover anchor={anchor} onClose={onClose} width={520} className="filter-menu">
      {filters.length === 0 && <div className="empty-note">No filters applied to this view</div>}
      {filters.map((f, i) => {
        const prop = db.schema.find((p) => p.id === f.prop) || db.schema[0];
        return (
          <div className="filter-row" key={f.id}>
            <span className="filter-join">
              {i === 0 ? 'Where' : i === 1 ? (
                <select value={view.filterMode || 'and'} onChange={(e) => onChange({ filterMode: e.target.value })} aria-label="Match mode">
                  <option value="and">And</option>
                  <option value="or">Or</option>
                </select>
              ) : (view.filterMode === 'or' ? 'Or' : 'And')}
            </span>
            <select
              value={prop.id}
              aria-label="Property"
              onChange={(e) => {
                const np = db.schema.find((p) => p.id === e.target.value);
                patch(f.id, { prop: np.id, op: opsFor(np.type)[0][0], value: '' });
              }}
            >
              {db.schema.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={f.op} onChange={(e) => patch(f.id, { op: e.target.value })} aria-label="Condition">
              {opsFor(prop.type).map(([op, label]) => <option key={op} value={op}>{label}</option>)}
            </select>
            <FilterValue prop={prop} filter={f} onChange={(p) => patch(f.id, p)} />
            <button className="icon-btn small" title="Remove filter" onClick={() => setFilters(filters.filter((x) => x.id !== f.id))}><Icon name="x" size={14} /></button>
          </div>
        );
      })}
      <MenuItem icon={<Icon name="plus" />} onClick={add}>Add filter</MenuItem>
      {filters.length > 0 && <MenuItem icon={<Icon name="trash" />} danger onClick={() => setFilters([])}>Delete filters</MenuItem>}
    </Popover>
  );
}

export function SortMenu({ anchor, db, view, onChange, onClose }) {
  const sorts = view.sorts || [];
  const set = (list) => onChange({ sorts: list });
  return (
    <Popover anchor={anchor} onClose={onClose} width={380} className="filter-menu">
      {sorts.length === 0 && <div className="empty-note">No sorts applied to this view</div>}
      {sorts.map((s) => (
        <div className="filter-row" key={s.id}>
          <select value={s.prop} aria-label="Sort property" onChange={(e) => set(sorts.map((x) => (x.id === s.id ? { ...x, prop: e.target.value } : x)))}>
            {db.schema.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={s.dir} aria-label="Direction" onChange={(e) => set(sorts.map((x) => (x.id === s.id ? { ...x, dir: e.target.value } : x)))}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
          <button className="icon-btn small" title="Remove sort" onClick={() => set(sorts.filter((x) => x.id !== s.id))}><Icon name="x" size={14} /></button>
        </div>
      ))}
      <MenuItem icon={<Icon name="plus" />} onClick={() => { const used = new Set(sorts.map((s) => s.prop)); const prop = db.schema.find((p) => !used.has(p.id)) || db.schema[0]; set([...sorts, { id: uid(), prop: prop.id, dir: 'asc' }]); }}>Add sort</MenuItem>
      {sorts.length > 0 && <MenuItem icon={<Icon name="trash" />} danger onClick={() => set([])}>Delete sorts</MenuItem>}
    </Popover>
  );
}

export function PropertiesMenu({ anchor, db, view, onChange, onClose }) {
  const hidden = new Set(view.hidden || []);
  const toggle = (id) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange({ hidden: [...next] });
  };
  const props = db.schema.filter((p) => p.type !== 'title');
  return (
    <Popover anchor={anchor} onClose={onClose} width={260}>
      <div className="menu-group">Properties</div>
      {props.length === 0 && <div className="empty-note">No other properties</div>}
      {props.map((p) => (
        <MenuItem key={p.id} icon={<PropIcon type={p.type} />} onClick={() => toggle(p.id)} right={<Icon name={hidden.has(p.id) ? 'eyeOff' : 'eye'} size={14} />}>{p.name}</MenuItem>
      ))}
      {props.length > 0 && (
        <div className="menu-inline">
          <button className="btn-small" onClick={() => onChange({ hidden: [] })}>Show all</button>
          <button className="btn-small" onClick={() => onChange({ hidden: props.map((p) => p.id) })}>Hide all</button>
        </div>
      )}
    </Popover>
  );
}

export function AddPropertyMenu({ anchor, onAdd, onClose }) {
  const [name, setName] = useState('');
  return (
    <Popover anchor={anchor} onClose={onClose} width={250}>
      <input className="menu-input" autoFocus placeholder="Property name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Property name" />
      <div className="menu-group">Type</div>
      {PROPERTY_TYPES.map((t) => (
        <MenuItem key={t.type} icon={<span className="prop-glyph">{t.glyph}</span>} onClick={() => { onAdd(name.trim() || t.label, t.type); onClose(); }}>{t.label}</MenuItem>
      ))}
    </Popover>
  );
}

export function HeaderMenu({ anchor, prop, view, onClose, onRename, onChangeType, onSort, onFilter, onHide, onDelete }) {
  const [name, setName] = useState(prop.name);
  const isTitle = prop.type === 'title';
  const [typing, setTyping] = useState(false);
  const sort = (view.sorts || []).find((s) => s.prop === prop.id);
  return (
    <Popover anchor={anchor} onClose={() => { if (name.trim() && name !== prop.name) onRename(name.trim()); onClose(); }} width={240}>
      {typing ? (
        <>
          <button className="menu-back" onClick={() => setTyping(false)}><Icon name="chevronLeft" size={12} /> Property type</button>
          {PROPERTY_TYPES.map((t) => (
            <MenuItem key={t.type} icon={<span className="prop-glyph">{t.glyph}</span>} active={t.type === prop.type} onClick={() => { onChangeType(t.type); onClose(); }} right={t.type === prop.type ? <Icon name="check" size={13} /> : null}>{t.label}</MenuItem>
          ))}
        </>
      ) : (
        <>
          <input
            className="menu-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { if (name.trim()) onRename(name.trim()); onClose(); } }}
            aria-label="Property name"
          />
          {!isTitle && (
            <MenuItem icon={<PropIcon type={prop.type} />} right={<Icon name="chevronRight" size={12} />} onClick={() => setTyping(true)}>{propTypeInfo(prop.type).label}</MenuItem>
          )}
          <div className="menu-sep" />
          <MenuItem icon={<Icon name="arrowUp" />} active={sort?.dir === 'asc'} onClick={() => { onSort('asc'); onClose(); }}>Sort ascending</MenuItem>
          <MenuItem icon={<Icon name="arrowDown" />} active={sort?.dir === 'desc'} onClick={() => { onSort('desc'); onClose(); }}>Sort descending</MenuItem>
          <MenuItem icon={<Icon name="filter" />} onClick={() => { onFilter(); onClose(); }}>Filter</MenuItem>
          {!isTitle && <MenuItem icon={<Icon name="eyeOff" />} onClick={() => { onHide(); onClose(); }}>Hide in view</MenuItem>}
          {!isTitle && <MenuItem icon={<Icon name="trash" />} danger onClick={() => { onDelete(); onClose(); }}>Delete property</MenuItem>}
        </>
      )}
    </Popover>
  );
}

export function AddViewMenu({ anchor, onAdd, onClose }) {
  return (
    <Popover anchor={anchor} onClose={onClose} width={220}>
      <div className="menu-group">Add a view</div>
      {VIEW_TYPES.map((v) => (
        <MenuItem key={v.type} icon={<Icon name={v.icon} />} onClick={() => { onAdd(v.type); onClose(); }}>{v.label}</MenuItem>
      ))}
    </Popover>
  );
}

export function ViewSettingsMenu({ anchor, db, view, onChange, onDuplicate, onDelete, canDelete, onClose, onCreateProperty }) {
  const [name, setName] = useState(view.name);
  const groupable = db.schema.filter((p) => p.type === 'select' || p.type === 'status');
  const dates = db.schema.filter((p) => p.type === 'date');
  return (
    <Popover anchor={anchor} onClose={() => { if (name.trim() && name !== view.name) onChange({ name: name.trim() }); onClose(); }} width={280} className="view-settings">
      <input className="menu-input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { onChange({ name: name.trim() || view.name }); onClose(); } }} aria-label="View name" />
      <div className="menu-group">Layout</div>
      <div className="layout-grid">
        {VIEW_TYPES.map((v) => (
          <button key={v.type} type="button" className={`layout-btn${view.type === v.type ? ' active' : ''}`} onClick={() => onChange({ type: v.type })}>
            <Icon name={v.icon} size={18} /><span>{v.label}</span>
          </button>
        ))}
      </div>
      {view.type === 'board' && (
        <label className="field">
          <span>Group by</span>
          <select value={view.groupBy || ''} onChange={(e) => (e.target.value === '__new' ? onCreateProperty('status') : onChange({ groupBy: e.target.value || null }))}>
            {groupable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new">+ New Status property</option>
          </select>
        </label>
      )}
      {view.type === 'calendar' && (
        <label className="field">
          <span>Show by</span>
          <select value={view.dateBy || ''} onChange={(e) => (e.target.value === '__new' ? onCreateProperty('date') : onChange({ dateBy: e.target.value || null }))}>
            {dates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new">+ New Date property</option>
          </select>
        </label>
      )}
      <div className="menu-sep" />
      <MenuItem icon={<Icon name="duplicate" />} onClick={() => { onDuplicate(); onClose(); }}>Duplicate view</MenuItem>
      <MenuItem icon={<Icon name="trash" />} danger disabled={!canDelete} onClick={() => { onDelete(); onClose(); }}>Delete view</MenuItem>
    </Popover>
  );
}
