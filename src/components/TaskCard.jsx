import React from 'react';
import { Draggable } from '@hello-pangea/dnd';

export default function TaskCard({ task, index, onSelectTask, isSelected }) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`task-card ${isSelected ? 'selected' : ''}`}
          onClick={() => onSelectTask(task)}
           style={{
    padding: '10px',
    margin: '5px 0',
    border: isSelected ? '2px solid #ff9800' : '1px solid #ccc',
    borderRadius: '8px',
    backgroundColor: isSelected ? '#fff8e1' : '#f4f4f4',
    cursor: 'pointer',
  }}
        >
          {task.content}
        </div>
      )}
    </Draggable>
  );
}
