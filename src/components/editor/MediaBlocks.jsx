import { useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import Popover from '../Popover.jsx';
import Icon from '../Icon.jsx';
import { useEditor, useUi } from './EditorContext.js';

const isHttp = (u) => /^https?:\/\/\S+$/i.test(u || '');

export function ImageBlock({ block }) {
  const ed = useEditor();
  const { readOnly } = useUi();
  const [picker, setPicker] = useState(null);
  const [tab, setTab] = useState('upload');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const frameRef = useRef(null);
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const url = await api.upload(file);
      ed.update(block.id, { url });
      setPicker(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startResize = (e, side) => {
    e.preventDefault();
    const frame = frameRef.current;
    const container = frame.parentElement.getBoundingClientRect().width;
    const startX = e.clientX;
    const startW = frame.getBoundingClientRect().width;
    const move = (ev) => {
      const delta = (ev.clientX - startX) * (side === 'left' ? -1 : 1) * (block.align === 'center' || !block.align ? 2 : 1);
      const pct = Math.max(10, Math.min(100, ((startW + delta) / container) * 100));
      frame.style.width = `${pct}%`;
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      ed.update(block.id, { width: Math.round(parseFloat(frame.style.width)) });
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  if (!block.url) {
    return (
      <>
        <button
          type="button"
          className="media-empty"
          disabled={readOnly}
          onClick={(e) => setPicker(e.currentTarget)}
        >
          <Icon name="image" /> Add an image
        </button>
        {picker && (
          <Popover anchor={picker} onClose={() => setPicker(null)} width={380} className="media-picker">
            <div className="tabs">
              <button className={tab === 'upload' ? 'active' : ''} onClick={() => setTab('upload')}>Upload</button>
              <button className={tab === 'link' ? 'active' : ''} onClick={() => setTab('link')}>Embed link</button>
            </div>
            {tab === 'upload' ? (
              <div className="picker-body">
                <button className="btn wide" disabled={busy} onClick={() => fileRef.current.click()}>{busy ? 'Uploading…' : 'Upload file'}</button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" hidden onChange={(e) => upload(e.target.files[0])} />
                <div className="hint">PNG, JPG, GIF, WebP or AVIF · up to 20 MB. You can also paste or drop an image on the page.</div>
              </div>
            ) : (
              <form
                className="picker-body"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!isHttp(link.trim())) { setError('Enter a valid http(s) URL'); return; }
                  ed.update(block.id, { url: link.trim() });
                  setPicker(null);
                }}
              >
                <input autoFocus placeholder="Paste the image link…" value={link} onChange={(e) => setLink(e.target.value)} />
                <button className="btn primary wide" type="submit">Embed image</button>
              </form>
            )}
            {error && <div className="form-error">{error}</div>}
          </Popover>
        )}
      </>
    );
  }

  return (
    <figure className={`image-block align-${block.align || 'center'}`}>
      <div className="image-frame" ref={frameRef} style={{ width: `${block.width || 100}%` }}>
        <img src={block.url} alt={block.caption || ''} draggable={false} onError={(e) => { e.currentTarget.classList.add('broken'); }} />
        {!readOnly && (
          <>
            <span className="resize-handle left" onMouseDown={(e) => startResize(e, 'left')} />
            <span className="resize-handle right" onMouseDown={(e) => startResize(e, 'right')} />
            <div className="image-tools">
              <button title="Align left" onClick={() => ed.update(block.id, { align: 'left' })}>⟸</button>
              <button title="Center" onClick={() => ed.update(block.id, { align: 'center' })}>⟺</button>
              <button title="Align right" onClick={() => ed.update(block.id, { align: 'right' })}>⟹</button>
              <button title="Replace image" onClick={() => ed.update(block.id, { url: '' })}><Icon name="edit" size={13} /></button>
            </div>
          </>
        )}
      </div>
      {(block.caption || !readOnly) && (
        <input
          className="caption"
          placeholder="Add a caption"
          value={block.caption || ''}
          readOnly={readOnly}
          onChange={(e) => ed.update(block.id, { caption: e.target.value }, { typing: true })}
        />
      )}
    </figure>
  );
}

export function BookmarkBlock({ block }) {
  const ed = useEditor();
  const { readOnly } = useUi();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  if (!block.url) {
    return (
      <form
        className="bookmark-empty"
        onSubmit={(e) => {
          e.preventDefault();
          const v = value.trim();
          if (!isHttp(v)) { setError('Enter a valid http(s) URL'); return; }
          ed.update(block.id, { url: v, title: new URL(v).hostname.replace(/^www\./, '') });
        }}
      >
        <Icon name="link" />
        <input placeholder="Paste a link to create a bookmark…" value={value} onChange={(e) => { setValue(e.target.value); setError(''); }} disabled={readOnly} />
        <button className="btn primary small" type="submit" disabled={readOnly}>Create bookmark</button>
        {error && <span className="form-error">{error}</span>}
      </form>
    );
  }
  let host = block.url;
  try { host = new URL(block.url).hostname; } catch { /* keep raw */ }
  return (
    <div className="bookmark">
      <div className="bookmark-text">
        <input
          className="bookmark-title"
          value={block.title || ''}
          placeholder="Untitled bookmark"
          readOnly={readOnly}
          onChange={(e) => ed.update(block.id, { title: e.target.value }, { typing: true })}
        />
        <input
          className="bookmark-desc"
          value={block.description || ''}
          placeholder="Add a description"
          readOnly={readOnly}
          onChange={(e) => ed.update(block.id, { description: e.target.value }, { typing: true })}
        />
        <a href={block.url} target="_blank" rel="noopener noreferrer" className="bookmark-url">
          <Icon name="link" size={13} />
          {host !== block.url ? `${host} · ` : ''}{block.url}
        </a>
      </div>
    </div>
  );
}

function toEmbedUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}`;
      if (u.pathname.startsWith('/embed/')) return `https://www.youtube-nocookie.com${u.pathname}`;
    }
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`;
    if (host === 'vimeo.com' && /^\/\d+/.test(u.pathname)) return `https://player.vimeo.com/video/${u.pathname.slice(1)}`;
    if (host === 'loom.com' && u.pathname.startsWith('/share/')) return `https://www.loom.com/embed/${u.pathname.split('/')[2]}`;
    return u.toString();
  } catch {
    return null;
  }
}

export function EmbedBlock({ block }) {
  const ed = useEditor();
  const { readOnly } = useUi();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const src = block.url && toEmbedUrl(block.url);

  if (!src) {
    return (
      <form
        className="bookmark-empty"
        onSubmit={(e) => {
          e.preventDefault();
          if (!toEmbedUrl(value.trim())) { setError('Enter a valid URL'); return; }
          ed.update(block.id, { url: value.trim() });
        }}
      >
        <Icon name="external" />
        <input placeholder="Paste a link to embed (YouTube, Vimeo, Loom, any site)…" value={value} onChange={(e) => { setValue(e.target.value); setError(''); }} disabled={readOnly} />
        <button className="btn primary small" type="submit" disabled={readOnly}>Embed</button>
        {error && <span className="form-error">{error}</span>}
      </form>
    );
  }
  return (
    <div className="embed">
      <iframe
        src={src}
        title={block.url}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms"
        referrerPolicy="no-referrer"
        allow="fullscreen; picture-in-picture"
      />
      {!readOnly && <button className="btn-ghost embed-reset" onClick={() => ed.update(block.id, { url: '' })}>Change link</button>}
    </div>
  );
}
