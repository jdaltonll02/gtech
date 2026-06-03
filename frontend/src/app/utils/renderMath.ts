import katex from 'katex';

/**
 * Replaces $$...$$ (block) and $...$ (inline) LaTeX in an HTML string
 * with KaTeX-rendered HTML. Safe to run on TipTap output — it only
 * touches text that contains the delimiters.
 */
export function renderMathInHtml(html: string): string {
  if (!html) return html;

  // Block math first ($$...$$) — must come before inline to avoid partial matches
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span class="katex-error">$$${tex}$$</span>`;
    }
  });

  // Inline math ($...$) — skip if already inside a katex span
  html = html.replace(/\$([^\$\n]+?)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span class="katex-error">$${tex}$</span>`;
    }
  });

  return html;
}
