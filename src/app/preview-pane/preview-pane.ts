import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, map } from 'rxjs/operators';
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
  private readonly iframeRef = viewChild.required<ElementRef<HTMLIFrameElement>>('previewFrame');

  private readonly rendered = toSignal(
    toObservable(this.store.currentMarkdown).pipe(
      debounceTime(300),
      map(md => this.marpService.render(md)),
    ),
  );

  constructor() {
    // Re-render iframe when Marp output changes
    effect(() => {
      const result = this.rendered();
      if (!result) return;
      this.store.setSlideCount(result.slideCount);
      this.iframeRef().nativeElement.srcdoc = this.marpService.buildSrcdoc(
        result.html,
        result.css,
      );
    });

    // Navigate to the current slide (also fires after each srcdoc reload via onFrameLoad)
    effect(() => {
      const idx = this.store.currentSlideIndex();
      this.iframeRef().nativeElement.contentWindow?.postMessage({ slideIndex: idx }, '*');
    });
  }

  /** Re-send slide position after the iframe finishes loading new srcdoc content. */
  protected onFrameLoad(): void {
    const idx = this.store.currentSlideIndex();
    this.iframeRef().nativeElement.contentWindow?.postMessage({ slideIndex: idx }, '*');
  }

  protected prevSlide(): void {
    this.store.goToSlide(this.store.currentSlideIndex() - 1);
  }

  protected nextSlide(): void {
    this.store.goToSlide(this.store.currentSlideIndex() + 1);
  }

  protected present(): void {
    this.iframeRef().nativeElement.requestFullscreen();
  }
}
