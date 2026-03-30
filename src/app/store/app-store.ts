import { Injectable, signal } from '@angular/core';

const SAMPLE_MARKDOWN = `---
marp: true
---

# Hello, Folio

A local-first Markdown slide editor.

---

## Writing slides is simple

Separate each slide with \`---\` and write Markdown.

- **Bold** and *italic* text
- \`Inline code\`
- Images, links, and more

---

## Themes

Folio supports three built-in Marp themes:
\`default\`, \`gaia\`, and \`uncover\`.

---

## Present

Hit the **▶ Present** button to go full-screen.
`;

@Injectable({ providedIn: 'root' })
export class AppStore {
  readonly currentMarkdown = signal(SAMPLE_MARKDOWN);
  readonly currentSlideIndex = signal(0);
  readonly slideCount = signal(1);
  readonly isDirty = signal(false);

  setMarkdown(value: string): void {
    this.currentMarkdown.set(value);
    this.isDirty.set(true);
  }

  setSlideCount(count: number): void {
    this.slideCount.set(count);
  }

  goToSlide(index: number): void {
    const clamped = Math.max(0, Math.min(index, this.slideCount() - 1));
    this.currentSlideIndex.set(clamped);
  }
}
