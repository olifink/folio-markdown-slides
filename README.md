# Folio

> A local-first, offline-capable PWA for writing Markdown — as slides, or as paginated prose documents.

Write Markdown, see it rendered in real time. No server, no account, no data leaving the device.

Built with **Angular 21**, **Angular Material 3 (M3 Expressive)**, and a Signal-based architecture.

---

## Document types

Folio automatically detects what kind of document you're writing from the frontmatter — no type picker, no extra UI.

| Document | Frontmatter | Preview |
|---|---|---|
| **Slides** | `marp: true` | Marp slide deck — full-screen presentable |
| **Prose** | _(none, or no `marp: true`)_ | Paginated flow text via Paged.js — `---` becomes a page break |

Both modes share the same editor, the same file management, and the same export workflow. Switching modes is as simple as adding or removing `marp: true`.

---

## Getting started

```bash
npm install
node scripts/download-pagedjs.mjs # One-time setup
npm start                         # dev server → http://localhost:4200
```

## Commands

| Command | Description |
|---|---|
| `npm start` | Dev server at `http://localhost:4200` (HMR enabled) |
| `npm run build` | Production build → `dist/` |
| `npm run build -- --configuration github` | Build for GitHub Pages (sub-path base href) |
| `node scripts/download-themes.mjs` | Refresh MarpX theme collection from GitHub |
| `node scripts/download-pagedjs.mjs` | Download Paged.js polyfill |
| `npm test` | Run unit tests with Vitest |
| `npx prettier --write .` | Format all files |

---

## What works today

- **Multi-document support** — automatically switch between Slides and Prose modes
- **Split-pane layout** — editor left, preview right on wide screens (≥ 840 px); Edit / Preview tabs on narrow
- **Live Marp preview** — typing in the editor re-renders slides in real time
- **Paginated Prose preview** — powered by Paged.js, supports standard Markdown and page breaks via `---`
- **File management** — create, open, and delete files via a Material 3 sidebar; M3 list items with explicit actions and Undo support
- **Inline renaming** — click the filename in the app bar to rename; commits on Enter/blur, cancels on Escape
- **Persistence** — all files saved locally via `lightning-fs` (IndexedDB POSIX fs); preferences stored in a dedicated IndexedDB store
- **PWA** — fully functional offline via Angular Service Worker; pre-caches app shell, assets, and fonts
- **Export** — download as `.md`, self-contained `.html` (with Paged.js bundled for prose), or Print to PDF
- **Presentation mode** — full-screen slides with keyboard and touch swipe navigation
- **Slide sync** — preview scrolls to the slide matching the cursor position
- **MarpX themes** — 16 professional themes bundled (cantor, einstein, socrates, …)
- **Cheat bar** — six snippet categories; items insert at cursor and display a monospace hint

---

## What's coming — v2 Prose Mode

Folio is evolving into a **multi-document-type editor**. The next milestone adds paginated prose as a first-class document type, powered by [Paged.js](https://pagedjs.org).

See [SPEC_v2_mdtext.md](./SPEC_v2_mdtext.md) for the full implementation spec.

```
marp: true   →  slide deck    (existing)
(no marp)    →  paginated prose document  (v2)
```

`---` works as a page break in prose mode — the same gesture users already know from slides.

---

## Theme management

Folio bundles the [MarpX](https://github.com/cunhapaulo/MarpX) theme collection.

- Themes are stored in `public/themes/marpx/`
- Fetched and registered with Marp Core at runtime in `MarpService`
- Run `node scripts/download-themes.mjs` to pull the latest CSS from the MarpX repository

---

## Stack

| Concern | Library | Status |
|---|---|---|
| Framework | Angular 21 — standalone components, Signals | ✅ |
| Slides engine | `@marp-team/marp-core` | ✅ |
| Prose pagination | `pagedjs` — Paged Media CSS polyfill | 🔜 v2 |
| Editor | CodeMirror 6 (`@codemirror/*`) | ✅ |
| UI | Angular Material 3 (M3 Expressive) + Angular CDK | ✅ |
| Styles | SCSS + CSS custom properties (M3 tokens) | ✅ |
| Filesystem | `lightning-fs` — IndexedDB-backed POSIX fs | ✅ |
| Preferences | Raw IndexedDB — single JSON value | ✅ |
| PWA | `@angular/pwa` (Workbox service worker) | ✅ |
| Themes | MarpX Collection (16 themes) | ✅ |

---

## Milestones

| # | Milestone | Status |
|---|---|---|
| M1 | Shell layout — split-pane (wide) / tabbed (narrow), toolbar | ✅ Done |
| M2 | Marp rendering — live Markdown → iframe preview, slide nav, fullscreen | ✅ Done |
| M3 | CodeMirror editor — syntax theme, `---` decoration, cheat bar | ✅ Done |
| M4 | Storage — lightning-fs, file list, create / rename / delete | ✅ Done |
| M5 | PWA — offline install, service worker, bundled fonts | ✅ Done |
| M6 | Export — `.md`, self-contained HTML, print-to-PDF | ✅ Done |
| M7 | **Prose mode** — frontmatter detection, Paged.js pagination, `---` as page break | 🔜 Planned |
| M8 | Polish — dark mode, micro-interactions, M3 Expressive theming complete | Planned |

---

## Design principles

Folio follows **Quiet Tech** constraints — every feature must satisfy:

- **No data, just art** — zero network calls at runtime after install; no analytics or telemetry
- **Digital respect** — no background processes, no battery-draining workers
- **Minimum permissions** — no camera, mic, contacts, or location access
