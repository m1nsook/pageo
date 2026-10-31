import type { BlockKind } from "@/components/editor/block-catalog";

/** Keyboard order always follows the currently filtered library list. */
export function nextGalleryKind(kinds: readonly BlockKind[], current: BlockKind, key: string): BlockKind | null {
  if (!kinds.length) return null;
  if (key === "Home") return kinds[0];
  if (key === "End") return kinds[kinds.length - 1];
  if (key !== "ArrowDown" && key !== "ArrowUp") return null;
  const at = kinds.indexOf(current);
  if (at < 0) return kinds[0];
  return kinds[(at + (key === "ArrowDown" ? 1 : -1) + kinds.length) % kinds.length];
}
