# Folio — Build Brief
> Lemon Slice Studios · Quiet Tech · Angular PWA · v0.1

---

## What it is

A local-first, offline-capable Progressive Web App that turns Markdown into
presentation slides using Marp Core. The target user is someone who wants a
focused Markdown-to-slides experience on an Android tablet or Chromebook
without installing a CLI tool, a code editor plugin, or a cloud-dependent
SaaS product.

The core loop: write Markdown in an editor on the left → see slides rendered
in real time on the right → present full-screen. No server, no account,
no data transmitted beyond the device.

---

## Quiet Tech constraints (non-negotiable)

Every feature and architecture decision must satisfy all four:

| Pillar | Hard constraint |
|---|---|
| No Data, Just Art | Zero network calls at runtime after install. No analytics, no telemetry. |
| Digital Respect | No background processes, no battery-draining workers, no Electron. |
| Minimum Permissions | PWA requests no special permissions. No camera, mic, contacts, location. |

---

## Tech stack

| Concern | Package | Notes |
|---|---|---|
| Framework | Angular 19+ standalone, Signals | No NgRx, no NgModules |
| Slides engine | `@marp-team/marp-core` | Not marpit — Core includes themes + KaTeX |
| Markdown editor | CodeMirror 6 (`@codemirror/*`) | Custom Marp syntax theme |
| Browser filesystem | `lightning-fs` | IndexedDB-backed POSIX fs, no git layer |
| App preferences | Raw `indexedDB` (no wrapper) | Single key, too lightweight for an ORM |
| UI | `@angular/material` (M3 Expressive) + `@angular/cdk` | No Tailwind |
| PWA | `@angular/pwa` (Workbox) | All deps bundled — no CDN calls at runtime |
| Styles | SCSS + CSS custom properties (M3 Expressive tokens) | |

**Do not add:** Dexie, isomorphic-git, RxJS beyond what Angular requires,
any UI framework other than Angular Material.

---

## Storage model

lightning-fs provides a POSIX-style filesystem backed by IndexedDB.
Initialise a single fs instance at app boot with a fixed volume name (`folio`).

### Filesystem layout

```
/presentations/
  my-first-deck.md
  quarterly-review.md
  conference-talk.md
```

Each `.md` file is the complete source of truth for a presentation —
Marp front-matter, `---` slide separators, and content. No database, no
metadata sidecar files.

### App preferences

Stored as a single JSON value in a separate IndexedDB store (not via
lightning-fs). Keys:

```ts
interface AppPrefs {
  lastOpenFile: string | null;   // filename, not full path
  preferredTheme: 'default' | 'gaia' | 'uncover';
  editorFontSize: number;        // sp, default 16
  darkMode: 'system' | 'light' | 'dark';
}
```

### Auto-save

- Every keystroke writes the current content to lightning-fs immediately
  (synchronous to the fs, async to IndexedDB under the hood).
- No git, no commit history, no versioning in v1.0.

### Presentation list

Derived by reading `/presentations/` directory at boot and on any write.
The Angular Signal store holds the list reactively.

---

## Architecture

### Marp rendering

`@marp-team/marp-core` runs entirely in-browser. Call once per debounced
change (300ms):

```ts
import Marp from '@marp-team/marp-core'
const marp = new Marp()
const { html, css } = marp.render(markdown)
```

Inject into an `<iframe srcdoc="...">` using a composed HTML shell:

```ts
function buildSrcdoc(html: string, css: string): string {
  return `<!DOCTYPE html><html><head>
    <style>${css}</style>
  </head><body>${html}</body></html>`
}
```

**Why iframe:** Marp's CSS must not leak into the app shell. The iframe
also means re-rendering is trivially a new `srcdoc` assignment — no
teardown logic needed. Full-screen presentation is
`iframeEl.requestFullscreen()`.

### Slide navigation

Parse the rendered HTML for `<section>` elements to get slide count.
Expose prev/next controls that `postMessage` a slide index to the iframe,
which uses Marp's navigation API or a simple `scrollIntoView` per section.

### State (Angular Signals)

```ts
// Global app store — no NgRx
presentationList: Signal<string[]>
currentFile: Signal<string | null>
currentMarkdown: Signal<string>
currentSlideIndex: Signal<number>
slideCount: Signal<number>
isDirty: Signal<boolean>
prefs: Signal<AppPrefs>
```

No observables for UI state. Use `effect()` for side effects
(write to lightning-fs on markdown change).

---

## Layout

### Wide (≥ 840dp) — split pane

