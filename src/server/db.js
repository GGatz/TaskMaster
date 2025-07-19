// src/server/db.js
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: '192.168.1.123', // your other computer's IP
  user: 'your_user',
  password: 'your_password',
  database: 'your_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
