import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  keymap,
} from '@codemirror/view';
import { Extension, RangeSetBuilder } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { tags } from '@lezer/highlight';
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { EMOJI_SHORTCODES } from './emoji-shortcodes';

// ── Completion Data ─────────────────────────────────────────────────────────

const MARPX_THEMES = [
  'cantor', 'church', 'copernicus', 'einstein',
  'frankfurt', 'galileo', 'gauss', 'gropius',
  'gödel', 'haskell', 'hobbes', 'lorca',
  'marpx', 'newton', 'socrates', 'sparta'
];
const BUILTIN_THEMES = ['default', 'gaia', 'uncover'];
const ALL_THEMES = [...BUILTIN_THEMES, ...MARPX_THEMES].sort();

const GLOBAL_DIRECTIVES = [
  { label: 'theme', detail: 'Set presentation theme' },
  { label: 'paginate', detail: 'true/false - toggle slide numbers' },
  { label: 'header', detail: 'Header text for all slides' },
  { label: 'footer', detail: 'Footer text for all slides' },
  { label: 'backgroundColor', detail: 'Default background color' },
  { label: 'color', detail: 'Default text color' },
  { label: 'headingDivider', detail: 'Regex to auto-split slides' },
  { label: 'marp', detail: 'Must be true' },
];

const LOCAL_DIRECTIVES = [
  { label: '_class', detail: 'Class for THIS slide' },
  { label: '_backgroundColor', detail: 'Color for THIS slide' },
  { label: '_color', detail: 'Text color for THIS slide' },
  { label: '_header', detail: 'Header for THIS slide' },
  { label: '_footer', detail: 'Footer for THIS slide' },
];

const MARPX_TAGS = [
  { label: 'box', detail: 'Styled content box' },
  { label: 'callout', detail: 'Attention block' },
  { label: 'multicolumn', detail: 'Flex columns' },
  { label: 'notes', detail: 'On-slide notes' },
];

const CODE_FENCE_LANGUAGES = [
  { label: 'mermaid', detail: 'Diagram (flowchart, sequence, …)' },
  { label: 'javascript', detail: 'JavaScript' },
  { label: 'typescript', detail: 'TypeScript' },
  { label: 'python', detail: 'Python' },
  { label: 'html', detail: 'HTML' },
  { label: 'css', detail: 'CSS' },
  { label: 'scss', detail: 'SCSS' },
  { label: 'json', detail: 'JSON' },
  { label: 'yaml', detail: 'YAML' },
  { label: 'bash', detail: 'Bash / Shell' },
  { label: 'sql', detail: 'SQL' },
  { label: 'java', detail: 'Java' },
  { label: 'c', detail: 'C' },
  { label: 'cpp', detail: 'C++' },
  { label: 'csharp', detail: 'C#' },
  { label: 'rust', detail: 'Rust' },
  { label: 'go', detail: 'Go' },
  { label: 'ruby', detail: 'Ruby' },
  { label: 'php', detail: 'PHP' },
  { label: 'swift', detail: 'Swift' },
  { label: 'kotlin', detail: 'Kotlin' },
  { label: 'r', detail: 'R' },
  { label: 'markdown', detail: 'Markdown' },
  { label: 'xml', detail: 'XML' },
  { label: 'diff', detail: 'Diff / Patch' },
];

const SNIPPETS = [
  { label: '# Header 1', apply: '# ', detail: 'Main title' },
  { label: '## Header 2', apply: '## ', detail: 'Section title' },
  { label: '### Header 3', apply: '### ', detail: 'Subsection title' },
  { label: '--- New Slide', apply: '\n---\n', detail: 'Slide separator' },
  { label: '![bg] Background', apply: '![bg](url)', detail: 'Full slide image' },
  { label: '**Bold**', apply: '**text**', detail: 'Strong emphasis' },
  { label: '*Italic*', apply: '*text*', detail: 'Emphasis' },
  { label: '`Inline code`', apply: '`code`', detail: 'Monospace highlight' },
  { label: '* Bullet list', apply: '* ', detail: 'Unordered list' },
  { label: '- [ ] Task list', apply: '- [ ] ', detail: 'Checklist' },
  { label: '$ Math Inline', apply: '$formula$', detail: 'KaTeX formula' },
  { label: '$$ Math Block', apply: '$$\nformula\n$$', detail: 'Block formula' },
  { label: '== Highlight ==', apply: '==text==', detail: 'Mark text' },
  { label: '[^1] Footnote', apply: '[^1]', detail: 'Add reference' },
  { label: '``` Code block', apply: '```', detail: 'Fenced code block' },
];

