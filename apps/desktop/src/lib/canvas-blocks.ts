import type { Editor } from "@tiptap/react";

export type CanvasBlockSelection = {
  pageId: string;
  index: number;
  tagName: string;
  text: string;
};

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const types: Record<string, string[]> = {
  h1: ["heading"], h2: ["heading"], h3: ["heading"],
  h4: ["heading"], h5: ["heading"], h6: ["heading"],
  p: ["paragraph"], ul: ["bulletList"], ol: ["orderedList"],
  blockquote: ["blockquote"], pre: ["codeBlock"], hr: ["horizontalRule"],
};

/** Determine the Tiptap block represented by a sanitized, rendered site
 * element. We never blindly edit based on an element's array index: the
 * source node's type and complete text must match as well.
 *
 * Some Markdown structures render differently to Tiptap's model. In those
 * cases, the safe fallback is to open Edit without moving the cursor.
 */
export function findCanvasSourcePosition(
  editor: Editor,
  selection: CanvasBlockSelection,
): number | null {
  const expected = types[selection.tagName];
  if (!expected) return null;

  const candidates: { position: number; index: number }[] = [];
  editor.state.doc.forEach((node, offset, index) => {
    if (!expected.includes(node.type.name)) return;
    if (node.type.name === "heading" &&
        node.attrs.level !== Number(selection.tagName.slice(1))) return;
    if (selection.tagName === "p") {
      let containsImage = false;
      node.descendants(child => { if (child.type.name === "image") containsImage = true; });
      if (containsImage) return;
    }
    if (normalize(node.textContent) !== selection.text) return;
    candidates.push({ position: offset + 1, index });
  });
  // Duplicate rendered headings/paragraphs are indistinguishable without
  // stable per-block source IDs. Never target any of them automatically.
  if (candidates.length !== 1) return null;
  return candidates[0].position;
}

export function canvasBlockName(tagName: string): string {
  if (/^h[1-6]$/.test(tagName)) return `Heading ${tagName[1]}`;
  return ({
    p: "Paragraph", ul: "Bullet list", ol: "Numbered list",
    blockquote: "Quote", pre: "Code block", table: "Table",
    hr: "Divider", img: "Image",
  } as Record<string, string>)[tagName] ?? "Content block";
}

export function normalizeCanvasText(value: string): string {
  return normalize(value);
}

/** Only plain, unformatted text in a heading or paragraph can be edited from
 * the inspector. Links, inline code, emphasis, images, nested structures and
 * ambiguous matches are deliberately excluded to protect the original source.
 */
export function editableCanvasText(editor: Editor, selection: CanvasBlockSelection): boolean {
  if (selection.tagName !== "p" && !/^h[1-6]$/.test(selection.tagName)) return false;
  const position = findCanvasSourcePosition(editor, selection);
  if (position === null) return false;
  const node = editor.state.doc.nodeAt(position - 1);
  if (!node || node.content.childCount !== 1 || !node.firstChild?.isText ||
      node.firstChild.marks.length !== 0) return false;
  return normalize(node.textContent) === selection.text;
}

export function replacePlainCanvasText(
  editor: Editor, selection: CanvasBlockSelection, replacement: string,
): boolean {
  if (replacement.length > 3000 || replacement.includes("\n") ||
      replacement.includes("\r") || replacement.trim().length === 0 ||
      !editableCanvasText(editor, selection)) return false;
  const position = findCanvasSourcePosition(editor, selection);
  if (position === null) return false;
  const node = editor.state.doc.nodeAt(position - 1);
  if (!node) return false;
  if (node.textContent === replacement) return true;
  // Replace ONLY the text contents of the verified source node, preserving
  // the block type, heading level and surrounding document.
  editor.view.dispatch(editor.state.tr.insertText(
    replacement, position, position + node.nodeSize - 2,
  ));
  return true;
}