```
┌──────────────────────────────────────────────────────────────────┐
│  ◈ Folio   [Deck title ▾]                       [◑]  [⚙]  [FAB] │  toolbar
├─────────────────────────────┬────────────────────────────────────┤
│                             │                                    │
│   CodeMirror editor         │   Marp iframe preview              │
│   (JetBrains Mono 16sp)     │                                    │
│                             │   ┌──────────────────────────────┐ │
│                             │   │                              │ │
│                             │   │         slide content        │ │
│                             │   │                              │ │
│                             │   └──────────────────────────────┘ │
│                             │        ‹  1 / 4  ›                 │
├─────────────────────────────┴────────────────────────────────────┤
│  CHEAT BAR                                                       │
└──────────────────────────────────────────────────────────────────┘
```

### Narrow (< 840dp) — tabbed

Two tabs below the toolbar: **Edit** and **Preview**. Cheat bar visible
only on the Edit tab, pinned above the software keyboard.

### Presentation mode

`iframeEl.requestFullscreen()` — the iframe fills the viewport, the app
shell disappears entirely. Exit with Escape or a long-press on mobile.

---

## Components

```
AppComponent                  root shell, toolbar
├── PresentationListDrawer    slide-out nav drawer, list of .md files
├── EditorPaneComponent       hosts CodeMirror instance
│   └── CheatBarComponent     single-row category buttons + menus
├── PreviewPaneComponent      hosts the Marp iframe
│   └── SlideNavComponent     ‹ N / M › prev/next controls
└── SettingsComponent         bottom sheet, prefs
```

Services:
```
FsService          lightning-fs init, read, write, list, delete
MarpService        marp.render() wrapper, debounced Signal output
PrefsService       IndexedDB read/write for AppPrefs
```

---

## Design system

### Color tokens

Use M3 Expressive `mat.define-theme()` with these seed colours. Define as CSS custom
properties and reference throughout — never hardcode hex values in
component SCSS.

```scss
// Seeds passed to Angular Material theme builder
$primary:   #7C4DFF;   // Plasma — interactive elements, active state
$tertiary:  #C8FF00;   // Volt   — primary CTA (Present FAB)
$error:     #FF4D6D;   // Neon Coral — destructive, unsaved indicator
```

**Light mode surfaces**
```
--surface:            #F8F8FC
--surface-container:  #EFEFF5
--on-surface:         #18181F
--outline:            #C8C8D8
```

**Dark mode surfaces**
```
--surface:            #111116
--surface-container:  #1C1C24
--on-surface:         #E8E8F2
--outline:            #2E2E3E
```

**Vivid accents — use sparingly, never two together on the same element**

| Name | Light | Dark | Use |
|---|---|---|---|
| Volt | `#C8FF00` | `#D4FF33` | Present FAB fill, active slide pip |
| Plasma | `#7C4DFF` | `#9E72FF` | Active tab, focused cheat item, selected state |
| Neon Coral | `#FF4D6D` | `#FF6B85` | Delete zone, unsaved dot, bold/italic markers in editor |

### Typography

```scss
--font-ui:     'Inter', system-ui, sans-serif;
--font-editor: 'JetBrains Mono', 'Fira Code', monospace;
```

Load both from Google Fonts, bundled via the PWA asset cache — no runtime
CDN call.

### Shape

```
Present FAB:          16dp radius (standard M3 Expressive FAB)
Presentation cards:   16dp radius
Cheat bar buttons:    8dp radius
Toolbar chips:        6dp radius
Split pane divider:   1px solid var(--outline), no shadow
```

No drop shadows on content surfaces. Shadow only on the FAB
(`mat-elevation-z3`).

### The Present FAB

Standard M3 Expressive FAB (56dp, 16dp radius). **Volt fill (`#C8FF00`), `#18181F`
icon**. Icon: a right-pointing triangle (play/present). Position:
bottom-right of the preview pane on wide, bottom-right of the screen on
narrow. Spring scale on press (M3 Expressive motion). On press:
`iframeEl.requestFullscreen()`.

---

## CodeMirror syntax theme

Custom light and dark themes — do not use a generic CM6 theme preset.

| Token | Light | Dark |
|---|---|---|
| Marp front-matter key | `#7C4DFF` | `#9E72FF` |
| `---` slide separator | Full-width block decoration, `#C8FF00` on `#1C1C24` bg | Same |
| Heading `#` | `#18181F` bold | `#E8E8F2` bold |
| Bold / italic markers | `#FF4D6D` | `#FF6B85` |
| Inline code | `#00BFA5` | `#1DE9B6` |
| Speaker note comment | `#888899` italic | `#6666AA` italic |
| Plain body | `#18181F` | `#E8E8F2` |

The `---` slide separator must render as a **full-width coloured bar** using
a CodeMirror 6 line decoration (`Decoration.line`), not just highlighted
characters.

---

## Cheat bar

A single row of category buttons pinned below the editor toolbar.
Each opens a standard Material 3 `MatMenu`. Tapping an item inserts the
snippet at the CodeMirror cursor and dismisses the menu.

Button style: `32dp` tall, `8dp` radius, `var(--outline)` border,
surface fill. On tap: 100ms Plasma fill flash, returns to neutral.

