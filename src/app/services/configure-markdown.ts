// @ts-ignore
import MarkdownIt from 'markdown-it';
// @ts-ignore
import mark from 'markdown-it-mark';
// @ts-ignore
import footnote from 'markdown-it-footnote';
// @ts-ignore
import deflist from 'markdown-it-deflist';
// @ts-ignore
import container from 'markdown-it-container';
// @ts-ignore
import taskLists from 'markdown-it-task-lists';

/**
 * Applies the shared plugin set to any markdown-it instance.
 * Used by both MarpService (marp.markdown) and ProseService (standalone md).
 */
export function configureMarkdownPlugins(md: MarkdownIt): void {
  md.use(mark)
    .use(footnote)
    .use(deflist)
    .use(taskLists, { label: true, labelAfter: true })
    .use(container, 'container');

  const defaultFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens: any[], idx: number, options: any, env: any, self: any) => {
    const token = tokens[idx];
    if (token.info === 'mermaid') {
      return `<div class="mermaid-container"><pre class="mermaid">${token.content}</pre></div>`;
    }
    return defaultFence!(tokens, idx, options, env, self);
  };
}
