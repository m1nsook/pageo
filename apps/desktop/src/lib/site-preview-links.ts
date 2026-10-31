/** Resolve only validated local site links inside the sandboxed Studio canvas.
 * External URLs, absolute paths and private pages must never navigate the WebView.
 */
export type CanvasLink = { kind: "page"; pageId: string; fragment: string } | { kind: "fragment"; fragment: string };
function fragment(raw: string): string | null {
  try { return decodeURIComponent(raw); } catch { return null; }
}
export function resolveCanvasLink(href: string, publicPageIds: readonly string[]): CanvasLink | null {
  if (href.startsWith("#")) {
    const decoded = fragment(href.slice(1));
    return decoded === null ? null : { kind: "fragment", fragment: decoded };
  }
  const match = /^(?:\.\/)?([a-z0-9-]+)\.html(?:#(.*))?$/i.exec(href);
  if (!match || !publicPageIds.includes(match[1])) return null;
  const decoded = fragment(match[2] ?? "");
  return decoded === null ? null : { kind: "page", pageId: match[1], fragment: decoded };
}
