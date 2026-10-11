// Block text is stored as a small, restricted subset of HTML. Anything that enters the
// editor from outside (paste, drop, saved data) goes through sanitizeHtml first.

const INLINE_OK = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'CODE', 'A', 'SPAN', 'BR', 'MARK']);
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'TITLE', 'META', 'LINK']);
const BLOCK_BREAKS = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'TR']);

const COLOR_CLASS = /^(tc|bg)-[a-z]+$/;
const SAFE_HREF = /^(https?:|mailto:|tel:|\/|#)/i;

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function unescapeHtml(s) {
  return String(s).replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

export function htmlToText(html) {
  return unescapeHtml(String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''));
}

function clean(node, out) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.appendChild(document.createTextNode(child.nodeValue));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = child.tagName;
    if (DROP_WITH_CONTENT.has(tag)) continue;
    if (!INLINE_OK.has(tag)) {
      // Unwrap unknown elements but keep paragraphs apart with a line break.
      const before = out.childNodes.length;
      clean(child, out);
      if (BLOCK_BREAKS.has(tag) && out.childNodes.length > before) out.appendChild(document.createElement('br'));
      continue;
    }
    if (tag === 'BR') {
      out.appendChild(document.createElement('br'));
      continue;
    }
    const el = document.createElement(tag === 'STRIKE' || tag === 'DEL' ? 's' : tag === 'B' ? 'strong' : tag === 'I' ? 'em' : tag.toLowerCase());
    if (tag === 'A') {
      const href = child.getAttribute('href');
      const page = child.getAttribute('data-page');
      if (page && /^[\w-]+$/.test(page)) {
        el.setAttribute('data-page', page);
        el.setAttribute('class', 'mention');
        el.setAttribute('contenteditable', 'false');
      } else if (href && SAFE_HREF.test(href.trim())) {
        el.setAttribute('href', href.trim());
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    } else if (tag === 'SPAN' || tag === 'MARK') {
      const classes = (child.getAttribute('class') || '').split(/\s+/).filter((c) => COLOR_CLASS.test(c));
      if (!classes.length) {
        clean(child, out);
        continue;
      }
      el.setAttribute('class', classes.join(' '));
    }
    clean(child, el);
    out.appendChild(el);
  }
}

export function sanitizeHtml(html) {
  if (!html) return '';
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const out = document.createElement('div');
  clean(tpl.content, out);
  // Trim a trailing <br> left by block-level unwrapping.
  while (out.lastChild && out.lastChild.nodeName === 'BR') out.removeChild(out.lastChild);
  return out.innerHTML;
}
