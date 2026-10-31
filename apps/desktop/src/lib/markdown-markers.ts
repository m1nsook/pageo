/** Tiptap Markdown serializes bracketed Paglora blockquote markers with
 * backslash escapes (\[!NOTE\]); that silently turns cards and callouts into
 * plain quotes on the next static build. Keep only known first-party markers
 * as syntax when they occur at the start of a quoted paragraph.
 */
export function preservePagloraMarkers(markdown: string): string {
  return markdown.replace(
    /^([ \t]{0,3}>[ \t]*)\\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|CARD|STEPS|TABS|CODEGROUP|TAB)\\\]/gim,
    (_whole, prefix: string, kind: string) => prefix + "[!" + kind.toUpperCase() + "]",
  );
}
