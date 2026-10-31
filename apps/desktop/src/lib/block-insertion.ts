import type { Editor } from "@tiptap/core";
import { createMarkdownBlock, type BlockKind } from "@/components/editor/block-catalog";

/** Never target an arbitrary nested text position for a block drop.
 * Align placement to a document-level boundary using the real editor nodes.
 */
export function blockDropPosition(editor: Editor, clientY: number): number {
  let position = editor.state.doc.content.size;
  editor.state.doc.forEach((_node, offset) => {
    const element = editor.view.nodeDOM(offset);
    if (!(element instanceof HTMLElement)) return;
    const bounds = element.getBoundingClientRect();
    if (clientY < bounds.top + bounds.height / 2 && position === editor.state.doc.content.size) {
      position = offset;
    }
  });
  return position;
}

/** This is the only insertion path for both click and drag. A successful
 * command must actually change the ProseMirror document, not merely consume
 * a DOM event. scrollIntoView exposes offscreen click insertions to the user.
 */
export function insertBlockIntoEditor(editor: Editor, kind: BlockKind, clientY?: number): boolean {
  if (!editor.isEditable || editor.isDestroyed) return false;
  const previous = editor.state.doc;
  const position = clientY === undefined
    ? editor.state.selection.from
    : blockDropPosition(editor, clientY);
  const inserted = editor.chain().focus()
    .insertContentAt(position, createMarkdownBlock(kind))
    .scrollIntoView()
    .run();
  return inserted && !editor.state.doc.eq(previous);
}
