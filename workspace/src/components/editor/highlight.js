// Tiny regex tokenizer for code block syntax highlighting. Not a parser: it only needs to
// look right for common cases (comments, strings, numbers, keywords).

const KEYWORDS = {
  javascript: 'const let var function return if else for while do switch case break continue new class extends import export from default async await try catch finally throw typeof instanceof in of this super null undefined true false yield static get set',
  typescript: 'const let var function return if else for while do switch case break continue new class extends implements interface type enum import export from default async await try catch finally throw typeof instanceof in of this super null undefined true false readonly public private protected abstract as keyof namespace declare',
  python: 'def class return if elif else for while in not and or is import from as with try except finally raise pass break continue lambda yield None True False global nonlocal async await self',
  java: 'public private protected static final class interface extends implements new return if else for while do switch case break continue try catch finally throw throws import package void int long double float boolean char byte short null true false this super abstract synchronized var',
  csharp: 'public private protected internal static readonly class interface struct enum namespace using new return if else for foreach while do switch case break continue try catch finally throw void int long double float bool char string null true false this base var async await override virtual abstract',
  c: 'int long short char float double void unsigned signed const static struct union enum typedef return if else for while do switch case break continue goto sizeof NULL include define extern volatile register',
  cpp: 'int long short char float double void unsigned signed const static struct union enum typedef class template typename namespace using public private protected virtual override new delete return if else for while do switch case break continue try catch throw nullptr true false auto bool include define this',
  go: 'package import func return if else for range switch case break continue defer go select chan map struct interface type var const nil true false default fallthrough',
  rust: 'fn let mut const static struct enum impl trait pub use mod crate self Self super return if else for while loop match break continue as in ref move async await dyn where type unsafe true false',
  ruby: 'def end class module return if elsif else unless case when for while until do begin rescue ensure raise yield self nil true false require include extend attr_accessor then and or not',
  php: 'function return if else elseif for foreach while do switch case break continue class extends implements new public private protected static echo use namespace try catch finally throw null true false this',
  bash: 'if then else elif fi for while do done case esac function in echo export local return exit cd ls cat grep sed awk',
  sql: 'SELECT FROM WHERE AND OR NOT INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP INDEX JOIN LEFT RIGHT INNER OUTER ON GROUP BY ORDER HAVING LIMIT OFFSET AS DISTINCT NULL IS IN LIKE BETWEEN UNION ALL CASE WHEN THEN ELSE END PRIMARY KEY FOREIGN REFERENCES select from where and or not insert into values update set delete create table alter drop index join left right inner outer on group by order having limit offset as distinct null is in like between union all case when then else end',
  json: 'true false null',
  yaml: 'true false null yes no',
  css: '',
  html: '',
  markdown: '',
};
KEYWORDS.js = KEYWORDS.javascript;
KEYWORDS.ts = KEYWORDS.typescript;
KEYWORDS.py = KEYWORDS.python;
KEYWORDS.sh = KEYWORDS.bash;
KEYWORDS.shell = KEYWORDS.bash;

const COMMENT = {
  python: /^#.*/, bash: /^#.*/, ruby: /^#.*/, yaml: /^#.*/, sql: /^--.*/,
  css: /^\/\*[\s\S]*?(\*\/|$)/, html: /^<!--[\s\S]*?(-->|$)/,
};
const SLASH_COMMENT = /^(\/\/.*|\/\*[\s\S]*?(\*\/|$))/;

export function highlight(code, lang) {
  const l = (lang || '').toLowerCase();
  if (!l || l === 'plain text' || l === 'markdown') return escape(code);
  const kw = new Set((KEYWORDS[l] || '').split(/\s+/).filter(Boolean));
  const commentRe = COMMENT[l] || SLASH_COMMENT;
  const rules = [
    ['cm', commentRe],
    ['str', /^("(\\.|[^"\\\n])*"?|'(\\.|[^'\\\n])*'?|`(\\.|[^`\\])*`?)/],
    ['num', /^\b\d[\d_]*(\.\d+)?([eE][+-]?\d+)?\b/],
    ['id', /^[A-Za-z_$][\w$]*/],
    ['tag', l === 'html' ? /^<\/?[A-Za-z][\w-]*|^\/?>/ : /^(?!)/],
  ];
  let out = '';
  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);
    let matched = false;
    for (const [type, re] of rules) {
      const m = rest.match(re);
      if (!m || !m[0]) continue;
      const text = m[0];
      if (type === 'id') {
        if (kw.has(text)) out += `<span class="tk-kw">${escape(text)}</span>`;
        else if (l !== 'json' && /^\s*\(/.test(rest.slice(text.length))) out += `<span class="tk-fn">${escape(text)}</span>`;
        else if (/^[A-Z]/.test(text) && l !== 'bash') out += `<span class="tk-cls">${escape(text)}</span>`;
        else out += escape(text);
      } else {
        out += `<span class="tk-${type}">${escape(text)}</span>`;
      }
      i += text.length;
      matched = true;
      break;
    }
    if (!matched) {
      out += escape(code[i]);
      i += 1;
    }
  }
  return out;
}

function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
