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
</head>
<body>
${html}
<script>
(function () {
  function show(idx) {
    var slides = document.querySelectorAll('svg[data-marpit-svg]');
    if (slides[idx]) slides[idx].scrollIntoView({ behavior: 'instant' });
  }
  window.addEventListener('message', function (e) {
    if (e.data && typeof e.data.slideIndex === 'number') show(e.data.slideIndex);
  });
})();
</script>
</body>
</html>`;
  }
}
