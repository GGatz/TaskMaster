// src/server/server.js
import express from 'express';
import cors from 'cors';
import taskRoutes from './routes/tasks.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Enable CORS for all origins (adjust if needed)
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/api/tasks', taskRoutes);

// Root route (optional)
app.get('/', (req, res) => {
  res.send('Task Tracker API is running');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
