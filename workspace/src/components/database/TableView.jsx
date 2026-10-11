import { useEffect, useRef, useState } from 'react';
import { convertValue } from '../../lib/dbquery.js';
import { emptyValue } from '../../lib/dbdefaults.js';
import { uid } from '../../lib/blocks.js';
import PageIcon from '../PageIcon.jsx';
import Popover, { MenuItem } from '../Popover.jsx';
import Icon from '../Icon.jsx';
import { Cell, PropIcon } from './cells.jsx';
import { AddPropertyMenu, HeaderMenu } from './menus.jsx';

/** Name input that grabs focus when its row has just been created. */
function TitleInput({ row, focus, onChange }) {
  const ref = useRef(null);
  useEffect(() => { if (focus) ref.current?.focus(); }, [focus]);
  return <input ref={ref} className="title-input" value={row.title} placeholder="Untitled" onChange={(e) => onChange(e.target.value)} aria-label="Name" />;
}

const DEFAULT_W = 180;
const TITLE_W = 300;

export default function TableView({ d, view, rows, go, newRowId, onAddRow, onFilterBy }) {
  const { db } = d;
  const props = db.schema.filter((p) => p.type === 'title' || !(view.hidden || []).includes(p.id));
  const widthOf = (p) => view.widths?.[p.id] ?? (p.type === 'title' ? TITLE_W : DEFAULT_W);
  const template = `${props.map((p) => `${widthOf(p)}px`).join(' ')} 44px`;
  const [menu, setMenu] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const [adding, setAdding] = useState(null);
  const gridRef = useRef(null);

  const startResize = (e, p) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widthOf(p);
    let w = startW;
    const move = (ev) => {
      w = Math.max(80, Math.min(700, startW + ev.clientX - startX));
      gridRef.current?.style.setProperty('--w-' + p.id, `${w}px`);
      const cols = props.map((x) => (x.id === p.id ? `${w}px` : `${widthOf(x)}px`)).join(' ');
      gridRef.current?.querySelectorAll('.tv-row, .tv-head').forEach((r) => { r.style.gridTemplateColumns = `${cols} 44px`; });
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      d.updateView(view.id, { widths: { ...(view.widths || {}), [p.id]: Math.round(w) } });
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const changeType = (prop, type) => {
    if (type === prop.type) return;
    const next = { ...prop, type };
    if (['select', 'multi_select', 'status'].includes(type) && !['select', 'multi_select', 'status'].includes(prop.type)) {
      // Seed options from the distinct text values already in the column.
      const names = [...new Set(d.rows.map((r) => r.props?.[prop.id]).filter((v) => typeof v === 'string' && v.trim()).flatMap((v) => v.split(',').map((s) => s.trim()).filter(Boolean)))];
      const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'yellow', 'red', 'brown', 'gray'];
      next.options = type === 'status'
        ? [{ id: uid(), name: 'Not started', color: 'gray', group: 'todo' }, { id: uid(), name: 'In progress', color: 'blue', group: 'in_progress' }, { id: uid(), name: 'Done', color: 'green', group: 'complete' }]
        : names.slice(0, 30).map((n, i) => ({ id: uid(), name: n, color: colors[i % colors.length] }));
    } else if (!['select', 'multi_select', 'status'].includes(type)) {
      delete next.options;
    } else if (type === 'status' && prop.type !== 'status') {
      next.options = (prop.options || []).map((o) => ({ ...o, group: o.group || 'todo' }));
    }
    d.updateProperty(prop.id, next);
    d.rows.forEach((r) => {
      const old = r.props?.[prop.id];
      if (old === undefined) return;
      d.updateRow(r.id, { props: { [prop.id]: convertValue(old, prop, type, next) ?? emptyValue(type) } });
    });
  };

  return (
    <div className="table-view">
      <div className="tv-scroll" ref={gridRef}>
        <div className="tv-head tv-row" style={{ gridTemplateColumns: template }} role="row">
          {props.map((p) => (
            <div key={p.id} className="tv-th" role="columnheader">
              <button type="button" className="th-btn" onClick={(e) => setMenu({ prop: p, anchor: e.currentTarget })}>
                <PropIcon type={p.type} />
                <span className="truncate">{p.name}</span>
                {(view.sorts || []).find((s) => s.prop === p.id) && <Icon name={view.sorts.find((s) => s.prop === p.id).dir === 'asc' ? 'arrowUp' : 'arrowDown'} size={12} />}
              </button>
              <span className="col-resize" onMouseDown={(e) => startResize(e, p)} />
            </div>
          ))}
          <div className="tv-th add">
            <button type="button" className="th-btn" title="Add a property" aria-label="Add a property" onClick={(e) => setAdding(e.currentTarget)}><Icon name="plus" size={14} /></button>
          </div>
        </div>
        {rows.map((row) => (
          <div className="tv-row" style={{ gridTemplateColumns: template }} key={row.id} role="row">
            {props.map((p) => (
              <div className={`tv-td${p.type === 'title' ? ' title' : ''}`} key={p.id} role="gridcell">
                {p.type === 'title' ? (
                  <>
                    <PageIcon icon={row.icon} size={18} />
                    <TitleInput row={row} focus={row.id === newRowId} onChange={(title) => d.updateRow(row.id, { title })} />
                    <button type="button" className="open-btn" onClick={() => go(row.id)} title="Open page"><Icon name="expand" size={12} /> Open</button>
                  </>
                ) : (
                  <Cell
                    prop={p}
                    row={row}
                    onChange={(v) => d.updateRow(row.id, { props: { [p.id]: v } })}
                    onUpdateProp={(patch) => d.updateProperty(p.id, patch)}
                  />
                )}
              </div>
            ))}
            <div className="tv-td end">
              <button type="button" className="icon-btn small row-menu-btn" title="Row actions" aria-label="Row actions" onClick={(e) => setRowMenu({ row, anchor: e.currentTarget })}><Icon name="dots" size={14} /></button>
            </div>
          </div>
        ))}
        <button type="button" className="tv-new" onClick={() => onAddRow()}><Icon name="plus" size={14} /> New</button>
        <div className="tv-count">{rows.length} {rows.length === 1 ? 'row' : 'rows'}</div>
      </div>
      {menu && (
        <HeaderMenu
          anchor={menu.anchor}
          prop={menu.prop}
          view={view}
          onClose={() => setMenu(null)}
          onRename={(name) => d.updateProperty(menu.prop.id, { name })}
          onChangeType={(type) => changeType(menu.prop, type)}
          onSort={(dir) => d.updateView(view.id, { sorts: [{ id: uid(), prop: menu.prop.id, dir }] })}
          onFilter={() => onFilterBy(menu.prop)}
          onHide={() => d.updateView(view.id, { hidden: [...(view.hidden || []), menu.prop.id] })}
          onDelete={() => { if (window.confirm(`Delete the "${menu.prop.name}" property? Its values will be lost.`)) d.deleteProperty(menu.prop.id); }}
        />
      )}
      {adding && <AddPropertyMenu anchor={adding} onClose={() => setAdding(null)} onAdd={(name, type) => d.addProperty(name, type)} />}
      {rowMenu && (
        <Popover anchor={rowMenu.anchor} onClose={() => setRowMenu(null)} width={200}>
          <MenuItem icon={<Icon name="expand" />} onClick={() => { go(rowMenu.row.id); setRowMenu(null); }}>Open</MenuItem>
          <MenuItem icon={<Icon name="duplicate" />} onClick={() => { d.duplicateRow(rowMenu.row.id); setRowMenu(null); }}>Duplicate</MenuItem>
          <MenuItem icon={<Icon name="trash" />} danger onClick={() => { d.deleteRow(rowMenu.row.id); setRowMenu(null); }}>Delete</MenuItem>
        </Popover>
      )}
    </div>
  );
}
