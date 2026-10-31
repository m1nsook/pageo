import { marked } from "marked";
import type { BlockKind } from "@/components/editor/block-catalog";
import { BLOCK_MARKDOWN_EXAMPLES } from "@/lib/block-examples";

export type VisibleSourceBlock = { text: string };

/** Recover raw source offsets from Markdown tokens, without serializing Tiptap
 * or rewriting a single byte of the user's existing source. The offsets are
 * UTF-16 code units, matching both JS strings and marked token.raw lengths.
 */
function sourceBlocks(source: string): { offset: number; signature: string }[] {
  const tokens = marked.lexer(source, { gfm: true });
  const blocks: { offset: number; signature: string }[] = [];
  let cursor = 0;
  for (const token of tokens) {
    if (typeof token.raw !== "string") throw new Error("Markdown tokenizer omitted source offsets.");
    const offset = source.indexOf(token.raw, cursor);
    if (offset < 0) throw new Error("Cannot recover the original Markdown block boundaries.");
    cursor = offset + token.raw.length;
    if (token.type === "space") continue;
    const firstItem = "items" in token && Array.isArray(token.items)
      ? token.items.map(item => item.text).join(" ") : "";
    const text = "text" in token && typeof token.text === "string" ? token.text : firstItem;
    blocks.push({ offset, signature: signature(text || token.raw) });
  }
  return blocks;
}

/** Text anchor is used ONLY when the parser splits/combines top-level blocks.
 * It is never used to modify the original Markdown.
 */
function signature(text: string): string {
  return text.toLowerCase().normalize("NFKC")
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 180);
}

function sourceBoundary(source: string, editorBlocks: readonly VisibleSourceBlock[], boundary: number): number {
  if (!Number.isInteger(boundary) || boundary < 0 || boundary > editorBlocks.length) {
    throw new Error("The selected editor boundary is outside the document.");
  }
  const blocks = sourceBlocks(source);
  if (boundary === 0) return blocks.length ? blocks[0].offset : 0;
  if (boundary === editorBlocks.length) return source.length;

  // The common path: one top-level Markdown token per rendered editor block.
  // Check nearby text to avoid silently placing a block in the wrong section.
  if (blocks.length === editorBlocks.length) {
    const before = signature(editorBlocks[boundary - 1].text);
    const after = signature(editorBlocks[boundary].text);
    const beforeSource = blocks[boundary - 1].signature;
    const afterSource = blocks[boundary].signature;
    const overlap = (a: string, b: string) => Boolean(a && b) && (a.includes(b) || b.includes(a));
    // Both surrounding blocks must match if they contain text. An empty
    // heading/hr alone is not sufficient evidence of a correct source offset.
    if ((!before || overlap(before, beforeSource)) &&
        (!after || overlap(after, afterSource))) return blocks[boundary].offset;
  }

  // In malformed editor trees the token/node counts can differ. Resolve a
  // unique adjacent text anchor, or refuse rather than append at the end.
  const target = signature(editorBlocks[boundary].text);
  const previous = signature(editorBlocks[boundary - 1].text);
  const match = (anchor: string, sourceAnchor: string) =>
    anchor.length >= 5 && sourceAnchor.length >= 5 &&
    (sourceAnchor.includes(anchor) || anchor.includes(sourceAnchor));
  const candidates = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) =>
      match(target, block.signature) &&
      (index === 0 || match(previous, blocks[index - 1].signature)));
  if (candidates.length === 1) return candidates[0].block.offset;
  throw new Error("Cannot safely map this drop to a unique Markdown section. No content was changed.");
}

/** Insertion location comes from the actual editor caret or pointer release
 * boundary, never the page end. The original Markdown is an untouched prefix
 * and suffix around the newly inserted standalone portable Markdown block.
 */
export function insertComponentAtMarkdownBoundary(
  source: string, kind: BlockKind, editorBlocks: readonly VisibleSourceBlock[], boundary: number,
): string {
  const snippet = BLOCK_MARKDOWN_EXAMPLES[kind];
  if (typeof snippet !== "string" || !snippet.trim()) throw new Error("Unknown documentation component.");
  const offset = sourceBoundary(source, editorBlocks, boundary);
  const before = source.slice(0, offset);
  const after = source.slice(offset);
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const leading = before.length === 0 || before.endsWith(eol + eol) ? ""
    : before.endsWith(eol) ? eol : eol + eol;
  const trailing = after.length === 0 ? eol
    : after.startsWith(eol + eol) ? "" : after.startsWith(eol) ? eol : eol + eol;
  return before + leading + snippet.replace(/\n/g, eol) + trailing + after;
}
