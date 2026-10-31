import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Copy, GripVertical, Plus } from "lucide-react";
import { marked } from "marked";
import { toast } from "sonner";
import { BLOCKS, type BlockKind } from "@/components/editor/block-catalog";
import { BLOCK_MARKDOWN_EXAMPLES } from "@/lib/block-examples";
import { nextGalleryKind } from "@/lib/gallery-navigation";
import { beginPointerBlock } from "@/lib/block-drag";
import { renderPageContent } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** A scriptless example frame: its body comes from the *same sanitized*
 * renderer used for Studio previews and exported public documentation.
 */
const FRAME_STYLE = `
:root { color-scheme: light; font-family: system-ui, sans-serif; font-size: 14px; }
body { margin: 0; padding: 22px; color: #22252c; background: #fff; line-height: 1.65; }
h1,h2,h3 { margin: 0 0 14px; line-height: 1.2; letter-spacing: -.025em; }
h1 { font-size: 25px; } h2 { font-size: 20px; }
p { margin: 0 0 12px; } a { color: #2196f3; }
blockquote { margin: 0 0 12px; border-left: 3px solid #2196f3; padding: 9px 14px; background: #f3f7fc; border-radius: 5px; }
pre { overflow: auto; padding: 12px; border-radius: 6px; background: #16181d; color: #f1f1f2; }
code { font-family: ui-monospace, monospace; } ul,ol { padding-left: 22px; }
hr { border: 0; border-top: 1px solid #d8dbe2; }
details { padding: 12px; border: 1px solid #d5dce6; border-radius: 5px; }
.paglora-card, .paglora-callout { border: 1px solid #c8d8eb; border-radius: 8px; padding: 12px; background: #f3f7ff; }
.paglora-steps { border-left: 2px solid #2196f3; padding-left: 14px; }
.paglora-badges { margin: 12px 0; }
.paglora-badges-title { font-weight: 700; margin-bottom: 9px; }
.paglora-badges-row { display: flex; flex-wrap: wrap; gap: 8px; }
.paglora-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid #ccd6e4; font-size: 12px; font-weight: 650; background: #f4f7fb; }
.paglora-badge-info { color: #145da3; border-color: #bad6f5; background: #eaf4ff; }
.paglora-badge-success { color: #116b45; border-color: #a7dcc3; background: #e8f8f0; }
.paglora-badge-warning { color: #815600; border-color: #efd28a; background: #fff6dc; }
.paglora-badge-danger { color: #a12b43; border-color: #f2b3c1; background: #fff0f3; }
.paglora-tabs, .paglora-code-group { border: 1px solid #d6dbe4; border-radius: 8px; padding: 12px; }
`;

