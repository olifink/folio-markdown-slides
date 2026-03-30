import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, filter, map, switchMap } from 'rxjs/operators';
import { fromEvent, of, timer } from 'rxjs';
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
  protected readonly store = inject(AppStore);
  private readonly marpService = inject(MarpService);
  private readonly iframeRef = viewChild<ElementRef<HTMLIFrameElement>>('previewFrame');

  /**
   * First emission is immediate (no debounce) so the preview populates on load.
   * Subsequent emissions debounce 300ms to avoid re-rendering on every keystroke.
   */
  private readonly rendered = toSignal(
    toObservable(this.store.currentMarkdown).pipe(
      switchMap((md, index) =>
        index === 0 ? of(md) : timer(300).pipe(map(() => md)),
      ),
      map(md => this.marpService.render(md)),
    ),
    { initialValue: this.marpService.render(this.store.currentMarkdown()) },
  );

  constructor() {
    // Sync slide index when the iframe navigates via keyboard (e.g. in fullscreen)
    fromEvent<MessageEvent>(window, 'message')
      .pipe(
        filter(e => e.source === this.iframeRef()?.nativeElement.contentWindow),
        filter(e => typeof e.data?.slideIndex === 'number'),
        takeUntilDestroyed(),
      )
      .subscribe(e => this.store.goToSlide(e.data.slideIndex));

    // Update iframe srcdoc and store slide count whenever rendered output changes
    effect(() => {
      const result = this.rendered();
      const iframe = this.iframeRef();
      if (!iframe) return;
      this.store.setSlideCount(result.slideCount);
      iframe.nativeElement.srcdoc = this.marpService.buildSrcdoc(result.html, result.css);
    });

    // Scroll to current slide (also fires via onFrameLoad after srcdoc reloads)
    effect(() => {
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
