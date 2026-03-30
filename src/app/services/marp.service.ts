import { Injectable } from '@angular/core';
import Marp from '@marp-team/marp-core';

@Injectable({ providedIn: 'root' })
export class MarpService {
  private readonly marp = new Marp({ html: true });

  render(markdown: string): { html: string; css: string; slideCount: number } {
    const { html, css } = this.marp.render(markdown);
    // Marp renders one <svg data-marpit-svg> per slide
    const slideCount = (html.match(/data-marpit-svg/g) ?? []).length || 1;
    return { html, css, slideCount };
  }

  /**
   * Builds a self-contained HTML document for the iframe srcdoc.
   * Includes Marp's CSS and a small navigation script that responds
   * to postMessage({ slideIndex: number }) from the parent frame.
   */
  buildSrcdoc(html: string, css: string): string {
    // language=HTML
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${css}</style>
<style>
  html, body, .marpit {
    margin: 0; padding: 0;
    width: 100%; height: 100%;
    overflow: hidden;
    background: transparent;
  }
  /* Hide all slides; only the active one is shown */
  svg[data-marpit-svg] {
    display: none;
    width: 100%;
    height: 100%;
  }
  svg[data-marpit-svg].active {
    display: block;
  }
</style>
</head>
<body>
${html}
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

  // Keyboard navigation — works in fullscreen and when the iframe is focused
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

  // Parent → iframe: navigate to a specific slide
  window.addEventListener('message', function (e) {
    if (e.data && typeof e.data.slideIndex === 'number') show(e.data.slideIndex);
  });
})();
</script>
</body>
</html>`;
  }
}
