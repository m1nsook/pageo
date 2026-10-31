/** Standard Markdown citations: no proprietary syntax or web-only runtime.
 * Site rendering and portable .paglora backups require no special handling.
 */
export function formatInlineCitation(label: string, rawUrl: string, accessed?: string): string {
  const caption = label.trim();
  if (!caption || caption.length > 140 || /[\r\n\[\]<>]/.test(caption)) {
    throw new Error("Citation label must contain 1–140 characters without brackets or newlines.");
  }
  let link: URL;
  try { link = new URL(rawUrl.trim()); } catch { throw new Error("Enter a valid HTTPS source URL."); }
  if (link.protocol !== "https:" || !link.hostname || link.username || link.password ||
    /[\u0000-\u001f\u007f]/.test(rawUrl) || rawUrl.length > 2048) {
    throw new Error("Sources must use a valid HTTPS URL without credentials.");
  }
  let title = "";
  if (accessed) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(accessed) || Number.isNaN(Date.parse(accessed))) {
      throw new Error("Access date must be a valid YYYY-MM-DD date.");
    }
    title = ` "Accessed ${accessed}"`;
  }
  // Percent-encode user-supplied brackets to avoid breaking Markdown links.
  const href = link.toString().replace(/\(/g, "%28").replace(/\)/g, "%29");
  return `[${caption}](${href}${title})`;
}
