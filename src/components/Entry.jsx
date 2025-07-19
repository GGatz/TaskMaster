import React from 'react';
import { Draggable } from '@hello-pangea/dnd';

export default function Entry({ item, index, color }) {
  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            padding: '12px',
            marginBottom: '8px',
            borderRadius: '4px',
            backgroundColor: color,
            boxShadow: snapshot.isDragging
              ? '0 2px 6px rgba(0,0,0,0.2)'
              : 'none',
            ...provided.draggableProps.style,
          }}
        >
          {item.content}
        </div>
      )}
    </Draggable>
  );
}
