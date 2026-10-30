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
  const indexed = candidates.find(item => item.index === selection.index);
  if (indexed) return indexed.position;

  // Only accept fallback matching when it is unambiguous. Duplicate headings
  // or paragraphs should never silently focus the wrong source block.
  return candidates.length === 1 ? candidates[0].position : null;
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
