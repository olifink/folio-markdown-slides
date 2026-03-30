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
| `npm run watch` | Build in watch mode (development config) |
| `npm test` | Run unit tests with Vitest |
| `npx prettier --write .` | Format all files |

## Stack

| Concern | Library |
|---|---|
| Framework | Angular 21 — standalone components, Signals, no NgModules |
| Slides engine | `@marp-team/marp-core` — Markdown → HTML |
| Editor | CodeMirror 6 with custom Marp syntax theme |
| Filesystem | `lightning-fs` — IndexedDB-backed POSIX fs |
| Preferences | Raw IndexedDB — single JSON value |
| UI | Angular Material 3 (M3 Expressive) + Angular CDK |
| Styles | SCSS + CSS custom properties (M3 tokens) |
| PWA | `@angular/pwa` (Workbox service worker) |
| Tests | Vitest + jsdom |

## Status

| Milestone | Status |
|---|---|
| **M1** Shell layout — split-pane (wide) / tabbed (narrow), toolbar | ✅ Done |
| **M2** Marp rendering — live Markdown → iframe preview | ✅ Done |
| **M3** CodeMirror editor — syntax theme, `---` bar decoration, cheat bar | Planned |
| **M4** Storage — lightning-fs persistence, file list, create/rename/delete | Planned |
| **M5** Presentation mode — fullscreen, slide nav, theme switcher | Planned |
| **M6** PWA — offline install, service worker, bundled fonts | Planned |
| **M7** Export — download `.md`, self-contained HTML, print-to-PDF | Planned |
| **M8** Polish — dark mode, micro-interactions, M3 Expressive theming | Planned |

## Design principles

Folio follows **Quiet Tech** constraints — every feature must satisfy:

- **No data, just art** — zero network calls at runtime after install; no analytics or telemetry
- **Digital respect** — no background processes, no battery-draining workers
- **Minimum permissions** — no camera, mic, contacts, or location access
