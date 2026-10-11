import { useEffect, useRef, useState } from 'react';
import { COLORS, COLOR_LABEL } from '../../lib/constants.js';
import { uid } from '../../lib/blocks.js';
import { propTypeInfo } from '../../lib/dbdefaults.js';
import { todayIso } from '../../lib/dbquery.js';
import Popover, { MenuItem } from '../Popover.jsx';
import Icon from '../Icon.jsx';

export const Tag = ({ option }) => <span className={`tag tag-${option.color || 'gray'}`}>{option.name}</span>;

export const PropIcon = ({ type }) => <span className="prop-glyph" aria-hidden="true">{propTypeInfo(type).glyph}</span>;

const fmtDay = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
export const formatDate = (v) => {
  if (!v?.start) return '';
  return v.end && v.end !== v.start ? `${fmtDay(v.start)} → ${fmtDay(v.end)}` : fmtDay(v.start);
};

/** Read-only rendering of a property value (used on cards, list rows and read-only columns). */
export function ValueView({ prop, row }) {
  const v = prop.type === 'created_time' ? { start: new Date(row.created_at).toISOString().slice(0, 10) }
    : prop.type === 'last_edited_time' ? { start: new Date(row.updated_at).toISOString().slice(0, 10) }
      : row.props?.[prop.id];
  switch (prop.type) {
    case 'select': case 'status': {
      const o = prop.options?.find((x) => x.id === v);
      return o ? <Tag option={o} /> : null;
    }
    case 'multi_select':
      return <span className="tags">{(v || []).map((id) => prop.options?.find((x) => x.id === id)).filter(Boolean).map((o) => <Tag key={o.id} option={o} />)}</span>;
    case 'date': case 'created_time': case 'last_edited_time':
      return v?.start ? <span className="val-text">{formatDate(v)}</span> : null;
    case 'checkbox':
      return <span className={`checkbox sm${v ? ' on' : ''}`}>{v && <Icon name="check" size={10} />}</span>;
    case 'number':
      return v == null || v === '' ? null : <span className="val-text">{v}</span>;
    case 'url': case 'email': case 'phone':
      return v ? <span className="val-text link">{v}</span> : null;
    default:
      return v ? <span className="val-text">{v}</span> : null;
  }
}

/* ---------------------------------------------------------------- pickers */

function OptionEditor({ option, onChange, onDelete, onBack }) {
  const [name, setName] = useState(option.name);
  return (
    <div className="option-editor">
      <button className="menu-back" onClick={onBack}><Icon name="chevronLeft" size={12} /> Edit option</button>
      <input
        className="menu-input"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== option.name && onChange({ name: name.trim() })}
        onKeyDown={(e) => { if (e.key === 'Enter') { onChange({ name: name.trim() || option.name }); onBack(); } }}
        aria-label="Option name"
      />
      <MenuItem danger icon={<Icon name="trash" />} onClick={onDelete}>Delete</MenuItem>
      <div className="menu-group">Colors</div>
      {COLORS.map((c) => (
        <MenuItem key={c} icon={<span className={`swatch-dot tag-${c}`} />} onClick={() => onChange({ color: c })} right={option.color === c ? <Icon name="check" size={13} /> : null}>
          {COLOR_LABEL(c)}
        </MenuItem>
      ))}
    </div>
  );
}

const STATUS_GROUPS = [['todo', 'To-do'], ['in_progress', 'In progress'], ['complete', 'Complete']];

export function OptionPicker({ anchor, prop, value, multi, onChange, onUpdateProp, onClose }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const options = prop.options || [];
  const selected = multi ? (value || []) : value ? [value] : [];
  const shown = options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = options.some((o) => o.name.toLowerCase() === q.trim().toLowerCase());

  const choose = (o) => {
    if (multi) onChange(selected.includes(o.id) ? selected.filter((x) => x !== o.id) : [...selected, o.id]);
    else { onChange(value === o.id ? null : o.id); onClose(); }
  };
  const create = () => {
    const name = q.trim();
    if (!name) return;
    const used = new Set(options.map((o) => o.color));
    const color = COLORS.find((c) => !used.has(c)) || COLORS[options.length % COLORS.length];
    const opt = { id: uid(), name, color, ...(prop.type === 'status' ? { group: 'todo' } : {}) };
    onUpdateProp({ options: [...options, opt] });
    if (multi) onChange([...selected, opt.id]); else { onChange(opt.id); onClose(); }
    setQ('');
  };
  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (shown.length === 1 || (shown.length && exact)) choose(shown.find((o) => o.name.toLowerCase() === q.trim().toLowerCase()) || shown[0]);
      else if (q.trim()) create();
    }
  };

  const row = (o) => (
    <div key={o.id} className="option-row">
      <button type="button" className="option-main" onClick={() => choose(o)}>
        <Tag option={o} />
        {selected.includes(o.id) && <Icon name="check" size={13} />}
      </button>
      <button type="button" className="icon-btn small" title="Edit option" onClick={() => setEditing(o.id)}><Icon name="dots" size={14} /></button>
    </div>
  );

  const editingOpt = options.find((o) => o.id === editing);
  return (
    <Popover anchor={anchor} onClose={onClose} width={260} maxHeight={380} className="option-picker">
      {editingOpt ? (
        <OptionEditor
          option={editingOpt}
          onBack={() => setEditing(null)}
          onChange={(patch) => onUpdateProp({ options: options.map((o) => (o.id === editingOpt.id ? { ...o, ...patch } : o)) })}
          onDelete={() => {
            onUpdateProp({ options: options.filter((o) => o.id !== editingOpt.id) });
            if (selected.includes(editingOpt.id)) onChange(multi ? selected.filter((x) => x !== editingOpt.id) : null);
            setEditing(null);
          }}
        />
      ) : (
        <>
          <input className="menu-input" autoFocus placeholder={multi ? 'Search or create an option…' : 'Search or create an option…'} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} aria-label="Search options" />
          <div className="option-list">
            {prop.type === 'status'
              ? STATUS_GROUPS.map(([g, label]) => {
                const inGroup = shown.filter((o) => (o.group || 'todo') === g);
                return inGroup.length ? <div key={g}><div className="menu-group">{label}</div>{inGroup.map(row)}</div> : null;
              })
              : <>{shown.length > 0 && <div className="menu-group">Select an option or create one</div>}{shown.map(row)}</>}
            {q.trim() && !exact && (
              <button type="button" className="option-create" onClick={create}>Create <Tag option={{ name: q.trim(), color: 'gray' }} /></button>
            )}
            {!shown.length && !q.trim() && <div className="empty-note">No options yet — type to create one</div>}
          </div>
        </>
      )}
    </Popover>
  );
}

