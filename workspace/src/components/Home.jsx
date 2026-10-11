import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { timeAgo } from '../lib/constants.js';
import { useWorkspace } from '../lib/store.jsx';
import { Topbar } from './PageView.jsx';
import PageIcon from './PageIcon.jsx';
import Icon from './Icon.jsx';
import { newDatabaseSetup } from '../lib/dbdefaults.js';

export default function Home() {
  const ws = useWorkspace();
  const [recent, setRecent] = useState([]);
  useEffect(() => { api.search('').then(setRecent).catch(() => {}); }, [ws.pages]);
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <Topbar />
      <div className="page-scroll">
        <div className="home">
          <h1>{greeting}</h1>
          <div className="home-section">Recently visited</div>
          <div className="home-grid">
            {recent.map((r) => (
              <button key={r.id} className="home-card" onClick={() => ws.go(r.id)}>
                <PageIcon icon={r.icon} type={r.type} size={26} />
                <span className="home-title">{r.title || 'Untitled'}</span>
                <span className="home-time">{timeAgo(r.updated_at)}</span>
              </button>
            ))}
            <button className="home-card new" onClick={async () => { const p = await ws.createPage({}); ws.go(p.id); }}>
              <Icon name="plus" size={20} />
              <span className="home-title">New page</span>
            </button>
            <button className="home-card new" onClick={async () => { const p = await ws.createPage({ type: 'database', ...newDatabaseSetup('table') }); ws.go(p.id); }}>
              <Icon name="table" size={20} />
              <span className="home-title">New database</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
