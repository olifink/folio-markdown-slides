import { Injectable } from '@angular/core';
import Marp from '@marp-team/marp-core';
// @ts-ignore
import mark from 'markdown-it-mark';
// @ts-ignore
import footnote from 'markdown-it-footnote';
// @ts-ignore
import deflist from 'markdown-it-deflist';
// @ts-ignore
import container from 'markdown-it-container';

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

  constructor() {
    this.marp.markdown
      .use(mark)
      .use(footnote)
      .use(deflist)
      .use(container, 'container');

    // Add Mermaid support to markdown-it
    const defaultFence = this.marp.markdown.renderer.rules.fence;
    this.marp.markdown.renderer.rules.fence = (tokens: any[], idx: number, options: any, env: any, self: any) => {
      const token = tokens[idx];
      if (token.info === 'mermaid') {
        return `<div class="mermaid-container"><pre class="mermaid">${token.content}</pre></div>`;
      }
      return defaultFence!(tokens, idx, options, env, self);
    };

    this.registerMarpXThemes();
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

  buildSrcdoc(html: string, css: string, isExport: boolean = false): string {
    const navScript = isExport ? '' : `
<script src="js/mermaid.min.js"></script>
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
      fontSize: 16,
      flowchart: { useMaxWidth: false, htmlLabels: false },
      sequence: { useMaxWidth: false },
      gantt: { useMaxWidth: false }
    });
  }

  async function show(idx) {
    var clamped = Math.max(0, Math.min(idx, slides.length - 1));
    slides.forEach(function (s, i) { s.classList.toggle('active', i === clamped); });
    current = clamped;
    
    if (window.mermaid) {
      await mermaid.run({
        querySelector: '.active .mermaid'
      });
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
    show(next).then(function(idx) { window.parent.postMessage({ slideIndex: actualIdx }, '*'); });
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
  }
  .mermaid svg {
    max-width: 100%;
    height: auto !important;
  }
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
</style>
</head>
<body>
${html}
${navScript}
</body>
</html>`;
  }
}
