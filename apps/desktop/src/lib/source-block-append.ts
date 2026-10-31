import { BLOCK_MARKDOWN_EXAMPLES } from "@/lib/block-examples";
import type { BlockKind } from "@/components/editor/block-catalog";

/** When a third-party Markdown construct creates an invalid Tiptap tree, the
 * original .md remains the source of truth. Append an ordinary portable
 * component instead of replacing/serializing that invalid visual tree.
 *
 * This function NEVER trims, normalizes or reserializes the user's source.
 * It is intentionally an end-of-document fallback, not a claimed caret insert.
 */
export function appendComponentToMarkdown(source: string, kind: BlockKind): string {
  const snippet = BLOCK_MARKDOWN_EXAMPLES[kind];
  if (typeof snippet !== "string" || !snippet.trim()) {
    throw new Error("Unknown documentation component.");
  }
  const separator = source.length === 0 || source.endsWith("\n\n") ? ""
    : source.endsWith("\n") ? "\n" : "\n\n";
  return source + separator + snippet + "\n";
}
