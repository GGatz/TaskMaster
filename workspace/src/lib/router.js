import { useEffect, useState } from 'react';

// Hash routing keeps the app deployable as static files behind any server: #/p/<pageId>
const parse = () => {
  const m = window.location.hash.match(/^#\/p\/([\w-]+)/);
  return m ? m[1] : null;
};

export function useRoute() {
  const [id, setId] = useState(parse);
  useEffect(() => {
    const onChange = () => setId(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return id;
}

export const navigate = (id) => {
  window.location.hash = id ? `#/p/${id}` : '#/';
};

export const pageUrl = (id) => `${window.location.origin}${window.location.pathname}#/p/${id}`;
