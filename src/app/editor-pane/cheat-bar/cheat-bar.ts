import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AppStore } from '../../store/app-store';

export interface CheatItem {
  label: string;
  /** Short representation shown below the label in monospace. */
  hint: string;
  snippet?: string;
  prefix?: string;
  suffix?: string;
}

interface CheatCategory {
  label: string;
  items: readonly CheatItem[];
}

const CATEGORIES: readonly CheatCategory[] = [
  {
    label: 'Insert',
    items: [
      { label: 'Heading 1',   hint: '# ',         snippet: '# ' },
      { label: 'Heading 2',   hint: '## ',         snippet: '## ' },
      { label: 'Heading 3',   hint: '### ',        snippet: '### ' },
      { label: 'Code block',  hint: '```…```',     snippet: '```\n\n```' },
      { label: 'Table',       hint: '3x2',         snippet: '| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n' },
      { label: 'Footnote',    hint: '[^1]',        snippet: '[^1]\n\n[^1]: ' },
    ],
  },
  {
    label: 'Text',
    items: [
      { label: 'Bold',        hint: '**text**',    prefix: '**', suffix: '**' },
      { label: 'Italic',      hint: '*text*',      prefix: '*',  suffix: '*' },
      { label: 'Highlight',   hint: '==text==',    prefix: '==', suffix: '==' },
      { label: 'Inline code', hint: '`code`',      prefix: '`',  suffix: '`' },
      { label: 'Link',        hint: '[text](url)', prefix: '[',  suffix: '](url)' },
      { label: 'Bullet list', hint: '* item',      snippet: '* ' },
      { label: 'Task list',   hint: '- [ ] item',  snippet: '- [ ] ' },
    ],
  },
  {
    label: 'Slide',
    items: [
      { label: 'New slide',     hint: '---',                      snippet: '\n---\n' },
      { label: 'Paginate on',   hint: 'paginate: true',           snippet: 'paginate: true' },
      { label: 'Section title', hint: '<!-- _class: lead -->',    snippet: '<!-- _class: lead -->' },
    ],
  },
  {
    label: 'Theme',
    items: [
      { label: 'Default',           hint: 'theme: default',         snippet: 'theme: default' },
      { label: 'Gaia',              hint: 'theme: gaia',            snippet: 'theme: gaia' },
      { label: 'Uncover',           hint: 'theme: uncover',         snippet: 'theme: uncover' },
      { label: 'Background colour', hint: 'backgroundColor: #fff',  snippet: 'backgroundColor: #ffffff' },
      { label: 'Text colour',       hint: 'color: #000',            snippet: 'color: #000000' },
    ],
  },
  {
    label: 'Image',
    items: [
      { label: 'Background full',    hint: '![bg](url)',           snippet: '![bg](url)' },
      { label: 'Background left',    hint: '![bg left](url)',      snippet: '![bg left](url)' },
      { label: 'Background right',   hint: '![bg right](url)',     snippet: '![bg right](url)' },
      { label: 'Bg 50% left',        hint: '![bg left:50%](url)', snippet: '![bg left:50%](url)' },
    ],
  },
  {
    label: 'Layout',
    items: [
      { label: 'Lead class',   hint: '<!-- _class: lead -->',        snippet: '<!-- _class: lead -->' },
      { label: 'Invert',       hint: '<!-- _class: invert -->',      snippet: '<!-- _class: invert -->' },
      { label: 'Two columns',  hint: '<div class="columns">',        snippet: '<div class="columns">\n\n</div>' },
    ],
  },
  {
    label: 'Note',
    items: [
      { label: 'Speaker note',  hint: '<!-- … -->',     snippet: '<!--\n\n-->' },
      { label: 'HTML comment',  hint: '<!-- comment -->', snippet: '<!-- comment -->' },
    ],
  },
];

@Component({
  selector: 'app-cheat-bar',
  imports: [MatButtonModule, MatMenuModule],
  templateUrl: './cheat-bar.html',
  styleUrl: './cheat-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheatBarComponent {
  protected readonly store = inject(AppStore);
  readonly insert = output<CheatItem>();
  protected readonly categories = CATEGORIES;
}