function frameHtml(body: string) {
  // Scripts and external resources are disabled both by CSP and iframe sandbox.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; form-action 'none';">
<style>${FRAME_STYLE}</style></head><body>${body}</body></html>`;
}

export function BlockComponentGallery({ disabled, onInsert }: {
  disabled: boolean;
  onInsert: (kind: BlockKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BlockKind>("card");
  const [mode, setMode] = useState<"preview" | "markdown">("preview");
  const [filter, setFilter] = useState("");
  const [rendered, setRendered] = useState("");
  const example = BLOCK_MARKDOWN_EXAMPLES[selected];
  const choose = (kind: BlockKind) => { setSelected(kind); setMode("preview"); };
  const insertSelected = () => { if (!disabled) { onInsert(selected); setOpen(false); } };
  const startPointer = (event: React.PointerEvent<HTMLElement>, kind: BlockKind) => {
    if (disabled || event.button !== 0 || !event.isPrimary) return;
    if (beginPointerBlock(kind, event.pointerId, event.clientX, event.clientY)) {
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* WebView fallback */ }
    }
  };
  useEffect(() => {
    if (!open) return;
    const closeAfterDrop = () => setOpen(false);
    document.addEventListener("paglora:gallery-block-dropped", closeAfterDrop);
    return () => document.removeEventListener("paglora:gallery-block-dropped", closeAfterDrop);
  }, [open]);
  const blocks = useMemo(() => BLOCKS.filter(item =>
    (item.title + " " + item.description).toLowerCase().includes(filter.toLowerCase().trim())), [filter]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void Promise.resolve(marked.parse(example)).then(html => {
      if (!alive) return;
      setRendered(frameHtml(renderPageContent(html, "en").html));
    }).catch(error => {
      console.warn("Component preview failed", error);
      if (alive) setRendered(frameHtml("<p>Preview unavailable. Markdown is still ready to copy or insert.</p>"));
    });
    return () => { alive = false; };
  }, [open, example]);

  const item = BLOCKS.find(block => block.kind === selected)!;
  return (
    <Dialog modal={false} open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><BookOpen className="size-3.5" /> Library</Button>
      </DialogTrigger>
      <DialogContent showOverlay={false} className="flex h-[min(84dvh,760px)] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,980px)]">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <DialogTitle>Documentation component library</DialogTitle>
          <DialogDescription>Explore reusable Paglora blocks. Click Insert, or drag with your pointer outside this non-modal Library onto the page. Use ↑/↓, Home/End and Ctrl+Enter with the keyboard.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,180px)_minmax(0,1fr)] sm:grid-cols-[240px_minmax(0,1fr)] sm:grid-rows-1">
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-border bg-muted/20 sm:border-b-0 sm:border-r">
            <div className="p-3">
              <input value={filter} onChange={event => setFilter(event.target.value)}
                placeholder="Filter components…" aria-label="Filter documentation components"
                onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); const first = blocks[0]; if (first) choose(first.kind); const item = document.querySelector<HTMLButtonElement>('[data-gallery-kind="'+ (first?.kind ?? "") +'"]'); item?.focus(); } }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-1 p-2 pt-0">
                {blocks.map(({ kind, title, icon: Icon }) => (
                  <Button type="button" key={kind} data-gallery-kind={kind} draggable={false}
                    onPointerDown={event => startPointer(event, kind)}
                    onDragStart={event => event.preventDefault()}
                    style={{ touchAction: "none" }}
                    aria-description="Drag onto the editor, or select and click Insert"
                    variant={selected === kind ? "secondary" : "ghost"}
                    className="w-full cursor-grab select-none justify-start gap-2 text-left active:cursor-grabbing" aria-pressed={selected === kind}
                    onClick={() => choose(kind)} onKeyDown={event => {
                      const next = nextGalleryKind(blocks.map(block => block.kind), kind, event.key);
                      if (next) { event.preventDefault(); choose(next); document.querySelector<HTMLButtonElement>('[data-gallery-kind="'+next+'"]')?.focus(); }
                      else if (event.ctrlKey && event.key === "Enter") { event.preventDefault(); insertSelected(); }
                    }}>
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{title}</span>
                    {selected === kind && <Check className="size-3.5 text-primary" />}
                    <GripVertical aria-hidden="true" className="size-3.5 text-muted-foreground/60" />
                  </Button>
                ))}
                {blocks.length === 0 && <p className="p-3 text-xs text-muted-foreground">No matching components.</p>}
              </div>
            </ScrollArea>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.title}</p><p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p></div>
              <div className="flex items-center gap-2">
                <button type="button" disabled={disabled} draggable={false}
                  onPointerDown={event => startPointer(event, selected)}
                  onDragStart={event => event.preventDefault()}
                  style={{ touchAction: "none" }}
                  aria-label={`Drag ${item.title} example into the editor`}
                  className="flex cursor-grab select-none items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed">
                  <GripVertical className="size-3.5" /> Drag to page
                </button>
                <Button size="sm" disabled={disabled} onClick={insertSelected}>
                  <Plus className="size-3.5" /> Insert
                </Button>
              </div>
            </div>
            <Tabs value={mode} onValueChange={value => setMode(value as "preview" | "markdown")} className="min-h-0 min-w-0 flex-1 gap-0">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
                <TabsList>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="markdown">Markdown</TabsTrigger>
                </TabsList>
                <Button variant="ghost" size="sm" onClick={() => {
                  if (!navigator.clipboard?.writeText) return;
                  void navigator.clipboard.writeText(example).then(() => toast.success("Markdown copied"))
                    .catch(() => toast.error("Could not copy Markdown"));
                }}><Copy className="size-3.5" /> Copy source</Button>
              </div>
              <TabsContent value="preview" className="min-h-0 min-w-0 flex-1 overflow-hidden p-4">
                <iframe title={`${item.title} documentation example`} sandbox="" referrerPolicy="no-referrer"
                  srcDoc={rendered} className="block h-full min-h-0 min-w-0 w-full rounded-md border border-border bg-white" />
              </TabsContent>
              <TabsContent value="markdown" className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
                <pre className="min-h-52 whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-4 font-mono text-xs leading-relaxed"><code>{example}</code></pre>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
