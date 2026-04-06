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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { AppStore } from '../store/app-store';
import { EditorService } from '../services/editor.service';
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
  private readonly editorService = inject(EditorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly editorHost = viewChild.required<ElementRef<HTMLDivElement>>('editorHost');

  private editorView: EditorView | null = null;

  private readonly extensions = createMarpExtensions(
    md => this.store.setMarkdown(md),
    idx => this.store.goToSlide(idx)
  );

  constructor() {
    afterNextRender(() => {
      this.editorView = new EditorView({
        state: EditorState.create({
          doc: this.store.currentMarkdown(),
          extensions: this.extensions,
        }),
        parent: this.editorHost().nativeElement,
      });
    });

    this.editorService.insert$.pipe(takeUntilDestroyed()).subscribe(text => {
      this.doInsert(text);
    });

    effect(() => {
      const md = this.store.currentMarkdown();
      const view = this.editorView;
      if (!view || view.state.doc.toString() === md) return;
      view.setState(EditorState.create({ doc: md, extensions: this.extensions }));
    });

    this.destroyRef.onDestroy(() => this.editorView?.destroy());
  }

  protected onCheatInsert(snippet: string): void {
    this.doInsert(snippet);
  }

  private doInsert(snippet: string): void {
    const view = this.editorView;
    if (!view) return;

    // Detect 'key: value' pattern (directives like theme, paginate, etc.)
    // We only target alphabetic keys that don't start with underscore (slide-local)
    const kvMatch = snippet.match(/^([a-zA-Z]+):\s*(.*)$/);
    
    if (kvMatch) {
      this.insertIntoFrontMatter(kvMatch[1], kvMatch[2]);
    } else {
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: snippet },
        selection: { anchor: from + snippet.length },
      });
      view.focus();
    }
  }

  private insertIntoFrontMatter(key: string, value: string): void {
    const view = this.editorView;
    if (!view) return;

    const content = view.state.doc.toString();
    const fmRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(fmRegex);

    if (match) {
      // Front matter exists
      const fmContent = match[1];
      const keyRegex = new RegExp(`^${key}:\\s*.*$`, 'm');
      
      if (keyRegex.test(fmContent)) {
        // Key exists, replace it
        const newFmContent = fmContent.replace(keyRegex, `${key}: ${value}`);
        const newFullContent = content.replace(fmRegex, `---\n${newFmContent}\n---`);
        view.dispatch({
          changes: { from: 0, to: content.length, insert: newFullContent }
        });
      } else {
        // Key doesn't exist, append before the closing ---
        const closingPos = match[0].length;
        const insertPos = closingPos - 4; // index before \n---
        view.dispatch({
          changes: { from: insertPos, to: insertPos, insert: `\n${key}: ${value}` }
        });
      }
    } else {
      // Front matter doesn't exist, create it at the top
      const newFm = `---\nmarp: true\n${key}: ${value}\n---\n\n`;
      view.dispatch({
        changes: { from: 0, to: 0, insert: newFm }
      });
    }
    view.focus();
  }
}
