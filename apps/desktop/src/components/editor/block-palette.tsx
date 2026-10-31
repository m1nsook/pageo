import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { Blocks, GripVertical, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createMarkdownBlock, BLOCKS, type BlockKind } from "@/components/editor/block-catalog";
import { BlockOutline } from "@/components/editor/block-outline";
import { BlockComponentGallery } from "@/components/editor/block-component-gallery";
import { cn } from "@/lib/utils";
import { beginBlockDrag, canAcceptBlockDrag, readBlockDrop, finishBlockDrag } from "@/lib/block-drag";

function topLevelDropPos(editor: Editor, y: number): number {
  // Snap to boundaries between top-level nodes: inserting there cannot
  // accidentally split a paragraph, heading, or code block.
  let result = editor.state.doc.content.size;
  editor.state.doc.forEach((_node, offset) => {
    const dom = editor.view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;
    const bounds = dom.getBoundingClientRect();
    if (y < bounds.top + bounds.height / 2 && result === editor.state.doc.content.size) {
      result = offset;
    }
  });
  return result;
}

export function BlockPalette({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<BlockKind | null>(null);
  const [overEditor, setOverEditor] = useState(false);

  function insert(kind: BlockKind, point?: { y: number }) {
    if (!editor || disabled) return;
    const node = createMarkdownBlock(kind);
    if (point) editor.chain().focus().insertContentAt(topLevelDropPos(editor, point.y), node).run();
    else editor.chain().focus().insertContent(node).run();
  }

  // Both sidebar and Gallery now share one browser-native drag/drop route.
  // The in-memory source marker prevents external text or file drops from
  // creating blocks; WebView2 may omit custom MIME on dragover.
  useEffect(() => {
    if (!editor || disabled) return;
    const isValid = (event: DragEvent) => canAcceptBlockDrag(event.dataTransfer) &&
      event.target instanceof Element && Boolean(event.target.closest("[data-editor-drop-zone]"));
    const over = (event: DragEvent) => {
      if (!isValid(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect="copy";
      setOverEditor(true);
    };
    const leave = (event: DragEvent) => {
      if (!(event.relatedTarget instanceof Element) ||
        !event.relatedTarget.closest("[data-editor-drop-zone]")) setOverEditor(false);
    };
    const drop = (event: DragEvent) => {
      if (!isValid(event)) return;
      const kind = readBlockDrop(event.dataTransfer);
      if (!kind) return;
      event.preventDefault();
      event.stopPropagation();
      setOverEditor(false);
      insert(kind, { y: event.clientY });
      finishBlockDrag();
      setDragging(null);
      document.dispatchEvent(new Event("paglora:gallery-block-dropped"));
    };
    document.addEventListener("dragover",over,true);
    document.addEventListener("dragleave",leave,true);
    document.addEventListener("drop",drop,true);
    return () => {
      document.removeEventListener("dragover",over,true);
      document.removeEventListener("dragleave",leave,true);
      document.removeEventListener("drop",drop,true);
    };
  }, [editor,disabled]);

  function dragStart(event: React.DragEvent<HTMLButtonElement>,kind:BlockKind) {
    if (disabled || !editor || !beginBlockDrag(event.dataTransfer,kind)) {
      event.preventDefault(); return;
    }
    setDragging(kind);
  }
  function dragEnd() {
    finishBlockDrag();
    setDragging(null);
    setOverEditor(false);
  }

  const items = BLOCKS.filter((item) => (item.title + " " + item.description).toLowerCase().includes(search.toLowerCase()));
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
          <div className="px-3 py-3"><Input aria-label="Filter blocks" placeholder="Search blocks..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid gap-1 px-3 pb-4">
              {items.map(({ kind, title, description, icon: Icon }) => (
                <Button
                  key={kind}
                  type="button"
                  variant="ghost"
                  disabled={disabled || !editor}
                  draggable={!disabled && Boolean(editor)}
                  className={cn("group h-auto min-h-14 w-full cursor-grab justify-start gap-3 px-2.5 py-2 text-left font-normal select-none active:cursor-grabbing", dragging === kind && "bg-primary/10")}
                  onDragStart={(event) => dragStart(event,kind)}
                  onDragEnd={dragEnd}
                  onClick={() => insert(kind)}
                  aria-label={`Insert ${title}`}
                  aria-description="Click to insert, or drag onto the page"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span><span className="block truncate text-[11px] text-muted-foreground">{description}</span></span>
                  <GripVertical className="size-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
                </Button>
              ))}
              {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">No matching blocks.</p>}
            </div>
          </ScrollArea>
          <div className="border-t border-border p-3 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-start gap-2"><Info className="mt-0.5 size-3.5 shrink-0" /><span>Drag a block onto the page, or click to insert at the caret. These blocks save as normal Markdown.</span></div>
          </div>
        </TabsContent>
        <TabsContent value="outline" className="min-h-0 overflow-hidden"><BlockOutline editor={editor} disabled={disabled} /></TabsContent>
      </Tabs>
      {dragging && <div role="status" className="border-t border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {overEditor ? "Release to insert block into the page" : "Drag over the page editor to insert"}
      </div>}
    </aside>
  );
}
