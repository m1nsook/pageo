import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
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
import { blockDropBoundary, insertBlockIntoEditor } from "@/lib/block-insertion";
import { beginPointerBlock, updatePointerBlock, finishPointerBlock, cancelPointerBlock, activePointerBlock } from "@/lib/block-drag";

function editorDropZone(x: number, y: number): HTMLElement | null {
  const zone = document.querySelector<HTMLElement>("[data-editor-drop-zone]");
  if (!zone) return null;
  const hit = document.elementFromPoint(x, y);
  // Never allow dropping through dialogs, the palette, or another overlay.
  if (hit?.closest('[role="dialog"], [data-slot="dialog-content"]')) return null;
  if (hit?.closest("[data-editor-drop-zone]")) return zone;
  // WebView2 sometimes reports the capture target instead of the element
  // beneath the pointer. The editor rectangle is still an exact local target.
  const rect = zone.getBoundingClientRect();
  return hit?.closest("[data-paglora-project-root]") &&
    x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom ? zone : null;
}
function clearDropHighlight() {
  const zone = document.querySelector("[data-editor-drop-zone]");
  zone?.classList.remove("ring-2", "ring-primary", "ring-inset");
}

export function BlockPalette({ editor, disabled, onInvalidDocument }: { editor: Editor | null; disabled: boolean; onInvalidDocument?: (kind: BlockKind, point?: { y: number }) => boolean }) {
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<BlockKind | null>(null);
  const [overEditor, setOverEditor] = useState(false);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [dropLine, setDropLine] = useState<{ left: number; top: number; width: number } | null>(null);
  const [insertionStatus, setInsertionStatus] = useState("");
  const suppressClick = useRef(false);
  // Save-state rerenders recreate the parent callback. Keep its latest value
  // without cancelling an active WebView2 pointer gesture.
  const invalidDocumentRef = useRef(onInvalidDocument);
  invalidDocumentRef.current = onInvalidDocument;

  function insert(kind: BlockKind, point?: { y: number }): boolean {
    const title = BLOCKS.find(block => block.kind === kind)?.title ?? "Block";
    if (!editor || disabled) return false;
    let explanation = "The document was not changed.";
    let invalidVisualTree = false;
    const success = insertBlockIntoEditor(editor, kind, point?.y, (reason, code) => {
      explanation = reason;
      invalidVisualTree = code === "invalidDocument";
    });
    if (success) {
      setInsertionStatus("Inserted " + title + " into the document.");
      return true;
    }
    // A broken Tiptap parse does NOT mean the .md file is broken. Instead of
    // blocking all 20 components, use the source-preserving fallback supplied
    // by the project editor. Never overwrite the document with editor.getMarkdown().
    if (invalidVisualTree && invalidDocumentRef.current?.(kind, point)) {
      const message = "Inserted " + title + " at the selected Markdown block boundary.";
      setInsertionStatus(message);
      toast.success(title + " placed", { description: "Saved at the selected block, preserving original Markdown." });
      return true;
    }
    setInsertionStatus("Unable to insert " + title + ". " + explanation);
    toast.error("Could not insert " + title, { description: explanation });
    return false;
  }

  useEffect(() => {
    if (!editor || disabled) return;
    // One gesture handler for the sidebar AND the Library (which is a portal).
    // No native DataTransfer or browser drop state is involved.
    const moveAt = (id: number, x: number, y: number) => {
      const session = updatePointerBlock(id, x, y);
      if (!session || !session.moved) return;
      const zone = editorDropZone(x, y);
      document.querySelector("[data-editor-drop-zone]")?.classList.toggle("ring-2", Boolean(zone));
      document.querySelector("[data-editor-drop-zone]")?.classList.toggle("ring-primary", Boolean(zone));
      document.querySelector("[data-editor-drop-zone]")?.classList.toggle("ring-inset", Boolean(zone));
      setDragging(session.kind);
      setOverEditor(Boolean(zone));
      setDragPoint({ x, y });
      if (!zone) { setDropLine(null); return; }

      const boundary = blockDropBoundary(editor, y);
      // Gather DOM block rectangles instead of narrowing variables assigned
      // inside a ProseMirror callback (which TypeScript treats as unchanged).
      const visible: HTMLElement[] = [];
      editor.state.doc.forEach((_node, offset, index) => {
        let el: Node | null = null;
        try { el = editor.view.nodeDOM(offset); } catch { /* optional view */ }
        if (!(el instanceof HTMLElement)) el = editor.view.dom?.children[index] ?? null;
        if (el instanceof HTMLElement) visible[index] = el;
      });
      const target = visible[boundary];
      const last = visible.filter(Boolean).at(-1);
      const zoneRect = zone.getBoundingClientRect();
      const yLine = target ? target.getBoundingClientRect().top
        : last ? last.getBoundingClientRect().bottom : zoneRect.top + 16;
      setDropLine({ left: zoneRect.left, top: yLine, width: zoneRect.width });
    };
    const move = (event: PointerEvent) => {
      moveAt(event.pointerId, event.clientX, event.clientY);
      if (activePointerBlock()?.moved && event.cancelable) event.preventDefault();
    };
    // Some WebView2 builds lose pointermove/up after capture or native selection.
    // Real mouse events recover the same session without HTML5 drag/drop.
    const mouseMove = (event: MouseEvent) => {
      const session = activePointerBlock();
      if (session) moveAt(session.pointerId, event.clientX, event.clientY);
    };
    const releaseAt = (id: number, x: number, y: number) => {
      const session = finishPointerBlock(id, x, y);
      if (!session) return;
      clearDropHighlight();
      setDragging(null);
      setOverEditor(false);
      setDragPoint(null);
      setDropLine(null);
      if (!session.moved) return; // Ordinary click remains available.
      suppressClick.current = true;
      requestAnimationFrame(() => { suppressClick.current = false; });
      if (editorDropZone(x, y) && insert(session.kind, { y })) {
        document.dispatchEvent(new Event("paglora:gallery-block-dropped"));
      }
    };
    const release = (event: PointerEvent) =>
      releaseAt(event.pointerId, event.clientX, event.clientY);
    const mouseUp = (event: MouseEvent) => {
      const session = activePointerBlock();
      if (session) releaseAt(session.pointerId, event.clientX, event.clientY);
    };
    const cancel = (event: PointerEvent) => {
      cancelPointerBlock(event.pointerId);
      clearDropHighlight();
      setDragging(null);
      setOverEditor(false);
      setDragPoint(null);
      setDropLine(null);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("mousemove", mouseMove, true);
    window.addEventListener("mouseup", mouseUp, true);
    return () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("mousemove", mouseMove, true);
      window.removeEventListener("mouseup", mouseUp, true);
      cancelPointerBlock();
      clearDropHighlight();
    };
  }, [editor, disabled]);

  function startPointer(event: ReactPointerEvent<HTMLButtonElement>, kind: BlockKind) {
    if (!editor || disabled || event.button !== 0 || !event.isPrimary) return;
    suppressClick.current = false;
    if (beginPointerBlock(kind, event.pointerId, event.clientX, event.clientY)) {
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* WebView fallback */ }
    }
  }
  function click(kind: BlockKind) {
    if (suppressClick.current) return;
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
                  draggable={false}
                  onDragStart={event => event.preventDefault()}
                  style={{ touchAction: "none" }}
                  className={cn("group h-auto min-h-14 w-full cursor-grab justify-start gap-3 px-2.5 py-2 text-left font-normal select-none active:cursor-grabbing", dragging === kind && "bg-primary/10")}
                  onPointerDown={event => startPointer(event, kind)}
                  onClick={() => click(kind)}
                  aria-label={"Insert " + title}
                  aria-description="Click to insert after the selected block, or drag into the document"
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
              <span>Click to insert after the selected block or drag onto the page. Inserted blocks are automatically scrolled into view.</span>
            </div>
            {insertionStatus && <p role="status" aria-live="polite" className="mt-2 font-medium">{insertionStatus}</p>}
          </div>
        </TabsContent>
        <TabsContent value="outline" className="min-h-0 overflow-hidden"><BlockOutline editor={editor} disabled={disabled} /></TabsContent>
      </Tabs>
      {dragging && dragPoint && <div aria-hidden="true" className="pointer-events-none fixed z-[999] max-w-56 rounded-md border border-primary bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-lg"
        style={{ left: dragPoint.x + 16, top: dragPoint.y + 16 }}>
        {BLOCKS.find(block => block.kind === dragging)?.title ?? "Component"} · {overEditor ? "Release to insert" : "Drag onto page"}
      </div>}
      {dragging && dropLine && <div aria-hidden="true" className="pointer-events-none fixed z-[998] h-0.5 rounded bg-primary shadow-sm"
        style={{ left: dropLine.left, top: dropLine.top, width: dropLine.width }} />}
      {dragging && <div role="status" className="border-t border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {overEditor ? "Release to insert block at this location" : "Drag into the page editor"}
      </div>}
    </aside>
  );
}
