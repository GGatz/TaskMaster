import { useMemo, useState } from 'react';
import { addDays, impliedDefaults, isoDate, todayIso } from '../../lib/dbquery.js';
import Icon from '../Icon.jsx';
import { CardTitle } from './cards.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView({ d, view, rows, go, newRowId, setNewRowId }) {
  const { db } = d;
  const dateProp = db.schema.find((p) => p.id === view.dateBy && p.type === 'date') || db.schema.find((p) => p.type === 'date');
  const [cursor, setCursor] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1); });
  const [dragRow, setDragRow] = useState(null);
  const [over, setOver] = useState(null);
  const colorProp = db.schema.find((p) => p.type === 'status' || p.type === 'select');

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const total = Math.ceil((first.getDay() + lastDay.getDate()) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return { iso: isoDate(day), date: day, inMonth: day.getMonth() === cursor.getMonth() };
    });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map();
    if (!dateProp) return map;
    for (const r of rows) {
      const v = r.props?.[dateProp.id];
      if (!v?.start) continue;
      const end = v.end && v.end >= v.start ? v.end : v.start;
      for (let cur = v.start, guard = 0; cur <= end && guard < 62; cur = addDays(cur, 1), guard++) {
        if (!map.has(cur)) map.set(cur, []);
        map.get(cur).push(r);
      }
    }
    return map;
  }, [rows, dateProp]);

  if (!dateProp) {
    return (
      <div className="empty-state">
        <p>A calendar needs a <b>Date</b> property to place pages on.</p>
        <button className="btn primary" onClick={() => { const p = d.addProperty('Date', 'date'); d.updateView(view.id, { dateBy: p.id }); }}>Add a Date property</button>
      </div>
    );
  }

  const today = todayIso();
  const title = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shift = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  const addOn = async (iso) => {
    const row = await d.addRow({ props: { ...impliedDefaults(db.schema, view), [dateProp.id]: { start: iso, end: null } } });
    setNewRowId(row.id);
  };
  const moveTo = (row, iso) => {
    const v = row.props?.[dateProp.id];
    if (!v?.start || v.start === iso) return;
    const span = v.end ? Math.round((new Date(v.end) - new Date(v.start)) / 86400000) : 0;
    d.updateRow(row.id, { props: { [dateProp.id]: { start: iso, end: span ? addDays(iso, span) : null } } });
  };
  const colorOf = (row) => colorProp?.options?.find((o) => o.id === row.props?.[colorProp.id])?.color || 'gray';
  const noDate = rows.filter((r) => !r.props?.[dateProp.id]?.start);

  return (
    <div className="calendar">
      <div className="cal-head">
        <strong>{title}</strong>
        <span className="push" />
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="chevronLeft" /></button>
        <button className="btn-small" onClick={() => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); }}>Today</button>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevronRight" /></button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w) => <div key={w} className="cal-dow">{w}</div>)}
        {days.map((day) => (
          <div
            key={day.iso}
            className={`cal-day${day.inMonth ? '' : ' out'}${day.iso === today ? ' today' : ''}${over === day.iso ? ' over' : ''}`}
            onDragOver={(e) => { if (dragRow) { e.preventDefault(); setOver(day.iso); } }}
            onDragLeave={() => setOver((o) => (o === day.iso ? null : o))}
            onDrop={(e) => { e.preventDefault(); if (dragRow) moveTo(dragRow, day.iso); setDragRow(null); setOver(null); }}
          >
            <div className="cal-daynum">
              <span>{day.date.getDate() === 1 ? day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : day.date.getDate()}</span>
              <button className="icon-btn small cal-add" title="New page on this day" aria-label={`New page on ${day.iso}`} onClick={() => addOn(day.iso)}><Icon name="plus" size={12} /></button>
            </div>
            {(byDay.get(day.iso) || []).map((row) => (
              <div
                key={row.id}
                className={`cal-event tag-${colorOf(row)}`}
                draggable
                onDragStart={() => setDragRow(row)}
                onDragEnd={() => { setDragRow(null); setOver(null); }}
                onClick={() => { if (row.id !== newRowId) go(row.id); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) go(row.id); }}
              >
                <CardTitle row={row} editing={row.id === newRowId} onChange={(t) => d.updateRow(row.id, { title: t })} onDone={() => setNewRowId(null)} />
              </div>
            ))}
          </div>
        ))}
      </div>
      {noDate.length > 0 && (
        <div className="cal-nodate">
          <div className="menu-group">No date ({noDate.length})</div>
          {noDate.map((r) => <button key={r.id} className="chip" onClick={() => go(r.id)}>{r.title || 'Untitled'}</button>)}
        </div>
      )}
    </div>
  );
}
