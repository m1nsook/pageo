import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, DragEvent as ReactDragEvent } from "react";
import type { Editor } from "@tiptap/core";
import { Blocks, GripVertical, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BLOCKS, type BlockKind } from "@/components/editor/block-catalog";
import { BlockOutline } from "@/components/editor/block-outline";
import { BlockComponentGallery } from "@/components/editor/block-component-gallery";
import { cn } from "@/lib/utils";
import { insertBlockIntoEditor } from "@/lib/block-insertion";
import {
  activeDraggedBlock, beginBlockDrag, canAcceptBlockDrag,
  readBlockDrop, finishBlockDrag,
} from "@/lib/block-drag";

type PointerSession = {
  id: number; kind: BlockKind; x: number; y: number;
  moved: boolean; native: boolean;
};

function targetInEditor(x: number, y: number): boolean {
  const element = document.elementFromPoint(x, y);
  return Boolean(element?.closest("[data-editor-drop-zone]"));
}

export function BlockPalette({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<BlockKind | null>(null);
  const [overEditor, setOverEditor] = useState(false);
  const [insertionStatus, setInsertionStatus] = useState("");
  const pointer = useRef<PointerSession | null>(null);
  const nativeInserted = useRef(false);
  const suppressClick = useRef(false);
  const lastDragPoint = useRef<{ x: number; y: number } | null>(null);

  function insert(kind: BlockKind, point?: { y: number }): boolean {
    if (!editor || disabled) return false;
    const success = insertBlockIntoEditor(editor, kind, point?.y);
    const title = BLOCKS.find(item => item.kind === kind)?.title ?? "Block";
    if (!success) {
      setInsertionStatus("Unable to insert " + title + ". The document was not changed.");
      toast.error("Could not insert " + title);
      return false;
    }
    setInsertionStatus("Inserted " + title + " into the document.");
    return true;
  }

  useEffect(() => {
    if (!editor || disabled) return;

    const over = (event: DragEvent) => {
      if (!canAcceptBlockDrag(event.dataTransfer)) return;
      if (!(event.target instanceof Element) ||
        !event.target.closest("[data-editor-drop-zone]")) {
        setOverEditor(false);
        return;
      }
      lastDragPoint.current = { x: event.clientX, y: event.clientY };
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setOverEditor(true);
    };
    const leave = (event: DragEvent) => {
      if (!(event.relatedTarget instanceof Element) ||
        !event.relatedTarget.closest("[data-editor-drop-zone]")) setOverEditor(false);
    };
    const drop = (event: DragEvent) => {
      if (!(event.target instanceof Element) ||
        !event.target.closest("[data-editor-drop-zone]") ||
        !canAcceptBlockDrag(event.dataTransfer)) return;
      // Handle our drag before ProseMirror's own default text/plain drop.
      event.preventDefault();
      event.stopPropagation();
      nativeInserted.current = true;
      setOverEditor(false);
      const kind = readBlockDrop(event.dataTransfer);
      if (kind && insert(kind, { y: event.clientY })) {
        document.dispatchEvent(new Event("paglora:gallery-block-dropped"));
      }
      finishBlockDrag();
      setDragging(null);
    };
    const endNative = (event: DragEvent) => {
      const kind = activeDraggedBlock();
      if (kind && !nativeInserted.current) {
        // Some WebView2 versions fire dragend without delivering a drop event.
        // Recover only if the released pointer is over this editor; never
        // append at the last selection or drop elsewhere in the application.
        const x = event.clientX || lastDragPoint.current?.x || 0;
        const y = event.clientY || lastDragPoint.current?.y || 0;
        if (targetInEditor(x, y) && insert(kind, { y })) {
          document.dispatchEvent(new Event("paglora:gallery-block-dropped"));
        }
      }
      nativeInserted.current = false;
      lastDragPoint.current = null;
      finishBlockDrag();
      setDragging(null);
      setOverEditor(false);
      pointer.current = null;
    };

    const onPointerMove = (event: PointerEvent) => {
      const started = pointer.current;
      if (!started || started.id !== event.pointerId || started.native) return;
      if (!started.moved && Math.hypot(event.clientX - started.x, event.clientY - started.y) >= 8) {
        started.moved = true;
        setDragging(started.kind);
      }
      if (started.moved) setOverEditor(targetInEditor(event.clientX, event.clientY));
    };
    const onPointerUp = (event: PointerEvent) => {
      const started = pointer.current;
      if (!started || started.id !== event.pointerId) return;
      pointer.current = null;
      if (started.native) return; // Native drop/dragend owns the gesture.
      if (started.moved) {
        suppressClick.current = true;
        if (targetInEditor(event.clientX, event.clientY)) {
          insert(started.kind, { y: event.clientY });
        }
        setDragging(null);
        setOverEditor(false);
      }
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (pointer.current?.id === event.pointerId && !pointer.current.native) {
        pointer.current = null;
        setDragging(null);
        setOverEditor(false);
      }
    };
    // Global capture listeners work even after pointer leaves the sidebar,
    // without setPointerCapture trapping the pointer over the source button.
    document.addEventListener("dragover", over, true);
    document.addEventListener("dragleave", leave, true);
    document.addEventListener("drop", drop, true);
    document.addEventListener("dragend", endNative, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
    return () => {
      document.removeEventListener("dragover", over, true);
      document.removeEventListener("dragleave", leave, true);
      document.removeEventListener("drop", drop, true);
      document.removeEventListener("dragend", endNative, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
      pointer.current = null;
      finishBlockDrag();
    };
  }, [editor, disabled]);

  function startPointer(event: ReactPointerEvent<HTMLButtonElement>, kind: BlockKind) {
    if (!editor || disabled || event.button !== 0) return;
    suppressClick.current = false;
    pointer.current = {
      id: event.pointerId, kind, x: event.clientX, y: event.clientY,
      moved: false, native: false,
    };
  }
  function startNative(event: ReactDragEvent<HTMLButtonElement>, kind: BlockKind) {
    if (!editor || disabled || !beginBlockDrag(event.dataTransfer, kind)) {
      event.preventDefault();
      return;
    }
    if (pointer.current) pointer.current.native = true;
    nativeInserted.current = false;
    lastDragPoint.current = null;
    suppressClick.current = true;
    setDragging(kind);
  }
  function click(kind: BlockKind) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    insert(kind);
  }

  const items = BLOCKS.filter(item => (item.title + " " + item.description).toLowerCase().includes(search.toLowerCase()));
  return (
    <aside aria-label="Document tools" className="flex h-full w-full min-w-0 flex-col border-l border-border bg-card">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="flex items-center gap-2 text-xs font-semibold"><Blocks className="size-4" /> Visual editor</span>
        <BlockComponentGallery disabled={disabled || !editor} onInsert={kind => insert(kind)} />
      </div>
      <Separator />
      <Tabs defaultValue="insert" className="min-h-0 flex-1 gap-0">
        <div className="px-3 pt-3">
          <TabsList className="w-full">
            <TabsTrigger className="flex-1" value="insert">Insert</TabsTrigger>
            <TabsTrigger className="flex-1" value="outline">Blocks</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="insert" className="flex min-h-0 flex-col overflow-hidden">
          <div className="px-3 py-3"><Input aria-label="Filter blocks" placeholder="Search blocks..."
            value={search} onChange={event => setSearch(event.target.value)} /></div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid gap-1 px-3 pb-4">
              {items.map(({ kind, title, description, icon: Icon }) => (
                <Button key={kind} type="button" variant="ghost"
                  disabled={disabled || !editor}
                  draggable={!disabled && Boolean(editor)}
                  className={cn("group h-auto min-h-14 w-full cursor-grab justify-start gap-3 px-2.5 py-2 text-left font-normal select-none active:cursor-grabbing", dragging === kind && "bg-primary/10")}
                  onPointerDown={event => startPointer(event, kind)}
                  onDragStart={event => startNative(event, kind)}
                  onClick={() => click(kind)}
                  aria-label={"Insert " + title}
                  aria-description="Click to insert at the cursor, or drag into the document"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{description}</span></span>
                  <GripVertical className="size-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
                </Button>
              ))}
              {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">No matching blocks.</p>}
            </div>
          </ScrollArea>
          <div className="border-t border-border p-3 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-start gap-2"><Info className="mt-0.5 size-3.5 shrink-0" />
              <span>Click to insert at the cursor or drag onto the page. Inserted blocks are automatically scrolled into view.</span>
            </div>
            {insertionStatus && <p role="status" aria-live="polite" className="mt-2 font-medium">{insertionStatus}</p>}
          </div>
        </TabsContent>
        <TabsContent value="outline" className="min-h-0 overflow-hidden"><BlockOutline editor={editor} disabled={disabled} /></TabsContent>
      </Tabs>
      {dragging && <div role="status" className="border-t border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {overEditor ? "Release to insert block at this location" : "Drag into the page editor"}
      </div>}
    </aside>
  );
}