// ── Autocomplete Logic ──────────────────────────────────────────────────────

function marpCompletionSource(context: CompletionContext): CompletionResult | null {
  const fullText = context.state.doc.toString();
  const line = context.state.doc.lineAt(context.pos);
  const lineTextBefore = line.text.slice(0, context.pos - line.from);
  const word = context.matchBefore(/\w*/);

  // Check if we are in front-matter
  const fmStartMatch = fullText.match(/^---\n/);
  let isInFrontMatter = false;
  if (fmStartMatch) {
    const remainingText = fullText.slice(4);
    const fmEndIndex = remainingText.indexOf('\n---');
    if (fmEndIndex !== -1 && context.pos <= fmEndIndex + 8) {
      isInFrontMatter = true;
    }
  }

  // 1. Theme completion (triggered by 'theme: ')
  const themeMatch = lineTextBefore.match(/theme:\s*(\w*)$/);
  if (themeMatch) {
    return {
      from: line.from + lineTextBefore.lastIndexOf(themeMatch[1]),
      options: ALL_THEMES.map(t => ({
        label: t,
        type: 'keyword',
        detail: MARPX_THEMES.includes(t) ? 'X' : ''
      })),
      filter: true
    };
  }

  // 2. MarpX Tags (triggered by '<')
  const tagMatch = lineTextBefore.match(/<(\w*)$/);
  if (tagMatch) {
    return {
      from: line.from + lineTextBefore.lastIndexOf(tagMatch[1]),
      options: MARPX_TAGS.map(t => ({
        label: t.label,
        type: 'type',
        detail: 'MarpX Tag',
        apply: t.label + '></' + t.label + '>'
      })),
      filter: true
    };
  }

  // 3. Directives inside HTML comments (triggered by '<!-- ' or '<!-- _')
  const commentMatch = lineTextBefore.match(/<!--\s*(_?\w*)$/);
  if (commentMatch) {
    const isLocal = commentMatch[1].startsWith('_');
    const options = (isLocal ? LOCAL_DIRECTIVES : [...GLOBAL_DIRECTIVES, ...LOCAL_DIRECTIVES]);
    return {
      from: line.from + lineTextBefore.lastIndexOf(commentMatch[1]),
      options: options.map(d => ({
        label: d.label,
        type: 'property',
        detail: d.detail,
        apply: d.label + ': '
      })),
      filter: true
    };
  }

  // 4. Front-matter specific global directives
  if (isInFrontMatter && word) {
    const isStartOfLine = /^(\w*)$/.test(lineTextBefore.trim());
    if (isStartOfLine || context.explicit) {
      return {
        from: word.from,
        options: GLOBAL_DIRECTIVES.map(d => ({
          label: d.label,
          type: 'property',
          detail: d.detail,
          apply: d.label + ': '
        })),
        filter: true
      };
    }
  }

  // 5. Code fence language (triggered by ``` at start of line)
  const fenceMatch = lineTextBefore.match(/^(`{3})(\w*)$/);
  if (fenceMatch) {
    const langStart = line.from + fenceMatch[1].length;
    return {
      from: langStart,
      options: CODE_FENCE_LANGUAGES.map(l => ({
        label: l.label,
        type: 'keyword',
        detail: l.detail,
        apply: l.label + '\n\n```',
        boost: l.label === 'mermaid' ? 1 : 0,
      })),
      filter: true,
    };
  }

  // 6. Emoji shortcode (triggered by ':' followed by at least one word character)
  const emojiMatch = context.matchBefore(/:[a-z0-9_+-]*/);
  if (emojiMatch && emojiMatch.from !== emojiMatch.to) {
    return {
      from: emojiMatch.from,
      options: EMOJI_SHORTCODES.map(e => ({
        label: `:${e.code}: ${e.emoji}`,
        type: 'text',
        apply: `:${e.code}:`,
        detail: 'Emoji',
      })),
      filter: true,
      validFor: /^:[a-z_+][a-z0-9_+-]*:?$/,
    };
  }

  // 7. General Markdown snippets (triggered by characters OR explicit Ctrl+Space)
  const snippetPrefix = context.matchBefore(/[#!$*=\^:`-]*/);
  if (context.explicit || (snippetPrefix && snippetPrefix.from !== snippetPrefix.to)) {
    const isSlides = isInFrontMatter || fullText.includes('marp: true');
    const options = SNIPPETS.filter(s => {
      if (!isSlides && s.apply.includes('bg')) return false;
      return true;
    }).map(s => {
      if (!isSlides && s.label === '![bg] Background') {
        return { ...s, label: '![alt] Image', apply: '![alt](url)', detail: 'Standard image' };
      }
      return {
        label: s.label,
        type: 'text',
        apply: s.apply,
        detail: s.detail
      };
    });

    return {
      from: snippetPrefix ? snippetPrefix.from : context.pos,
      options: options,
      filter: true
    };
  }

  return null;
}

// ── Rest of Editor Logic ────────────────────────────────────────────────────

const marpHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.heading1, tags.heading2, tags.heading3,
    tags.heading4, tags.heading5, tags.heading6],
    color: 'var(--cm-color-heading)',
    fontWeight: 'bold',
  },
  { tag: tags.strong, color: 'var(--cm-color-emphasis)', fontWeight: 'bold' },
  { tag: tags.emphasis, color: 'var(--cm-color-emphasis)', fontStyle: 'italic' },
  { tag: tags.monospace, color: 'var(--cm-color-code)' },
  {
    tag: [tags.comment, tags.blockComment, tags.lineComment],
    color: 'var(--cm-color-comment)', fontStyle: 'italic'
  },
  {
    tag: [tags.meta, tags.keyword, tags.propertyName],
    color: 'var(--cm-color-meta)'
  },
  { tag: tags.url, color: 'var(--cm-color-code)' },
]);

