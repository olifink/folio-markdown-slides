import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EditorService } from '../services/editor.service';
import { CheatItem } from '../editor-pane/cheat-bar/cheat-bar';

interface HelpSection {
  title: string;
  items: CheatItem[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'Basics',
    items: [
      { label: 'Heading 1', snippet: '# ', hint: 'Main title' },
      { label: 'Heading 2', snippet: '## ', hint: 'Section title' },
      { label: 'Bold', prefix: '**', suffix: '**', hint: 'Strong emphasis' },
      { label: 'Italic', prefix: '*', suffix: '*', hint: 'Light emphasis' },
      { label: 'Highlight', prefix: '==', suffix: '==', hint: 'Mark text yellow' },
      { label: 'Inline code', prefix: '`', suffix: '`', hint: 'Monospace text' },
      { label: 'Link', prefix: '[', suffix: '](url)', hint: 'Hyperlink' },
    ]
  },
  {
    title: 'Structure',
    items: [
      { label: 'Bullet list', snippet: '* ', hint: 'Unordered list' },
      { label: 'Task list', snippet: '- [ ] ', hint: 'Checklist' },
      { label: 'Table', snippet: '| Col | Col |\n| --- | --- |\n| Cell | Cell |\n', hint: 'Data table' },
      { label: 'Footnote', snippet: '[^1]\n\n[^1]: ', hint: 'Add reference' },
      { label: 'Math Inline', snippet: '$E=mc^2$', hint: 'KaTeX formula' },
      { label: 'Math Block', snippet: '$$\nI = \\int f(x) dx\n$$', hint: 'Centered formula' },
    ]
  },
  {
    title: 'Slides & Layout',
    items: [
      { label: 'New Slide', snippet: '\n---\n', hint: 'Horizontal separator' },
      { label: 'Two columns', snippet: '<div class="columns">\n\nLeft\n\nRight\n\n</div>', hint: 'Multicolumn layout' },
      { label: 'Background full', snippet: '![bg](url)', hint: 'Full slide image' },
      { label: 'Background left', snippet: '![bg left](url)', hint: 'Split image' },
      { label: 'Chapter', snippet: '<!-- _class: chapter -->', hint: 'Transition slide style' },
      { label: 'Black Slide', snippet: '<!-- _class: black-slide -->', hint: 'Invert to solid black' },
    ]
  },
  {
    title: 'Advanced',
    items: [
      { label: 'Diagram', snippet: '```mermaid\ngraph TD\nA[Start] --> B[End]\n```', hint: 'Mermaid.js diagram' },
      { label: 'Emoji', snippet: ':rocket:', hint: 'Shortcodes support' },
      { label: 'Comments', snippet: '<!-- speaker notes -->', hint: 'Presenter-only notes' },
      { label: 'Paginate', snippet: 'paginate: true', hint: 'Enable slide numbers' },
      { label: 'Front Matter', snippet: '---\nmarp: true\ntheme: default\n---', hint: 'Presentation config' },
    ]
  }
];

@Component({
  selector: 'app-help-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './help-dialog.html',
  styleUrl: './help-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpDialogComponent {
  protected readonly sections = HELP_SECTIONS;
  private readonly editorService = inject(EditorService);
  private readonly dialogRef = inject(MatDialogRef<HelpDialogComponent>);

  protected insert(item: CheatItem): void {
    this.editorService.insert(item);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
