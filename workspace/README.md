# TaskMaster Workspace

A self-hosted, single-user, Notion-style workspace: nested pages, a block editor and databases
(table, board, list, gallery, calendar). It runs on your own machine and keeps everything in one
SQLite file — no external services, accounts or database server.

## Quick start

Requires **Node.js 22.13 or newer** (it uses the built-in `node:sqlite`).

```bash
cd workspace
npm install

npm run dev      # API on :3001 + Vite dev server on http://localhost:5173 (hot reload)
# or
npm start        # builds the client and serves everything on http://127.0.0.1:3001
```

The first start seeds a **Getting Started** page and a sample **Tasks** database.

| Env var         | Default          | Purpose                                                                 |
| --------------- | ---------------- | ----------------------------------------------------------------------- |
| `PORT`          | `3001`           | API / production server port                                            |
| `HOST`          | `127.0.0.1`      | Interface to bind. See *Security* before changing it                    |
| `DATA_DIR`      | `workspace/data` | Where `workspace.db` and `uploads/` live. Back this folder up           |
| `DB_FILE`       | `$DATA_DIR/workspace.db` | Override the SQLite file path                                   |
| `ALLOWED_HOSTS` | *(empty)*        | Extra `Host` header values accepted while bound to loopback             |
| `API_URL`       | `http://127.0.0.1:3001` | Where the Vite dev server proxies `/api` and `/uploads`          |

## What's in it

**Pages**
- Infinite nesting, sidebar tree with drag-to-reorder / drag-to-nest, favorites, resizable and collapsible sidebar
- Emoji icons, gradient / uploaded / linked cover images, breadcrumbs, per-page font (default / serif / mono), small text, full width, lock page
- Quick search (`Ctrl/⌘ K`) over titles **and** body text, with snippets
- Trash with restore / delete forever / empty; deleting a page trashes its sub-pages, restoring brings them back
- Duplicate (deep copy incl. sub-pages and database rows), move to…, export as Markdown, copy link
- Light / dark / system theme, responsive layout down to phone width

**Block editor**
- Blocks: text, headings 1–3, bulleted / numbered / to-do / toggle lists (unlimited nesting), quote, callout, divider,
  code (syntax highlighting, language picker, copy), image (upload, paste, drop or link; resize and align), web bookmark,
  embed (YouTube, Vimeo, Loom, any site), simple table, 2–3 columns, table of contents, sub-page, link to page,
  inline databases
