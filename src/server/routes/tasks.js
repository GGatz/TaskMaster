// src/server/routes/tasks.js
import express from 'express';
import pool from '../db.js'; // your mysql2 pool connection

const router = express.Router();

// GET /api/tasks - Get all tasks
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// GET /api/tasks/:id - Get one task by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// POST /api/tasks - Create a new task
router.post('/', async (req, res) => {
  const { title, description, status, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  try {
    const [result] = await pool.query(
      'INSERT INTO tasks (title, description, status, due_date) VALUES (?, ?, ?, ?)',
      [title, description || null, status || 'todo', due_date || null]
    );

    const insertedId = result.insertId;
    const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [insertedId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id - Update a task
router.put('/:id', async (req, res) => {
  const { title, description, status, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  try {
    const [result] = await pool.query(
      'UPDATE tasks SET title = ?, description = ?, status = ?, due_date = ? WHERE id = ?',
      [title, description || null, status || 'todo', due_date || null, req.params.id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });

    const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id - Delete a task
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