export function DatePicker({ anchor, value, onChange, onClose }) {
  const v = value || { start: '', end: null };
  const [hasEnd, setHasEnd] = useState(!!v.end);
  const set = (patch) => {
    const next = { ...v, ...patch };
    if (!next.start) { onChange(next.end ? { start: next.end, end: null } : null); return; }
    if (next.end && next.end < next.start) next.end = next.start;
    onChange({ start: next.start, end: hasEnd || patch.end ? next.end : null });
  };
  return (
    <Popover anchor={anchor} onClose={onClose} width={250} className="date-picker">
      <label className="field"><span>{hasEnd ? 'Start' : 'Date'}</span><input type="date" autoFocus value={v.start || ''} onChange={(e) => set({ start: e.target.value })} /></label>
      {hasEnd && <label className="field"><span>End</span><input type="date" value={v.end || ''} min={v.start || undefined} onChange={(e) => set({ end: e.target.value })} /></label>}
      <label className="switch-row">
        <span>End date</span>
        <input type="checkbox" checked={hasEnd} onChange={(e) => { setHasEnd(e.target.checked); onChange(v.start ? { start: v.start, end: e.target.checked ? v.end || v.start : null } : null); }} />
      </label>
      <div className="date-actions">
        <button className="btn-small" onClick={() => onChange({ start: todayIso(), end: hasEnd ? todayIso() : null })}>Today</button>
        <button className="btn-small" onClick={() => { onChange(null); onClose(); }}>Clear</button>
      </div>
    </Popover>
  );
}

/* ---------------------------------------------------------------- editable cell */

function TextCell({ prop, value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef(null);
  const numeric = prop.type === 'number';

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const start = () => { setDraft(value == null ? '' : String(value)); setEditing(true); };
  const commit = () => {
    setEditing(false);
    if (numeric) {
      const t = draft.trim();
      const n = t === '' ? null : Number(t);
      if (t !== '' && !Number.isFinite(n)) return;
      if (n !== (value ?? null)) onChange(n);
    } else if (draft !== (value ?? '')) {
      onChange(draft);
    }
  };

  if (editing) {
    return (
      <input
        ref={ref}
        className="cell-input"
        value={draft}
        inputMode={numeric ? 'decimal' : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); }
        }}
        aria-label={prop.name}
      />
    );
  }
  const href = prop.type === 'url' && value ? (/^https?:\/\//i.test(value) ? value : `https://${value}`)
    : prop.type === 'email' && value ? `mailto:${value}` : prop.type === 'phone' && value ? `tel:${value}` : null;
  return (
    <div className={`cell-text${numeric ? ' num' : ''}`} onClick={start} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') start(); }} role="textbox" aria-label={prop.name}>
      {value != null && value !== '' ? (href ? <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{String(value)}</a> : String(value)) : <span className="cell-empty">{numeric ? '' : ''}</span>}
    </div>
  );
}

export function Cell({ prop, row, onChange, onUpdateProp }) {
  const [anchor, setAnchor] = useState(null);
  const value = row.props?.[prop.id];
  const open = (e) => setAnchor(e.currentTarget);
  const close = () => setAnchor(null);

  switch (prop.type) {
    case 'checkbox':
      return (
        <button type="button" role="checkbox" aria-checked={!!value} aria-label={prop.name} className={`checkbox${value ? ' on' : ''}`} onClick={() => onChange(!value)}>
          {value && <Icon name="check" size={12} />}
        </button>
      );
    case 'select': case 'status': case 'multi_select':
      return (
        <>
          <button type="button" className="cell-button" onClick={open} aria-label={prop.name}>
            <ValueView prop={prop} row={row} />
          </button>
          {anchor && (
            <OptionPicker anchor={anchor} prop={prop} value={value} multi={prop.type === 'multi_select'} onChange={onChange} onUpdateProp={onUpdateProp} onClose={close} />
          )}
        </>
      );
    case 'date':
      return (
        <>
          <button type="button" className="cell-button" onClick={open} aria-label={prop.name}>
            <ValueView prop={prop} row={row} />
          </button>
          {anchor && <DatePicker anchor={anchor} value={value} onChange={onChange} onClose={close} />}
        </>
      );
    case 'created_time': case 'last_edited_time':
      return <div className="cell-text readonly">{new Date(prop.type === 'created_time' ? row.created_at : row.updated_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</div>;
    default:
      return <TextCell prop={prop} value={value} onChange={onChange} />;
  }
}
