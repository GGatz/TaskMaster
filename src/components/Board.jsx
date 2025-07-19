
import DragDropBoard from './DragDropBoard';
import defaultData from './data/defaultData';
console.log('Board data:', data);
import { useState, useEffect } from 'react';
import { colorSchemes } from '../cfg/colors';

export default function Board() {
  const [data, setData] = useState(defaultData);
  const [selectedTask, setSelectedTask] = useState(null);

  // Create a new task in the blue column by default
  const onCreateTask = () => {
    const newTask = {
      id: String(taskIdCounter++),
      content: `New Task ${taskIdCounter}`,
    };

    const columnId = 'blue';

    setData((prev) => {
      const newItems = [...prev.columns[columnId].items, newTask];
      return {
        ...prev,
        columns: {
          ...prev.columns,
          [columnId]: {
            ...prev.columns[columnId],
            items: newItems,
          },
        },
      };
    });

    setSelectedTask(newTask);
  };

  // Edit selected task (placeholder)
  const onEditTask = () => {
    if (!selectedTask) {
      alert('Please select a task to edit.');
      return;
    }
    alert(`Editing task: ${selectedTask.content}`);
    // Here you can open a modal or inline edit form
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem' }}>
      <header
        style={{
          marginBottom: '1rem',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <Button onClick={onCreateTask}>+ Create Task</Button>
        <Button onClick={onEditTask}>✎ Edit Task</Button>
      </header>

   <DragDropBoard
  data={data}
  setData={setData}
  selectedTask={selectedTask}
  setSelectedTask={setSelectedTask}
/>

    </div>
  );
}

