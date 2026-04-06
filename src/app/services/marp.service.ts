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

  renderProse(markdown: string): { html: string } {
    // Strip YAML frontmatter before rendering
    const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
    const html = this.marp.markdown.render(body);
    return { html };
  }

  buildSrcdoc(html: string, css: string = '', isExport: boolean = false, type: 'slides' | 'prose' = 'slides'): string {
    if (type === 'slides') {
      return this.buildSlidesSrcdoc(html, css, isExport);
    } else {
      return this.buildProseSrcdoc(html, isExport);
    }
  }

  private buildSlidesSrcdoc(html: string, css: string, isExport: boolean): string {
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

  private buildProseSrcdoc(html: string, isExport: boolean): string {
    const pagedScript = isExport
      ? '' // Paged.js not strictly needed for print if @page CSS is enough, but polyfill helps with complex layout
      : `<script src="js/mermaid.min.js"></script>
<script src="js/paged.polyfill.min.js"></script>
<script>
window.PagedConfig = {
  auto: false,
  after: function(flow) {
    window.parent.postMessage({ pageCount: flow.total }, '*');
    
    // Initialize Mermaid after Paged.js has fragmented the DOM
    if (window.mermaid) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        flowchart: { useMaxWidth: false, htmlLabels: true }
      });
      mermaid.run({ querySelector: '.mermaid' });
    }
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
    background: #f0f0f0;
    margin: 0;
  }
  
  /* Reset for exported HTML */
  ${isExport ? 'body { background: white; }' : ''}

  .markdown-body {
    background: white;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: system-ui, -apple-system, sans-serif;
    margin-top: 1.4em;
    margin-bottom: 0.4em;
    line-height: 1.2;
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
    white-space: pre-wrap;
    word-break: break-all;
  }
  
  blockquote {
    border-left: 3px solid #aaa;
    margin-left: 0;
    padding-left: 1em;
    color: #555;
    font-style: italic;
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
  
  img {
    max-width: 100%;
    height: auto;
  }

  .mermaid-container {
    display: flex;
    justify-content: center;
    width: 100%;
    margin: 1em 0;
  }

  /* Paged.js page boxes */
  .pagedjs_page {
    background: white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    margin: 0 auto 24px;
  }
  
  ${isExport ? '.pagedjs_page { box-shadow: none; margin: 0; }' : ''}
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
