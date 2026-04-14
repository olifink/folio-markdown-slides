import { Injectable } from '@angular/core';
// @ts-ignore
import MarkdownIt from 'markdown-it';
// @ts-ignore
import { full as emojiPlugin } from 'markdown-it-emoji';
import hljs from 'highlight.js';
import { configureMarkdownPlugins } from './configure-markdown';
import { mathPlugin } from './markdown-math';
import { loadMermaidScript } from './mermaid-loader';

export type ColorScheme = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ProseService {
  private readonly md = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: true,
    typographer: true,
    highlight: (str: string, lang: string) => {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        } catch {}
      }
      return '';
    },
  });

  private mermaidContent = '';

  constructor() {
    configureMarkdownPlugins(this.md);
    this.md.use(emojiPlugin).use(mathPlugin);
    loadMermaidScript().then(s => (this.mermaidContent = s));
  }

  render(markdown: string): { html: string } {
    const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
    const html = this.md.render(body);
    return { html };
  }

  /**
   * @param standalone - true for HTML file download (inlines mermaid script);
   *                     false for live preview and print-to-PDF (uses <script src>).
   */
  buildSrcdoc(
    html: string,
    isExport: boolean = false,
    proseMode: 'flow' | 'paged' = 'flow',
    colorScheme: ColorScheme = 'system',
    appTheme: 'quiet' | 'clean' = 'quiet',
    fontFamily: 'sans-serif' | 'serif' = 'sans-serif',
    standalone: boolean = false,
    title: string = 'Folio Document',
  ): string {
    const isPaged = proseMode === 'paged';
    const htmlAttr = ` data-theme="${appTheme}" data-font-family="${fontFamily}"${colorScheme === 'system' ? '' : ` data-color-scheme="${colorScheme}"`}`;

    const mermaidTag = standalone && this.mermaidContent
      ? `<script>${this.mermaidContent}</script>`
      : `<script src="js/mermaid.min.js"></script>`;

    const mermaidThemeExpr = `document.documentElement.dataset.colorScheme === 'dark' ||
               (!document.documentElement.dataset.colorScheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
               ? 'dark' : 'default'`;

    // Exports (HTML download + print-to-PDF) always use the light theme regardless
    // of the user's colour scheme — printed pages should not be dark.
    const mermaidConfig = (export_: boolean) => `{
      startOnLoad: false,
      theme: ${export_ ? "'default'" : mermaidThemeExpr},
      securityLevel: 'loose',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      flowchart: { useMaxWidth: false, htmlLabels: true }
    }`;

    // Helper script to handle links within srcdoc.
    // 1. Internal hash links (footnotes) scroll into view.
    // 2. External links open in a new tab to avoid iframe navigation issues.
    var linkHandlerScript = `
    <script>
    document.addEventListener('click', function(e) {
    var target = e.target;
    while (target && target.tagName !== 'A') target = target.parentNode;
    if (!target || !target.getAttribute('href')) return;

    var href = target.getAttribute('href');
    if (href.startsWith('#')) {
      var id = href.slice(1);
      var el = document.getElementById(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView();
      }
    } else {
      e.preventDefault();
      window.open(href, '_blank');
    }
    });

    (function() {
    var touchStartX = 0;
    var touchStartY = 0;
    document.addEventListener('touchstart', function(e) {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
      var touchEndX = e.changedTouches[0].screenX;
      var touchEndY = e.changedTouches[0].screenY;
      var diffX = touchStartX - touchEndX;
      var diffY = Math.abs(touchStartY - touchEndY);

      // If swiping right (diffX < -50) and it's mostly horizontal, switch back to editor.
      // Swiping left in prose just scrolls horizontally or does nothing, 
      // but we can also trigger next tab if at the right edge if we want.
      if (diffX < -50 && Math.abs(diffX) > diffY) {
        window.parent.postMessage({ type: 'tabSwitch', direction: 'prev' }, '*');
      }
    }, { passive: true });
    })();
    </script>`;

    // Scaling script for paged mode to fit the width of the iframe.
    const pagedScaleScript = isPaged && !isExport ? `
<script>
(function() {
  var resizeTimeout;
  function updateScale() {
    var pages = document.querySelector('.pagedjs_pages');
    if (!pages) {
      // If Paged.js hasn't finished yet, try again shortly
      setTimeout(updateScale, 100);
      return;
    }
    
    // Ensure styles are set on body
    document.body.style.display = 'flex';
    document.body.style.flexDirection = 'column';
    document.body.style.alignItems = 'center';
    document.body.style.overflowX = 'hidden';

    // Reset for measurement
    pages.style.transform = 'none';
    pages.style.width = 'max-content';
    pages.style.display = 'inline-block';
    
    var pageWidth = pages.offsetWidth;
    var containerWidth = window.innerWidth;
    var padding = 40; 
    
    if (pageWidth > 0) {
      var scale = (containerWidth - padding) / pageWidth;
      if (scale > 1) scale = 1; 

      pages.style.transform = 'scale(' + scale + ')';
      pages.style.transformOrigin = 'top center';
      
      // Update body to accommodate scaled content height
      document.body.style.height = (pages.offsetHeight * scale + padding) + 'px';
    }
    pages.style.width = '';
  }

  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateScale, 50);
  });

  window.rescalePagedView = updateScale;
  
  // Also run on load as a backup to PagedConfig.after
  window.addEventListener('load', function() {
    setTimeout(updateScale, 200);
  });
})();
</script>` : '';

    let pagedScript = '';
    if (isPaged && !isExport) {
      pagedScript = `
<script>
    window.PagedConfig = {
  auto: false,
  after: function(flow) {
    if (window.rescalePagedView) window.rescalePagedView();
    if (window.mermaid) {
      mermaid.initialize(${mermaidConfig(false)});
      mermaid.run({ querySelector: '.mermaid' });
    }
    // Post message AFTER scaling so parent scroll restoration is accurate.
    // We use requestAnimationFrame to ensure the body height change has been processed.
    var total = (flow && typeof flow.total === 'number') ? flow.total : 1;
    requestAnimationFrame(function() {
      window.parent.postMessage({ pageCount: total }, '*');
    });
  }
};
</script>
${mermaidTag}
<script src="js/paged.polyfill.min.js"></script>
<script>
window.addEventListener('DOMContentLoaded', function() {
  window.PagedPolyfill.preview();
});
</script>
${linkHandlerScript}
${pagedScaleScript}`;
    } else if (isExport) {
      // Export (HTML download or print): no paged.js, but mermaid still renders
      pagedScript = `${mermaidTag}
<script>
window.addEventListener('DOMContentLoaded', function() {
  if (window.mermaid) {
    mermaid.initialize(${mermaidConfig(!standalone)});
    mermaid.run({ querySelector: '.mermaid' }).then(function() {
      window.parent.postMessage({ type: 'printReady' }, '*');
    });
  } else {
    window.parent.postMessage({ type: 'printReady' }, '*');
  }
});
</script>
${linkHandlerScript}`;
    } else {
      // Flow mode preview
      pagedScript = `${mermaidTag}
<script>
window.addEventListener('DOMContentLoaded', function() {
  if (window.mermaid) {
    mermaid.initialize(${mermaidConfig(false)});
    mermaid.run({ querySelector: '.mermaid' });
  }
});
</script>
${linkHandlerScript}`;
    }

    const pagedStyles = isPaged ? `
  @page { size: A4 portrait; margin: 20mm 22mm; }

  hr {
    break-before: page;
    border: none;
    height: 0;
    margin: 0;
    visibility: hidden;
  }

  body { background: ${isExport ? 'var(--prose-bg)' : 'var(--prose-canvas)'}; }
  .markdown-body { background: var(--prose-bg); }

  .pagedjs_page {
    background: var(--prose-bg);
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    margin: 0 auto 24px;
  }
  ${isExport ? '.pagedjs_page { box-shadow: none; margin: 0; }' : ''}
` : `
  body {
    background: var(--prose-bg);
    padding: 2rem;
  }

  hr {
    border: none;
    border-top: 1px solid var(--prose-border);
    margin: 2rem 0;
  }
`;

    return `<!DOCTYPE html>
<html${htmlAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  /* ── Colour tokens (Theme-aware) ── */
  
  [data-theme="quiet"] {
    --prose-bg:       #ffffff;
    --prose-canvas:   #f3f0ff; /* lavender container */
    --prose-text:     #1d1b20;
    --prose-muted:    #555555;
    --prose-border:   #dfd9f2;
    --prose-code-bg:  #f5f5f5;
    --prose-quote-border: #aaaaaa;

    @media (prefers-color-scheme: dark) {
      &:not([data-color-scheme="light"]) {
        --prose-bg:       #1c1b1f;
        --prose-canvas:   #111116;
        --prose-text:     #e6e0e9;
        --prose-muted:    #a09aac;
        --prose-border:   #2e2e3e;
        --prose-code-bg:  #2b2930;
        --prose-quote-border: #6b6573;
      }
    }
    &[data-color-scheme="dark"] {
      --prose-bg:       #1c1b1f;
      --prose-canvas:   #111116;
      --prose-text:     #e6e0e9;
      --prose-muted:    #a09aac;
      --prose-border:   #2e2e3e;
      --prose-code-bg:  #2b2930;
      --prose-quote-border: #6b6573;
    }
    &[data-color-scheme="light"] {
      --prose-bg:       #ffffff;
      --prose-canvas:   #f3f0ff;
      --prose-text:     #1d1b20;
      --prose-muted:    #555555;
      --prose-border:   #dfd9f2;
      --prose-code-bg:  #f5f5f5;
      --prose-quote-border: #aaaaaa;
    }
  }

  [data-theme="clean"] {
    --prose-bg:       #ffffff;
    --prose-canvas:   #f2f2f7;
    --prose-text:     #000000;
    --prose-muted:    #8e8e93;
    --prose-border:   #d1d1d6;
    --prose-code-bg:  #f2f2f7;
    --prose-quote-border: #c7c7cc;

    @media (prefers-color-scheme: dark) {
      &:not([data-color-scheme="light"]) {
        --prose-bg:       #000000;
        --prose-canvas:   #1c1c1e;
        --prose-text:     #ffffff;
        --prose-muted:    #8e8e93;
        --prose-border:   #38383a;
        --prose-code-bg:  #1c1c1e;
        --prose-quote-border: #38383a;
      }
    }
    &[data-color-scheme="dark"] {
      --prose-bg:       #000000;
      --prose-canvas:   #1c1c1e;
      --prose-text:     #ffffff;
      --prose-muted:    #8e8e93;
      --prose-border:   #38383a;
      --prose-code-bg:  #1c1c1e;
      --prose-quote-border: #38383a;
    }
    &[data-color-scheme="light"] {
      --prose-bg:       #ffffff;
      --prose-canvas:   #f2f2f7;
      --prose-text:     #000000;
      --prose-muted:    #8e8e93;
      --prose-border:   #d1d1d6;
      --prose-code-bg:  #f2f2f7;
      --prose-quote-border: #c7c7cc;
    }
  }

  /* ── Base ── */
  html, body {
    width: 100%;
    margin: 0;
    padding: 0;
    background: var(--prose-bg);
    color: var(--prose-text);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    color-scheme: ${colorScheme === 'dark' ? 'dark' : colorScheme === 'light' ? 'light' : 'light dark'};
    -webkit-font-smoothing: antialiased;
    -webkit-text-size-adjust: 100%;
    overscroll-behavior: none;
  }

  html[data-font-family="serif"], 
  html[data-font-family="serif"] body,
  html[data-font-family="serif"] h1,
  html[data-font-family="serif"] h2,
  html[data-font-family="serif"] h3,
  html[data-font-family="serif"] h4,
  html[data-font-family="serif"] h5,
  html[data-font-family="serif"] h6,
  html[data-font-family="serif"] .markdown-body h1,
  html[data-font-family="serif"] .markdown-body h2,
  html[data-font-family="serif"] .markdown-body h3 {
    font-family: 'Lora', 'Georgia', 'Times New Roman', serif;
  }

  *, *::before, *::after { box-sizing: border-box; }

  /* ── Prose body ── */
  .markdown-body {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    color: inherit;
    ${isExport ? 'max-width: 840px; margin: 0 auto; padding: 4rem 2rem;' : ''}
  }

  .markdown-body p, .markdown-body ul, .markdown-body ol,
  .markdown-body blockquote, .markdown-body pre, .markdown-body table {
    margin-top: 0;
    margin-bottom: 1rem;
  }

  /* ── Headings ── */
  h1, h2, h3, h4, h5, h6 {
    font-family: inherit;
    line-height: 1.2;
    color: var(--prose-text);
  }
  .markdown-body h1 { font-size: 2rem;   font-weight: 400; margin: 2rem 0 1rem; }
  .markdown-body h2 { font-size: 1.5rem; font-weight: 400; margin: 1.5rem 0 1rem; }
  .markdown-body h3 { font-size: 1.25rem; font-weight: 500; margin: 1.2rem 0 0.8rem; }

  p { margin: 0 0 0.9em; }

  .markdown-body strong, .markdown-body b { font-weight: 600; }
  .markdown-body em, .markdown-body i { font-style: italic; }

  .markdown-body ul, .markdown-body ol { padding-left: 1.5rem; }
  .markdown-body li { margin-bottom: 0.5rem; }
  .markdown-body li > p { margin-bottom: 0.25rem; }

  /* ── Code ── */
  pre, code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.88em;
  }
  code {
    background: var(--prose-code-bg);
    padding: 0.15em 0.35em;
    border-radius: 3px;
  }
  pre {
    background: var(--prose-code-bg);
    padding: 0.8em 1em;
    border-radius: 4px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  pre code { background: none; padding: 0; }

  /* ── Blockquote ── */
  blockquote {
    border-left: 3px solid var(--prose-quote-border);
    margin-left: 0;
    padding-left: 1em;
    color: var(--prose-muted);
    font-style: italic;
  }

  /* ── Table ── */
  table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 1em;
  }
  th, td {
    border: 1px solid var(--prose-border);
    padding: 0.4em 0.7em;
    text-align: left;
  }
  th { background: var(--prose-code-bg); }

  /* ── Misc ── */
  img { max-width: 100%; height: auto; }

  a { color: inherit; }

  /* KaTeX MathML — block centering only; browser renders the math natively */
  .katex-block { text-align: center; margin: 1rem 0; overflow-x: auto; }
  .katex-block .katex { display: inline-block; }

  /* ── Syntax highlighting (highlight.js) ── */
  :root {
    --hljs-keyword:  #6366f1;
    --hljs-string:   #059669;
    --hljs-comment:  #9ca3af;
    --hljs-number:   #d97706;
    --hljs-type:     #0891b2;
    --hljs-builtin:  #7c3aed;
    --hljs-attr:     #0369a1;
    --hljs-title:    #1d4ed8;
    --hljs-meta:     #64748b;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --hljs-keyword:  #818cf8;
      --hljs-string:   #34d399;
      --hljs-comment:  #6b7280;
      --hljs-number:   #fbbf24;
      --hljs-type:     #22d3ee;
      --hljs-builtin:  #a78bfa;
      --hljs-attr:     #38bdf8;
      --hljs-title:    #93c5fd;
      --hljs-meta:     #94a3b8;
    }
  }
  html[data-color-scheme="light"] {
    --hljs-keyword:  #6366f1;
    --hljs-string:   #059669;
    --hljs-comment:  #9ca3af;
    --hljs-number:   #d97706;
    --hljs-type:     #0891b2;
    --hljs-builtin:  #7c3aed;
    --hljs-attr:     #0369a1;
    --hljs-title:    #1d4ed8;
    --hljs-meta:     #64748b;
  }
  html[data-color-scheme="dark"] {
    --hljs-keyword:  #818cf8;
    --hljs-string:   #34d399;
    --hljs-comment:  #6b7280;
    --hljs-number:   #fbbf24;
    --hljs-type:     #22d3ee;
    --hljs-builtin:  #a78bfa;
    --hljs-attr:     #38bdf8;
    --hljs-title:    #93c5fd;
    --hljs-meta:     #94a3b8;
  }

  .hljs-keyword, .hljs-operator, .hljs-reserved        { color: var(--hljs-keyword); font-weight: 500; }
  .hljs-string, .hljs-template-string,
  .hljs-template-tag, .hljs-regexp                     { color: var(--hljs-string); }
  .hljs-comment, .hljs-quote                            { color: var(--hljs-comment); font-style: italic; }
  .hljs-number, .hljs-literal, .hljs-symbol,
  .hljs-link                                            { color: var(--hljs-number); }
  .hljs-type, .hljs-class, .hljs-variable.language_    { color: var(--hljs-type); }
  .hljs-built_in, .hljs-function                        { color: var(--hljs-builtin); }
  .hljs-attr, .hljs-selector-attr,
  .hljs-selector-pseudo                                 { color: var(--hljs-attr); }
  .hljs-title, .hljs-title.class_,
  .hljs-title.function_                                 { color: var(--hljs-title); }
  .hljs-meta, .hljs-selector-tag,
  .hljs-selector-id, .hljs-selector-class              { color: var(--hljs-meta); }
  .hljs-addition    { color: var(--hljs-string); background: color-mix(in srgb, var(--hljs-string) 12%, transparent); }
  .hljs-deletion    { color: #ef4444; background: color-mix(in srgb, #ef4444 12%, transparent); }

  .mermaid-container {
    display: flex;
    justify-content: center;
    width: 100%;
    margin: 1em 0;
  }

  .task-list-item { list-style-type: none !important; }
  .task-list-item-checkbox { margin: 0 0.5em 0.25em -1.4em !important; vertical-align: middle !important; }

  ${pagedStyles}
</style>
</head>
<body>
<div class="markdown-body">
${html}
</div>
${pagedScript}
</body>
</html>`;
  }
}