- `/` command menu with search (also from the `+` handle), `@` page mentions
- Markdown shortcuts (`# `, `- `, `1. `, `[] `, `> `, `---`, ` ``` `, `**bold**`, `*italic*`, `` `code` ``, `~strike~`)
- Floating format toolbar: bold, italic, underline, strikethrough, inline code, links, text colour and highlight
- Block handle: drag to reorder (drop on a block's side edge to make columns), turn into, colour, duplicate, delete
- Block selection (`Esc`), multi-select with `Shift ↑/↓`, copy / cut / paste blocks, `Ctrl/⌘ D`, `Ctrl/⌘ Shift ↑/↓` to move
- Pasting Markdown or multi-line text creates real blocks; pasting an image uploads it
- Undo / redo (typing is grouped into steps)

**Databases**
- Every row is a full page. Properties: title, text, number, select, multi-select, status, date (with end date), checkbox,
  URL, email, phone, created time, last edited time
- Views per database: **table** (resizable columns), **board** (drag cards between groups), **list**, **gallery**, **calendar**
  (drag events between days)
- Per-view filters (AND / OR, operators per property type), multi-level sorts, hidden properties, search; board group-by and calendar date property
- Edit property names, types (values are converted where possible), select options and colours
- Inline in any page, or as a full page

## Keyboard shortcuts

| Action                       | Keys                                   |
| ---------------------------- | -------------------------------------- |
| Search                       | `Ctrl/⌘ K` (or `P`)                    |
| Toggle sidebar               | `Ctrl/⌘ \`                             |
| Bold / italic / underline    | `Ctrl/⌘ B / I / U`                     |
| Inline code / strikethrough  | `Ctrl/⌘ E` / `Ctrl/⌘ Shift S`          |
| Link (with text selected)    | `Ctrl/⌘ K`                             |
| Indent / outdent             | `Tab` / `Shift Tab`                    |
| Undo / redo                  | `Ctrl/⌘ Z` / `Ctrl/⌘ Shift Z`          |
| Select block, then…          | `Esc`, then `Delete`, `Ctrl/⌘ D`, `Shift ↑/↓`, `Enter` |
| Toggle to-do / toggle        | `Ctrl/⌘ Enter`                         |
| Soft line break              | `Shift Enter`                          |

## How it is built

```
workspace/
├─ server/            Express + node:sqlite
│  ├─ app.js          REST API (pages, trash, search, uploads), static hosting of dist/
│  ├─ pages.js        data layer (tree, trash cascade, duplicate with id remapping, search)
│  ├─ db.js, seed.js  schema, first-run content
│  └─ test/           API tests (node:test)
├─ e2e/               Playwright browser tests + runner (npm run e2e)
└─ src/               React 19 + Vite client
   ├─ lib/            api client, write-behind saver, store, block-tree ops, markdown, sanitizer, db query engine
   └─ components/
      ├─ editor/      block editor (Editor.jsx is the controller; Block, Editable, menus, toolbar…)
      └─ database/    DatabaseView + table / board / list / gallery / calendar
```

**Data model.** One `pages` table. A page stores its body as a JSON block tree. A database is a page with
`type = 'database'` whose `schema` (properties) and `views` are JSON; its rows are ordinary pages whose `parent_id` is
the database and whose `props` hold the property values. Inline databases are databases with `inline = 1`, referenced from
a `child_database` block. Deleting is soft: a page and its descendants share one `trashed_at`.

**Saving.** Edits update the UI immediately and are written behind by a debounced per-page queue (`lib/saver.js`):
merged patches, retry with backoff, flush on navigation / tab hide, and a "Saved / Saving… / Offline" indicator.
New database rows are created optimistically with a client-generated id.

**Editor.** Each text block is its own `contentEditable`. The DOM is the source of truth while typing, and React only
rewrites it when the stored value actually differs (undo, merges), so the caret never jumps. Undo/redo is a snapshot stack
over the immutable block tree rather than the browser's native undo. Rich text is stored as a small HTML subset
(`strong em u s code a span br`); everything that enters from outside (paste, saved data) goes through `lib/sanitize.js`.

## Tests

```bash
npm test        # API + query-engine tests (node:test)
npm run lint

# Browser tests (~120 checks: editing, drag & drop, databases, search, trash…)
npm i -D playwright && npx playwright install chromium   # once
npm run build && npm run e2e                             # uses a throwaway server + temp data dir
```

## Security notes

- **There is no authentication.** It is designed as a personal app on `127.0.0.1`. While bound to loopback the server also
  rejects requests with a non-loopback `Host` header (DNS-rebinding protection); add names via `ALLOWED_HOSTS`.
- If you set `HOST=0.0.0.0` or put it behind a reverse proxy, put real authentication in front of it.
- Uploads accept PNG, JPEG, GIF, WebP and AVIF only (SVG is rejected) and are served with `nosniff`.
- Bookmarks and embeds accept `http(s)` URLs only; links created in the editor are limited to web / mail / phone schemes.

## Not included (compared with Notion)

Multi-user accounts, sharing and permissions, real-time collaboration (concurrent edits are last-write-wins), comments,
page version history, templates, relation / rollup / formula properties, synced blocks, equations, web clipper,
import from Notion, offline mode, and AI features. Bookmark previews are title/description fields you edit — the server never
fetches third-party pages.
