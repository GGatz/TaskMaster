import React, { useState } from 'react';
import DragDropBoard from './components/DragDropBoard.jsx';// your working drag drop board

export default function Board() {
const [selectedTask, setSelectedTask] = useState(null);

  return (
    <div>
      <h1>Task Tracker</h1>
      <DragDropBoard />
    </div>
  );
}
