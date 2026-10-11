import PageIcon from '../PageIcon.jsx';
import Icon from '../Icon.jsx';
import { coverStyle } from '../../lib/constants.js';
import { CardProps, CardTitle, shownProps } from './cards.jsx';
import { ValueView } from './cells.jsx';

export function ListView({ d, view, rows, go, newRowId, setNewRowId, onAddRow }) {
  const { db } = d;
  const props = shownProps(db, view);
  return (
    <div className="list-view">
      {rows.map((row) => (
        <div
          key={row.id}
          className="list-row"
          role="button"
          tabIndex={0}
          onClick={() => { if (row.id !== newRowId) go(row.id); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) go(row.id); }}
        >
          <PageIcon icon={row.icon} size={18} />
          <CardTitle row={row} editing={row.id === newRowId} onChange={(title) => d.updateRow(row.id, { title })} onDone={() => setNewRowId(null)} />
          <span className="list-props">
            {props.map((p) => <span key={p.id} className="list-prop"><ValueView prop={p} row={row} /></span>)}
          </span>
        </div>
      ))}
      <button type="button" className="tv-new" onClick={() => onAddRow()}><Icon name="plus" size={14} /> New</button>
    </div>
  );
}

export function GalleryView({ d, view, rows, go, onAddRow }) {
  const { db } = d;
  return (
    <div className="gallery">
      {rows.map((row) => (
        <div key={row.id} className="gallery-card" role="button" tabIndex={0} onClick={() => go(row.id)} onKeyDown={(e) => { if (e.key === 'Enter') go(row.id); }}>
          <div className={`gallery-cover${row.cover ? '' : ' empty'}`} style={coverStyle(row.cover)}>
            {!row.cover && <PageIcon icon={row.icon} type="page" size={36} />}
          </div>
          <div className="gallery-body">
            <div className="card-head">
              {row.cover && row.icon && <PageIcon icon={row.icon} size={16} />}
              <span className="card-title">{row.title || <span className="untitled">Untitled</span>}</span>
            </div>
            <CardProps db={db} view={view} row={row} />
          </div>
        </div>
      ))}
      <button type="button" className="gallery-card new" onClick={() => onAddRow()}><Icon name="plus" size={16} /> New</button>
    </div>
  );
}
