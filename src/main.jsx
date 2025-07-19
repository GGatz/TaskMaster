import React from 'react';
<script src="http://localhost:8097"></script>
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import {useWindowDimensions} from 'react'
import App from './App.jsx'
import DragDropBoard from './components/DragDropBoard'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div style={{
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    padding: '16px',
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    boxSizing: 'border-box',
  }}>
      <DragDropBoard/>
    </div>
    
  </StrictMode>,
)
