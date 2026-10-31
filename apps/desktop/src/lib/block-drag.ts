import { BLOCKS, type BlockKind } from "@/components/editor/block-catalog";

const MIME = "application/x-paglora-block";
const PLAIN_PREFIX = "paglora:block:";
let activeBlock: BlockKind | null = null;
const known = (value: string): value is BlockKind => BLOCKS.some(block => block.kind === value);

/** Real WebView2 drags can expose empty dataTransfer.types/getData at drop.
 * A drag may be accepted only if it was started by Paglora in THIS window.
 */
export function activeDraggedBlock(): BlockKind | null {
  return activeBlock;
}
export function beginBlockDrag(data: DataTransfer, kind: BlockKind): boolean {
  if (!known(kind)) return false;
  activeBlock = kind;
  try { data.effectAllowed = "copy"; } catch { /* WebView2 fallback */ }
  try { data.setData(MIME, kind); } catch { /* WebView2 fallback */ }
  try { data.setData("text/plain", PLAIN_PREFIX + kind); } catch { /* WebView2 fallback */ }
  return true;
}
export function canAcceptBlockDrag(data: DataTransfer | null): boolean {
  if (!activeBlock) return false;
  if (data && Array.from(data.types ?? []).includes("Files")) return false;
  return true;
}
export function readBlockDrop(data: DataTransfer | null): BlockKind | null {
  if (!canAcceptBlockDrag(data) || !activeBlock) return null;
  let custom = "", plain = "";
  try { custom = data?.getData(MIME) ?? ""; } catch { /* WebView2 fallback */ }
  try { plain = data?.getData("text/plain") ?? ""; } catch { /* WebView2 fallback */ }
  // If a payload exists it must match the source-owned session. Never honor
  // an external URL, raw HTML, mismatched type, or an arbitrary text selection.
  if (custom && custom !== activeBlock) return null;
  if (plain && plain !== PLAIN_PREFIX + activeBlock) return null;
  return activeBlock;
}
export function finishBlockDrag(): void {
  activeBlock = null;
}
