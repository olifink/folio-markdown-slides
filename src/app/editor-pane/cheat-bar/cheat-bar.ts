import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';

interface CheatItem {
  label: string;
  /** Short representation shown below the label in monospace. */
  hint: string;
  snippet: string;
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
      { label: 'Bold',        hint: '**text**',    snippet: '**text**' },
      { label: 'Italic',      hint: '*text*',      snippet: '*text*' },
      { label: 'Inline code', hint: '`code`',      snippet: '`code`' },
      { label: 'Code block',  hint: '```…```',     snippet: '```\n\n```' },
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
    label: 'Text',
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
  readonly insert = output<string>();
  protected readonly categories = CATEGORIES;
}
