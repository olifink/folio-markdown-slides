import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { filter, map, switchMap } from 'rxjs/operators';
import { fromEvent, of, timer, merge } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AppStore } from '../store/app-store';
import { MarpService } from '../services/marp.service';
import { ProseService } from '../services/prose.service';

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
  private readonly proseService = inject(ProseService);
  private readonly iframeRef = viewChild<ElementRef<HTMLIFrameElement>>('previewFrame');

  /** Saved scroll offset (px) of the prose preview before its srcdoc is replaced. */
  private proseScrollY = 0;
  /** True while a prose-flow srcdoc swap is in-flight; hides the iframe to avoid scroll-jump flicker. */
  protected readonly proseReloading = signal(false);

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
          return { type: 'prose' as const, ...this.proseService.render(md) };
        }
      }),
    ),
    {
      initialValue: this.store.documentType() === 'slides'
        ? { type: 'slides' as const, ...this.marpService.render(this.store.currentMarkdown()) }
        : { type: 'prose' as const, ...this.proseService.render(this.store.currentMarkdown()) }
    },
  );

  constructor() {
    // ... (rest of constructor)
    
    // Update iframe srcdoc and store slide/page count whenever rendered output changes
    effect(() => {
      const result = this.rendered();
      const proseMode = this.store.proseViewMode();
      const colorScheme = this.store.colorScheme();
      const iframe = this.iframeRef();
      if (!iframe) return;

      if (result.type === 'slides') {
        this.store.setSlideCount(result.slideCount);
        iframe.nativeElement.srcdoc = this.marpService.buildSrcdoc(result.html, result.css, false);
      } else {
        // Save scroll position before the srcdoc replacement resets it to 0.
        // Hide the iframe in flow mode so the scroll-jump isn't visible.
        const scrollEl = iframe.nativeElement.contentDocument?.documentElement;
        this.proseScrollY = scrollEl?.scrollTop ?? 0;
        if (proseMode === 'flow') this.proseReloading.set(true);
        // Page count is set via postMessage after Paged.js finishes
        iframe.nativeElement.srcdoc = this.proseService.buildSrcdoc(result.html, false, proseMode, colorScheme);
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

    // Receive messages from the preview iframe.
    // pageCount: emitted by Paged.js after layout completes — update page counter and
    //            restore scroll position (paged mode reflows asynchronously, so we can't
    //            do this in onFrameLoad).
    fromEvent<MessageEvent>(window, 'message')
      .pipe(takeUntilDestroyed())
      .subscribe(e => {
        if (e.data?.pageCount !== undefined) {
          this.store.setSlideCount(e.data.pageCount);
          if (this.store.proseViewMode() === 'paged') {
            this.iframeRef()?.nativeElement.contentWindow?.scrollTo({ top: this.proseScrollY, behavior: 'instant' });
          }
        }
      });
  }

  /** Re-sends the active slide index after the iframe finishes loading new srcdoc content. */
  protected onFrameLoad(): void {
    const iframe = this.iframeRef()?.nativeElement;
    if (!iframe) return;
    iframe.contentWindow?.postMessage({ slideIndex: this.store.currentSlideIndex() }, '*');

    // For flow mode, the document is fully laid out at load time — restore scroll immediately,
    // then reveal the iframe (was hidden to suppress the scroll-jump flicker).
    // Paged mode is handled after the pageCount postMessage (Paged.js runs asynchronously).
    if (this.store.documentType() === 'prose' && this.store.proseViewMode() === 'flow') {
      iframe.contentWindow?.scrollTo({ top: this.proseScrollY, behavior: 'instant' });
      this.proseReloading.set(false);
    }
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

  protected toggleProseMode(): void {
    this.proseScrollY = 0; // layout changes completely on mode switch — start from top
    const current = this.store.proseViewMode();
    this.store.setProseViewMode(current === 'flow' ? 'paged' : 'flow');
  }
}
