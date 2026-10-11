import { useEffect, useState } from 'react';
import { useRoute } from './lib/router.js';
import { useWorkspace } from './lib/store.jsx';
import Sidebar from './components/Sidebar.jsx';
import PageView from './components/PageView.jsx';
import Home from './components/Home.jsx';
import { SearchModal, SettingsModal, Toast, TrashModal } from './components/Modals.jsx';

export default function App() {
  const ws = useWorkspace();
  const route = useRoute();
  const [modal, setModal] = useState(null); // 'search' | 'trash' | 'settings'

  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'p') && !e.shiftKey) {
        e.preventDefault();
        setModal((m) => (m === 'search' ? null : 'search'));
      } else if (mod && e.key === '\\') {
        e.preventDefault();
        ws.setSidebarOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ws]);

  // Phones: tapping a page should reveal it, not leave the sidebar covering it.
  useEffect(() => {
    if (route && window.matchMedia('(max-width: 800px)').matches) ws.setSidebarOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  if (ws.error && !ws.loaded) return <div className="fatal">Cannot reach the server: {ws.error}</div>;

  return (
    <div className="app">
      {ws.sidebarOpen && (
        <>
          <Sidebar currentId={route} onSearch={() => setModal('search')} onTrash={() => setModal('trash')} onSettings={() => setModal('settings')} />
          <div className="sidebar-backdrop" onClick={() => ws.setSidebarOpen(false)} />
        </>
      )}
      <main className="main">
        {route ? <PageView key={route} id={route} /> : <Home />}
      </main>
      <Toast />
      {modal === 'search' && <SearchModal onClose={() => setModal(null)} />}
      {modal === 'trash' && <TrashModal onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
    </div>
  );
}
