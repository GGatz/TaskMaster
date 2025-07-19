// src/client/src/components/AddTaskForm.jsx
import React, { useState } from 'react';

export default function AddTaskForm({ onTaskCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Please enter a task title.');
      return;
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, description }),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      const newTask = await response.json();
      onTaskCreated(newTask);

      // Clear the form
      setTitle('');
      setDescription('');
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
      <div>
        <label>
          Title:
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <label>
          Description:
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ marginLeft: '0.5rem', verticalAlign: 'top' }}
          />
        </label>
      </div>

      <button type="submit" style={{ marginTop: '0.5rem' }}>
        Add Task
      </button>
    </form>
  );
}
