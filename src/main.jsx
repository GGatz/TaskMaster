import { createRoot } from 'react-dom/client';
import { WorkspaceProvider } from './lib/store.jsx';
import App from './App.jsx';
import './styles/base.css';
import './styles/sidebar.css';
import './styles/editor.css';
import './styles/database.css';

createRoot(document.getElementById('root')).render(
  <WorkspaceProvider>
    <App />
  </WorkspaceProvider>,
);
