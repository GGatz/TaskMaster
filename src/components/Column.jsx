import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';

export default function Column({ column, onSelectTask, selectedTask }) {
  return (
    <div style={{ minWidth: '250px', backgroundColor: '#50830dff', padding: '8px', borderRadius: '8px' }}>
      <h3 style={{ color: column.color }}>{column.title}</h3>
      <Droppable droppableId={column.id}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{ minHeight: '100px' }}
          >
            {column.items.map((item, index) => (
              <TaskCard
                key={item.id}
                task={item}
                index={index}
                onSelectTask={onSelectTask}
                isSelected={selectedTask?.id === item.id}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
