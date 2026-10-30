import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Editor } from "@tiptap/core";
import { Blocks, GripVertical, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createMarkdownBlock, BLOCKS, type BlockKind } from "@/components/editor/block-catalog";
import { BlockOutline } from "@/components/editor/block-outline";
import { cn } from "@/lib/utils";

type Drag = { kind: BlockKind; x: number; y: number; active: boolean };

function topLevelDropPos(editor: Editor, y: number): number {
  // Snap to boundaries between top-level nodes: inserting there cannot
  // accidentally split a paragraph, heading, or code block.
  let result = editor.state.doc.content.size;
  editor.state.doc.forEach((node, offset) => {
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
  const [ghost, setGhost] = useState({ x: 0, y: 0 });
  const pointer = useRef<Drag | null>(null);

  function insert(kind: BlockKind, point?: { y: number }) {
    if (!editor || disabled) return;
    const node = createMarkdownBlock(kind);
    if (point) editor.chain().focus().insertContentAt(topLevelDropPos(editor, point.y), node).run();
    else editor.chain().focus().insertContent(node).run();
  }

  function start(event: ReactPointerEvent<HTMLButtonElement>, kind: BlockKind) {
    if (disabled || !editor || event.button !== 0) return;
    pointer.current = { kind, x: event.clientX, y: event.clientY, active: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = pointer.current;
    if (!drag) return;
    if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
    drag.active = true;
    setDragging(drag.kind);
    setGhost({ x: event.clientX, y: event.clientY });
    const element = document.elementFromPoint(event.clientX, event.clientY);
    setOverEditor(Boolean(element instanceof Element && element.closest("[data-editor-drop-zone]")));
  }
  function end(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = pointer.current;
    if (!drag) return;
    pointer.current = null;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const over = element instanceof Element && Boolean(element.closest("[data-editor-drop-zone]"));
    setDragging(null);
    setOverEditor(false);
    if (!drag.active) {
      insert(drag.kind);
    } else if (over) {
      insert(drag.kind, { y: event.clientY });
    }
  }
  function cancel() {
    pointer.current = null;
    setDragging(null);
    setOverEditor(false);
  }

  const items = BLOCKS.filter((item) => (item.title + " " + item.description).toLowerCase().includes(search.toLowerCase()));
  return (
    <aside aria-label="Document tools" className="flex h-full w-[270px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="flex items-center gap-2 text-xs font-semibold"><Blocks className="size-4" /> Visual editor</span>
        <Badge variant="secondary">Markdown</Badge>
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
                  className={cn("group h-auto min-h-14 w-full justify-start gap-3 px-2.5 py-2 text-left font-normal select-none touch-none", dragging === kind && "bg-primary/10")}
                  onPointerDown={(event) => start(event, kind)}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={cancel}
                  onClick={(event) => { if (event.detail === 0) insert(kind); }}
                  aria-label={`Insert ${title}`}
                  title="Click to insert, or drag onto the page"
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
      {dragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[100] flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-xs font-medium text-popover-foreground shadow-lg"
          style={{ left: ghost.x + 14, top: ghost.y + 14 }}>
          <Blocks className="size-3.5" /> {BLOCKS.find(item => item.kind === dragging)?.title}
          {overEditor && <span className="text-emerald-600">Drop to insert</span>}
        </div>
      )}
    </aside>
  );
}
