import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { AppStore } from '../store/app-store';
import { EditorService } from '../services/editor.service';
import { createFolioExtensions } from './folio-editor';
import { CheatBarComponent, CheatItem } from './cheat-bar/cheat-bar';

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
  readonly active = input(true);

  private readonly store = inject(AppStore);
  private readonly editorService = inject(EditorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly editorHost = viewChild.required<ElementRef<HTMLDivElement>>('editorHost');

  private editorView: EditorView | null = null;

  private readonly extensions = createFolioExtensions(
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

    this.editorService.insert$.pipe(takeUntilDestroyed()).subscribe(val => {
      if (typeof val === 'string') {
        this.doInsert(val);
      } else {
        this.onCheatInsert(val);
      }
    });

    effect(() => {
      const md = this.store.currentMarkdown();
      const view = this.editorView;
      if (!view || view.state.doc.toString() === md) return;
      view.setState(EditorState.create({ doc: md, extensions: this.extensions }));
    });

    // When the Edit tab becomes visible after being hidden, CodeMirror needs to
    // re-measure its layout (size was 0 while hidden) so cursor tracking works.
    effect(() => {
      if (this.active()) {
        this.editorView?.requestMeasure();
      }
    });

    this.destroyRef.onDestroy(() => this.editorView?.destroy());
  }

  protected onCheatInsert(item: CheatItem): void {
    if (item.prefix !== undefined && item.suffix !== undefined) {
      this.doWrap(item.prefix, item.suffix);
    } else if (item.snippet !== undefined) {
      this.doInsert(item.snippet);
    }
  }

  private doWrap(prefix: string, suffix: string): void {
    const view = this.editorView;
    if (!view) return;

    const { from, to } = view.state.selection.main;
    const selectedText = view.state.doc.sliceString(from, to);
    const insertion = prefix + selectedText + suffix;

    view.dispatch({
      changes: { from, to, insert: insertion },
      selection: from === to
        ? { anchor: from + prefix.length }
        : { 
            anchor: from + prefix.length, 
            head: from + prefix.length + selectedText.length 
          },
      scrollIntoView: true,
      userEvent: 'input.type',
    });
    
    // Defer focus slightly to ensure the menu closing transition 
    // doesn't steal focus back from the editor on mobile.
    setTimeout(() => view.focus(), 0);
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
        scrollIntoView: true,
        userEvent: 'input.type',
      });
      setTimeout(() => view.focus(), 0);
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
          changes: { from: 0, to: content.length, insert: newFullContent },
          scrollIntoView: true
        });
      } else {
        // Key doesn't exist, append before the closing ---
        const closingPos = match[0].length;
        const insertPos = closingPos - 4; // index before \n---
        view.dispatch({
          changes: { from: insertPos, to: insertPos, insert: `\n${key}: ${value}` },
          scrollIntoView: true
        });
      }
    } else {
      // Front matter doesn't exist, create it at the top
      // If we're inserting a slide-specific key (like theme), add marp: true
      const isMarpKey = ['theme', 'paginate', 'header', 'footer'].includes(key);
      const newFm = `---\n${isMarpKey ? 'marp: true\n' : ''}${key}: ${value}\n---\n\n`;
      view.dispatch({
        changes: { from: 0, to: 0, insert: newFm },
        scrollIntoView: true
      });
    }
    setTimeout(() => view.focus(), 0);
  }
}