| Button | Menu items (label → inserted text) |
|---|---|
| **Insert** | Heading 1 → `# `, Heading 2 → `## `, Heading 3 → `### `, Bold → `**text**`, Italic → `*text*`, Inline code → `` `code` ``, Code block → ` ```\n\n``` ` |
| **Slide** | New slide → `\n---\n`, Paginate on → `paginate: true`, Section title → `<!-- _class: lead -->` |
| **Theme** | Default → `theme: default`, Gaia → `theme: gaia`, Uncover → `theme: uncover`, Background colour → `backgroundColor: #ffffff`, Text colour → `color: #000000` |
| **Image** | Background full → `![bg](url)`, Background left → `![bg left](url)`, Background right → `![bg right](url)`, Background 50% left → `![bg left:50%](url)` |
| **Text** | Lead class → `<!-- _class: lead -->`, Invert → `<!-- _class: invert -->`, Two columns → `<div class="columns">\n\n</div>` |
| **Note** | Speaker note → `<!--\n\n-->`, HTML comment → `<!-- comment -->` |

Each menu item has a **primary label** and a **secondary line** showing the
raw snippet in monospace — so users learn the syntax passively.

---

## Marp themes

Three built-in themes from `marp-core`: `default`, `gaia`, `uncover`.

Theme picker: a `mat-button-toggle-group` in the toolbar with three options.
Changing theme re-renders the iframe immediately (200ms cross-fade on the
iframe opacity). The selection is persisted to `AppPrefs.preferredTheme`.

---

## Micro-interactions

| Element | Behaviour |
|---|---|
| Slide counter | Number-flip animation (CSS `@keyframes`) on index change, not a plain text swap |
| Unsaved indicator | 6dp dot in toolbar — Neon Coral when `isDirty`, fades to `--surface` when saved. No text label |
| New deck | List item springs in from bottom (M3 Expressive spring easing) |
| Delete deck | Swipe left → Coral trash zone revealed. Release = deleted. Snackbar with **Undo** (Plasma text) for 5s. No confirmation modal |
| Theme change | iframe opacity cross-fades 200ms. Editor unaffected |
| Cheat button tap | 100ms Plasma fill flash |

---

## PWA configuration

```json
// ngsw-config.json additions
{
  "assetGroups": [{
    "name": "fonts",
    "installMode": "prefetch",
    "resources": {
      "urls": [
        "https://fonts.googleapis.com/css2?family=Inter*",
        "https://fonts.googleapis.com/css2?family=JetBrains+Mono*"
      ]
    }
  }]
}
```

Web manifest:
```json
{
  "name": "Folio",
  "short_name": "Folio",
  "display": "standalone",
  "background_color": "#111116",
  "theme_color": "#111116",
  "orientation": "any"
}
```

Icons: adaptive icon set for Android (foreground + background layers),
standard PNG set for ChromeOS. Minimum sizes: 48, 72, 96, 144, 192, 512.

---

## MVP milestones (build in order)

| # | Milestone | Done when |
|---|---|---|
| M1 | Shell | Angular app renders; split-pane layout works on wide and narrow; routing between Editor and Preview tabs on narrow |
| M2 | Marp render | Typing Markdown updates the iframe in real time via debounced `marp.render()` |
| M3 Expressive | CodeMirror | CM6 editor with custom Marp syntax theme; `---` bar decoration; cheat bar inserts at cursor |
| M4 | Storage | Files persist across reloads via lightning-fs; list, create, rename, delete all work |
| M5 | Present | Full-screen works on Android and ChromeOS; slide nav (prev/next) works; theme switcher works |
| M6 | PWA | Installs on Android and ChromeOS; fully functional offline after install |
| M7 | Export | Download `.md`; export self-contained HTML; print-to-PDF via browser dialog |
| M8 | Polish | Dark mode; micro-interactions; responsive edge cases; M3 Expressive theming complete |

---

## Explicitly out of scope for v1.0

- Remote sync of any kind (no git push, no cloud)
- Version history / undo beyond the browser's built-in undo stack in CM6
- Collaboration or shared editing
- Custom theme authoring or CSS editor in-app
- Image paste or drag-and-drop (images via Marp `![bg]()` with a URL or data URI)
- Audio or video embedding
- iOS / Safari support
- Paid licensing or payment integration
- Onboarding flow (the cheat bar is the onboarding)

---

## What not to do

- No skeleton loaders — lightning-fs is local, reads are instant
- No empty-state illustrations — a single Plasma-coloured placeholder line in CM6 is enough (`# Start writing...`)
- No confirmation modals for reversible actions — use snackbar + Undo
- No gradients on interactive elements
- No shadows on content surfaces (only on the FAB)
- No `1px` dividers replaced by shadows or elevation — use colour separation between surface and surface-container
- Do not load any runtime dependency from a CDN — everything must be bundled
- Do not add Dexie, isomorphic-git, RxJS state management, or any second UI framework