// src/server/server.js
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/tasks', (req, res) => {
  res.json([
    { id: 1, title: 'Example Task', completed: false },
    { id: 2, title: 'Another Task', completed: true }
  ]);
});

app.listen(PORT, () => {
  console.log(`Backend API is running on http://localhost:${PORT}`);
});
