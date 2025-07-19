// src/entry.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App.jsx';
import '../index.css'; // Optional: if you have global styles

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Couldn't find root element to mount React app.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
