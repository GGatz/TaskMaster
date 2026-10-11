import { useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { uid } from '../../lib/blocks.js';
import { COLORS } from '../../lib/constants.js';
import { impliedDefaults } from '../../lib/dbquery.js';
import Icon from '../Icon.jsx';
import { Tag } from './cells.jsx';
import { CardProps, RowHead } from './cards.jsx';

export default function BoardView({ d, view, rows, go, newRowId, setNewRowId }) {
  const { db } = d;
  const groupProp = db.schema.find((p) => p.id === view.groupBy && (p.type === 'select' || p.type === 'status'))
    || db.schema.find((p) => p.type === 'select' || p.type === 'status');
  const [addingGroup, setAddingGroup] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const columns = useMemo(() => {
    if (!groupProp) return [];
    const cols = (groupProp.options || []).map((o) => ({ id: o.id, option: o, rows: [] }));
    const none = { id: '__none', option: null, rows: [] };
    const byId = new Map(cols.map((c) => [c.id, c]));
    for (const r of rows) (byId.get(r.props?.[groupProp.id]) || none).rows.push(r);
    return none.rows.length ? [none, ...cols] : cols;
  }, [rows, groupProp]);

  if (!groupProp) {
    return (
      <div className="empty-state">
        <p>A board groups cards by a <b>Select</b> or <b>Status</b> property.</p>
        <button className="btn primary" onClick={() => { const p = d.addProperty('Status', 'status'); d.updateView(view.id, { groupBy: p.id }); }}>Add a Status property</button>
      </div>
    );
  }

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const dest = columns.find((c) => c.id === destination.droppableId);
    const others = dest.rows.filter((r) => r.id !== draggableId);
    const prev = others[destination.index - 1];
    const next = others[destination.index];
    const position = prev && next ? (prev.position + next.position) / 2 : prev ? prev.position + 1 : next ? next.position - 1 : 1;
    const value = dest.option ? dest.option.id : null;
    d.updateRow(draggableId, { position, props: { [groupProp.id]: value } });
  };

  const addCard = async (col) => {
    const defaults = impliedDefaults(db.schema, view);
    const row = await d.addRow({ props: { ...defaults, [groupProp.id]: col.option ? col.option.id : null } });
    setNewRowId(row.id);
  };

  const addGroup = () => {
    const name = addingGroup.trim();
    if (!name) { setShowAdd(false); return; }
    const used = new Set((groupProp.options || []).map((o) => o.color));
    d.updateProperty(groupProp.id, { options: [...(groupProp.options || []), { id: uid(), name, color: COLORS.find((c) => !used.has(c)) || 'gray', ...(groupProp.type === 'status' ? { group: 'todo' } : {}) }] });
    setAddingGroup('');
    setShowAdd(false);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="board">
        {columns.map((col) => (
          <div className="board-col" key={col.id}>
            <div className="board-col-head">
              {col.option ? <Tag option={col.option} /> : <span className="tag tag-gray none">No {groupProp.name}</span>}
              <span className="count">{col.rows.length}</span>
              <button className="icon-btn small push" title="Add a card" aria-label={`Add a card to ${col.option?.name || 'No ' + groupProp.name}`} onClick={() => addCard(col)}><Icon name="plus" size={14} /></button>
            </div>
            <Droppable droppableId={col.id}>
              {(prov, snap) => (
                <div ref={prov.innerRef} {...prov.droppableProps} className={`board-cards${snap.isDraggingOver ? ' over' : ''}`}>
                  {col.rows.map((row, i) => (
                    <Draggable draggableId={row.id} index={i} key={row.id}>
                      {(p, s) => (
                        <div
                          ref={p.innerRef}
                          {...p.draggableProps}
                          {...p.dragHandleProps}
                          className={`card${s.isDragging ? ' dragging' : ''}`}
                          onClick={() => { if (row.id !== newRowId) go(row.id); }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) go(row.id); }}
                        >
                          <RowHead row={row} editing={row.id === newRowId} onChange={(title) => d.updateRow(row.id, { title })} onDone={() => setNewRowId(null)} />
                          <CardProps db={db} view={view} row={row} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {prov.placeholder}
                </div>
              )}
            </Droppable>
            <button className="board-new" onClick={() => addCard(col)}><Icon name="plus" size={14} /> New</button>
          </div>
        ))}
        <div className="board-col add-group">
          {showAdd ? (
            <input
              autoFocus
              className="menu-input"
              placeholder="Group name"
              value={addingGroup}
              onChange={(e) => setAddingGroup(e.target.value)}
              onBlur={addGroup}
              onKeyDown={(e) => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') { setAddingGroup(''); setShowAdd(false); } }}
            />
          ) : (
            <button className="board-new" onClick={() => setShowAdd(true)}><Icon name="plus" size={14} /> Add a group</button>
          )}
        </div>
      </div>
    </DragDropContext>
  );
}
