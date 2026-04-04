import { Injectable } from '@angular/core';
import Marp from '@marp-team/marp-core';

const MARPX_THEMES = [
  'cantor', 'church', 'copernicus', 'einstein', 
  'frankfurt', 'galileo', 'gauss', 'gropius', 
  'gödel', 'haskell', 'hobbes', 'lorca', 
  'marpx', 'newton', 'socrates', 'sparta'
];

@Injectable({ providedIn: 'root' })
export class MarpService {
  private readonly marp = new Marp({ html: true });

  constructor() {
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
    // Marp renders one <svg data-marpit-svg> per slide
    const slideCount = (html.match(/data-marpit-svg/g) ?? []).length || 1;
    return { html, css, slideCount };
  }

  /**
   * Builds a self-contained HTML document.
   * If isExport is true, it builds a static document suitable for saving.
   * If isExport is false, it includes the interactive navigation script for the iframe.
   */
  buildSrcdoc(html: string, css: string, isExport: boolean = false): string {
    const navScript = isExport ? '' : `
<script>
(function () {
  var slides = document.querySelectorAll('svg[data-marpit-svg]');
  var current = 0;

  function show(idx) {
    var clamped = Math.max(0, Math.min(idx, slides.length - 1));
    slides.forEach(function (s, i) { s.classList.toggle('active', i === clamped); });
    current = clamped;
    return clamped;
  }

  show(0);

  // Keyboard navigation
  document.addEventListener('keydown', function (e) {
    var next;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      next = current + 1;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'Backspace') {
      next = current - 1;
    } else {
      return;
    }
    e.preventDefault();
    next = show(next);
    window.parent.postMessage({ slideIndex: next }, '*');
  });

  // Touch navigation (swipes)
  var touchStartX = 0;
  var touchEndX = 0;
  
  document.addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].screenX;
  }, false);

  document.addEventListener('touchend', function(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, false);

  function handleSwipe() {
    var threshold = 50;
    var next = current;
    if (touchEndX < touchStartX - threshold) {
      // Swipe left -> next slide
      next = current + 1;
    } else if (touchEndX > touchStartX + threshold) {
      // Swipe right -> previous slide
      next = current - 1;
    } else {
      return;
    }
    next = show(next);
    window.parent.postMessage({ slideIndex: next }, '*');
  }

  // Parent → iframe: navigate to a specific slide
  window.addEventListener('message', function (e) {
    if (e.data && typeof e.data.slideIndex === 'number') show(e.data.slideIndex);
  });
})();
</script>`;

    const interactiveStyles = isExport ? `
  /* Print/Export styles: show all slides in a flow */
  html, body {
    height: auto !important;
    overflow: visible !important;
  }
  svg[data-marpit-svg] {
    display: block !important;
    width: 100vw !important;
    height: auto !important;
    page-break-after: always;
    break-after: page;
  }
  @media print {
    @page { margin: 0; size: landscape; }
    body { margin: 0; }
    svg[data-marpit-svg] {
      width: 100% !important;
      height: 100% !important;
    }
  }
` : `
  /* Interactive styles: only show active slide, centered in viewport */
  html, body, .marpit {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .marpit {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  svg[data-marpit-svg] {
    display: none;
    flex-shrink: 0;
  }
  svg[data-marpit-svg].active {
    display: block;
    max-width: 100%;
    max-height: 100%;
  }
`;

    // language=HTML
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
