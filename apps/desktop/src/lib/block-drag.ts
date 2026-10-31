import { BLOCKS, type BlockKind } from "@/components/editor/block-catalog";

// The browser's native drag gesture handles both Library and sidebar Palette.
// A source-owned in-memory session is also required: arbitrary files, URLs,
// selected text, and OS drags must never insert a documentation component.
const MIME = "application/x-paglora-block";
const PLAIN_PREFIX = "paglora:block:";
let activeBlock: BlockKind | null = null;
const known = (value: string): value is BlockKind => BLOCKS.some(block => block.kind === value);

export function beginBlockDrag(data: DataTransfer, kind: BlockKind) {
  if (!known(kind)) return false;
  activeBlock = kind;
  data.effectAllowed = "copy";
  data.setData(MIME, kind);
  // WebView2 can expose only text/plain during dragover. This exact marker
  // keeps the fallback distinct from normal dragged words or external URLs.
  data.setData("text/plain", PLAIN_PREFIX + kind);
  return true;
}

export function canAcceptBlockDrag(data: DataTransfer | null): boolean {
  if (!data || !activeBlock) return false;
  const types = Array.from(data.types);
  return types.includes(MIME) || types.includes("text/plain");
}

export function readBlockDrop(data: DataTransfer | null): BlockKind | null {
  if (!data || !activeBlock) return null;
  const fromCustom = data.getData(MIME);
  const fromText = data.getData("text/plain");
  const raw = fromCustom || (fromText.startsWith(PLAIN_PREFIX) ? fromText.slice(PLAIN_PREFIX.length) : "");
  return known(raw) && raw === activeBlock && (fromCustom === raw || fromText === PLAIN_PREFIX + raw)
    ? raw : null;
}

export function finishBlockDrag() {
  activeBlock = null;
}
