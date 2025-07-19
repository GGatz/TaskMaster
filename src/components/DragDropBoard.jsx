import React, { useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import Column from './Column';

function DragDropBoard() {
  const [data, setData] = useState(() => ({
    columns: {
      red: {
        id: 'red',
        title: 'Red Column',
        colorKey: 'red',
        items: [
          { id: '1', content: 'Red Item 1' },
          { id: '2', content: 'Red Item 2' },
        ],
      },
      green: {
        id: 'green',
        title: 'Green Column',
        colorKey: 'green',
        items: [
          { id: '3', content: 'Green Item 1' },
          { id: '4', content: 'Green Item 2' },
        ],
      },
      // etc.
    },
  }));

  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const onSelectTask = (taskId) => {
    setSelectedTaskId(taskId);
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const sourceCol = data.columns[source.droppableId];
    const destCol = data.columns[destination.droppableId];
    const draggedItem = sourceCol.items[source.index];

    if (source.droppableId === destination.droppableId) {
      const newItems = [...sourceCol.items];
      newItems.splice(source.index, 1);
      newItems.splice(destination.index, 0, draggedItem);
      setData((prev) => ({
        ...prev,
        columns: {
          ...prev.columns,
          [source.droppableId]: {
            ...sourceCol,
            items: newItems,
          },
        },
      }));
    } else {
      const sourceItems = [...sourceCol.items];
      sourceItems.splice(source.index, 1);
      const destItems = [...destCol.items];
      destItems.splice(destination.index, 0, draggedItem);
      setData((prev) => ({
        ...prev,
        columns: {
          ...prev.columns,
          [source.droppableId]: { ...sourceCol, items: sourceItems },
          [destination.droppableId]: { ...destCol, items: destItems },
        },
      }));
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '16px',
          width: '100%',
          maxWidth: '1400px',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {Object.entries(data.columns).map(([id, col]) => (
          <Column
            key={id}
            column={col}
            onSelectTask={onSelectTask}
            selectedTaskId={selectedTaskId}
          />
        ))}
      </div>
    </DragDropContext>
  );
}

export default DragDropBoard;