import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { marked } from "marked";
import { BookOpen, Copy, GripVertical, Plus } from "lucide-react";
import { BLOCKS, type BlockKind } from "@/components/editor/block-catalog";
import { BLOCK_MARKDOWN_EXAMPLES } from "@/lib/block-examples";
import { renderPageContent } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/** The Library uses the exact same source-owned components and drag gesture
 * as the palette. Preview HTML is sanitized by the existing site renderer.
 */
export function BlockComponentGallery({
  disabled, onInsert, onBeginDrag,
}: {
  disabled: boolean;
  onInsert: (kind: BlockKind) => boolean;
  onBeginDrag: (event: ReactPointerEvent<HTMLElement>, kind: BlockKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BlockKind>("card");
  const [search, setSearch] = useState("");
  const blocks = BLOCKS.filter(block =>
    (block.title + " " + block.description).toLowerCase().includes(search.toLowerCase()));
  const item = BLOCKS.find(block => block.kind === selected)!;
  const source = BLOCK_MARKDOWN_EXAMPLES[selected];
  const html = useMemo(
    () => renderPageContent(marked.parse(source, { async: false }) as string, "en").html,
    [source],
  );
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("paglora:component-library-dropped", close);
    return () => document.removeEventListener("paglora:component-library-dropped", close);
  }, [open]);

  return (
    <Dialog modal={false} open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline"><BookOpen className="size-3.5" /> Library</Button>
      </DialogTrigger>
      <DialogContent showOverlay={false}
        className="flex h-[min(84dvh,760px)] max-w-[min(96vw,980px)] flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle>Documentation component library</DialogTitle>
          <DialogDescription>Choose a component. Click Insert at your selected position, or drag from the list onto the document.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-border">
            <div className="p-3"><Input placeholder="Search…" value={search}
              onChange={event => setSearch(event.target.value)} /></div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-1 px-2 pb-3">
                {blocks.map(block => (
                  <button type="button" key={block.kind} draggable={false} disabled={disabled}
                    data-gallery-kind={block.kind}
                    onDragStart={event => event.preventDefault()}
                    onPointerDown={event => onBeginDrag(event, block.kind)}
                    onClick={() => setSelected(block.kind)}
                    style={{ touchAction: "none" }}
                    className={`flex w-full cursor-grab select-none items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-muted active:cursor-grabbing ${selected === block.kind ? "bg-muted font-medium" : ""}`}>
                    <block.icon className="size-4" />
                    <span className="min-w-0 flex-1 truncate">{block.title}</span>
                    <GripVertical className="size-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-border p-4">
              <div><p className="text-sm font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">{item.description}</p></div>
              <Button size="sm" disabled={disabled} onClick={() => { if (onInsert(selected)) setOpen(false); }}>
                <Plus className="size-4" /> Insert
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
              <div className="editor-content !min-h-0" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border p-3">
              <span className="text-xs text-muted-foreground">Stored as ordinary Markdown</span>
              <Button type="button" variant="outline" size="sm" onClick={() => {
                void navigator.clipboard.writeText(source)
                  .then(() => toast.success("Markdown copied"))
                  .catch(() => toast.error("Unable to copy Markdown"));
              }}><Copy className="size-3.5" /> Copy Markdown</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
