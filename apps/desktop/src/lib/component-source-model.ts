import { marked } from "marked";
import { BLOCK_MARKDOWN_EXAMPLES } from "@/lib/block-examples";
import type { BlockKind } from "@/components/editor/block-catalog";

/** One authoritative document model for the component composer.
 * Markdown tokens are mapped to the exact ORIGINAL source offsets. Both the
 * rendered insertion targets and the writer use these same offsets: there is
 * no ProseMirror index/fingerprint/DOM-to-Markdown guessing.
 */
export type SourceComponentBlock = {
  id: number;
  start: number;
  end: number;
  raw: string;
  markdownType: string;
};
export type SourceComponentDocument = {
  blocks: SourceComponentBlock[];
  source: string;
};

export function parseSourceComponents(source: string): SourceComponentDocument {
  const normalized = source.replace(/\r\n?/g, "\n");
  const tokens = marked.lexer(normalized, { gfm: true });
  let cursor = 0;
  let normalizedCursor = 0;
  let rawCursor = 0;
  const originalOffset = (at: number): number => {
    while (normalizedCursor < at) {
      if (source[rawCursor] === "\r" && source[rawCursor + 1] === "\n") rawCursor += 2;
      else rawCursor += 1;
      normalizedCursor += 1;
    }
    return rawCursor;
  };
  const blocks: SourceComponentBlock[] = [];
  for (const token of tokens) {
    const raw = token.raw;
    if (typeof raw !== "string" || !raw.length) continue;
    const offset = normalized.indexOf(raw, cursor);
    if (offset < cursor) throw new Error("Could not read source block boundaries.");
    cursor = offset + raw.length;
    if (token.type === "space") continue;
    const start = originalOffset(offset);
    const end = originalOffset(cursor);
    blocks.push({
      id: blocks.length,
      start,
      end,
      raw: source.slice(start, end),
      markdownType: token.type,
    });
  }
  return { source, blocks };
}

/** Position is always a boundary in the source-backed rendered canvas. */
export function insertComponentAtBoundary(
  source: string, kind: BlockKind, boundary: number,
): string {
  const template = BLOCK_MARKDOWN_EXAMPLES[kind];
  if (typeof template !== "string" || !template.trim()) {
    throw new Error("Unknown documentation component.");
  }
  const { blocks } = parseSourceComponents(source);
  if (!Number.isInteger(boundary) || boundary < 0 || boundary > blocks.length) {
    throw new Error("The insertion position is no longer valid.");
  }
  const index = boundary === blocks.length ? source.length : blocks[boundary].start;
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const before = source.slice(0, index);
  const after = source.slice(index);
  const separatorBefore = !before || before.endsWith(eol + eol) ? ""
    : before.endsWith(eol) ? eol : eol + eol;
  const separatorAfter = !after ? eol : after.startsWith(eol + eol) ? ""
    : after.startsWith(eol) ? eol : eol + eol;
  return before + separatorBefore + template.replace(/\n/g, eol) +
    separatorAfter + after;
}
