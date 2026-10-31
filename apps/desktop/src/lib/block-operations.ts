import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { closeHistory } from "@tiptap/pm/history";
import { Selection } from "@tiptap/pm/state";

type Action = { kind: "move"; from: number; to: number } |
  { kind: "duplicate" | "delete"; from: number };

/** All outline actions are real, undoable ProseMirror transactions. No HTML
 * manipulation or parallel Markdown representation is introduced.
 */
function applyBlockAction(editor: Editor, action: Action): boolean {
  const state = editor.state;
  const blocks: ProseMirrorNode[] = [];
  const offsets: number[] = [];
  state.doc.forEach((node, offset) => { blocks.push(node); offsets.push(offset); });
  const { from } = action;
  if (!editor.isEditable || !Number.isInteger(from) || from < 0 || from >= blocks.length) return false;

  const selected = blocks[from];
  const selectionInside = state.selection.from >= offsets[from] &&
    state.selection.from < offsets[from] + selected.nodeSize;
  const relativeCaret = selectionInside ? Math.max(1, state.selection.from - offsets[from]) : 1;
  let focusIndex = from;
  let caret = relativeCaret;

  if (action.kind === "move") {
    if (!Number.isInteger(action.to) || action.to < 0 ||
        action.to >= blocks.length || action.to === from) return false;
    blocks.splice(from, 1);
    blocks.splice(action.to, 0, selected);
    focusIndex = action.to;
  } else if (action.kind === "duplicate") {
    // ProseMirror nodes are immutable; subsequent edits replace only the copy.
    blocks.splice(from + 1, 0, selected);
    focusIndex = from + 1;
  } else if (blocks.length === 1) {
    // A document must retain a valid block even after deleting its last row.
    if (selected.type.name === "paragraph" && selected.content.size === 0) return false;
    const paragraph = state.schema.nodes.paragraph;
    if (!paragraph) return false;
    blocks[0] = paragraph.create();
    caret = 1;
  } else {
    blocks.splice(from, 1);
    focusIndex = Math.min(from, blocks.length - 1);
    caret = 1;
  }

  // A complete block replacement preserves nested lists, marks and heading
  // levels. Set a new selection explicitly: the replace mapping would
  // otherwise collapse the caret to the start of the document.
  const tr = closeHistory(state.tr.replaceWith(0, state.doc.content.size, blocks));
  let offset = 0;
  for (let i = 0; i < focusIndex; i++) offset += blocks[i].nodeSize;
  const focused = blocks[focusIndex];
  const position = Math.min(tr.doc.content.size,
    offset + Math.min(caret, Math.max(1, focused.nodeSize - 1)));
  tr.setSelection(Selection.near(tr.doc.resolve(position), 1));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export function moveBlock(editor: Editor, from: number, to: number): boolean {
  return applyBlockAction(editor, { kind: "move", from, to });
}

export function duplicateBlock(editor: Editor, from: number): boolean {
  return applyBlockAction(editor, { kind: "duplicate", from });
}

export function deleteBlock(editor: Editor, from: number): boolean {
  return applyBlockAction(editor, { kind: "delete", from });
}
