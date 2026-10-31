import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Blocks, GripVertical, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BLOCKS, type BlockKind } from "@/components/editor/block-catalog";
import { BlockComponentGallery } from "@/components/editor/block-component-gallery";
import { toast } from "sonner";

type Drag = {
  kind: BlockKind;
  id: number;
  startX: number; startY: number;
  x: number; y: number; moved: boolean;
};
type Drop = { boundary: number; x: number; y: number };

/** Both drag hit-testing and insertion positions are defined by the SOURCE
 * component canvas. A broken Tiptap parse has no role in either operation.
 */
function hitTest(x: number, y: number): Drop | null {
  const canvas = document.querySelector<HTMLElement>("[data-component-drop-canvas]");
  if (!canvas) return null;
  const r = canvas.getBoundingClientRect();
  if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
  const blocks = Array.from(canvas.querySelectorAll<HTMLElement>("[data-component-block-index]"));
  for (let index = 0; index < blocks.length; index++) {
    const bounds = blocks[index].getBoundingClientRect();
    if (y < bounds.top + bounds.height / 2) {
      return { boundary: index, x: r.left, y: bounds.top };
    }
  }
  const last = blocks.at(-1)?.getBoundingClientRect();
  return { boundary: blocks.length, x: r.left, y: last ? last.bottom : r.top + 30 };
}

export function BlockPalette({
  disabled, selectedBoundary, onSelectedBoundaryChange, onInsert,
}: {
  disabled: boolean;
  selectedBoundary: number;
  onSelectedBoundaryChange: (boundary: number) => void;
  onInsert: (kind: BlockKind, boundary: number) => boolean;
}) {
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState<Drag | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const active = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const callbacks = useRef({ onInsert, onSelectedBoundaryChange, disabled, selectedBoundary });
  callbacks.current = { onInsert, onSelectedBoundaryChange, disabled, selectedBoundary };

  function insert(kind: BlockKind, boundary: number): boolean {
    if (callbacks.current.disabled) return false;
    const success = callbacks.current.onInsert(kind, boundary);
    if (success) toast.success("Component inserted", { description: "Placed at the selected Markdown position." });
    return success;
  }

  // One session handler for both the side palette and the non-modal Library.
  // No window-wide drag object, native DataTransfer, or pointer capture.
  useEffect(() => {
    function movement(id: number, x: number, y: number) {
      const session = active.current;
      if (!session || session.id !== id) return;
      session.x = x;
      session.y = y;
      if (Math.hypot(x - session.startX, y - session.startY) >= 6) session.moved = true;
      if (session.moved) {
        setDragging({ ...session });
        setDrop(hitTest(x, y));
      }
    }
    function finish(id: number, x: number, y: number) {
      const session = active.current;
      if (!session || session.id !== id) return;
      movement(id, x, y);
      active.current = null;
      setDragging(null);
      setDrop(null);
      if (!session.moved) return;
      suppressClick.current = true;
      requestAnimationFrame(() => { suppressClick.current = false; });
      const target = hitTest(x, y);
      if (!target) return;
      callbacks.current.onSelectedBoundaryChange(target.boundary);
      if (insert(session.kind, target.boundary)) {
        document.dispatchEvent(new Event("paglora:component-library-dropped"));
      }
    }
    const pointerMove = (event: PointerEvent) => movement(event.pointerId, event.clientX, event.clientY);
    const pointerUp = (event: PointerEvent) => finish(event.pointerId, event.clientX, event.clientY);
    // WebView2 can lose the pointer stream when leaving a dialog/scroll area.
    // The mouse stream is a recovery path for the SAME drag, not a second drag.
    const mouseMove = (event: MouseEvent) => {
      if (active.current) movement(active.current.id, event.clientX, event.clientY);
    };
    const mouseUp = (event: MouseEvent) => {
      if (active.current) finish(active.current.id, event.clientX, event.clientY);
    };
    const cancel = () => {
      active.current = null;
      setDragging(null);
      setDrop(null);
    };
    window.addEventListener("pointermove", pointerMove, true);
    window.addEventListener("pointerup", pointerUp, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("mousemove", mouseMove, true);
    window.addEventListener("mouseup", mouseUp, true);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointermove", pointerMove, true);
      window.removeEventListener("pointerup", pointerUp, true);
      window.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("mousemove", mouseMove, true);
      window.removeEventListener("mouseup", mouseUp, true);
      window.removeEventListener("blur", cancel);
    };
  }, []);

  function start(event: ReactPointerEvent<HTMLElement>, kind: BlockKind) {
    if (callbacks.current.disabled || active.current ||
        event.button !== 0 || !event.isPrimary) return;
    active.current = {
      kind, id: event.pointerId, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, moved: false,
    };
  }

  const blocks = BLOCKS.filter(block =>
    (block.title + " " + block.description).toLowerCase().includes(query.toLowerCase()));

  return (
    <aside aria-label="Documentation components" className="flex h-full w-full min-w-0 flex-col border-l border-border bg-card">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4">
        <span className="flex items-center gap-2 text-xs font-semibold"><Blocks className="size-4" /> Components</span>
        <BlockComponentGallery disabled={disabled} onInsert={kind => insert(kind, callbacks.current.selectedBoundary)}
          onBeginDrag={start} />
      </div>
      <Separator />
      <div className="p-3"><Input aria-label="Filter components" placeholder="Search components…" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 px-3 pb-4">
          {blocks.map(({ kind, icon: Icon, title, description }) => (
            <button type="button" key={kind} disabled={disabled} draggable={false}
              data-component-kind={kind}
              onDragStart={event => event.preventDefault()}
              onPointerDown={event => start(event, kind)}
              onClick={() => { if (!suppressClick.current) insert(kind, callbacks.current.selectedBoundary); }}
              style={{ touchAction: "none" }}
              className="flex min-h-14 w-full cursor-grab select-none items-center gap-3 rounded-lg px-2 text-left hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{title}</span>
                <span className="block truncate text-xs text-muted-foreground">{description}</span>
              </span>
              <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />
            </button>
          ))}
        </div>
      </ScrollArea>
      <p className="flex items-start gap-2 border-t border-border p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        Drag a component onto the document, or select a position and click to insert.
      </p>
      {dragging && (
        <div className="pointer-events-none fixed z-[9999] rounded-md border border-primary bg-background px-3 py-2 text-xs font-semibold shadow-lg"
          style={{ left: dragging.x + 14, top: dragging.y + 14 }}>
          {BLOCKS.find(block => block.kind === dragging.kind)?.title ?? "Component"}
          {drop ? " · Release to insert" : " · Drag onto the document"}
        </div>
      )}
      {drop && (
        <div aria-hidden="true" className="pointer-events-none fixed z-[9998] h-1 rounded-full bg-primary"
          style={{ left: drop.x, top: drop.y, width: document.querySelector<HTMLElement>("[data-component-drop-canvas]")?.getBoundingClientRect().width ?? 0 }} />
      )}
    </aside>
  );
}
