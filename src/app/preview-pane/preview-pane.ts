import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { filter, map, switchMap } from 'rxjs/operators';
import { fromEvent, of, timer, merge } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AppStore } from '../store/app-store';
import { MarpService } from '../services/marp.service';

@Component({
  selector: 'app-preview-pane',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './preview-pane.html',
  styleUrl: './preview-pane.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewPaneComponent {
  readonly active = input(true);

  protected readonly store = inject(AppStore);
  private readonly marpService = inject(MarpService);
  private readonly iframeRef = viewChild<ElementRef<HTMLIFrameElement>>('previewFrame');

  /**
   * First emission is immediate (no debounce) so the preview populates on load.
   * Subsequent emissions debounce to avoid re-rendering on every keystroke.
   * Prose uses a longer debounce as Paged.js fragmentation is expensive.
   */
  private readonly rendered = toSignal(
    toObservable(this.store.currentMarkdown).pipe(
      switchMap((md, index) => {
        const debounceTime = index === 0 ? 0 : (this.store.documentType() === 'prose' ? 600 : 300);
        return timer(debounceTime).pipe(map(() => md));
      }),
      map(md => {
        if (this.store.documentType() === 'slides') {
          return { type: 'slides' as const, ...this.marpService.render(md) };
        } else {
          return { type: 'prose' as const, ...this.marpService.renderProse(md) };
        }
      }),
    ),
    { 
      initialValue: this.store.documentType() === 'slides' 
        ? { type: 'slides' as const, ...this.marpService.render(this.store.currentMarkdown()) }
        : { type: 'prose' as const, ...this.marpService.renderProse(this.store.currentMarkdown()) }
    },
  );

  constructor() {
    // ... (rest of constructor)
    
    // Update iframe srcdoc and store slide/page count whenever rendered output changes
    effect(() => {
      const result = this.rendered();
      const proseMode = this.store.proseViewMode(); // Track mode changes
      const iframe = this.iframeRef();
      if (!iframe) return;
      
      if (result.type === 'slides') {
        this.store.setSlideCount(result.slideCount);
        iframe.nativeElement.srcdoc = this.marpService.buildSrcdoc(result.html, result.css, false, 'slides');
      } else {
        // Page count is set via postMessage after Paged.js finishes
        iframe.nativeElement.srcdoc = this.marpService.buildSrcdoc(result.html, '', false, 'prose', proseMode);
      }
    });

    // Scroll to current slide (only relevant for slides mode)
    effect(() => {
      if (this.store.documentType() !== 'slides') return;
      const idx = this.store.currentSlideIndex();
      this.iframeRef()?.nativeElement.contentWindow?.postMessage({ slideIndex: idx }, '*');
    });

    // Re-sync slide position when the tab becomes visible after being hidden
    effect(() => {
      if (!this.active() || this.store.documentType() !== 'slides') return;
      const idx = this.store.currentSlideIndex();
      this.iframeRef()?.nativeElement.contentWindow?.postMessage({ slideIndex: idx }, '*');
    });
  }

  /** Re-sends the active slide index after the iframe finishes loading new srcdoc content. */
  protected onFrameLoad(): void {
    const idx = this.store.currentSlideIndex();
    this.iframeRef()?.nativeElement.contentWindow?.postMessage({ slideIndex: idx }, '*');
  }

  protected prevSlide(): void {
    this.store.goToSlide(this.store.currentSlideIndex() - 1);
  }

  protected nextSlide(): void {
    this.store.goToSlide(this.store.currentSlideIndex() + 1);
  }

  protected present(): void {
    this.iframeRef()?.nativeElement.requestFullscreen();
  }
}
