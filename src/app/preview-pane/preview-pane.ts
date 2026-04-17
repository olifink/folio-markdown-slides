import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { filter, map, switchMap, distinctUntilChanged, take } from 'rxjs/operators';
import { fromEvent, of, timer, merge, combineLatest } from 'rxjs';
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
  readonly backToEditor = output<void>();

  protected readonly store = inject(AppStore);
  private readonly marpService = inject(MarpService);
  private readonly proseService = inject(ProseService);
  private readonly iframeRef = viewChild<ElementRef<HTMLIFrameElement>>('previewFrame');

  /** Saved scroll offset (px) of the prose preview before its srcdoc is replaced. */
  private proseScrollY = 0;
  /** True while a prose-flow srcdoc swap is in-flight; hides the iframe to avoid scroll-jump flicker. */
  protected readonly proseReloading = signal(false);
  private reloadingTimeout?: any;

  /** 
   * Tracks document visibility and focus to force a re-render when the app 
   * is resumed from the background. Mobile browsers often discard iframe 
   * content or defer loading when hidden.
   */
  private readonly isVisible = signal(document.visibilityState === 'visible');
  private readonly refreshTrigger = signal(0);

  /**
   * First emission is immediate (no debounce) so the preview populates on load.
   * Subsequent emissions debounce to avoid re-rendering on every keystroke.
   * Prose uses a longer debounce as Paged.js fragmentation is expensive.
   */
  private readonly rendered = toSignal(
    combineLatest([
      toObservable(this.store.currentMarkdown),
      toObservable(this.store.documentType)
    ]).pipe(
      switchMap(([md, type], index) => {
        const debounceTime = index === 0 ? 0 : (type === 'prose' ? 600 : 300);
        return timer(debounceTime).pipe(map(() => ({ md, type })));
      }),
      map(({ md, type }) => {
        if (type === 'slides') {
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
    // Force re-render on visibility/focus change (background -> foreground).
    // We use a combination of events and a delay to be robust against 
    // mobile OS "thawing" logic and PWA suspension.
    merge(
      fromEvent(document, 'visibilitychange'),
      fromEvent(window, 'focus'),
      fromEvent(window, 'pageshow'),
    )
      .pipe(
        takeUntilDestroyed(),
        // Stabilization delay: wait for the webview to be fully active 
        // before we check visibility and potentially trigger a reload.
        switchMap(() => timer(300).pipe(map(() => document.visibilityState === 'visible'))),
        distinctUntilChanged()
      )
      .subscribe(visible => {
        const wasHidden = !this.isVisible();
        this.isVisible.set(visible);
        
        // If we transitioned from hidden to visible, increment the trigger
        // to force a srcdoc reload in the effect below.
        if (visible && wasHidden) {
          this.refreshTrigger.update(n => n + 1);
        }
      });

    // Update iframe srcdoc and store slide/page count whenever rendered output changes.
    // Also re-runs when `active()` becomes true or when the app is resumed so that
    // mobile browsers (which often discard iframe content) always get a fresh srcdoc.
    effect(() => {
      const result = this.rendered();
      const proseMode = this.store.proseViewMode();
      const colorScheme = this.store.colorScheme();
      const appTheme = this.store.appTheme();
      const isActive = this.active();
      const visible = this.isVisible();
      const trigger = this.refreshTrigger();
      const iframe = this.iframeRef();

      // Don't write to a hidden iframe — mobile browsers may defer the load event
      // or discard the content entirely. The next activation will re-trigger this effect.
      if (!iframe || !isActive || !visible) return;

      // Append a tiny cache-buster comment to the srcdoc to force a reload even 
      // if the HTML content is identical to the previous value.
      const reloadMeta = `<!-- r:${trigger} -->`;

      if (result.type === 'slides') {
        this.store.setSlideCount(result.slideCount);
        this.proseReloading.set(false);
        iframe.nativeElement.srcdoc = this.marpService.buildSrcdoc(result.html, result.css, false, appTheme) + reloadMeta;
      } else {
        // Save scroll position before the srcdoc replacement resets it to 0.
        const win = iframe.nativeElement.contentWindow;
        const scrollEl = iframe.nativeElement.contentDocument?.documentElement;
        const bodyEl = iframe.nativeElement.contentDocument?.body;
        this.proseScrollY = win?.pageYOffset ?? win?.scrollY ?? scrollEl?.scrollTop ?? bodyEl?.scrollTop ?? 0;

        // Hide the iframe so the scroll-jump/reflow isn't visible.
        this.proseReloading.set(true);
        
        // Failsafe: if the iframe takes too long to report back (postMessage lost),
        // reveal it anyway so the user doesn't see a blank screen.
        clearTimeout(this.reloadingTimeout);
        this.reloadingTimeout = setTimeout(() => {
          if (untracked(() => this.proseReloading())) {
            this.proseReloading.set(false);
          }
        }, 3000);

        // Page count is set via postMessage after Paged.js finishes
        iframe.nativeElement.srcdoc = this.proseService.buildSrcdoc(result.html, false, proseMode, colorScheme, appTheme, this.store.prefs().fontFamily) + reloadMeta;
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
    fromEvent<MessageEvent>(window, 'message')
      .pipe(takeUntilDestroyed())
      .subscribe(e => {
        const iframe = this.iframeRef()?.nativeElement;
        if (e.source !== iframe?.contentWindow) return;

        if (e.data?.type === 'tabSwitch') {
          if (e.data.direction === 'prev') {
            this.backToEditor.emit();
          }
        }

        if (e.data?.pageCount !== undefined) {
          this.store.setSlideCount(e.data.pageCount);
          if (this.store.proseViewMode() === 'paged') {
            const targetY = this.proseScrollY;
            const win = iframe?.contentWindow;

            const restore = () => {
              win?.scrollTo({ top: targetY, behavior: 'instant' });
              this.proseReloading.set(false);
            };

            // Double-hit restoration to ensure it sticks after layout/paint
            restore();
            requestAnimationFrame(restore);
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
