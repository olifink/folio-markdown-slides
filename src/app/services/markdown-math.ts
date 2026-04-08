/**
 * Minimal markdown-it plugin for $...$ inline math and $$...$$ block math.
 * Renders via KaTeX with MathML output — no KaTeX CSS or fonts required.
 */
// @ts-ignore
import MarkdownIt from 'markdown-it';
// @ts-ignore
import katex from 'katex';

function renderMath(src: string, displayMode: boolean): string {
  return katex.renderToString(src, {
    displayMode,
    output: 'mathml',
    throwOnError: false,
  });
}

export function mathPlugin(md: MarkdownIt): void {
  // ── Block math: $$ ... $$ ──────────────────────────────────────────────────
  md.block.ruler.before(
    'fence',
    'math_block',
    (state: any, startLine: number, endLine: number, silent: boolean) => {
      let pos = state.bMarks[startLine] + state.tShift[startLine];
      const max = state.eMarks[startLine];

      if (pos + 2 > max) return false;
      if (state.src.charCodeAt(pos) !== 0x24 /* $ */ || state.src.charCodeAt(pos + 1) !== 0x24) return false;

      // Opening $$
      const openDelim = state.src.slice(pos, max);
      if (!openDelim.startsWith('$$')) return false;

      // Check for single-line $$ math $$ on one line
      const inlineContent = openDelim.slice(2).trimEnd();
      if (inlineContent.endsWith('$$') && inlineContent.length > 2) {
        if (silent) return true;
        const content = inlineContent.slice(0, -2).trim();
        const token = state.push('math_block', 'math', 0);
        token.content = content;
        token.map = [startLine, startLine + 1];
        token.markup = '$$';
        state.line = startLine + 1;
        return true;
      }

      // Multi-line: search for closing $$
      let nextLine = startLine + 1;
      let found = false;
      while (nextLine < endLine) {
        pos = state.bMarks[nextLine] + state.tShift[nextLine];
        const lineMax = state.eMarks[nextLine];
        if (pos < lineMax && state.src.charCodeAt(pos) === 0x24 && state.src.charCodeAt(pos + 1) === 0x24) {
          found = true;
          break;
        }
        nextLine++;
      }

      if (!found) return false;
      if (silent) return true;

      const content = state.getLines(startLine + 1, nextLine, state.tShift[startLine], false).trim();
      const token = state.push('math_block', 'math', 0);
      token.content = content;
      token.map = [startLine, nextLine + 1];
      token.markup = '$$';
      state.line = nextLine + 1;
      return true;
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
  );

  // ── Inline math: $...$ ─────────────────────────────────────────────────────
  md.inline.ruler.after('escape', 'math_inline', (state: any, silent: boolean) => {
    const src = state.src;
    const pos = state.pos;
    const max = state.posMax;

    if (src.charCodeAt(pos) !== 0x24 /* $ */) return false;
    // Don't match $$
    if (src.charCodeAt(pos + 1) === 0x24) return false;

    let end = pos + 1;
    while (end < max && src.charCodeAt(end) !== 0x24) end++;
    if (end >= max || src.charCodeAt(end) !== 0x24) return false;
    if (end === pos + 1) return false; // empty $

    if (!silent) {
      const token = state.push('math_inline', 'math', 0);
      token.markup = '$';
      token.content = src.slice(pos + 1, end);
    }
    state.pos = end + 1;
    return true;
  });

  // ── Renderers ──────────────────────────────────────────────────────────────
  md.renderer.rules['math_block'] = (tokens: any[], idx: number) =>
    `<p class="katex-block">${renderMath(tokens[idx].content, true)}</p>\n`;

  md.renderer.rules['math_inline'] = (tokens: any[], idx: number) =>
    renderMath(tokens[idx].content, false);
}
