import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import Entry from './Entry';

export default function Column({ column }) {
  return (
    <Droppable droppableId={column.id}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          style={{
            flex: '1 1 0',
            minWidth: '280px',
            backgroundColor: column.color,
            padding: '12px',
            borderRadius: '8px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h3 style={{ textAlign: 'center' }}>{column.title}</h3>
          {column.items.map((item, index) => (
            <Entry key={item.id} item={item} index={index} color={column.color} />
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}
