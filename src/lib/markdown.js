// Markdown <-> blocks. Used for paste, import-by-paste and "Export as Markdown".

import { newBlock } from './blocks.js';
import { escapeHtml, htmlToText, sanitizeHtml } from './sanitize.js';

/* ---------- inline ---------- */

export function inlineMdToHtml(src) {
  let s = escapeHtml(src);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => `\uE000${codes.push(c) - 1}\uE001`);
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u.replace(/"/g, '%22')}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  s = s.replace(/\uE000(\d+)\uE001/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
  return sanitizeHtml(s);
}

export function inlineHtmlToMd(html) {
  if (!html) return '';
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const walk = (node) => {
    let out = '';
    for (const n of node.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) { out += n.nodeValue.replace(/\n/g, '  \n'); continue; }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const inner = walk(n);
      switch (n.tagName) {
        case 'STRONG': case 'B': out += inner.trim() ? `**${inner}**` : inner; break;
        case 'EM': case 'I': out += inner.trim() ? `*${inner}*` : inner; break;
        case 'S': case 'STRIKE': case 'DEL': out += inner.trim() ? `~~${inner}~~` : inner; break;
        case 'CODE': out += `\`${inner}\``; break;
        case 'A': out += n.getAttribute('href') ? `[${inner}](${n.getAttribute('href')})` : inner; break;
        case 'BR': out += '  \n'; break;
        default: out += inner;
      }
    }
    return out;
  };
  return walk(tpl.content);
}

/* ---------- blocks -> markdown ---------- */

export function blocksToMarkdown(blocks, depth = 0) {
  const lines = [];
  const pad = '  '.repeat(depth);
  let counter = 0;
  for (const b of blocks) {
    counter = b.type === 'numbered_list' ? counter + 1 : 0;
    const text = b.type === 'code' ? htmlToText(b.html) : inlineHtmlToMd(b.html);
    const kids = () => (b.children?.length ? blocksToMarkdown(b.children, depth + 1) : '');
    switch (b.type) {
      case 'heading_1': lines.push(`${pad}# ${text}`, ''); break;
      case 'heading_2': lines.push(`${pad}## ${text}`, ''); break;
      case 'heading_3': lines.push(`${pad}### ${text}`, ''); break;
      case 'bulleted_list': lines.push(`${pad}- ${text}`); if (b.children?.length) lines.push(kids()); break;
      case 'numbered_list': lines.push(`${pad}${counter}. ${text}`); if (b.children?.length) lines.push(kids()); break;
      case 'to_do': lines.push(`${pad}- [${b.checked ? 'x' : ' '}] ${text}`); if (b.children?.length) lines.push(kids()); break;
      case 'toggle': lines.push(`${pad}- ${text}`); if (b.children?.length) lines.push(kids()); break;
      case 'quote': lines.push(`${pad}> ${text}`, ''); break;
      case 'callout': lines.push(`${pad}> ${b.icon || ''} ${text}`.trimEnd(), ''); break;
      case 'divider': lines.push(`${pad}---`, ''); break;
      case 'code': lines.push(`${pad}\`\`\`${b.lang && b.lang !== 'plain text' ? b.lang : ''}`, text, `${pad}\`\`\``, ''); break;
      case 'image': lines.push(`${pad}![${b.caption || ''}](${b.url || ''})`, ''); break;
      case 'bookmark': case 'embed': lines.push(`${pad}[${b.title || b.url || ''}](${b.url || ''})`, ''); break;
      case 'table': {
        (b.rows || []).forEach((r, i) => {
          lines.push(`| ${r.map((c) => inlineHtmlToMd(c).replace(/\|/g, '\\|')).join(' | ')} |`);
          if (i === 0) lines.push(`| ${r.map(() => '---').join(' | ')} |`);
        });
        lines.push('');
        break;
      }
      case 'column_list': for (const c of b.children) lines.push(blocksToMarkdown(c.children, depth)); break;
      case 'child_page': case 'link_to_page': lines.push(`${pad}[Page](#/p/${b.pageId})`, ''); break;
      case 'child_database': case 'table_of_contents': break;
      default: if (text || depth === 0) lines.push(`${pad}${text}`, '');
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

/* ---------- markdown -> blocks ---------- */

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

export function looksLikeMarkdown(text) {
  return /^(#{1,3} |[-*+] |\d+[.)] |> |```|---\s*$|- \[[ xX]\] )/m.test(text) && text.includes('\n');
}

export function markdownToBlocks(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const root = [];
  const stack = []; // list nesting: {indent, block}
  let i = 0;
  const push = (block, indent = null) => {
    if (indent === null) {
      stack.length = 0;
      root.push(block);
      return;
    }
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length) stack[stack.length - 1].block.children.push(block);
    else root.push(block);
    stack.push({ indent, block });
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; stack.length = 0; continue; }

    const fence = line.match(/^\s*```\s*([\w+-]*)/);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++;
      push(newBlock('code', { html: escapeHtml(body.join('\n')), lang: fence[1] || 'plain text' }));
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      push(newBlock(`heading_${Math.min(heading[1].length, 3)}`, { html: inlineMdToHtml(heading[2]) }));
      i++; continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { push(newBlock('divider')); i++; continue; }
    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      push(newBlock('quote', { html: body.map(inlineMdToHtml).join('<br>') }));
      continue;
    }
    const img = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/);
    if (img) { push(newBlock('image', { url: img[2], caption: img[1] })); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      const rows = [];
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => inlineMdToHtml(c.trim().replace(/\\\|/g, '|')));
      rows.push(cells(line));
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      const width = Math.max(...rows.map((r) => r.length));
      push(newBlock('table', { rows: rows.map((r) => Array.from({ length: width }, (_, k) => r[k] || '')), header: true }));
      continue;
    }
    const list = line.match(LIST_RE);
    if (list) {
      const indent = list[1].replace(/\t/g, '    ').length;
      const marker = list[2];
      const body = list[3];
      let block;
      const todo = body.match(/^\[([ xX])\]\s+(.*)$/);
      if (todo) block = newBlock('to_do', { checked: todo[1] !== ' ', html: inlineMdToHtml(todo[2]) });
      else if (/^\d/.test(marker)) block = newBlock('numbered_list', { html: inlineMdToHtml(body) });
      else block = newBlock('bulleted_list', { html: inlineMdToHtml(body) });
      push(block, indent);
      i++; continue;
    }
    // paragraph: merge consecutive plain lines
    const para = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(\s*(#{1,6}\s|```|>|[-*+]\s|\d+[.)]\s|\|))/.test(lines[i])) para.push(lines[i++].trim());
    push(newBlock('paragraph', { html: para.map(inlineMdToHtml).join('<br>') }));
  }
  return root;
}
