import { lazy, Suspense, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useWorkspace } from '../../lib/store.jsx';
import PageIcon from '../PageIcon.jsx';
import { useEditor, useUi } from './EditorContext.js';

const DatabaseView = lazy(() => import('../database/DatabaseView.jsx'));

export function TocBlock({ block }) {
  const ui = useUi();
  const items = ui.headings || [];
  return (
    <nav className={`toc ${block.color ? `color-${block.color}` : ''}`} aria-label="Table of contents">
      {items.length === 0 && <div className="toc-empty">Add headings to the page to build a table of contents.</div>}
      {items.map((h) => (
        <a
          key={h.id}
          className={`toc-item l${h.level}`}
          href={`#${h.id}`}
          onClick={(e) => {
            e.preventDefault();
            document.querySelector(`[data-block-id="${h.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          {h.text || 'Untitled'}
        </a>
      ))}
    </nav>
  );
}

/** Live-resolved title/icon for a page id, falling back to a fetch for pages outside the sidebar tree. */
export function usePageMeta(pageId) {
  const { pages } = useWorkspace();
  const fromTree = pages.find((p) => p.id === pageId);
  const [fetched, setFetched] = useState(null);
  useEffect(() => {
    if (fromTree || !pageId) return undefined;
    let live = true;
    api.getPage(pageId).then((p) => live && setFetched(p)).catch(() => live && setFetched({ missing: true }));
    return () => { live = false; };
  }, [pageId, fromTree]);
  return fromTree || fetched;
}

export function PageLinkBlock({ block }) {
  const ed = useEditor();
  const meta = usePageMeta(block.pageId);
  const missing = meta?.missing;
  return (
    <button
      type="button"
      className={`page-link${missing ? ' missing' : ''}`}
      onClick={() => !missing && ed.openPage(block.pageId)}
    >
      <PageIcon icon={meta?.icon} type={meta?.type} size={22} />
      <span className="page-link-title">{missing ? 'Page not found' : meta ? meta.title || 'Untitled' : 'Loading…'}</span>
    </button>
  );
}

export function DatabaseBlock({ block }) {
  if (!block.pageId) return <div className="empty-note">This database is missing.</div>;
  return (
    <div className="db-block">
      <Suspense fallback={<div className="empty-note">Loading database…</div>}>
        <DatabaseView dbId={block.pageId} inline />
      </Suspense>
    </div>
  );
}
