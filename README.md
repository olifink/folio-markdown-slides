# Folio

A local-first, offline-capable PWA for creating and presenting Markdown slides using [Marp Core](https://github.com/marp-team/marp-core). Write Markdown, see slides rendered in real time, present full-screen — no server, no account, no data leaving the device.

Built with Angular 21, Angular Material 3 (M3 Expressive), and a Signal-based architecture.

---

## Getting started

```bash
npm install
npm start        # dev server → http://localhost:4200
```

## Commands

| Command | Description |
|---|---|
| `npm start` | Dev server at `http://localhost:4200` (HMR enabled) |
| `npm run build` | Production build → `dist/` |
| `npm run build -- --configuration github` | Build for GitHub Pages (sub-path base href) |
| `node scripts/download-themes.mjs` | Refresh MarpX theme collection from GitHub |
| `npm test` | Run unit tests with Vitest |
| `npx prettier --write .` | Format all files |

## What works today

- **Split-pane layout** — editor left, preview right on wide screens (≥ 840 px); Edit / Preview tabs on narrow
- **Live Marp preview** — typing in the editor re-renders the iframe within 300 ms; first load is immediate
- **File Management** — create, open, and delete presentations via a Material 3 sidebar; swipe-to-delete logic replaced by refined M3 list items with explicit actions and Undo support
- **Inline Renaming** — click the filename in the app bar to rename the current deck; auto-commits on Enter/blur, cancels on Escape
- **Persistence** — all slides saved locally via `lightning-fs` (IndexedDB POSIX fs); app preferences (last open file, theme, etc.) stored in a dedicated IndexedDB store
- **PWA Ready** — fully functional offline via Angular Service Worker; pre-caches app shell, assets, and Google Fonts
- **Export Options** — download as `.md`, self-contained `.html`, or Print to PDF (optimized landscape layout)
- **Presentation Mode** — full-screen support with keyboard and **touch swipe** navigation
- **Slide Sync** — preview automatically scrolls to the slide the cursor is currently in (aware of Marp front-matter)
- **MarpX Themes** — built-in support for 16 professional themes (cantor, einstein, socrates, etc.)
- **Cheat bar** — six snippet categories (Insert / Slide / Theme / Image / Text / Note), each opens a Material menu; items insert at the cursor and show a monospace hint for learning the syntax

## Theme management

Folio bundles the [MarpX](https://github.com/cunhapaulo/MarpX) theme collection.

- **Local Storage**: Themes are stored in `public/themes/marpx/`.
- **Registration**: Themes are fetched and registered with Marp Core at runtime in `MarpService`.
- **Updating**: Run `node scripts/download-themes.mjs` to re-download the latest CSS files from the MarpX repository.

## Stack

| Concern | Library | State |
|---|---|---|
| Framework | Angular 21 — standalone components, Signals | ✅ wired |
| Slides engine | `@marp-team/marp-core` | ✅ wired |
| Editor | CodeMirror 6 (`@codemirror/*`) | ✅ wired |
| UI | Angular Material 3 (M3 Expressive) + Angular CDK | ✅ wired |
| Styles | SCSS + CSS custom properties (M3 tokens) | ✅ wired |
| Filesystem | `lightning-fs` — IndexedDB-backed POSIX fs | ✅ wired |
| Preferences | Raw IndexedDB — single JSON value | ✅ wired |
| PWA | `@angular/pwa` (Workbox service worker) | ✅ wired |
| Themes | MarpX Collection | ✅ bundled |

## Milestones

| # | Milestone | Status |
|---|---|---|
| M1 | Shell layout — split-pane (wide) / tabbed (narrow), toolbar | ✅ Done |
| M2 | Marp rendering — live Markdown → iframe preview, slide nav, fullscreen keyboard nav | ✅ Done |
| M3 | CodeMirror editor — syntax theme, `---` bar decoration, cheat bar | ✅ Done |
| M4 | Storage — lightning-fs persistence, file list, create / rename / delete | ✅ Done |
| M5 | PWA — offline install, service worker, bundled fonts | ✅ Done |
| M6 | Export — download `.md`, self-contained HTML, print-to-PDF | ✅ Done |
| M7 | Polish — dark mode, micro-interactions, M3 Expressive theming complete | Planned |

## Design principles

Folio follows **Quiet Tech** constraints — every feature must satisfy:

- **No data, just art** — zero network calls at runtime after install; no analytics or telemetry
- **Digital respect** — no background processes, no battery-draining workers
- **Minimum permissions** — no camera, mic, contacts, or location access
