import { Injectable } from '@angular/core';
import Marp from '@marp-team/marp-core';
import { configureMarkdownPlugins } from './configure-markdown';
import { loadMermaidScript } from './mermaid-loader';

const MARPX_THEMES = [
  'cantor', 'church', 'copernicus', 'einstein',
  'frankfurt', 'galileo', 'gauss', 'gropius',
  'gödel', 'haskell', 'hobbes', 'lorca',
  'marpx', 'newton', 'socrates', 'sparta'
];

@Injectable({ providedIn: 'root' })
export class MarpService {
  private readonly marp = new Marp({
    html: true,
    math: 'katex',
    emoji: {
      shortcode: true,
      unicode: true
    }
  });

  private mermaidContent = '';

  constructor() {
    configureMarkdownPlugins(this.marp.markdown);
    this.registerMarpXThemes();
    loadMermaidScript().then(s => (this.mermaidContent = s));
  }

  private async registerMarpXThemes(): Promise<void> {
    for (const theme of MARPX_THEMES) {
      try {
        const response = await fetch(`themes/marpx/${theme}.css`);
        if (response.ok) {
          const css = await response.text();
          this.marp.themeSet.add(css);
        }
      } catch (e) {
        console.error(`Failed to register MarpX theme: ${theme}`, e);
      }
    }
  }

  render(markdown: string): { html: string; css: string; slideCount: number } {
    const { html, css } = this.marp.render(markdown);
    const slideCount = (html.match(/data-marpit-svg/g) ?? []).length || 1;
    return { html, css, slideCount };
  }

  /**
   * @param standalone - true for HTML file download (inlines mermaid script);
   *                     false for live preview and print-to-PDF (uses <script src>).
   */
  buildSrcdoc(html: string, css: string = '', isExport: boolean = false, standalone: boolean = false): string {
    const mermaidTag = standalone && this.mermaidContent
      ? `<script>${this.mermaidContent}</script>`
      : `<script src="js/mermaid.min.js"></script>`;

    // Mermaid initialisation — always included (preview + export).
    // Export renders all diagrams at once; preview renders per active slide.
    const mermaidInit = isExport ? `
${mermaidTag}
<script>
(function () {
  var MERMAID_CONFIG = {
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: 20,
    flowchart: { useMaxWidth: false, htmlLabels: true },
    sequence: { useMaxWidth: false },
    gantt: { useMaxWidth: false }
  };
  function init() {
    if (!window.mermaid) {
      window.parent.postMessage({ type: 'printReady' }, '*');
      return;
    }
    mermaid.initialize(MERMAID_CONFIG);
    mermaid.run({ querySelector: '.mermaid' }).then(function() {
      window.parent.postMessage({ type: 'printReady' }, '*');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>` : `
${mermaidTag}
<script>
(function () {
  var slides = document.querySelectorAll('svg[data-marpit-svg]');
  var current = 0;

  if (window.mermaid) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: 20,
      flowchart: { useMaxWidth: false, htmlLabels: true },
      sequence: { useMaxWidth: false },
      gantt: { useMaxWidth: false }
    });
  }

  async function show(idx) {
    var clamped = Math.max(0, Math.min(idx, slides.length - 1));
    slides.forEach(function (s, i) { s.classList.toggle('active', i === clamped); });
    current = clamped;

    if (window.mermaid) {
      await document.fonts.ready;
      var diagramEls = Array.from(document.querySelectorAll('.active .mermaid:not([data-processed])'));
      if (diagramEls.length) {
        var tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'position:absolute;left:-9999px;top:0;width:900px;visibility:hidden;';
        document.body.appendChild(tempDiv);
        var placements = diagramEls.map(function(el) {
          var marker = document.createComment('mermaid');
          el.parentNode.replaceChild(marker, el);
          el.classList.add('mermaid-render-tmp');
          tempDiv.appendChild(el);
          return { el: el, marker: marker };
        });
        await mermaid.run({ querySelector: '.mermaid-render-tmp' });
        placements.forEach(function(p) {
          p.el.classList.remove('mermaid-render-tmp');
          p.marker.parentNode.replaceChild(p.el, p.marker);
        });
        document.body.removeChild(tempDiv);
      }
    }
    return clamped;
  }

  show(0);

  document.addEventListener('keydown', function (e) {
    var next;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') next = current + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'Backspace') next = current - 1;
    else return;
    show(next).then(function(idx) { window.parent.postMessage({ slideIndex: idx }, '*'); });
  });

  var touchStartX = 0;
  document.addEventListener('touchstart', function(e) { touchStartX = e.changedTouches[0].screenX; }, false);
  document.addEventListener('touchend', function(e) {
    var touchEndX = e.changedTouches[0].screenX;
    var next = current;
    if (touchEndX < touchStartX - 50) next = current + 1;
    else if (touchEndX > touchStartX + 50) next = current - 1;
    else return;
    show(next).then(function(idx) { window.parent.postMessage({ slideIndex: idx }, '*'); });
  }, false);

  window.addEventListener('message', function (e) {
    if (e.data && typeof e.data.slideIndex === 'number') show(e.data.slideIndex);
  });
})();
</script>`;

    const interactiveStyles = isExport ? `
  html, body { height: auto !important; overflow: visible !important; }
  svg[data-marpit-svg] { display: block !important; width: 100vw !important; height: auto !important; page-break-after: always; break-after: page; }
` : `
  html, body, .marpit { width: 100%; height: 100%; overflow: hidden; }
  .marpit { display: flex; align-items: center; justify-content: center; }
  svg[data-marpit-svg] { display: none; flex-shrink: 0; }
  svg[data-marpit-svg].active { display: block; max-width: 100%; max-height: 100%; }

  .mermaid-container {
    display: flex;
    justify-content: center;
    width: 100%;
  }
  .mermaid svg {
    display: block;
    max-width: 100%;
    height: auto;
  }
`;

    const taskListStyles = `
  .task-list-item { list-style-type: none !important; }
  .task-list-item-checkbox { margin: 0 0.5em 0.25em -1.4em !important; vertical-align: middle !important; }
`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Folio Presentation</title>
<style>${css}</style>
<style>
  html, body, .marpit {
    margin: 0; padding: 0;
    background: transparent;
    ${isExport ? '' : 'touch-action: none;'}
  }
  ${interactiveStyles}
  ${taskListStyles}
</style>
</head>
<body>
${html}
${mermaidInit}
</body>
</html>`;
  }
}
