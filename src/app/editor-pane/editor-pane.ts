import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { AppStore } from '../store/app-store';

@Component({
  selector: 'app-editor-pane',
  template: `
    <textarea
      #editor
      class="editor-textarea"
      (input)="store.setMarkdown(editor.value)"
      aria-label="Markdown editor"
      spellcheck="false"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
    ></textarea>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .editor-textarea {
      flex: 1;
      width: 100%;
      height: 100%;
      padding: 1.25rem;
      border: none;
      outline: none;
      resize: none;
      font-family: var(--font-editor);
      font-size: 1rem;
      line-height: 1.6;
      background: var(--surface);
      color: var(--on-surface);
      tab-size: 2;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPaneComponent {
  protected readonly store = inject(AppStore);
  private readonly editorRef = viewChild.required<ElementRef<HTMLTextAreaElement>>('editor');

  constructor() {
    // Sync textarea value from store when the change originates externally
    // (e.g. loading a file in M4). Skip update when the textarea is focused
    // to avoid resetting cursor position while the user is typing.
    effect(() => {
      const md = this.store.currentMarkdown();
      const el = this.editorRef().nativeElement;
      if (document.activeElement !== el) {
        el.value = md;
      }
    });
  }
}
