import type { Editor } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";
import { createMarkdownBlock, type BlockKind } from "@/components/editor/block-catalog";

/** Snap drops to the boundary of a top-level document node, never into
 * nested markup where a drop could split an existing Markdown component.
 */
export function blockDropPosition(editor: Editor, clientY: number): number {
  let position = editor.state.doc.content.size;
  editor.state.doc.forEach((_node, offset) => {
    const element = editor.view.nodeDOM(offset);
    if (typeof HTMLElement === "undefined" || !(element instanceof HTMLElement)) return;
    const bounds = element.getBoundingClientRect();
    if (clientY < bounds.top + bounds.height / 2 && position === editor.state.doc.content.size) {
      position = offset;
    }
  });
  return position;
}

/** Index of the top-level Markdown block boundary for a pointer release.
 * This index is stable even when the in-memory ProseMirror tree is malformed.
 * The release position is found from actual rendered block rectangles.
 */
export function blockDropBoundary(editor: Editor, clientY: number): number {
  let result = editor.state.doc.childCount;
  editor.state.doc.forEach((_node, offset, index) => {
    let element: Node | null = null;
    try { element = editor.view.nodeDOM(offset); } catch { /* Detached node view. */ }
    if (typeof HTMLElement === "undefined" || !(element instanceof HTMLElement)) {
      element = editor.view.dom?.children[index] ?? null;
    }
    if (typeof HTMLElement === "undefined" || !(element instanceof HTMLElement)) return;
    const bounds = element.getBoundingClientRect();
    if (result === editor.state.doc.childCount && clientY < bounds.top + bounds.height / 2) {
      result = index;
    }
  });
  return result;
}

/** A click uses the last caret position, not the end of the source file. */
export function selectionBlockBoundary(editor: Editor): number {
  const { $from } = editor.state.selection;
  if ($from.depth === 0) return editor.state.doc.childCount;
  return Math.min(editor.state.doc.childCount, $from.index(0) + 1);
}

/** Click inserts after the whole top-level block containing the selection. */
export function selectionBlockEnd(editor: Editor): number {
  const selection = editor.state.selection.$from;
  if (selection.depth === 0) return editor.state.doc.content.size;
  const offset = selection.before(1);
  const node = editor.state.doc.nodeAt(offset);
  return node ? Math.min(offset + node.nodeSize, editor.state.doc.content.size)
    : editor.state.doc.content.size;
}

export type InsertionFailureCode = "invalidDocument" | "notEditable" | "invalidPosition" | "error";
type InsertionFailure = (reason: string, code?: InsertionFailureCode) => void;

/** Single click/drag/gallery insertion path.
 *
 * Tiptap's insertContentAt can attempt schema fitting against an invalid
 * document, throwing "Called contentMatchAt on a node with invalid content".
 * Build the node with THIS editor's live schema, validate both documents,
 * and commit one ordinary undoable ProseMirror transaction instead. Never
 * repair bad Markdown by silently replacing or discarding the user's page.
 */
export function insertBlockIntoEditor(
  editor: Editor, kind: BlockKind, clientY?: number, onFailure?: InsertionFailure,
): boolean {
  const fail = (reason: string, code: InsertionFailureCode = "error") => { onFailure?.(reason, code); return false; };
  if (editor.isDestroyed || !editor.isEditable) return fail("The editor is not editable. Switch to Edit view.", "notEditable");
  try {
    const { state, view } = editor;
    try {
      state.doc.check();
    } catch {
      // This describes the in-memory ProseMirror parse, NOT invalid user Markdown.
      return fail("The visual editor could not represent this Markdown structure.", "invalidDocument");
    }

    // JSON is constructed from the vetted palette, not any external drag MIME.
    // Use the active schema so multiple copies of prosemirror-model cannot
    // introduce incompatible parsed nodes through insertContentAt.
    const block = state.schema.nodeFromJSON(createMarkdownBlock(kind));
    block.check();
    if (!block.isBlock) return fail("The selected component is not a block.");
    const position = clientY === undefined
      ? selectionBlockEnd(editor)
      : blockDropPosition(editor, clientY);
    const $position = state.doc.resolve(position);
    if ($position.depth !== 0 ||
      !state.doc.canReplaceWith($position.index(), $position.index(), block.type, block.marks)) {
      return fail("That location cannot accept the selected component.", "invalidPosition");
    }

    const previous = state.doc;
    const transaction = state.tr.insert(position, block);
    transaction.doc.check();
    if (!transaction.docChanged || transaction.doc.eq(previous)) {
      return fail("The component did not change the document.");
    }

    // The new component is visible and ready for typing; a leaf divider
    // instead uses the nearest valid selection. One dispatch = one undo step.
    transaction.setSelection(Selection.near(
      transaction.doc.resolve(Math.min(position + 1, transaction.doc.content.size)), 1,
    ));
    transaction.scrollIntoView();
    view.dispatch(transaction);
    if (editor.state.doc.eq(previous)) return fail("The editor did not apply the insertion.");
    try { view.focus(); } catch { /* Focus is cosmetic; insertion succeeded. */ }
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Paglora block insertion failed:", error);
    return fail("Insertion was refused: " + detail + ". No editor content was intentionally replaced.");
  }
}
