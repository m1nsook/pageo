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

/** Click inserts AFTER the entire top-level block containing the selection.
 * Inserting at selection.from could split a heading and hide the result
 * between two fragments; it also violated our previous 1-click expectation.
 */
export function selectionBlockEnd(editor: Editor): number {
  const selection = editor.state.selection.$from;
  if (selection.depth === 0) return editor.state.doc.content.size;
  const offset = selection.before(1);
  const node = editor.state.doc.nodeAt(offset);
  return node ? Math.min(offset + node.nodeSize, editor.state.doc.content.size)
    : editor.state.doc.content.size;
}

/** This is the only insertion path for both click and drag. A successful
 * command must actually change the ProseMirror document, not merely consume
 * a DOM event. scrollIntoView exposes offscreen click insertions to the user.
 */
export function insertBlockIntoEditor(editor: Editor, kind: BlockKind, clientY?: number): boolean {
  if (!editor.isEditable || editor.isDestroyed) return false;
  const previous = editor.state.doc;
  const position = clientY === undefined
    ? selectionBlockEnd(editor)
    : blockDropPosition(editor, clientY);
  const inserted = editor.chain().focus()
    .insertContentAt(position, createMarkdownBlock(kind))
    .scrollIntoView()
    .run();
  return inserted && !editor.state.doc.eq(previous);
}
