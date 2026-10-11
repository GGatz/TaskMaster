import { useEffect, useRef } from 'react';
import PageIcon from '../PageIcon.jsx';
import { ValueView } from './cells.jsx';

export const shownProps = (db, view) => db.schema.filter((p) => p.type !== 'title' && !(view.hidden || []).includes(p.id) && !(view.type === 'board' && p.id === view.groupBy));

const hasValue = (p, row) => {
  if (p.type === 'created_time' || p.type === 'last_edited_time') return true;
  const v = row.props?.[p.id];
  if (p.type === 'checkbox') return true;
  return !(v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !v.start));
};

/** Title that turns into an input while a freshly created row is being named. */
export function CardTitle({ row, editing, onChange, onDone }) {
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  if (!editing) return <span className="card-title">{row.title || <span className="untitled">Untitled</span>}</span>;
  return (
    <input
      ref={ref}
      className="card-title-input"
      value={row.title}
      placeholder="Untitled"
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onDone(); } }}
      onClick={(e) => e.stopPropagation()}
      aria-label="Name"
    />
  );
}

export function CardProps({ db, view, row }) {
  const props = shownProps(db, view).filter((p) => hasValue(p, row));
  if (!props.length) return null;
  return (
    <div className="card-props">
      {props.map((p) => (
        <div className="card-prop" key={p.id}><ValueView prop={p} row={row} /></div>
      ))}
    </div>
  );
}

export function RowHead({ row, editing, onChange, onDone }) {
  return (
    <div className="card-head">
      {row.icon && <PageIcon icon={row.icon} size={16} />}
      <CardTitle row={row} editing={editing} onChange={onChange} onDone={onDone} />
    </div>
  );
}
