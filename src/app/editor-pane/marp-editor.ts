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

// ── Syntax highlight style ───────────────────────────────────────────────────
// Colors match the Folio design tokens from the BRIEF exactly.

const marpHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.heading1, tags.heading2, tags.heading3,
          tags.heading4, tags.heading5, tags.heading6],
    color: '#18181F',
    fontWeight: 'bold',
  },
  // Bold and italic markers + their content → Neon Coral
  { tag: tags.strong,   color: '#FF4D6D', fontWeight: 'bold' },
  { tag: tags.emphasis, color: '#FF4D6D', fontStyle: 'italic' },
  // Inline code → teal
  { tag: tags.monospace, color: '#00BFA5' },
  // HTML comments (speaker notes / _class directives) → muted italic
  { tag: [tags.comment, tags.blockComment, tags.lineComment],
    color: '#888899', fontStyle: 'italic' },
  // YAML front-matter keys → Plasma
  { tag: [tags.meta, tags.keyword, tags.propertyName],
    color: '#7C4DFF' },
  // Links and URLs
  { tag: tags.url, color: '#00BFA5' },
]);

// ── Slide separator line decoration ─────────────────────────────────────────
// Every line matching /^---+\s*$/ gets a full-width Volt bar via Decoration.line().

const separatorDecoration = Decoration.line({
  attributes: { class: 'cm-marp-separator' },
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

// ── Base editor theme ────────────────────────────────────────────────────────

const marpBaseTheme = EditorView.theme({
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
  // Hide gutter for a clean prose feel
  '.cm-gutters': { display: 'none' },
  // Full-width Volt bar for --- separators
  '.cm-marp-separator': {
    background: '#1C1C24 !important',
    color: '#C8FF00 !important',
    fontWeight: 'bold',
  },
  // Placeholder text
  '.cm-placeholder': {
    color: 'var(--color-plasma)',
    opacity: '0.5',
    fontStyle: 'normal',
  },
});

// ── Public extension factory ─────────────────────────────────────────────────

export function createMarpExtensions(onChange: (content: string) => void): Extension[] {
  return [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    markdown(),
    marpBaseTheme,
    syntaxHighlighting(marpHighlightStyle),
    separatorPlugin,
    EditorView.lineWrapping,
    EditorView.updateListener.of(update => {
      if (update.docChanged) onChange(update.state.doc.toString());
    }),
  ];
}
