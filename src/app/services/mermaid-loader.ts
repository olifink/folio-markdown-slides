/**
 * Module-level cache for the mermaid script content.
 * Fetched once and shared across MarpService and ProseService.
 */
let cache: Promise<string> | null = null;

export function loadMermaidScript(): Promise<string> {
  return (cache ??= fetch('js/mermaid.min.js')
    .then(r => (r.ok ? r.text() : ''))
    .catch(() => ''));
}
