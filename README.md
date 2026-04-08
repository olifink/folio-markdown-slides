# Folio

> A local-first, offline-capable PWA for writing Markdown — as slides, or as paginated prose documents.

A beautiful, simple and calm space for writing.

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

- **Multi-document support** — automatically switch between Slides and Prose modes.
- **Split-pane layout** — editor left, preview right on wide screens (≥ 840 px); Edit / Preview tabs on narrow.
- **Prose Preview Toggle** — hide the preview panel in Prose mode on desktop to focus entirely on writing.
- **Post-it Theme** — a calm, lavender-inspired light theme with vibrant "Volt" green accents for primary actions.
- **Live Marp preview** — typing in the editor re-renders slides in real time.
- **Paginated Prose preview** — powered by Paged.js, supports standard Markdown and page breaks via `---`.
- **Smart Editor Shortcuts** — "Cheat bar" and Cheatsheet support selection wrapping (bold, italic, links) and smart cursor placement.
- **File management** — create, open, and delete files via a Material 3 sidebar; M3 list items with explicit actions and Undo support.
- **Inline renaming** — click the filename in the app bar to rename; commits on Enter/blur, cancels on Escape.
- **Persistence** — all files saved locally via `lightning-fs` (IndexedDB POSIX fs); preferences stored in a dedicated IndexedDB store.
- **PWA** — fully functional offline via Angular Service Worker; pre-caches app shell, assets, and fonts.
- **Export** — download as `.md`, self-contained `.html` (Mermaid diagrams inlined), or Print to PDF.
- **Presentation mode** — full-screen slides with keyboard and touch swipe navigation.
- **Slide sync** — preview scrolls to the slide matching the cursor position.
- **MarpX themes** — 16 professional themes bundled (cantor, einstein, socrates, …).
- **Dark mode** — system / light / dark toggle; prose preview and syntax highlighting both respond.
- **Mobile Optimized** — aggressive focus management ensures the virtual keyboard stays active during snippet insertion on tablets and Chromebooks.

### Prose mode features

- **Task lists** — GitHub-style checkboxes `- [ ]` and `- [x]` rendered in both slides and prose.
- **Emoji shortcodes** — `:smile:` → 😄 (full shortcode set).
- **Math** — inline `$x^2$` and block `$$...$$` via KaTeX, rendered as MathML (no fonts needed).
- **Syntax highlighting** — fenced code blocks highlighted via highlight.js with a custom light/dark theme.
- **Mermaid diagrams** — same as slides; render correctly in preview, HTML export, and PDF.
- **Dark mode** — prose iframe follows the app's colour scheme; code tokens and mermaid theme switch too.

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
| Prose pagination | `pagedjs` — Paged Media CSS polyfill | ✅ |
| Editor | CodeMirror 6 (`@codemirror/*`) | ✅ |
| UI | Angular Material 3 (M3 Expressive) + Angular CDK | ✅ |
| Styles | SCSS + CSS custom properties (M3 tokens) | ✅ |
| Filesystem | `lightning-fs` — IndexedDB-backed POSIX fs | ✅ |
| Preferences | Raw IndexedDB — single JSON value | ✅ |
| PWA | `@angular/pwa` (Workbox service worker) | ✅ |
| Themes | MarpX Collection (16 themes) | ✅ |
| Prose math | KaTeX — MathML output, no CSS dependency | ✅ |
| Syntax highlighting | highlight.js — custom light/dark token theme | ✅ |

---

## Architecture notes

### Service split

Rendering is split between two focused services:

| Service | Responsibility |
|---|---|
| `MarpService` | Marp Core rendering, MarpX theme registration, slide srcdoc |
| `ProseService` | markdown-it rendering, emoji, math, syntax highlighting, task lists, prose srcdoc |

Shared markdown-it plugins (mark, footnote, deflist, task-lists, container, Mermaid fence) live in `configure-markdown.ts` and are applied to both the Marp internal `markdown-it` instance and the prose standalone instance.

### Mermaid in exports

`mermaid.min.js` is fetched once at startup and cached. For **HTML download** it is inlined in the output (fully self-contained). For **print-to-PDF** the relative `js/mermaid.min.js` path resolves from the app's origin. Print waits for a `printReady` postMessage fired after `mermaid.run()` resolves before opening the print dialog.

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
| M7 | **Prose mode** — frontmatter detection, Paged.js pagination, `---` as page break | ✅ Done |
| M8 | Polish — dark mode, smart snippets, lavender "post-it" theme | ✅ Done |

---

## Design principles

Folio follows **Quiet Tech** constraints — every feature must satisfy:

- **No data, just art** — zero network calls at runtime after install; no analytics or telemetry
- **Digital respect** — no background processes, no battery-draining workers
- **Minimum permissions** — no camera, mic, contacts, or location access
