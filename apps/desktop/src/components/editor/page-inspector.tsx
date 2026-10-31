import { useEffect, useState, type FormEvent } from "react";
import { Check, FileCode2, FilePenLine, LayoutTemplate, LockKeyhole, MousePointer2, PanelRight, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioTooltip } from "@/components/studio/studio-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Page } from "@/lib/pages";
import { canvasBlockName, type CanvasBlockSelection } from "@/lib/canvas-blocks";

type ChangeAction = "rename" | "layout" | "visibility" | "group";

const layouts: { value: Page["layout"]; name: string; description: string }[] = [
  { value: "docs", name: "Docs", description: "Navigation and table of contents" },
  { value: "wide", name: "Wide", description: "More room for documentation" },
  { value: "landing", name: "Landing", description: "Full-width introduction page" },
];

/** Page-level properties only. Individual block properties will require a
 * stable content model, not mutations to the generated HTML iframe.
 */
export function PageInspector({
  page, busy, onChange, onEditContent, selectedBlock, onEditBlock, onClearBlock,
  allowTextEdit, onSaveText,
}: {
  page: Page;
  busy: boolean;
  onChange: (action: ChangeAction, id: string, next: string) => void;
  onEditContent: () => void;
  selectedBlock: CanvasBlockSelection | null;
  onEditBlock: () => void;
  onClearBlock: () => void;
  allowTextEdit: boolean;
  onSaveText: (nextText: string) => boolean;
}) {
  const [title, setTitle] = useState(page.title);
  const [navGroup, setNavGroup] = useState(page.navGroup);
  const [textDraft, setTextDraft] = useState(selectedBlock?.text ?? "");
  const [textSaveError, setTextSaveError] = useState(false);
  useEffect(() => {
    setTextDraft(selectedBlock?.text ?? "");
    setTextSaveError(false);
  }, [selectedBlock?.pageId, selectedBlock?.index, selectedBlock?.text]);
  useEffect(() => setTitle(page.title), [page.id, page.title]);
  useEffect(() => setNavGroup(page.navGroup), [page.id, page.navGroup]);
  const trimmed = title.trim();
  const dirty = trimmed !== page.title;

  function saveTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed || !dirty || busy) return;
    onChange("rename", page.id, trimmed);
  }

  return (
    <aside aria-label="Page properties" className="flex h-full w-[270px] shrink-0 flex-col overflow-hidden border-l border-border bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <PanelRight className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Properties</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{selectedBlock ? "Block" : "Page"}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {selectedBlock && (
          <>
            <section aria-label="Selected canvas block" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <MousePointer2 className="size-4 text-primary" />
                  {canvasBlockName(selectedBlock.tagName)}
                </div>
                <StudioTooltip label="Clear selection"><Button size="icon-xs" variant="ghost" aria-label="Clear block selection"
                  onClick={onClearBlock}><X className="size-3.5" /></Button></StudioTooltip>
              </div>
              <p className="line-clamp-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {selectedBlock.text || "Empty block"}
              </p>
              {allowTextEdit && (
                <form className="space-y-2" onSubmit={(event) => {
                  event.preventDefault();
                  setTextSaveError(!onSaveText(textDraft));
                }}>
                  <Label htmlFor="canvas-block-text">Text</Label>
                  <Textarea id="canvas-block-text" aria-label="Edit selected block text"
                    value={textDraft} maxLength={3000} rows={4}
                    disabled={busy} onChange={event => {
                      setTextDraft(event.target.value.replace(/[\r\n]+/g, " "));
                      setTextSaveError(false);
                    }} />
                  <Button type="submit" size="sm" className="w-full"
                    disabled={busy || !textDraft.trim() || textDraft === selectedBlock.text}>
                    <Save className="size-3.5" /> Apply text to page
                  </Button>
                  {textSaveError && <p role="alert" className="text-xs text-destructive">
                    The source changed or cannot be matched safely. Open Edit instead.
                  </p>}
                  <p className="text-[11px] text-muted-foreground">
                    Plain text only. For links, rich formatting or multiple paragraphs, use Edit.
                  </p>
                </form>
              )}
              <Button className="w-full" onClick={onEditBlock} disabled={busy}>
                <FilePenLine className="size-4" /> Edit selected block
              </Button>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Double-click a block on the canvas to open its source in the visual editor.
                Unsupported block types open the page without changing content.
              </p>
            </section>
            <Separator />
          </>
        )}
        <div className="space-y-2">
          <Label htmlFor="studio-page-title">Name</Label>
          <form onSubmit={saveTitle} className="flex gap-2">
            <Input
              id="studio-page-title"
              aria-label="Page title"
              value={title}
              maxLength={100}
              disabled={busy}
              onChange={event => setTitle(event.target.value)}
            />
            <StudioTooltip label="Save page title"><Button type="submit" size="icon" variant="outline" aria-label="Save page title"
              disabled={busy || !dirty || !trimmed}>
              <Save className="size-4" />
            </Button></StudioTooltip>
          </form>
          <p className="break-all font-mono text-[11px] text-muted-foreground">
            docs/{page.id}.md
          </p>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="studio-nav-group">Navigation group</Label>
          <form className="flex gap-2" onSubmit={event => {
            event.preventDefault();
            const value = navGroup.trim();
            if (value && value !== page.navGroup && !busy) onChange("group", page.id, value);
          }}>
            <Input id="studio-nav-group" aria-label="Navigation group" maxLength={60}
              value={navGroup} disabled={busy} placeholder="Documentation"
              onChange={event => setNavGroup(event.target.value)} />
            <Button type="submit" size="icon" variant="outline" aria-label="Save navigation group"
              disabled={busy || !navGroup.trim() || navGroup.trim() === page.navGroup}><Save className="size-4" /></Button>
          </form>
          <p className="text-[11px] text-muted-foreground">Group this page under a heading in the published sidebar.</p>
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="size-4 text-muted-foreground" />
            <p className="text-xs font-semibold">Layout</p>
          </div>
          <div className="grid gap-1.5" role="group" aria-label="Page layout">
            {layouts.map(layout => (
              <button
                type="button"
                key={layout.value}
                disabled={busy}
                aria-pressed={page.layout === layout.value}
                onClick={() => page.layout !== layout.value && onChange("layout", page.id, layout.value)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-50 ${page.layout === layout.value ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-xs font-medium">{layout.name}</span>
                  <span className="text-[11px] leading-relaxed text-muted-foreground">{layout.description}</span>
                </span>
                {page.layout === layout.value && <Check className="mt-0.5 size-4 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <Label htmlFor="studio-page-visibility" className="flex items-center gap-1.5">
              <LockKeyhole className="size-3.5" /> Public page
            </Label>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {page.id === "index" ? "Overview must remain public." : "Private pages are excluded from the exported site."}
            </p>
          </div>
          <Switch
            id="studio-page-visibility"
            checked={page.isPublic}
            disabled={busy || page.id === "index"}
            onCheckedChange={checked => onChange("visibility", page.id, String(checked))}
          />
        </div>
        <Separator />
        <div className="space-y-3">
          <p className="text-xs font-semibold">Page content</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Edit text and blocks in the rich-text editor. The canvas previews the actual site output.
          </p>
          <Button variant="outline" className="w-full justify-start" onClick={onEditContent} disabled={busy}>
            <FilePenLine className="size-4" /> Edit content
          </Button>
          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <FileCode2 className="mt-0.5 size-3.5 shrink-0" />
            Project CSS remains editable from Source in the top toolbar.
          </div>
        </div>
      </div>
    </aside>
  );
}
