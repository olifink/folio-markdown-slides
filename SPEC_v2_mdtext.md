# Spec — v2 Prose Mode

> **Status:** Planned · **Target milestone:** M7  
> **Author:** Folio · **Last updated:** April 2026

Adds paginated flow-text Markdown as a first-class document type alongside the existing slide mode.

---

## Overview

Folio detects document type from the YAML frontmatter. No type picker, but provide an option to create new text or slide document and have placeholder default content — and then just write Markdown.

```
marp: true   →  slides     (existing behaviour)
(no marp)    →  prose      (this spec)
```

`---` works as a page break in prose mode — identical gesture to the slide separator users already know.

---

## Goals

- [ ] Paginated browser preview for prose documents rendered via **Paged.js**
- [ ] `---` as a visual, explicit page break — identical to the slide separator gesture
- [ ] All existing markdown-it plugins carry over (footnotes, definition lists, `==mark==`, containers, Mermaid fences)
- [ ] Export to PDF via the existing print-to-iframe path (Paged.js applies print-ready layout automatically)
- [ ] Export to self-contained `.html` with Paged.js embedded
- [ ] Zero new user-facing UI for mode switching — detection is fully automatic

### Non-goals

- Custom prose themes in v2 (one default page style ships; theme support is a future iteration)
- Side-by-side page navigation buttons (prose scrolls freely — no prev/next needed)
- Real-time page count in the app bar (deferred to a later polish pass)

---

## Architecture

### 1 — Document type detection

A single `computed()` signal in `AppStore`:

```typescript
// src/app/store/app-store.ts
readonly documentType = computed<'slides' | 'prose'>(() => {
  const md = this.currentMarkdown();
  const frontmatterMatch = md.trimStart().match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch && /^marp:\s*true\s*$/m.test(frontmatterMatch[1])) {
    return 'slides';
  }
  return 'prose';
});
```

No other part of the system needs to parse frontmatter — everything branches off this one signal.

### 2 — Prose rendering in MarpService

The existing `MarpService` already holds a fully configured `markdown-it` instance (registered by Marp Core) with all plugins wired. Prose rendering reuses it directly.

```typescript
// src/app/services/marp.service.ts

renderProse(markdown: string): { html: string } {
  // Strip YAML frontmatter before rendering
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const html = this.marp.markdown.render(body);
  return { html };
}

buildProseSrcdoc(html: string, isExport: boolean = false): string {
  const pagedScript = isExport
    ? '' // Paged.js not needed for print — @page CSS is enough
    : `<script src="js/paged.polyfill.min.js"></script>
<script>
window.PagedConfig = {
  auto: false,
  after: function(flow) {
    window.parent.postMessage({ pageCount: flow.total }, '*');
  }
};
window.addEventListener('DOMContentLoaded', function() {
  window.PagedPolyfill.preview();
});
</script>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Folio Document</title>
<style>
  /* Page geometry — A4 portrait */
  @page {
    size: A4 portrait;
    margin: 20mm 22mm;
  }

  /* --- as explicit page break */
  hr {
    break-before: page;
    display: none;
  }

  /* Prose typography */
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 11pt;
    line-height: 1.7;
    color: #1a1a1a;
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: system-ui, sans-serif;
    margin-top: 1.4em;
    margin-bottom: 0.4em;
  }
  p { margin: 0 0 0.9em; }
  pre, code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.88em;
  }
  pre {
    background: #f5f5f5;
    padding: 0.8em 1em;
    border-radius: 4px;
    overflow-x: auto;
  }
  blockquote {
    border-left: 3px solid #aaa;
    margin-left: 0;
    padding-left: 1em;
    color: #555;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 1em;
  }
  th, td {
    border: 1px solid #ccc;
    padding: 0.4em 0.7em;
    text-align: left;
  }
  /* Paged.js page boxes */
  .pagedjs_page {
    background: white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    margin: 0 auto 24px;
  }
</style>
</head>
<body>
${html}
${pagedScript}
</body>
</html>`;
}
```

### 3 — PreviewPaneComponent branching

```typescript
// src/app/preview-pane/preview-pane.ts  (conceptual diff)

private readonly rendered = toSignal(
  toObservable(this.store.currentMarkdown).pipe(
    switchMap((md, index) =>
      index === 0 ? of(md) : timer(this.store.documentType() === 'prose' ? 600 : 300).pipe(map(() => md)),
    ),
    map(md => {
      if (this.store.documentType() === 'slides') {
        return { type: 'slides' as const, ...this.marpService.render(md) };
      } else {
        return { type: 'prose' as const, ...this.marpService.renderProse(md) };
      }
    }),
  ),
  { initialValue: { type: 'slides' as const, ...this.marpService.render(this.store.currentMarkdown()) } },
);
```

Effect on srcdoc assignment:

```typescript
effect(() => {
  const result = this.rendered();
  const iframe = this.iframeRef();
  if (!iframe) return;

  if (result.type === 'slides') {
    this.store.setSlideCount(result.slideCount);
    iframe.nativeElement.srcdoc = this.marpService.buildSrcdoc(result.html, result.css);
  } else {
    iframe.nativeElement.srcdoc = this.marpService.buildProseSrcdoc(result.html);
  }
});
```

Page count returned via postMessage from inside Paged.js `after()` callback, received in the existing `window.addEventListener('message')` handler. The handler already routes by message shape — add a `pageCount` branch alongside the existing `slideIndex` branch:

```typescript
fromEvent<MessageEvent>(window, 'message')
  .pipe(
    filter(e => e.source === this.iframeRef()?.nativeElement.contentWindow),
    takeUntilDestroyed(),
  )
  .subscribe(e => {
    if (typeof e.data?.slideIndex === 'number') this.store.goToSlide(e.data.slideIndex);
    if (typeof e.data?.pageCount === 'number') this.store.setSlideCount(e.data.pageCount);
  });
```

### 4 — Preview pane UI gating

Slide nav buttons and the Present FAB are hidden for prose:

```html
<!-- preview-pane.html -->
@if (store.documentType() === 'slides') {
  <nav class="slide-nav" aria-label="Slide navigation"> … </nav>
  <button mat-fab class="present-fab" …> … </button>
}
```

### 5 — ExportService

The existing `print()` and `downloadHtml()` methods are slides-only today. Add prose equivalents:

```typescript
downloadProseHtml(filename: string, markdown: string): void {
  const { html } = this.marpService.renderProse(markdown);
  // isExport=true → no Paged.js script; @page CSS handles print layout
  const fullHtml = this.marpService.buildProseSrcdoc(html, true);
  const blob = new Blob([fullHtml], { type: 'text/html' });
  this.download(filename.replace(/\.md$/, '') + '.html', blob);
}

printProse(markdown: string): void {
  const { html } = this.marpService.renderProse(markdown);
  const fullHtml = this.marpService.buildProseSrcdoc(html, true);
  // Reuse existing print-via-hidden-iframe pattern
  this._printViaFrame(fullHtml);
}
```

The toolbar export menu already branches on document type — gate each option accordingly.

---

## Paged.js integration

### Bundle

Paged.js is added as an npm dependency and copied to `public/js/` at build time (or downloaded via a script like Mermaid):

```bash
npm install pagedjs
```

Or, since Folio already has a download-themes script pattern, add `scripts/download-pagedjs.mjs` that fetches the UMD bundle from unpkg and writes it to `public/js/paged.polyfill.min.js`.

### Service worker precache

Add to `ngsw-config.json` alongside `mermaid.min.js`:

```json
{
  "assetGroups": [
    {
      "name": "app-assets",
      "resources": {
        "files": [
          "/js/paged.polyfill.min.js"
        ]
      }
    }
  ]
}
```

### Why polyfill mode (not `Previewer` API)

Paged.js ships two integration paths:

| Mode | How | Use case |
|---|---|---|
| **Polyfill** (`paged.polyfill.js`) | Drop `<script>` into page; runs automatically on `DOMContentLoaded` | Simple — matches Folio's srcdoc iframe pattern |
| **Previewer API** (`import { Previewer }`) | Programmatic; pass DOM content + CSS | Useful when you control the DOM before rendering |

The polyfill mode is the right choice here: it mirrors how Mermaid is integrated (`<script src="js/mermaid.min.js">`), it requires no build-time bundling of Paged.js into the Angular app, and it keeps the prose rendering entirely self-contained within the srcdoc iframe.

### Behaviour inside the iframe

1. `paged.polyfill.js` loads and waits for `DOMContentLoaded`
2. It processes the rendered HTML, applying `@page` rules and fragmenting content into page boxes (`.pagedjs_page` elements)
3. The `after()` callback fires with `flow.total` (total page count) → posted to `window.parent`
4. Angular receives the count and stores it in `slideCount` (shared signal, renamed to `pageCount` in a later refactor)

---

## Debounce strategy

Paged.js does heavy DOM fragmentation — more expensive than a Marp re-render. The debounce is gated on document type:

```typescript
timer(this.store.documentType() === 'prose' ? 600 : 300)
```

This keeps slide mode snappy while giving Paged.js enough settling time.

---

## AppStore changes

| Signal / computed | Change |
|---|---|
| `presentationList` | Rename → `fileList` (files are no longer all presentations) |
| `slideCount` / `setSlideCount` | Kept as-is for now; semantically means "page count" for prose |
| `currentSlideIndex` / `goToSlide` | Kept; used only in slides mode — prose ignores it |
| `documentType` | **New** `computed<'slides' \| 'prose'>()` derived from `currentMarkdown` |

Full rename of `presentationList` → `fileList` is a separate, mechanical refactor. It can land independently without blocking prose mode.

---

## Sample prose document

A new sample file `Welcome Prose.md` is created the first time a user creates a text document:

```markdown
# My First Document

Write your content here. Use standard Markdown — headings, lists, **bold**, *italic*, footnotes[^1], tables, and code blocks all work.

---

## Page Two

Use `---` to start a new page. It works the same way as in slide mode.

[^1]: Footnotes render at the bottom of the page they appear on.
```

---

## Open questions

- **Page size selector** — A4 vs letter vs custom? Deferred to a post-v2 polish pass.
- **Prose themes** — Typography presets (academic, report, novel)? Deferred; one default style ships in v2.
- **Frontmatter passthrough** — Should prose docs support a `title:` frontmatter key for the browser `<title>`? Yes — low cost, implement during `buildProseSrcdoc`.
- **Mermaid in prose** — The fence override in `MarpService` already applies to `markdown-it`; Mermaid diagrams should work in prose without changes. Needs a smoke test.
- **Scroll restoration** — After Paged.js re-renders, the iframe scroll position resets. Can mitigate by recording `scrollY` before srcdoc update and restoring via postMessage after `after()` fires.
