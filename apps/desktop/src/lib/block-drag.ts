import { BLOCKS, type BlockKind } from "@/components/editor/block-catalog";

// In Tauri/Windows WebView2 a native HTML5 drag shows the forbidden cursor,
// drops are often rejected and DataTransfer can disappear. Paglora's palette
// and Library are entirely in one window, so use pointer events instead.
export type PointerBlock = {
  kind: BlockKind;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
};
const valid = (value: string): value is BlockKind => BLOCKS.some(block => block.kind === value);
let active: PointerBlock | null = null;

export function beginPointerBlock(kind: BlockKind, pointerId: number, x: number, y: number): boolean {
  if (!valid(kind) || active) return false;
  active = { kind, pointerId, startX: x, startY: y, x, y, moved: false };
  return true;
}
export function updatePointerBlock(pointerId: number, x: number, y: number): PointerBlock | null {
  if (!active || active.pointerId !== pointerId) return null;
  active.x = x;
  active.y = y;
  if (Math.hypot(x - active.startX, y - active.startY) >= 7) active.moved = true;
  return { ...active };
}
export function finishPointerBlock(pointerId: number, x: number, y: number): PointerBlock | null {
  const current = updatePointerBlock(pointerId, x, y);
  if (current) active = null;
  return current;
}
export function cancelPointerBlock(pointerId?: number) {
  if (pointerId === undefined || active?.pointerId === pointerId) active = null;
}
export function activePointerBlock(): PointerBlock | null {
  return active ? { ...active } : null;
}