const separatorDecoration = Decoration.line({
  attributes: { class: 'cm-folio-separator' },
});

function buildSeparatorDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (/^-{3,}\s*$/.test(line.text)) {
        builder.add(line.from, line.from, separatorDecoration);
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const separatorPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildSeparatorDecorations(view);
    }
    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildSeparatorDecorations(update.view);
      }
    }
  },
  { decorations: v => v.decorations },
);

const folioBaseTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '1rem',
    background: 'var(--surface)',
    color: 'var(--on-surface)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-editor)',
    lineHeight: '1.6',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '1.25rem',
    caretColor: 'var(--color-plasma)',
    minHeight: '100%',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--color-plasma)',
    borderLeftWidth: '2px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(124, 77, 255, 0.04)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(124, 77, 255, 0.18)',
  },
  '.cm-gutters': { display: 'none' },
  '.cm-folio-separator': {
    background: 'var(--cm-separator-bg) !important',
    color: 'var(--cm-separator-color) !important',
    fontWeight: 'bold',
  },
  '.cm-placeholder': {
    color: 'var(--color-plasma)',
    opacity: '0.5',
    fontStyle: 'normal',
  },
  '.cm-tooltip-autocomplete': {
    border: '1px solid var(--outline)',
    backgroundColor: 'var(--surface) !important',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-ui)',
    padding: '4px 0',
  },
  '.cm-tooltip-autocomplete > ul > li': {
    padding: '6px 12px !important',
    display: 'flex !important',
    justifyContent: 'flex-start !important',
    alignItems: 'center',
    textAlign: 'left !important',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--color-plasma) !important',
    color: 'white !important',
  },
  '.cm-completionLabel': {
    flex: 'none',
  },
  '.cm-completionDetail': {
    marginLeft: '12px',
    fontWeight: 'normal',
    color: 'var(--color-plasma)',
    opacity: '0.7',
    fontSize: '0.75rem',
    flex: '1',
    textAlign: 'right',
  },
  'li[aria-selected] .cm-completionDetail': {
    color: 'white',
    opacity: '1',
  }
});

export function createFolioExtensions(
  onChange: (content: string) => void,
  onCursorMove: (slideIndex: number) => void,
): Extension[] {
  return [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    markdown(),
    folioBaseTheme,
    syntaxHighlighting(marpHighlightStyle),
    separatorPlugin,
    EditorView.lineWrapping,
    autocompletion({
      override: [marpCompletionSource]
    }),
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }

      if (update.selectionSet || update.docChanged) {
        const fullText = update.state.doc.toString();
        const pos = update.state.selection.main.head;
        const textBefore = fullText.slice(0, pos);

        const linesBefore = textBefore.split('\n');
        let separatorsBefore = 0;
        for (const line of linesBefore) {
          if (/^-{3,}\s*$/.test(line)) {
            separatorsBefore++;
          }
        }

        const hasFrontMatter = fullText.trimStart().startsWith('---');
        let slideIndex = 0;

        if (hasFrontMatter) {
          if (separatorsBefore <= 2) {
            slideIndex = 0;
          } else {
            slideIndex = separatorsBefore - 2;
          }
        } else {
          slideIndex = separatorsBefore;
        }

        onCursorMove(slideIndex);
      }
    }),
  ];
}
