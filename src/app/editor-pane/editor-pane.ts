import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { AppStore } from '../store/app-store';
import { createMarpExtensions } from './marp-editor';
import { CheatBarComponent } from './cheat-bar/cheat-bar';

@Component({
  selector: 'app-editor-pane',
  imports: [CheatBarComponent],
  template: `
    <div #editorHost class="editor-host"></div>
    <app-cheat-bar (insert)="onCheatInsert($event)" />
  `,
  styleUrl: './editor-pane.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'editor-pane' },
})
export class EditorPaneComponent {
  private readonly store = inject(AppStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly editorHost = viewChild.required<ElementRef<HTMLDivElement>>('editorHost');

  private editorView: EditorView | null = null;

  constructor() {
    afterNextRender(() => {
      this.editorView = new EditorView({
        state: EditorState.create({
          doc: this.store.currentMarkdown(),
          extensions: createMarpExtensions(md => this.store.setMarkdown(md)),
        }),
        parent: this.editorHost().nativeElement,
      });
    });

    // Sync editor content when the store changes externally (e.g. file load in M4)
    effect(() => {
      const md = this.store.currentMarkdown();
      const view = this.editorView;
      if (!view || view.state.doc.toString() === md) return;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: md },
      });
    });

    this.destroyRef.onDestroy(() => this.editorView?.destroy());
  }

  protected onCheatInsert(snippet: string): void {
    const view = this.editorView;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + snippet.length },
    });
    view.focus();
  }
}
