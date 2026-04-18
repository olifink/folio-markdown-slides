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
  /** True while a srcdoc swap is in-flight; hides the iframe to avoid scroll-jump flicker. */
  protected readonly isPreviewLoading = signal(false);
  private reloadingTimeout?: any;
  private lastSrcdoc = '';
  private lastTrigger = 0;

  /** 
   * Tracks document visibility and focus to force a re-render when the app 
   * is resumed from the background. Mobile browsers often discard iframe 
   * content or defer loading when hidden.
   */
  private readonly isVisible = signal(document.visibilityState === 'visible');
  private readonly refreshTrigger = signal(0);
  private readonly isFrameReady = signal(false);

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
    merge(
      fromEvent(document, 'visibilitychange'),
      fromEvent(window, 'focus'),
      fromEvent(window, 'pageshow'),
    )
      .pipe(
        takeUntilDestroyed(),
        switchMap(() => timer(300).pipe(map(() => document.visibilityState === 'visible'))),
        distinctUntilChanged()
      )
      .subscribe(visible => {
        const wasHidden = !this.isVisible();
        this.isVisible.set(visible);
        
        if (visible && wasHidden) {
          this.refreshTrigger.update(n => n + 1);
        }
      });

    // Update iframe srcdoc whenever content changes or the app is resumed.
    effect(() => {
      const result = this.rendered();
      const proseMode = this.store.proseViewMode();
      const colorScheme = this.store.colorScheme();
      const appTheme = this.store.appTheme();
      const isActive = this.active();
      const visible = this.isVisible();
      const trigger = this.refreshTrigger();
      const iframe = this.iframeRef();

      if (!iframe || !isActive || !visible) return;

      const reloadMeta = `<!-- r:${trigger} -->`;
      let nextSrcdoc = '';
      
      if (result.type === 'slides') {
        nextSrcdoc = this.marpService.buildSrcdoc(result.html, result.css, false, appTheme) + reloadMeta;
      } else {
        nextSrcdoc = this.proseService.buildSrcdoc(result.html, false, proseMode, colorScheme, appTheme, this.store.prefs().fontFamily) + reloadMeta;
      }

      if (nextSrcdoc === this.lastSrcdoc) {
        return;
      }
      this.lastSrcdoc = nextSrcdoc;

      // Check if this render was triggered by a background resumption
      const isResumption = trigger > this.lastTrigger;
      this.lastTrigger = trigger;

      // Hide the iframe during reload to prevent flicker/jump
      this.isPreviewLoading.set(true);
      this.isFrameReady.set(false);

      if (result.type === 'slides') {
        this.store.setSlideCount(result.slideCount);
      } else {
        const win = iframe.nativeElement.contentWindow;
        const scrollEl = iframe.nativeElement.contentDocument?.documentElement;
        const bodyEl = iframe.nativeElement.contentDocument?.body;
        this.proseScrollY = win?.pageYOffset ?? win?.scrollY ?? scrollEl?.scrollTop ?? bodyEl?.scrollTop ?? 0;
      }

      // Aggressive Failsafe: If the iframe doesn't report back within 500ms
      clearTimeout(this.reloadingTimeout);
      this.reloadingTimeout = setTimeout(() => {
        if (untracked(() => this.isPreviewLoading())) {
          // If we are resuming from background and it's stuck, do a full page reload.
          if (isResumption) {
            window.location.reload();
          } else {
            // Otherwise (normal editing), just reveal the iframe and hope for the best.
            this.isPreviewLoading.set(false);
          }
        }
      }, 500);

      iframe.nativeElement.srcdoc = nextSrcdoc;
    });

    // Scroll to current slide (only relevant for slides mode)
    effect(() => {
      if (this.store.documentType() !== 'slides' || !this.active() || !this.isFrameReady()) return;
      const idx = this.store.currentSlideIndex();
      this.iframeRef()?.nativeElement.contentWindow?.postMessage({ folioIdentifier: 'folio-preview', slideIndex: idx }, '*');
    });

    // Receive messages from the preview iframe.
    fromEvent<MessageEvent>(window, 'message')
      .pipe(takeUntilDestroyed())
      .subscribe(e => {
        const iframe = this.iframeRef()?.nativeElement;
        const isFromOurIframe = e.source === iframe?.contentWindow || e.data?.folioIdentifier === 'folio-preview';
        if (!isFromOurIframe) return;

        if (e.data?.type === 'ready') {
          this.isFrameReady.set(true);
          this.isPreviewLoading.set(false);
          clearTimeout(this.reloadingTimeout);
        }

        if (e.data?.type === 'tabSwitch') {
          if (e.data.direction === 'prev') {
            this.backToEditor.emit();
          }
        }

        if (e.data?.pageCount !== undefined || e.data?.type === 'flowLoaded' || e.data?.slideIndex !== undefined) {
          if (e.data?.pageCount !== undefined) {
            this.store.setSlideCount(e.data.pageCount);
          }
          
          if (this.store.documentType() === 'prose' && this.store.proseViewMode() === 'paged') {
            const targetY = this.proseScrollY;
            const win = iframe?.contentWindow;
            const restore = () => {
              win?.scrollTo({ top: targetY, behavior: 'instant' });
              this.isPreviewLoading.set(false);
              clearTimeout(this.reloadingTimeout);
            };
            restore();
            requestAnimationFrame(restore);
          } else {
            this.isPreviewLoading.set(false);
            clearTimeout(this.reloadingTimeout);
          }
        }
      });
  }

  /** Re-sends the active slide index after the iframe finishes loading new srcdoc content. */
  protected onFrameLoad(): void {
    const iframe = this.iframeRef()?.nativeElement;
    if (!iframe) return;
    iframe.contentWindow?.postMessage({ folioIdentifier: 'folio-preview', slideIndex: this.store.currentSlideIndex() }, '*');

    if (this.store.documentType() === 'slides' || (this.store.documentType() === 'prose' && this.store.proseViewMode() === 'flow')) {
      if (this.store.documentType() === 'prose') {
        iframe.contentWindow?.scrollTo({ top: this.proseScrollY, behavior: 'instant' });
      }
      this.isPreviewLoading.set(false);
      clearTimeout(this.reloadingTimeout);
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
